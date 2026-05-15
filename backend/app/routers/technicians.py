from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone
import math

from app.database import get_db
from app.models.technician import Technician
from app.models.shift import Shift
from app.models.lookup import IndirectActivity
from app.schemas.technician import TechnicianOut, PaginatedTechnicians, PinAuthOut
from app.schemas.shift import StatusIndicatorOut
from app.schemas.lookup import IndirectActivityOut

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


@router.get("/indirect-activity", response_model=list[IndirectActivityOut])
def get_indirect_activities(db: Session = Depends(get_db)):
    return db.query(IndirectActivity).order_by(IndirectActivity.name).all()


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
