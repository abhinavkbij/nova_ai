import asyncio
import base64
import json
import os
import ssl
import certifi
from datetime import datetime, timezone

_SSL_CTX = ssl.create_default_context(cafile=certifi.where())
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from google import genai
from google.genai import types

from app.database import SessionLocal
from app.models.work_order import WorkOrderRepair, WorkOrderNote, Task
from app.models.part import Part
from app.models.shift import Shift
from app.models.technician import Technician

router = APIRouter(prefix="/nova", tags=["nova"])

GEMINI_MODEL = "gemini-3.1-flash-live-preview"
PCM_SAMPLE_RATE = 16000

BASE_SYSTEM_PROMPT = """You are Nova, a voice AI assistant embedded in FASTERWEB — an auto-repair shop technician management system.

ROLE: Help technicians manage work orders, parts requests, notes, and shifts using natural voice or text. Technicians are on the shop floor with dirty hands — they cannot easily type or tap.

ACTIVATION: Respond immediately when the technician says any of: "Hey Nova", "Hi Nova", "Nova", "OK Nova", "Okay Nova". These are wake phrases — treat the first thing said after the wake phrase as the command.

BEHAVIOR:
- Be concise. One or two sentences max unless more detail is explicitly requested.
- After completing an action, confirm it briefly: "Done — note added." or "Shift started."
- When showing data, use navigate_to AND the corresponding fetch tool so the UI updates and you can summarize the results.
- Speak naturally — no bullet points, no markdown in voice responses.
- Use the current screen context (provided in [CONTEXT] messages) to understand what the technician is looking at and to fill in missing parameters (e.g. repair_id from the current repair screen).

SCREEN CONTEXT:
You receive [CONTEXT] messages that describe what the technician is currently viewing:
- screen: "home" | "dashboard" | "repairs" | "parts" | "create_work_order" | "repair_detail"
- repairId, woNumber, repairTitle — present when on a repair detail screen
- technicianId, shopId, shopName, role — always present after login

EXAMPLES:
- "Show me my open repairs" → navigate_to(repairs) + set_repairs_tab(open) + get_work_orders(open) → summarize count and top items
- "Show me completed repairs" → navigate_to(repairs) + set_repairs_tab(completed)
- "Show me all repairs" → navigate_to(repairs) + set_repairs_tab(all)
- "Open repair 42" or "Take me to repair 42" → navigate_to_repair(repair_id=42)
- "Show me the notes for repair 42" → navigate_to_repair(repair_id=42, tab="notes")
- "Show me the parts for repair 42" → navigate_to_repair(repair_id=42, tab="parts")
- "Show me the tasks for repair 42" → navigate_to_repair(repair_id=42, tab="tasks")
- "What parts do I have?" → navigate_to(parts) + get_parts_requests(active) → summarize
- "Add a note: engine is misfiring on cylinder 3" → add_note using current repairId from context
- "Begin my shift" → begin_shift
- "End my shift" → end_shift
- "I'm going on lunch" → set_indirect_activity("Break-Lunch")
- "Show me the notes" or "Open notes tab" → set_repair_detail_tab(notes)
- "Show me the parts" → set_repair_detail_tab(parts)
- "Show me the tasks" or "What are my tasks for this repair?" → set_repair_detail_tab(tasks) + get_repair_tasks using current repairId
- "Show me attachments" → set_repair_detail_tab(attachments)
- "Mark this repair complete" → update_work_order_status with status "C"
"""


def _build_system_prompt(tech: Optional[Technician]) -> str:
    if not tech:
        return BASE_SYSTEM_PROMPT
    lines = [
        BASE_SYSTEM_PROMPT,
        f"\nCURRENT SESSION:",
        f"- Technician: {tech.name} (ID: {tech.id})",
        f"- Role: {tech.role or 'Technician'}",
        f"- Shop ID: {tech.shop_id}",
    ]
    if tech.shop:
        lines.append(f"- Shop: {tech.shop.name}")
    return "\n".join(lines)


def _make_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set in environment")
    return genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(async_client_args={"ssl": _SSL_CTX}),
    )


def _make_rest_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set in environment")
    return genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(async_client_args={"verify": certifi.where()}),
    )


def _make_config(system_prompt: str) -> types.LiveConnectConfig:
    tools = types.Tool(
        function_declarations=[
            types.FunctionDeclaration(
                name="navigate_to",
                description="Navigate the technician's UI to a specific section.",
                parameters=types.Schema(
                    type="OBJECT",
                    properties={
                        "section": types.Schema(
                            type="STRING",
                            enum=["repairs", "parts", "home"],
                            description="Which section to navigate to.",
                        )
                    },
                    required=["section"],
                ),
            ),
            types.FunctionDeclaration(
                name="set_repair_detail_tab",
                description="Switch the active tab on the repair detail page (Notes, Parts, Tasks, Attachments).",
                parameters=types.Schema(
                    type="OBJECT",
                    properties={
                        "tab": types.Schema(
                            type="STRING",
                            enum=["notes", "parts", "tasks", "attachments"],
                            description="Which tab to activate on the repair detail page.",
                        )
                    },
                    required=["tab"],
                ),
            ),
            types.FunctionDeclaration(
                name="set_repairs_tab",
                description="Switch the active tab on the repairs screen (All, Open, Completed, Last WO).",
                parameters=types.Schema(
                    type="OBJECT",
                    properties={
                        "tab": types.Schema(
                            type="STRING",
                            enum=["all", "open", "completed", "lastWO"],
                            description="Which repairs tab to activate.",
                        )
                    },
                    required=["tab"],
                ),
            ),
            types.FunctionDeclaration(
                name="navigate_to_repair",
                description="Open the detail page for a specific repair/work order, optionally landing on a specific tab. Use when the technician asks to open, view, or resume a specific repair, or asks to see notes/parts/tasks for a named repair.",
                parameters=types.Schema(
                    type="OBJECT",
                    properties={
                        "repair_id": types.Schema(
                            type="INTEGER",
                            description="The repair (WorkOrderRepair) ID to open.",
                        ),
                        "tab": types.Schema(
                            type="STRING",
                            enum=["notes", "parts", "tasks", "attachments"],
                            description="Which tab to open on the repair detail page. Omit to open the default (notes) tab.",
                        ),
                    },
                    required=["repair_id"],
                ),
            ),
            types.FunctionDeclaration(
                name="get_work_orders",
                description="Fetch the technician's work orders.",
                parameters=types.Schema(
                    type="OBJECT",
                    properties={
                        "status_filter": types.Schema(
                            type="STRING",
                            enum=["open", "closed", "all"],
                            description="Filter by status. Default 'all'.",
                        )
                    },
                ),
            ),
            types.FunctionDeclaration(
                name="get_parts_requests",
                description="Fetch the technician's parts requests.",
                parameters=types.Schema(
                    type="OBJECT",
                    properties={
                        "tab": types.Schema(
                            type="STRING",
                            enum=["active", "past", "all"],
                            description="Filter to active or past requests. Default 'all'.",
                        )
                    },
                ),
            ),
            types.FunctionDeclaration(
                name="begin_shift",
                description="Begin the technician's shift.",
                parameters=types.Schema(type="OBJECT", properties={}),
            ),
            types.FunctionDeclaration(
                name="end_shift",
                description="End the technician's current active shift.",
                parameters=types.Schema(type="OBJECT", properties={}),
            ),
            types.FunctionDeclaration(
                name="set_indirect_activity",
                description="Set the technician's indirect activity status (break, lunch, admin, etc).",
                parameters=types.Schema(
                    type="OBJECT",
                    properties={
                        "activity": types.Schema(
                            type="STRING",
                            description='Activity name, e.g. "Break-Lunch", "Break-break", "Shop Admin Meetings".',
                        )
                    },
                    required=["activity"],
                ),
            ),
            types.FunctionDeclaration(
                name="add_note",
                description="Add a note to a work order repair. Use the repairId from current screen context if not specified.",
                parameters=types.Schema(
                    type="OBJECT",
                    properties={
                        "repair_id": types.Schema(
                            type="INTEGER",
                            description="The repair (WorkOrderRepair) ID to attach the note to.",
                        ),
                        "subject": types.Schema(
                            type="STRING",
                            description="Short subject line for the note.",
                        ),
                        "note_text": types.Schema(
                            type="STRING",
                            description="The body of the note.",
                        ),
                    },
                    required=["repair_id", "note_text"],
                ),
            ),
            types.FunctionDeclaration(
                name="get_repair_tasks",
                description="Fetch the task checklist steps for a specific repair.",
                parameters=types.Schema(
                    type="OBJECT",
                    properties={
                        "repair_id": types.Schema(
                            type="INTEGER",
                            description="The repair ID whose tasks to retrieve.",
                        )
                    },
                    required=["repair_id"],
                ),
            ),
            types.FunctionDeclaration(
                name="update_work_order_status",
                description="Change the status of a work order repair (e.g. mark complete, put on hold).",
                parameters=types.Schema(
                    type="OBJECT",
                    properties={
                        "repair_id": types.Schema(
                            type="INTEGER",
                            description="The repair ID to update.",
                        ),
                        "status_code": types.Schema(
                            type="STRING",
                            description='Status code: "A" = Active/Open, "C" = Complete, "H" = Hold.',
                        ),
                    },
                    required=["repair_id", "status_code"],
                ),
            ),
            types.FunctionDeclaration(
                name="set_repair_reason",
                description="Set the repair reason on a work order repair.",
                parameters=types.Schema(
                    type="OBJECT",
                    properties={
                        "repair_id": types.Schema(type="INTEGER", description="The repair ID."),
                        "reason_id": types.Schema(type="INTEGER", description="The reason ID to assign."),
                    },
                    required=["repair_id", "reason_id"],
                ),
            ),
        ]
    )

    return types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Aoede")
            ),
            language_code="en-US",
        ),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(disabled=True)
        ),
        system_instruction=types.Content(parts=[types.Part(text=system_prompt)]),
        tools=[tools],
    )


async def _execute_tool(
    name: str,
    args: dict,
    technician_id: Optional[int],
    ws: WebSocket,
) -> dict:
    db = SessionLocal()
    try:
        if name == "navigate_to":
            section = args.get("section", "repairs")
            await ws.send_text(json.dumps({"type": "action", "action": "navigate", "section": section}))
            return {"success": True, "navigated_to": section}

        elif name == "set_repair_detail_tab":
            tab = args.get("tab", "notes")
            await ws.send_text(json.dumps({"type": "action", "action": "set_repair_detail_tab", "tab": tab}))
            return {"success": True, "tab": tab}

        elif name == "set_repairs_tab":
            tab = args.get("tab", "all")
            await ws.send_text(json.dumps({"type": "action", "action": "set_repairs_tab", "tab": tab}))
            return {"success": True, "tab": tab}

        elif name == "navigate_to_repair":
            repair_id = args.get("repair_id")
            if not repair_id:
                return {"error": "repair_id is required"}
            repair = db.query(WorkOrderRepair).filter(WorkOrderRepair.id == repair_id).first()
            if not repair:
                return {"error": f"Repair {repair_id} not found"}
            tab = args.get("tab")
            msg = {"type": "action", "action": "navigate_repair", "repair_id": repair_id}
            if tab:
                msg["tab"] = tab
            await ws.send_text(json.dumps(msg))
            return {"success": True, "repair_id": repair_id}

        elif name == "get_work_orders":
            status_filter = args.get("status_filter", "all")
            query = db.query(WorkOrderRepair)
            if technician_id:
                query = query.filter(WorkOrderRepair.technician_id == technician_id)
            if status_filter == "open":
                query = query.filter(WorkOrderRepair.is_open == True)
            elif status_filter == "closed":
                query = query.filter(WorkOrderRepair.is_open == False)
            rows = query.limit(20).all()
            work_orders = [
                {
                    "wo_number": r.wo_number,
                    "title": r.title,
                    "priority": r.priority,
                    "parts_status": r.parts_status,
                    "status": "open" if r.is_open else "closed",
                    "repair_code": r.repair_code,
                    "repair_id": r.id,
                }
                for r in rows
            ]
            return {"count": len(work_orders), "work_orders": work_orders}

        elif name == "get_parts_requests":
            tab = args.get("tab", "all")
            query = db.query(Part)
            if technician_id:
                query = query.filter(Part.technician_id == technician_id)
            if tab == "active":
                query = query.filter(Part.request_part_status_id.in_([1, 2]))
            elif tab == "past":
                query = query.filter(Part.request_part_status_id == 3)
            rows = query.limit(20).all()
            parts = [
                {
                    "part_name": r.part_name,
                    "wo_number": r.wo_number,
                    "repair_code": r.repair_code,
                    "qty": r.requested_qty,
                    "status_id": r.request_part_status_id,
                }
                for r in rows
            ]
            return {"count": len(parts), "parts": parts}

        elif name == "begin_shift":
            if not technician_id:
                return {"error": "No technician session active"}
            tech = db.query(Technician).filter(Technician.id == technician_id).first()
            if not tech:
                return {"error": "Technician not found"}
            existing = (
                db.query(Shift)
                .filter(Shift.technician_id == technician_id, Shift.end_time.is_(None))
                .first()
            )
            if existing:
                begin_time = existing.begin_time.isoformat() if existing.begin_time else datetime.now(timezone.utc).isoformat()
                await ws.send_text(json.dumps({"type": "action", "action": "begin_shift", "begin_time": begin_time, "shift_id": existing.id}))
                return {"success": True, "message": "Shift already active", "shift_id": existing.id}
            shop_id = tech.shop_id or 1
            shift = Shift(technician_id=technician_id, shop_id=shop_id, created_user_id=technician_id)
            db.add(shift)
            db.commit()
            db.refresh(shift)
            begin_time = shift.begin_time.isoformat() if shift.begin_time else datetime.now(timezone.utc).isoformat()
            await ws.send_text(json.dumps({"type": "action", "action": "begin_shift", "begin_time": begin_time, "shift_id": shift.id}))
            return {"success": True, "message": "Shift started", "shift_id": shift.id}

        elif name == "end_shift":
            if not technician_id:
                return {"error": "No technician session active"}
            shift = (
                db.query(Shift)
                .filter(Shift.technician_id == technician_id, Shift.end_time.is_(None))
                .first()
            )
            if not shift:
                return {"error": "No active shift found"}
            shift.end_time = datetime.now(timezone.utc)
            db.commit()
            await ws.send_text(json.dumps({"type": "action", "action": "end_shift", "shift_id": shift.id}))
            return {"success": True, "message": "Shift ended"}

        elif name == "set_indirect_activity":
            activity = args.get("activity", "")
            await ws.send_text(json.dumps({"type": "action", "action": "set_indirect_activity", "activity": activity}))
            return {"success": True, "activity": activity}

        elif name == "add_note":
            repair_id = args.get("repair_id")
            note_text = args.get("note_text", "")
            subject = args.get("subject", "Nova Note")
            if not repair_id:
                return {"error": "repair_id is required"}
            note = WorkOrderNote(
                repair_id=repair_id,
                subject=subject,
                note=note_text,
                created_technician_id=technician_id,
                created_user_id=technician_id,
            )
            db.add(note)
            db.commit()
            db.refresh(note)
            # Signal frontend to refresh notes
            await ws.send_text(json.dumps({"type": "action", "action": "refresh_notes", "repair_id": repair_id}))
            return {"success": True, "note_id": note.id, "subject": subject}

        elif name == "get_repair_tasks":
            repair_id = args.get("repair_id")
            if not repair_id:
                return {"error": "repair_id is required"}
            tasks = db.query(Task).filter(Task.repair_id == repair_id).order_by(Task.step_number).all()
            return {
                "count": len(tasks),
                "tasks": [
                    {
                        "step": t.step_number,
                        "name": t.task_name,
                        "result": t.result_name,
                        "comment": t.comment,
                    }
                    for t in tasks
                ],
            }

        elif name == "update_work_order_status":
            repair_id = args.get("repair_id")
            status_code = args.get("status_code", "A")
            if not repair_id:
                return {"error": "repair_id is required"}
            repair = db.query(WorkOrderRepair).filter(WorkOrderRepair.id == repair_id).first()
            if not repair:
                return {"error": f"Repair {repair_id} not found"}
            repair.wo_status_code = status_code
            if status_code == "C":
                repair.is_open = False
            elif status_code == "A":
                repair.is_open = True
            db.commit()
            await ws.send_text(json.dumps({"type": "action", "action": "refresh_repair", "repair_id": repair_id}))
            return {"success": True, "repair_id": repair_id, "status_code": status_code}

        elif name == "set_repair_reason":
            repair_id = args.get("repair_id")
            reason_id = args.get("reason_id")
            if not repair_id or reason_id is None:
                return {"error": "repair_id and reason_id are required"}
            repair = db.query(WorkOrderRepair).filter(WorkOrderRepair.id == repair_id).first()
            if not repair:
                return {"error": f"Repair {repair_id} not found"}
            repair.reason_id = reason_id
            db.commit()
            return {"success": True, "repair_id": repair_id, "reason_id": reason_id}

        return {"error": f"Unknown tool: {name}"}
    finally:
        db.close()


async def _recv_from_frontend(
    session: genai.live.AsyncSession,
    ws: WebSocket,
    technician_id: Optional[int],
):
    """Forward messages from the browser to the Gemini session."""
    try:
        while True:
            msg = await ws.receive()
            if msg["type"] == "websocket.disconnect":
                break

            if "text" in msg:
                data = json.loads(msg["text"])
                msg_type = data.get("type")

                if msg_type == "audio":
                    await session.send_realtime_input(
                        audio=types.Blob(
                            data=base64.b64decode(data["data"]),
                            mime_type=f"audio/pcm;rate={PCM_SAMPLE_RATE}",
                        )
                    )

                elif msg_type == "audio_start":
                    await session.send_realtime_input(activity_start=types.ActivityStart())

                elif msg_type == "audio_end":
                    await session.send_realtime_input(activity_end=types.ActivityEnd())

                elif msg_type == "text":
                    content = data.get("content", "").strip()
                    if content:
                        await session.send_client_content(
                            turns=types.Content(role="user", parts=[types.Part(text=content)]),
                            turn_complete=True,
                        )

                elif msg_type == "context_update":
                    # Inject current screen context into the live session so Gemini
                    # knows what the technician is looking at without needing to ask.
                    ctx = {k: v for k, v in data.items() if k != "type" and v is not None}
                    context_text = "[CONTEXT] " + json.dumps(ctx)
                    await session.send_client_content(
                        turns=types.Content(role="user", parts=[types.Part(text=context_text)]),
                        turn_complete=False,
                    )

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[Nova] recv_from_frontend error: {e}")


async def _recv_from_gemini(
    session: genai.live.AsyncSession,
    ws: WebSocket,
    technician_id: Optional[int],
):
    """Forward Gemini responses to the browser, handle tool calls."""
    try:
        while True:
            async for response in session.receive():
                if response.go_away:
                    print(f"[Nova] Gemini GoAway; time_left={response.go_away.time_left}")
                    try:
                        await ws.send_text(json.dumps({"type": "status", "state": "connecting"}))
                    except Exception:
                        pass
                    await session.close()
                    return

                sc = response.server_content

                # Audio chunks
                if sc and sc.model_turn and sc.model_turn.parts:
                    for part in sc.model_turn.parts:
                        if part.inline_data and part.inline_data.data:
                            await ws.send_text(json.dumps({
                                "type": "audio",
                                "data": base64.b64encode(part.inline_data.data).decode(),
                            }))

                # Text chunks
                text_parts = []
                if sc and sc.model_turn and sc.model_turn.parts:
                    text_parts = [p.text for p in sc.model_turn.parts if p.text]
                if text_parts:
                    await ws.send_text(json.dumps({
                        "type": "text", "role": "assistant", "text": "".join(text_parts)
                    }))

                # Voice transcripts
                if sc:
                    if sc.input_transcription and sc.input_transcription.text:
                        await ws.send_text(json.dumps({
                            "type": "transcript", "role": "user",
                            "text": sc.input_transcription.text,
                        }))
                    if sc.output_transcription and sc.output_transcription.text:
                        await ws.send_text(json.dumps({
                            "type": "transcript", "role": "assistant",
                            "text": sc.output_transcription.text,
                        }))

                # Tool calls
                if response.tool_call:
                    await ws.send_text(json.dumps({"type": "status", "state": "thinking"}))
                    fn_responses = []
                    for fn_call in response.tool_call.function_calls:
                        result = await _execute_tool(fn_call.name, dict(fn_call.args), technician_id, ws)
                        fn_responses.append(
                            types.FunctionResponse(
                                name=fn_call.name,
                                id=fn_call.id,
                                response=result,
                            )
                        )
                    await session.send_tool_response(function_responses=fn_responses)

                # Turn complete
                if response.server_content and response.server_content.turn_complete:
                    await ws.send_text(json.dumps({"type": "status", "state": "idle"}))
                    break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[Nova] recv_from_gemini error: {e}")
        try:
            await ws.send_text(json.dumps({"type": "error", "message": str(e)}))
        except Exception:
            pass


@router.websocket("/ws")
async def nova_ws(ws: WebSocket, technicianId: Optional[str] = Query(None)):
    await ws.accept()

    tech_id: Optional[int] = None
    if technicianId and technicianId.isdigit():
        tech_id = int(technicianId)

    # Load technician for personalized system prompt
    db = SessionLocal()
    try:
        tech = db.query(Technician).filter(Technician.id == tech_id).first() if tech_id else None
        system_prompt = _build_system_prompt(tech)
    finally:
        db.close()

    try:
        client = _make_client()
    except ValueError as e:
        await ws.send_text(json.dumps({"type": "error", "message": str(e)}))
        await ws.close()
        return

    try:
        async with client.aio.live.connect(model=GEMINI_MODEL, config=_make_config(system_prompt)) as session:
            await ws.send_text(json.dumps({"type": "status", "state": "connected"}))

            t1 = asyncio.create_task(_recv_from_frontend(session, ws, tech_id))
            t2 = asyncio.create_task(_recv_from_gemini(session, ws, tech_id))

            done, pending = await asyncio.wait([t1, t2], return_when=asyncio.FIRST_COMPLETED)
            for task in pending:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[Nova] session error: {e}")
        try:
            await ws.send_text(json.dumps({"type": "error", "message": str(e)}))
        except Exception:
            pass
    finally:
        try:
            await ws.close()
        except Exception:
            pass


# ── STT transcription endpoint ────────────────────────────────────────────────
from fastapi import UploadFile, File, Form  # noqa: E402

@router.post("/stt/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    stream: Optional[str] = Form("false"),
):
    audio_bytes = await file.read()
    content_type = file.content_type or "audio/webm"

    try:
        client = _make_rest_client()
        response = await client.aio.models.generate_content(
            model="gemini-2.0-flash",
            contents=types.Content(
                parts=[
                    types.Part(inline_data=types.Blob(data=audio_bytes, mime_type=content_type)),
                    types.Part(text="Transcribe the spoken audio. Return only the transcribed text with no commentary."),
                ]
            ),
        )
        text = response.text.strip() if response.text else ""
        return {"text": text}
    except Exception as e:
        print(f"[STT] transcription error: {e}")
        return {"text": "", "error": str(e)}
