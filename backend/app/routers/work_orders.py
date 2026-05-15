from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
import math

from app.database import get_db
from app.models.work_order import WorkOrderRepair
from app.models.shift import Shift
from app.schemas.work_order import WorkOrderRepairOut, PaginatedWorkOrders

router = APIRouter(tags=["work_orders"])

SORT_FIELD_MAP = {
    "InDate": WorkOrderRepair.date_in,
    "Title": WorkOrderRepair.title,
    "Priority": WorkOrderRepair.priority,
    "WONumber": WorkOrderRepair.wo_number,
}


def _to_out(r: WorkOrderRepair) -> WorkOrderRepairOut:
    shop_name = r.shift.shop.name if r.shift and r.shift.shop else None
    if not shop_name and r.shop_id:
        from app.models.shop import Shop
        pass
    return WorkOrderRepairOut(
        id=r.id,
        woNumber=r.wo_number,
        woStatusCode=r.wo_status_code,
        title=r.title,
        assetMake=r.asset_make,
        assetModel=r.asset_model,
        vin=r.vin,
        repairCode=r.repair_code,
        shopId=r.shop_id,
        shopName=shop_name,
        timeStandard=r.time_standard,
        dateIn=r.date_in,
        priority=r.priority,
        partsStatus=r.parts_status,
        technicianId=r.technician_id,
        shiftId=r.shift_id,
        reasonId=r.reason_id,
        isOpen=r.is_open,
    )


@router.get("/WorkOrderRepairs/technician/{technician_id}", response_model=PaginatedWorkOrders)
def get_wo_repairs_for_technician(
    technician_id: int,
    page: int = Query(1, ge=1),
    pageSize: int = Query(6, ge=1, le=100),
    sortBy: Optional[str] = Query("InDate"),
    sortOrder: Optional[str] = Query("desc"),
    shopId: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(WorkOrderRepair).filter(WorkOrderRepair.technician_id == technician_id)
    if shopId:
        query = query.filter(WorkOrderRepair.shop_id == shopId)

    sort_col = SORT_FIELD_MAP.get(sortBy, WorkOrderRepair.date_in)
    if sortOrder and sortOrder.lower() == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    total = query.count()
    repairs = query.offset((page - 1) * pageSize).limit(pageSize).all()

    return PaginatedWorkOrders(
        data=[_to_out(r) for r in repairs],
        total=total,
        page=page,
        pageSize=pageSize,
        totalPages=max(1, math.ceil(total / pageSize)),
    )


@router.get("/WorkOrderRepairs/search", response_model=PaginatedWorkOrders)
def search_wo_repairs(
    technicianId: int = Query(...),
    searchText: Optional[str] = Query(None),
    searchValue: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(6, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(WorkOrderRepair).filter(WorkOrderRepair.technician_id == technicianId)

    if searchValue:
        text_lower = (searchText or "").lower()
        if "asset" in text_lower or "vin" in text_lower:
            query = query.filter(
                WorkOrderRepair.vin.ilike(f"%{searchValue}%")
                | WorkOrderRepair.asset_make.ilike(f"%{searchValue}%")
                | WorkOrderRepair.asset_model.ilike(f"%{searchValue}%")
            )
        elif "wo" in text_lower or "work order" in text_lower:
            query = query.filter(WorkOrderRepair.wo_number.ilike(f"%{searchValue}%"))
        elif "repair" in text_lower:
            query = query.filter(WorkOrderRepair.repair_code.ilike(f"%{searchValue}%"))
        else:
            query = query.filter(
                WorkOrderRepair.title.ilike(f"%{searchValue}%")
                | WorkOrderRepair.wo_number.ilike(f"%{searchValue}%")
                | WorkOrderRepair.vin.ilike(f"%{searchValue}%")
            )

    total = query.count()
    repairs = query.offset((page - 1) * pageSize).limit(pageSize).all()

    return PaginatedWorkOrders(
        data=[_to_out(r) for r in repairs],
        total=total,
        page=page,
        pageSize=pageSize,
        totalPages=max(1, math.ceil(total / pageSize)),
    )


@router.get("/WorkOrderRepairs/{shift_id}/CompletedRepairsCount")
def get_completed_repairs_count(shift_id: int, db: Session = Depends(get_db)):
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    count = (
        db.query(WorkOrderRepair)
        .filter(
            WorkOrderRepair.shift_id == shift_id,
            WorkOrderRepair.is_open == False,
        )
        .count()
    )
    return {"shiftId": shift_id, "completedRepairsCount": count}


@router.patch("/workorders/{work_order_id}/status/{status_code}")
def change_wo_status(work_order_id: int, status_code: str, db: Session = Depends(get_db)):
    repair = db.query(WorkOrderRepair).filter(WorkOrderRepair.id == work_order_id).first()
    if not repair:
        raise HTTPException(status_code=404, detail="Work order not found")
    repair.wo_status_code = status_code
    if status_code.upper() in ("C", "X"):
        repair.is_open = False
    db.commit()
    return {"id": repair.id, "woStatusCode": repair.wo_status_code, "message": "Status updated"}


@router.patch("/WorkOrderRepairs/{repair_id}/Reason/{reason_id}")
def set_repair_reason(repair_id: int, reason_id: int, db: Session = Depends(get_db)):
    repair = db.query(WorkOrderRepair).filter(WorkOrderRepair.id == repair_id).first()
    if not repair:
        raise HTTPException(status_code=404, detail="Work order repair not found")
    repair.reason_id = reason_id
    db.commit()
    return {"id": repair.id, "reasonId": repair.reason_id, "message": "Reason updated"}
