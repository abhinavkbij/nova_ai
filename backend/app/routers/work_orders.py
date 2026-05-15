from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Any, Optional
import math
from datetime import datetime, timezone
from pydantic import BaseModel

from app.database import get_db
from app.models.work_order import WorkOrderRepair
from app.models.shift import Shift
from app.models.lookup import WorkOrderStatus, RepairReason
from app.schemas.work_order import WorkOrderRepairOut, PaginatedWorkOrders


class RepairBeginIn(BaseModel):
    technicianId: int
    isWOStatusToActive: bool = True
    isLabor: bool = False
    isLaborOvertimeCheckRequired: bool = True
    isTechnicianOvertimeCheckRequired: bool = True


class RepairEndIn(BaseModel):
    technicianId: int
    repairId: int
    maintShopId: int

router = APIRouter(tags=["work_orders"])

SORT_FIELD_MAP = {
    "InDate": WorkOrderRepair.date_in,
    "Title": WorkOrderRepair.title,
    "Priority": WorkOrderRepair.priority,
    "WONumber": WorkOrderRepair.wo_number,
    "RepairId": WorkOrderRepair.id,
    "Status": WorkOrderRepair.wo_status_code,
}

PRIORITY_DESC = {
    "LOW": "Low Priority",
    "MEDIUM": "Medium Priority",
    "MED": "Medium Priority",
    "HIGH": "High Priority",
    "RED": "Emergency repairs needed",
    "WP": "When Possible",
}

WO_STATUS_DESC = {
    "A": "Active - Repair in Progress",
    "C": "Closed",
    "H": "On Hold",
    "W": "Waiting Parts",
    "R": "Return to Shop",
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


def _utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _repair_title_parts(title: str) -> tuple[str, str, str]:
    words = (title or "").split()
    action = words[0] if words else ""
    remainder = " ".join(words[1:]) if len(words) > 1 else title or ""
    return action, remainder, title or ""


def _to_fasterweb_repair_item(r: WorkOrderRepair) -> dict:
    action_desc, group_desc, component_desc = _repair_title_parts(r.title)
    technician = r.technician
    shop = technician.shop if technician and technician.shop else None
    priority = r.priority or ""
    status_code = r.wo_status_code or ""
    year_make = f"{r.asset_year} {(r.asset_make or '').upper()}" if r.asset_year else (r.asset_make or "").upper()

    return {
        "repairId": r.id,
        "repairScheduleID": str(r.shift_id or ""),
        "assetId": r.id,
        "assetNumber": r.wo_number or "",
        "assetThumbnail": "",
        "yearMake": year_make,
        "model": r.asset_model or "",
        "actionDesc": action_desc,
        "groupDesc": group_desc,
        "componentDesc": component_desc,
        "technicianId": r.technician_id,
        "technicianName": technician.name if technician else "",
        "documentId": r.id,
        "documentNumber": "",
        "maintShopId": r.shop_id,
        "maintShop": str(r.shop_id or ""),
        "maintShopDesc": shop.name if shop else "",
        "priority": priority,
        "priorityDesc": PRIORITY_DESC.get(priority.upper(), priority),
        "inDate": r.date_in,
        "promiseDate": None,
        "repairReasonId": r.reason_id or 0,
        "repairReasonDesc": "",
        "workOrderStatusCode": status_code,
        "workOrderStatusDesc": WO_STATUS_DESC.get(status_code.upper(), status_code),
        "status": "Working" if r.is_open else "Complete",
        "woSpendingAuthorized": None,
        "license": "N/A",
        "serialNumber": r.vin or "",
        "priorityID": 0,
        "repairGroupComponentActionID": 0,
        "isBillable": False,
        "laborStandardID": None,
        "timeStandardID": None,
        "timeStandardHours": r.time_standard,
        "warrantyClaimID": None,
        "estimatedStartDate": None,
        "estimatedHours": None,
        "shiftID": r.shift_id,
        "createdDate": "0001-01-01T00:00:00",
        "notificationCount": 0,
        "assetOrganization": "",
        "assetLocation": "",
        "hasParts": bool(r.parts),
    }


def _apply_status_filter(query, status_filter: Optional[str]):
    normalized = (status_filter or "All").strip().lower()
    if normalized in ("open", "active", "working"):
        return query.filter(WorkOrderRepair.is_open == True)
    if normalized in ("closed", "complete", "completed"):
        return query.filter(WorkOrderRepair.is_open == False)
    return query


def _fasterweb_envelope(data: Any, message: str) -> dict:
    return {
        "success": True,
        "data": data,
        "message": message,
        "errors": None,
        "timestamp": _utc_timestamp(),
    }


def _get_fasterweb_repairs_response(
    db: Session,
    technician_id: int,
    page: int,
    page_size: int,
    sort_by: Optional[str],
    sort_order: Optional[str],
    status_filter: Optional[str],
    shop_id: Optional[int],
) -> dict:
    base_query = db.query(WorkOrderRepair).filter(WorkOrderRepair.technician_id == technician_id)
    if shop_id:
        base_query = base_query.filter(WorkOrderRepair.shop_id == shop_id)

    open_count = base_query.filter(WorkOrderRepair.is_open == True).count()
    closed_count = base_query.filter(WorkOrderRepair.is_open == False).count()

    query = _apply_status_filter(base_query, status_filter)
    sort_col = SORT_FIELD_MAP.get(sort_by or "InDate", WorkOrderRepair.date_in)
    query = query.order_by(sort_col.asc() if (sort_order or "").lower() == "asc" else sort_col.desc())

    total = query.count()
    total_pages = max(1, math.ceil(total / page_size))
    repairs = query.offset((page - 1) * page_size).limit(page_size).all()

    return _fasterweb_envelope(
        {
            "items": [_to_fasterweb_repair_item(r) for r in repairs],
            "pagination": {
                "currentPage": page,
                "pageSize": page_size,
                "totalItems": total,
                "totalPages": total_pages,
                "hasNextPage": page < total_pages,
                "hasPreviousPage": page > 1,
            },
            "openRepairCount": open_count,
            "closedRepairCount": closed_count,
        },
        "Repairs retrieved successfully",
    )


@router.get("/WorkOrderRepxairs/technician")
@router.get("/WorkOrderRepairs/technician")
def get_fasterweb_wo_repairs_for_technician(
    technicianId: int = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(6, ge=1, le=100),
    sortBy: Optional[str] = Query("InDate"),
    sortOrder: Optional[str] = Query("desc"),
    statusFilter: Optional[str] = Query("All"),
    shopId: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    return _get_fasterweb_repairs_response(
        db=db,
        technician_id=technicianId,
        page=page,
        page_size=pageSize,
        sort_by=sortBy,
        sort_order=sortOrder,
        status_filter=statusFilter,
        shop_id=shopId,
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

    sort_col = SORT_FIELD_MAP.get(sortBy or "InDate", WorkOrderRepair.date_in)
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


# Static sub-paths must be declared before /{repair_id} to avoid routing conflicts
@router.get("/WorkOrderRepairs/getRepairReasons")
def get_repair_reasons(db: Session = Depends(get_db)):
    reasons = db.query(RepairReason).order_by(RepairReason.id).all()
    return _fasterweb_envelope(
        [{"id": r.id, "description": r.description} for r in reasons],
        "Repair reasons retrieved successfully",
    )


@router.post("/WorkOrderRepairs/repair/end")
def end_repair(payload: RepairEndIn, db: Session = Depends(get_db)):
    repair = db.query(WorkOrderRepair).filter(WorkOrderRepair.id == payload.repairId).first()
    if not repair:
        raise HTTPException(status_code=404, detail="Work order repair not found")
    repair.is_open = False
    repair.wo_status_code = "C"
    db.commit()
    return _fasterweb_envelope(
        {"repairId": repair.id, "woStatusCode": repair.wo_status_code},
        "Repair ended successfully",
    )


@router.get("/WorkOrderRepairs/{repair_id}")
def get_work_order_repair(repair_id: int, db: Session = Depends(get_db)):
    repair = db.query(WorkOrderRepair).filter(WorkOrderRepair.id == repair_id).first()
    if not repair:
        raise HTTPException(status_code=404, detail="Work order repair not found")
    return _fasterweb_envelope(_to_fasterweb_repair_item(repair), "Repair retrieved successfully")


@router.post("/WorkOrderRepairs/{repair_id}/begin")
def begin_repair(repair_id: int, payload: RepairBeginIn, db: Session = Depends(get_db)):
    repair = db.query(WorkOrderRepair).filter(WorkOrderRepair.id == repair_id).first()
    if not repair:
        raise HTTPException(status_code=404, detail="Work order repair not found")
    if payload.isWOStatusToActive:
        repair.wo_status_code = "A"
        repair.is_open = True
    db.commit()
    return _fasterweb_envelope(
        {"repairId": repair.id, "woStatusCode": repair.wo_status_code},
        "Repair begun successfully",
    )


@router.get("/work-orders/status")
def get_wo_statuses(db: Session = Depends(get_db)):
    statuses = db.query(WorkOrderStatus).order_by(WorkOrderStatus.id).all()
    return _fasterweb_envelope(
        [{"code": s.code, "description": s.description} for s in statuses],
        "Work order statuses retrieved successfully",
    )


@router.patch("/work-orders/{work_order_id}/status/{status_code}")
@router.patch("/workorders/{work_order_id}/status/{status_code}")
def change_wo_status(work_order_id: int, status_code: str, db: Session = Depends(get_db)):
    repair = db.query(WorkOrderRepair).filter(WorkOrderRepair.id == work_order_id).first()
    if not repair:
        raise HTTPException(status_code=404, detail="Work order not found")
    repair.wo_status_code = status_code
    if status_code.upper() in ("C", "X"):
        repair.is_open = False
    db.commit()
    return _fasterweb_envelope(
        {"id": repair.id, "woStatusCode": repair.wo_status_code},
        "Status updated",
    )


@router.patch("/WorkOrderRepairs/{repair_id}/Reason/{reason_id}")
def set_repair_reason(repair_id: int, reason_id: int, db: Session = Depends(get_db)):
    repair = db.query(WorkOrderRepair).filter(WorkOrderRepair.id == repair_id).first()
    if not repair:
        raise HTTPException(status_code=404, detail="Work order repair not found")
    repair.reason_id = reason_id
    db.commit()
    return _fasterweb_envelope(
        {"id": repair.id, "reasonId": repair.reason_id},
        "Reason updated",
    )
