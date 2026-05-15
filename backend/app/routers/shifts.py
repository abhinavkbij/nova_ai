from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import timezone

from app.database import get_db
from app.models.shift import Shift
from app.models.work_order import WorkOrderRepair
from app.schemas.shift import ShiftOut, ShiftEndOut

router = APIRouter(tags=["shifts"])


@router.post("/TechnicianDetails/{technician_id}/shift/begin", response_model=ShiftOut)
def begin_shift(
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


@router.get("/v1/Shifts/{shift_id}/end", response_model=ShiftEndOut)
def end_shift(shift_id: int, db: Session = Depends(get_db)):
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")

    from datetime import datetime
    if not shift.end_time:
        shift.end_time = datetime.now(timezone.utc)
        db.commit()
        db.refresh(shift)

    completed = (
        db.query(WorkOrderRepair)
        .filter(WorkOrderRepair.shift_id == shift_id, WorkOrderRepair.is_open == False)
        .count()
    )
    return ShiftEndOut(
        id=shift.id,
        technicianId=shift.technician_id,
        shopId=shift.shop_id,
        beginTime=shift.begin_time,
        endTime=shift.end_time,
        statusIndicator=shift.status_indicator,
        completedRepairsCount=completed,
    )
