from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.shift import Shift


class ShiftNotFoundError(Exception):
    pass


def begin_shift(db: Session, technician_id: int, shop_id: int) -> Shift:
    """Returns the existing active shift if it started today, otherwise ends any stale shift and creates a new one."""
    existing = (
        db.query(Shift)
        .filter(Shift.technician_id == technician_id, Shift.end_time.is_(None))
        .first()
    )
    if existing:
        begin = existing.begin_time
        if begin.tzinfo is None:
            begin = begin.replace(tzinfo=timezone.utc)
        if begin.date() == datetime.now(timezone.utc).date():
            return existing
        existing.end_time = datetime.now(timezone.utc)
        db.commit()

    shift = Shift(
        technician_id=technician_id,
        shop_id=shop_id,
        created_user_id=technician_id,
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return shift


def end_shift_by_technician(db: Session, technician_id: int) -> dict:
    """Ends the active shift for a technician. Raises ShiftNotFoundError if none active."""
    shift = (
        db.query(Shift)
        .filter(Shift.technician_id == technician_id, Shift.end_time.is_(None))
        .order_by(Shift.begin_time.desc())
        .first()
    )
    if not shift:
        raise ShiftNotFoundError(f"No active shift for technician {technician_id}")
    return _end_shift(shift, db)


def end_shift_by_id(db: Session, shift_id: int) -> dict:
    """Ends a shift by its ID. Raises ShiftNotFoundError if not found."""
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise ShiftNotFoundError(f"Shift {shift_id} not found")
    return _end_shift(shift, db)


def _end_shift(shift: Shift, db: Session) -> dict:
    had_indirect = bool(shift.status_indicator)
    if not shift.end_time:
        shift.status_indicator = None
        shift.end_time = datetime.now(timezone.utc)
        db.commit()
    return {
        "status": "Success",
        "message": (
            "Indirect labor shift ended successfully."
            if had_indirect
            else "Shift ended successfully."
        ),
        "endedDirectLabor": False,
        "endedIndirectLabor": had_indirect,
    }
