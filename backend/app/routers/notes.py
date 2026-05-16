from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.work_order import WorkOrderNote, WorkOrderRepair
from app.models.technician import Technician
from app.schemas.work_order import NoteOut, NoteCreateIn

router = APIRouter(prefix="/workordernotes", tags=["notes"])


def _utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _envelope(data, message: Optional[str] = None) -> dict:
    return {
        "success": True,
        "data": data,
        "message": message,
        "errors": None,
        "timestamp": _utc_timestamp(),
    }


def _note_to_out(note: WorkOrderNote, repair_id: int) -> NoteOut:
    return NoteOut(
        documentId=note.document_id or 0,
        repairId=repair_id,
        noteId=note.id,
        noteSubject=note.subject,
        noteText=note.note,
        createdDate=note.created_at,
        userName=note.user_name or "",
        isWorkOrder=note.is_work_order or False,
    )


@router.get("")
def get_notes(
    repairId: int = Query(...),
    searchString: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    repair = db.query(WorkOrderRepair).filter(WorkOrderRepair.id == repairId).first()
    work_order_id = repair.work_order_id if repair else None

    # match repair notes (repair_id = repairId) and WO notes (document_id = repairId or actual work_order_id)
    doc_ids = {repairId}
    if work_order_id:
        doc_ids.add(work_order_id)

    query = db.query(WorkOrderNote).filter(
        (WorkOrderNote.repair_id == repairId) |
        WorkOrderNote.document_id.in_(doc_ids)
    )

    if searchString:
        query = query.filter(
            WorkOrderNote.subject.ilike(f"%{searchString}%")
            | WorkOrderNote.note.ilike(f"%{searchString}%")
        )

    notes = query.order_by(WorkOrderNote.created_at.desc()).all()
    return _envelope([_note_to_out(n, repairId) for n in notes])


@router.post("", status_code=201)
def add_note(payload: NoteCreateIn, db: Session = Depends(get_db)):
    user_name = ""
    if payload.createdTechnicianID:
        tech = db.query(Technician).filter(Technician.id == payload.createdTechnicianID).first()
        if tech:
            parts = tech.name.split()
            user_name = f"{parts[0]}.{parts[-1][0]}" if len(parts) >= 2 else tech.name

    note = WorkOrderNote(
        document_id=payload.id if payload.isDocument else None,
        repair_id=payload.id if not payload.isDocument else None,
        subject=payload.subject,
        note=payload.note,
        is_work_order=payload.isDocument,
        user_name=user_name,
        created_user_id=payload.createdUserID,
        created_technician_id=payload.createdTechnicianID,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return _envelope(note.id, "Successfully added a note.")
