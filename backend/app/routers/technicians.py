from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone
import math
from pydantic import BaseModel

from app.database import get_db
from app.models.technician import Technician
from app.models.shift import Shift
from app.models.lookup import IndirectActivity
from app.schemas.technician import TechnicianOut, PaginatedTechnicians, PinAuthOut
from app.schemas.shift import StatusIndicatorOut
from app.schemas.lookup import IndirectActivityOut


class IndirectActivitySubmit(BaseModel):
    repairGroupComponentActionID: int


class BeginShiftIn(BaseModel):
    technicianId: int
    shopId: int

router = APIRouter(prefix="/technicians", tags=["technicians"])


@router.get("", response_model=PaginatedTechnicians)
def list_technicians(
    page: int = Query(1, ge=1),
    pageSize: int = Query(18, ge=1, le=100),
    shopId: Optional[int] = Query(None),
    technicianName: Optional[str] = Query(None),
    sort: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Technician)
    if shopId:
        query = query.filter(Technician.shop_id == shopId)
    if technicianName:
        query = query.filter(Technician.name.ilike(f"%{technicianName}%"))
    if sort and sort.lower() == "desc":
        query = query.order_by(Technician.name.desc())
    else:
        query = query.order_by(Technician.name.asc())

    total = query.count()
    technicians = query.offset((page - 1) * pageSize).limit(pageSize).all()

    data = []
    for t in technicians:
        data.append(TechnicianOut(
            id=t.id,
            name=t.name,
            email=t.email,
            role=t.role,
            shopId=t.shop_id,
            shopName=t.shop.name if t.shop else None,
        ))

    return PaginatedTechnicians(
        data=data,
        total=total,
        page=page,
        pageSize=pageSize,
        totalPages=max(1, math.ceil(total / pageSize)),
    )


@router.post("/begin-shift")
def begin_shift(payload: BeginShiftIn, db: Session = Depends(get_db)):
    from app.models.shift import Shift

    existing = (
        db.query(Shift)
        .filter(Shift.technician_id == payload.technicianId, Shift.end_time.is_(None))
        .first()
    )
    if existing:
        shift = existing
        started = False
    else:
        shift = Shift(
            technician_id=payload.technicianId,
            shop_id=payload.shopId,
            created_user_id=1,
        )
        db.add(shift)
        db.commit()
        db.refresh(shift)
        started = True

    return {
        "success": True,
        "data": {
            "shiftStarted": started,
            "isOvertime": False,
            "shiftId": shift.id,
            "technicianId": shift.technician_id,
            "shiftStartTime": shift.begin_time,
        },
        "message": "Shift started successfully." if started else "Active shift already exists.",
        "errors": None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/indirect-activity")
def get_indirect_activities(db: Session = Depends(get_db)):
    activities = (
        db.query(IndirectActivity)
        .order_by(IndirectActivity.repair_group_component_action_id)
        .all()
    )
    return {
        "success": True,
        "data": [IndirectActivityOut.from_orm_obj(a) for a in activities],
        "message": "Indirect activities fetched successfully",
        "errors": None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/{technician_id}/indirect-activity")
def submit_indirect_activity(
    technician_id: int,
    payload: IndirectActivitySubmit,
    db: Session = Depends(get_db),
):
    from app.models.work_order import WorkOrderRepair

    activity = db.query(IndirectActivity).filter(
        IndirectActivity.repair_group_component_action_id == payload.repairGroupComponentActionID
    ).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Indirect activity not found")

    active_shift = (
        db.query(Shift)
        .filter(Shift.technician_id == technician_id, Shift.end_time.is_(None))
        .order_by(Shift.begin_time.desc())
        .first()
    )
    if active_shift:
        active_shift.status_indicator = activity.name
        db.commit()

    current_repair = (
        db.query(WorkOrderRepair)
        .filter(
            WorkOrderRepair.technician_id == technician_id,
            WorkOrderRepair.is_open == True,
        )
        .order_by(WorkOrderRepair.date_in.desc())
        .first()
    )

    now = datetime.now(timezone.utc)
    return {
        "success": True,
        "data": {
            "technicianId": technician_id,
            "indirectActivityId": payload.repairGroupComponentActionID,
            "startedAt": now.isoformat(),
            "currentWorkingRepairId": current_repair.id if current_repair else None,
        },
        "message": "Indirect activity started successfully.",
        "errors": None,
        "timestamp": now.isoformat(),
    }


@router.get("/{technician_id}", response_model=TechnicianOut)
def get_technician(technician_id: int, db: Session = Depends(get_db)):
    t = db.query(Technician).filter(Technician.id == technician_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Technician not found")
    return TechnicianOut(
        id=t.id,
        name=t.name,
        email=t.email,
        role=t.role,
        shopId=t.shop_id,
        shopName=t.shop.name if t.shop else None,
    )


@router.get("/{technician_id}/status-indicator", response_model=StatusIndicatorOut)
def get_status_indicator(technician_id: int, db: Session = Depends(get_db)):
    t = db.query(Technician).filter(Technician.id == technician_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Technician not found")

    active_shift = (
        db.query(Shift)
        .filter(Shift.technician_id == technician_id, Shift.end_time.is_(None))
        .order_by(Shift.begin_time.desc())
        .first()
    )

    if not active_shift:
        return StatusIndicatorOut(isActive=False)

    now = datetime.now(timezone.utc)
    begin = active_shift.begin_time
    if begin.tzinfo is None:
        from datetime import timezone as tz
        begin = begin.replace(tzinfo=tz.utc)
    duration = int((now - begin).total_seconds())

    return StatusIndicatorOut(
        shiftId=active_shift.id,
        isActive=True,
        statusIndicator=active_shift.status_indicator,
        startedAt=active_shift.begin_time,
        durationSeconds=duration,
    )


@router.post("/auth/pin", response_model=PinAuthOut)
def authenticate_pin(
    technicianId: int = Query(...),
    pin: str = Query(...),
    db: Session = Depends(get_db),
):
    t = db.query(Technician).filter(Technician.id == technicianId).first()
    if not t:
        raise HTTPException(status_code=404, detail="Technician not found")
    if t.pin != pin:
        raise HTTPException(status_code=401, detail="Invalid PIN")

    fake_token = f"dev_token_{t.id}_{t.name.replace(' ', '_')}"
    return PinAuthOut(
        accessToken=fake_token,
        technician=TechnicianOut(
            id=t.id,
            name=t.name,
            email=t.email,
            role=t.role,
            shopId=t.shop_id,
            shopName=t.shop.name if t.shop else None,
        ),
    )
