from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.database import get_db
from app.models.shift import Shift
from app.models.work_order import WorkOrderRepair
from app.schemas.shift import ShiftOut

router = APIRouter(tags=["shifts"])


def _end_shift_response(shift: Shift, db: Session) -> dict:
    had_indirect = bool(shift.status_indicator)

    if not shift.end_time:
        shift.status_indicator = None
        shift.end_time = datetime.now(timezone.utc)
        db.commit()

    return {
        "status": "Success",
        "message": "Indirect labor shift ended successfully." if had_indirect else "Shift ended successfully.",
        "endedDirectLabor": False,
        "endedIndirectLabor": had_indirect,
    }


@router.post("/TechnicianDetails/{technician_id}/shift/begin", response_model=ShiftOut)
def begin_shift_legacy(
    technician_id: int,
    shopId: int = Query(...),
    createdUserId: int = Query(1),
    db: Session = Depends(get_db),
):
    existing = (
        db.query(Shift)
        .filter(Shift.technician_id == technician_id, Shift.end_time.is_(None))
        .first()
    )
    if existing:
        return ShiftOut(
            id=existing.id,
            technicianId=existing.technician_id,
            shopId=existing.shop_id,
            beginTime=existing.begin_time,
            endTime=existing.end_time,
            statusIndicator=existing.status_indicator,
        )
    shift = Shift(
        technician_id=technician_id,
        shop_id=shopId,
        created_user_id=createdUserId,
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return ShiftOut(
        id=shift.id,
        technicianId=shift.technician_id,
        shopId=shift.shop_id,
        beginTime=shift.begin_time,
        endTime=shift.end_time,
        statusIndicator=shift.status_indicator,
    )


@router.get("/v1/Shifts/{shift_id}/end")
def end_shift_by_id(shift_id: int, db: Session = Depends(get_db)):
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    return _end_shift_response(shift, db)


@router.get("/Shifts/{technician_id}/end")
def end_shift_by_technician(technician_id: int, db: Session = Depends(get_db)):
    shift = (
        db.query(Shift)
        .filter(Shift.technician_id == technician_id, Shift.end_time.is_(None))
        .order_by(Shift.begin_time.desc())
        .first()
    )
    if not shift:
        raise HTTPException(status_code=404, detail="No active shift for this technician")
    return _end_shift_response(shift, db)
