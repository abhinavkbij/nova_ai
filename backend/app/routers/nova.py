import asyncio
import base64
import json
import os
import ssl
import certifi
from datetime import datetime, timezone

# Build a certifi-backed SSL context once and reuse it everywhere.
# The google-genai Live API reads async_client_args["ssl"] when opening its
# websocket, so we inject this context directly into HttpOptions below.
_SSL_CTX = ssl.create_default_context(cafile=certifi.where())
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from google import genai
from google.genai import types

from app.database import SessionLocal
from app.models.work_order import WorkOrderRepair
from app.models.part import Part
from app.models.shift import Shift
from app.models.technician import Technician

router = APIRouter(prefix="/nova", tags=["nova"])

# GEMINI_MODEL = "gemini-live-2.5-flash-preview"
GEMINI_MODEL = "gemini-3.1-flash-live-preview"
PCM_SAMPLE_RATE = 16000

SYSTEM_PROMPT = """You are Nova, a voice AI assistant built into FASTERWEB — an auto-repair shop technician management system.

Your job is to help technicians manage their work orders, parts requests, and shifts using natural voice or text commands. Technicians are busy working in a shop — they may have dirty hands and can't easily use touch screens.

BEHAVIOR:
- Be concise and direct. One or two sentences max unless more detail is explicitly requested.
- Confirm actions after you take them (e.g. "Done, I've ended your shift.")
- When asked to show something, use navigate_to AND the corresponding fetch tool so both the UI updates and you have data to summarize.
- Speak naturally — avoid bullet points or markdown in spoken responses.

EXAMPLES OF COMMANDS:
- "Show me my open repairs" → navigate to repairs, fetch and summarize open work orders
- "What parts do I have requested?" → navigate to parts, fetch and summarize active parts requests
- "Begin my shift" → call begin_shift
- "End my shift" → call end_shift
- "I'm going on lunch" → call set_indirect_activity with "Break-Lunch"
- "Switch to parts" → navigate to parts section
"""


def _make_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set in environment")
    # Pass the certifi SSL context via async_client_args so the Live API's
    # internal websocket connection uses it instead of the broken macOS default.
    return genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(
            async_client_args={"ssl": _SSL_CTX}
        ),
    )


def _make_config() -> types.LiveConnectConfig:
    tools = types.Tool(
        function_declarations=[
            types.FunctionDeclaration(
                name="navigate_to",
                description="Navigate the technician's UI to a specific section of the dashboard.",
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
                name="get_work_orders",
                description="Fetch the technician's work orders from the database.",
                parameters=types.Schema(
                    type="OBJECT",
                    properties={
                        "status_filter": types.Schema(
                            type="STRING",
                            enum=["open", "closed", "all"],
                            description="Filter by open or closed status. Default is 'all'.",
                        )
                    },
                ),
            ),
            types.FunctionDeclaration(
                name="get_parts_requests",
                description="Fetch the technician's parts requests from the database.",
                parameters=types.Schema(
                    type="OBJECT",
                    properties={
                        "tab": types.Schema(
                            type="STRING",
                            enum=["active", "past", "all"],
                            description="Filter to active or past requests. Default is 'all'.",
                        )
                    },
                ),
            ),
            types.FunctionDeclaration(
                name="begin_shift",
                description="Begin the technician's shift. Creates a new shift record in the system.",
                parameters=types.Schema(type="OBJECT", properties={}),
            ),
            types.FunctionDeclaration(
                name="end_shift",
                description="End the technician's current active shift.",
                parameters=types.Schema(type="OBJECT", properties={}),
            ),
            types.FunctionDeclaration(
                name="set_indirect_activity",
                description="Set the technician's current indirect activity status (e.g. break, lunch, admin).",
                parameters=types.Schema(
                    type="OBJECT",
                    properties={
                        "activity": types.Schema(
                            type="STRING",
                            description='The activity name, e.g. "Break-Lunch", "Break-break", "Shop Admin Meetings".',
                        )
                    },
                    required=["activity"],
                ),
            ),
        ]
    )

    return types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Aoede")
            )
        ),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(
                disabled=True
            )
        ),
        system_instruction=types.Content(
            parts=[types.Part(text=SYSTEM_PROMPT)]
        ),
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
                }
                for r in rows
            ]
            return {"count": len(work_orders), "work_orders": work_orders}

        elif name == "get_parts_requests":
            tab = args.get("tab", "all")
            query = db.query(Part)
            if technician_id:
                query = query.filter(Part.technician_id == technician_id)
            # status IDs: 1=Requested, 2=Issued, 3=Cancelled (adjust to match seed data)
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
                await ws.send_text(json.dumps({"type": "action", "action": "begin_shift"}))
                return {"success": True, "message": "Shift already active", "shift_id": existing.id}
            shop_id = tech.shop_id or 1
            shift = Shift(technician_id=technician_id, shop_id=shop_id, created_user_id=technician_id)
            db.add(shift)
            db.commit()
            db.refresh(shift)
            await ws.send_text(json.dumps({"type": "action", "action": "begin_shift"}))
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
            await ws.send_text(json.dumps({"type": "action", "action": "end_shift"}))
            return {"success": True, "message": "Shift ended"}

        elif name == "set_indirect_activity":
            activity = args.get("activity", "")
            await ws.send_text(json.dumps({"type": "action", "action": "set_indirect_activity", "activity": activity}))
            return {"success": True, "activity": activity}

        return {"error": f"Unknown tool: {name}"}
    finally:
        db.close()


async def _recv_from_frontend(session: genai.live.AsyncSession, ws: WebSocket):
    """Forward messages from the browser WebSocket to the Gemini session."""
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
                    await session.send_realtime_input(
                        activity_start=types.ActivityStart()
                    )

                elif msg_type == "audio_end":
                    await session.send_realtime_input(
                        activity_end=types.ActivityEnd()
                    )

                elif msg_type == "text":
                    content = data.get("content", "").strip()
                    if content:
                        await session.send_client_content(
                            turns=types.Content(role="user", parts=[types.Part(text=content)]),
                            turn_complete=True,
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
    """Forward Gemini responses to the browser WebSocket, handle tool calls."""
    try:
        while True:
            async for response in session.receive():
                if response.go_away:
                    print(f"[Nova] Gemini GoAway received; closing live session. time_left={response.go_away.time_left}")
                    try:
                        await ws.send_text(json.dumps({"type": "status", "state": "connecting"}))
                    except Exception:
                        pass
                    await session.close()
                    return

                sc = response.server_content

                # Audio — use the documented model_turn.parts pattern (response.data
                # shortcut is unreliable for VAD-triggered audio responses)
                if sc and sc.model_turn and sc.model_turn.parts:
                    for part in sc.model_turn.parts:
                        if part.inline_data and part.inline_data.data:
                            await ws.send_text(json.dumps({
                                "type": "audio",
                                "data": base64.b64encode(part.inline_data.data).decode(),
                            }))

                # Text chunks. Avoid response.text here because the SDK logs a
                # warning for audio responses that also contain inline_data.
                text_parts = []
                if sc and sc.model_turn and sc.model_turn.parts:
                    text_parts = [
                        part.text for part in sc.model_turn.parts if part.text
                    ]
                if text_parts:
                    await ws.send_text(json.dumps({
                        "type": "text", "role": "assistant", "text": "".join(text_parts)
                    }))

                # Transcripts (voice input/output)
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
                        result = await _execute_tool(
                            fn_call.name, dict(fn_call.args), technician_id, ws
                        )
                        fn_responses.append(
                            types.FunctionResponse(
                                name=fn_call.name,
                                id=fn_call.id,
                                response=result,
                            )
                        )
                    await session.send_tool_response(function_responses=fn_responses)

                # Turn complete signal
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

    try:
        client = _make_client()
    except ValueError as e:
        await ws.send_text(json.dumps({"type": "error", "message": str(e)}))
        await ws.close()
        return

    try:
        async with client.aio.live.connect(model=GEMINI_MODEL, config=_make_config()) as session:
            await ws.send_text(json.dumps({"type": "status", "state": "connected"}))

            t1 = asyncio.create_task(_recv_from_frontend(session, ws))
            t2 = asyncio.create_task(_recv_from_gemini(session, ws, tech_id))

            done, pending = await asyncio.wait(
                [t1, t2], return_when=asyncio.FIRST_COMPLETED
            )
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


# ── Legacy STT stub (kept for API compatibility) ──────────────────────────────
from fastapi import UploadFile, File, Form  # noqa: E402

@router.post("/stt/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    stream: Optional[str] = Form("false"),
):
    await file.read()
    return {"text": "Use the /api/nova/ws WebSocket endpoint for real-time transcription."}
