from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.work_order import WorkOrderNote, WorkOrderRepair
from app.schemas.work_order import NoteOut, NoteCreateIn, NoteUpdateIn
from app.services import notes as notes_service

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
    if payload.isDocument:
        note = notes_service.add_document_note(
            db,
            document_id=payload.id,
            note_text=payload.note,
            subject=payload.subject,
            technician_id=payload.createdTechnicianID,
        )
    else:
        note = notes_service.add_repair_note(
            db,
            repair_id=payload.id,
            note_text=payload.note,
            subject=payload.subject,
            technician_id=payload.createdTechnicianID,
        )
    return _envelope(note.id, "Successfully added a note.")


@router.put("/{note_id}")
def update_note(note_id: int, payload: NoteUpdateIn, db: Session = Depends(get_db)):
    note = db.query(WorkOrderNote).filter(WorkOrderNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    if payload.subject is not None:
        note.subject = payload.subject
    if payload.note is not None:
        note.note = payload.note

    db.commit()
    db.refresh(note)
    return _envelope(_note_to_out(note, note.repair_id or 0), "Successfully updated a note.")
