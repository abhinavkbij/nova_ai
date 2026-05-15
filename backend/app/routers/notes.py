from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.work_order import WorkOrderNote
from app.schemas.work_order import NoteOut, NoteCreateIn

router = APIRouter(prefix="/workordernotes", tags=["notes"])


@router.get("", response_model=List[NoteOut])
def get_notes(
    repairId: int = Query(...),
    searchString: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(WorkOrderNote).filter(WorkOrderNote.repair_id == repairId)
    if searchString:
        query = query.filter(
            WorkOrderNote.subject.ilike(f"%{searchString}%")
            | WorkOrderNote.note.ilike(f"%{searchString}%")
        )
    notes = query.order_by(WorkOrderNote.created_at.desc()).all()
    return [
        NoteOut(
            id=n.id,
            repairId=n.repair_id,
            subject=n.subject,
            note=n.note,
            isDocument=n.is_document,
            isPending=n.is_pending,
            createdUserID=n.created_user_id,
            createdTechnicianID=n.created_technician_id,
            createdAt=n.created_at,
        )
        for n in notes
    ]


@router.post("", response_model=NoteOut, status_code=201)
def add_note(payload: NoteCreateIn, db: Session = Depends(get_db)):
    note = WorkOrderNote(
        repair_id=payload.id,
        subject=payload.subject,
        note=payload.note,
        is_document=payload.isDocument,
        is_pending=payload.isPending,
        created_user_id=payload.createdUserID,
        created_technician_id=payload.createdTechnicianID,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return NoteOut(
        id=note.id,
        repairId=note.repair_id,
        subject=note.subject,
        note=note.note,
        isDocument=note.is_document,
        isPending=note.is_pending,
        createdUserID=note.created_user_id,
        createdTechnicianID=note.created_technician_id,
        createdAt=note.created_at,
    )
