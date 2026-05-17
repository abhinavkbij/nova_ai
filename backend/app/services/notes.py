from sqlalchemy.orm import Session

from app.models.technician import Technician
from app.models.work_order import WorkOrderNote


def add_repair_note(
    db: Session,
    repair_id: int,
    note_text: str,
    subject: str,
    technician_id: int | None = None,
) -> WorkOrderNote:
    """Create a note attached to a repair. Resolves technician display name automatically."""
    user_name = _resolve_user_name(db, technician_id)
    note = WorkOrderNote(
        repair_id=repair_id,
        subject=subject,
        note=note_text,
        user_name=user_name,
        created_user_id=technician_id,
        created_technician_id=technician_id,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def add_document_note(
    db: Session,
    document_id: int,
    note_text: str,
    subject: str,
    technician_id: int | None = None,
) -> WorkOrderNote:
    """Create a note attached to a work order document."""
    user_name = _resolve_user_name(db, technician_id)
    note = WorkOrderNote(
        document_id=document_id,
        is_work_order=True,
        subject=subject,
        note=note_text,
        user_name=user_name,
        created_user_id=technician_id,
        created_technician_id=technician_id,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def _resolve_user_name(db: Session, technician_id: int | None) -> str:
    if not technician_id:
        return ""
    tech = db.query(Technician).filter(Technician.id == technician_id).first()
    if not tech:
        return ""
    parts = tech.name.split()
    return f"{parts[0]}.{parts[-1][0]}" if len(parts) >= 2 else tech.name
