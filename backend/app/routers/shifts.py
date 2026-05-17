from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.shift import ShiftOut
from app.services import shifts as shift_service
from app.services.shifts import ShiftNotFoundError

router = APIRouter(tags=["shifts"])


@router.post("/TechnicianDetails/{technician_id}/shift/begin", response_model=ShiftOut)
def begin_shift_legacy(
    technician_id: int,
    shopId: int = Query(...),
    createdUserId: int = Query(1),
    db: Session = Depends(get_db),
):
    shift = shift_service.begin_shift(db, technician_id, shopId)
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
    try:
        return shift_service.end_shift_by_id(db, shift_id)
    except ShiftNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/Shifts/{technician_id}/end")
def end_shift_by_technician(technician_id: int, db: Session = Depends(get_db)):
    try:
        return shift_service.end_shift_by_technician(db, technician_id)
    except ShiftNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
