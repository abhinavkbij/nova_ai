from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Any, Optional
import math
from datetime import datetime, timezone
from pydantic import BaseModel

from app.database import get_db
from app.models.work_order import WorkOrder, WorkOrderRepair, RepairTimer
from app.models.shift import Shift
from app.models.lookup import WorkOrderStatus, RepairReason
from app.schemas.work_order import WorkOrderRepairOut, PaginatedWorkOrders
from app.services import work_orders as wo_service
from app.services.work_orders import RepairNotFoundError


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


class WorkOrderCreateIn(BaseModel):
    assetNumber: str
    assetId: Optional[int] = None
    orgId: Optional[int] = None
    shopId: int
    statusCode: str = "A"
    department: Optional[str] = None
    dateIn: Optional[str] = None
    datePromised: Optional[str] = None
    billCode: Optional[str] = None
    contact: Optional[str] = None
    priority: str = "MEDIUM"
    symptom: Optional[str] = None
    meterActualReading: Optional[float] = None
    disableDowntime: bool = False
    assetYear: Optional[int] = None
    assetMake: Optional[str] = None
    assetModel: Optional[str] = None


class RepairCreateIn(BaseModel):
    workOrderId: int
    repairSchedule: Optional[str] = None
    repairReasonId: Optional[int] = None
    action: Optional[str] = None
    group: Optional[str] = None
    component: Optional[str] = None
    maintShopId: Optional[int] = None
    technicianId: Optional[int] = None

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
        "repairScheduleID": r.repair_code or str(r.shift_id or ""),
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
        "documentNumber": r.wo_number or "",
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
        "license": r.license_plate or "N/A",
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


class RepairSearchIn(BaseModel):
    technicianId: int
    shopId: Optional[int] = None
    searchText: Optional[str] = None   # e.g. "Repair Id", "Work Order Id", "VIN Code", "Asset Number", "License Number"
    searchValue: Optional[str] = None
    scope: Optional[str] = None        # "My Repairs in My Shop" | "My Repairs in All Shops" | "All Repairs in My Shop" | "All Repairs in All Shops"
    page: int = 1
    pageSize: int = 9
    statusFilter: Optional[str] = None


def _apply_scope_filter(query, technician_id: int, shop_id: Optional[int], scope: Optional[str]):
    scope_key = (scope or "My Repairs in My Shop").strip().lower()
    filter_tech = "my repairs" in scope_key
    filter_shop = "my shop" in scope_key

    if filter_tech:
        query = query.filter(WorkOrderRepair.technician_id == technician_id)
    if filter_shop and shop_id:
        query = query.filter(WorkOrderRepair.shop_id == shop_id)
    return query


@router.post("/WorkOrderRepairs/search")
def search_wo_repairs(payload: RepairSearchIn, db: Session = Depends(get_db)):
    base_query = db.query(WorkOrderRepair)
    base_query = _apply_scope_filter(base_query, payload.technicianId, payload.shopId, payload.scope)

    open_count = base_query.filter(WorkOrderRepair.is_open == True).count()
    closed_count = base_query.filter(WorkOrderRepair.is_open == False).count()

    query = _apply_status_filter(base_query, payload.statusFilter)

    if payload.searchValue:
        val = payload.searchValue
        label = (payload.searchText or "").strip().lower()

        if label == "repair id":
            try:
                query = query.filter(WorkOrderRepair.id == int(val))
            except ValueError:
                query = query.filter(WorkOrderRepair.id == -1)
        elif label == "work order id":
            query = query.filter(WorkOrderRepair.wo_number.ilike(f"%{val}%"))
        elif label == "vin code":
            query = query.filter(WorkOrderRepair.vin.ilike(f"%{val}%"))
        elif label == "asset number":
            query = query.filter(WorkOrderRepair.wo_number.ilike(f"%{val}%"))
        elif label == "license number":
            query = query.filter(WorkOrderRepair.license_plate.ilike(f"%{val}%"))
        else:
            query = query.filter(
                WorkOrderRepair.title.ilike(f"%{val}%")
                | WorkOrderRepair.wo_number.ilike(f"%{val}%")
                | WorkOrderRepair.vin.ilike(f"%{val}%")
            )

    total = query.count()
    page = max(1, payload.page)
    page_size = max(1, payload.pageSize)
    total_pages = max(1, math.ceil(total / page_size))
    repairs = query.order_by(WorkOrderRepair.date_in.desc()).offset((page - 1) * page_size).limit(page_size).all()

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
        [{"repairReasonId": r.id, "reason": r.description, "isObsolete": False} for r in reasons],
        "Repair Reasons retrieved successfully.",
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

    wo_label = repair.wo_number or f"Repair {repair.id}"
    active_shift = (
        db.query(Shift)
        .filter(Shift.technician_id == payload.technicianId, Shift.end_time.is_(None))
        .order_by(Shift.begin_time.desc())
        .first()
    )
    if active_shift:
        active_shift.status_indicator = wo_label

    db.commit()
    return _fasterweb_envelope(
        {"repairId": repair.id, "woStatusCode": repair.wo_status_code, "statusIndicator": wo_label},
        "Repair begun successfully",
    )


@router.get("/work-orders/status")
def get_wo_statuses(db: Session = Depends(get_db)):
    statuses = db.query(WorkOrderStatus).order_by(WorkOrderStatus.id).all()
    return _fasterweb_envelope(
        [
            {
                "workOrderStatusID": s.id,
                "status": s.code,
                "statusDesc": s.description,
                "isObsolete": False,
                "isDowntime": False,
                "isClearDateOut": True,
            }
            for s in statuses
        ],
        "Work order statuses retrieved successfully.",
    )


@router.patch("/work-orders/{work_order_id}/status/{status_code}")
@router.patch("/workorders/{work_order_id}/status/{status_code}")
def change_wo_status(work_order_id: int, status_code: str, db: Session = Depends(get_db)):
    try:
        repair = wo_service.update_status(db, work_order_id, status_code)
    except RepairNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _fasterweb_envelope(
        {"id": repair.id, "woStatusCode": repair.wo_status_code},
        "Status updated",
    )


@router.patch("/WorkOrderRepairs/{repair_id}/Reason/{reason_id}")
def set_repair_reason(repair_id: int, reason_id: int, db: Session = Depends(get_db)):
    try:
        repair = wo_service.set_reason(db, repair_id, reason_id)
    except RepairNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _fasterweb_envelope(
        {"id": repair.id, "reasonId": repair.reason_id},
        "Reason updated",
    )


@router.post("/WorkOrderRepairs/{repair_id}/timer/start")
def start_repair_timer(
    repair_id: int,
    technicianId: int = Query(...),
    db: Session = Depends(get_db),
):
    repair = db.query(WorkOrderRepair).filter(WorkOrderRepair.id == repair_id).first()
    if not repair:
        raise HTTPException(status_code=404, detail="Repair not found")

    # Close any open timer for this repair+technician pair first
    open_timer = (
        db.query(RepairTimer)
        .filter(
            RepairTimer.repair_id == repair_id,
            RepairTimer.technician_id == technicianId,
            RepairTimer.end_time.is_(None),
        )
        .first()
    )
    if open_timer:
        return _fasterweb_envelope(
            {
                "timerId": open_timer.id,
                "repairId": repair_id,
                "startTime": open_timer.start_time,
                "elapsedSeconds": int((datetime.now(timezone.utc) - open_timer.start_time.replace(tzinfo=timezone.utc)).total_seconds()),
            },
            "Timer already running",
        )

    now = datetime.now(timezone.utc)
    timer = RepairTimer(repair_id=repair_id, technician_id=technicianId, start_time=now)
    db.add(timer)
    db.commit()
    db.refresh(timer)
    return _fasterweb_envelope(
        {"timerId": timer.id, "repairId": repair_id, "startTime": timer.start_time, "elapsedSeconds": 0},
        "Timer started",
    )


@router.get("/WorkOrderRepairs/{repair_id}/timer")
def get_repair_timer(
    repair_id: int,
    technicianId: int = Query(...),
    db: Session = Depends(get_db),
):
    timer = (
        db.query(RepairTimer)
        .filter(
            RepairTimer.repair_id == repair_id,
            RepairTimer.technician_id == technicianId,
            RepairTimer.end_time.is_(None),
        )
        .order_by(RepairTimer.start_time.desc())
        .first()
    )
    if not timer:
        return _fasterweb_envelope(
            {"repairId": repair_id, "isRunning": False, "elapsedSeconds": 0, "startTime": None},
            "No active timer",
        )
    start = timer.start_time
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    elapsed = int((datetime.now(timezone.utc) - start).total_seconds())
    return _fasterweb_envelope(
        {
            "timerId": timer.id,
            "repairId": repair_id,
            "isRunning": True,
            "startTime": timer.start_time,
            "elapsedSeconds": elapsed,
        },
        "Timer retrieved",
    )


@router.post("/work-orders")
def create_work_order(payload: WorkOrderCreateIn, db: Session = Depends(get_db)):
    import random
    wo_number = str(random.randint(40000, 99999))
    while db.query(WorkOrder).filter(WorkOrder.wo_number == wo_number).first():
        wo_number = str(random.randint(40000, 99999))

    try:
        date_in = datetime.fromisoformat(payload.dateIn) if payload.dateIn else datetime.now(timezone.utc)
    except ValueError:
        date_in = datetime.now(timezone.utc)

    try:
        date_promised = datetime.fromisoformat(payload.datePromised) if payload.datePromised else None
    except ValueError:
        date_promised = None

    wo = WorkOrder(
        wo_number=wo_number,
        asset_number=payload.assetNumber,
        asset_year=payload.assetYear,
        asset_make=payload.assetMake,
        asset_model=payload.assetModel,
        org_id=payload.orgId,
        shop_id=payload.shopId,
        status_code=payload.statusCode,
        department=payload.department,
        date_in=date_in,
        date_promised=date_promised,
        bill_code=payload.billCode,
        contact=payload.contact,
        priority=payload.priority,
        symptom=payload.symptom,
        meter_actual_reading=payload.meterActualReading,
        disable_downtime=payload.disableDowntime,
    )
    db.add(wo)
    db.commit()
    db.refresh(wo)
    return _fasterweb_envelope(
        {"workOrderId": wo.id, "workOrderNumber": wo.wo_number},
        "Work order created successfully",
    )


@router.get("/work-orders/{wo_id}")
def get_work_order(wo_id: int, db: Session = Depends(get_db)):
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    repairs = db.query(WorkOrderRepair).filter(WorkOrderRepair.work_order_id == wo_id).all()
    return _fasterweb_envelope(
        {
            "workOrderId": wo.id,
            "workOrderNumber": wo.wo_number,
            "assetNumber": wo.asset_number,
            "assetYear": wo.asset_year,
            "assetMake": wo.asset_make,
            "assetModel": wo.asset_model,
            "statusCode": wo.status_code,
            "symptom": wo.symptom,
            "priority": wo.priority,
            "department": wo.department,
            "dateIn": wo.date_in.isoformat() if wo.date_in else None,
            "repairs": [
                {
                    "repairId": r.id,
                    "title": r.title,
                    "repairCode": r.repair_code,
                    "dateCreated": r.created_at.isoformat() if r.created_at else None,
                    "technicianName": r.technician.name if r.technician else "--",
                    "cost": 0.0,
                    "repairType": "New repair",
                }
                for r in repairs
            ],
        },
        "Work order retrieved successfully",
    )


@router.post("/WorkOrderRepairs")
def create_work_order_repair(payload: RepairCreateIn, db: Session = Depends(get_db)):
    wo = db.query(WorkOrder).filter(WorkOrder.id == payload.workOrderId).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    title_parts = [p for p in [payload.action, payload.group, payload.component] if p]
    title = "/".join(title_parts) or "New Repair"
    repair_code = "-".join(title_parts[:2]) if title_parts else "REP-GEN"

    repair = WorkOrderRepair(
        work_order_id=payload.workOrderId,
        wo_number=wo.wo_number,
        wo_status_code=wo.status_code,
        title=title,
        repair_code=repair_code,
        shop_id=payload.maintShopId or wo.shop_id,
        technician_id=payload.technicianId,
        priority=wo.priority,
        date_in=wo.date_in,
        is_open=True,
    )
    db.add(repair)
    db.commit()
    db.refresh(repair)
    return _fasterweb_envelope(
        {
            "repairId": repair.id,
            "workOrderId": wo.id,
            "workOrderNumber": wo.wo_number,
            "title": repair.title,
        },
        "Repair created successfully",
    )


@router.get("/work-orders/{wo_id}/pending-repairs")
def get_pending_repairs_for_wo(wo_id: int, db: Session = Depends(get_db)):
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    repairs = (
        db.query(WorkOrderRepair)
        .filter(WorkOrderRepair.shop_id == wo.shop_id, WorkOrderRepair.is_open == True)
        .limit(9)
        .all()
    )
    return _fasterweb_envelope(
        [_to_fasterweb_repair_item(r) for r in repairs],
        "Pending repairs retrieved",
    )


@router.get("/LookUps/Departments")
def get_departments():
    return _fasterweb_envelope(
        [
            {"id": 1,  "code": "9433", "name": "9433 [Animal Control]"},
            {"id": 2,  "code": "9434", "name": "9434 [Public Works]"},
            {"id": 3,  "code": "9435", "name": "9435 [Fleet Services]"},
            {"id": 4,  "code": "9436", "name": "9436 [Parks & Recreation]"},
            {"id": 5,  "code": "9437", "name": "9437 [Utilities]"},
            {"id": 6,  "code": "9438", "name": "9438 [Fire Department]"},
            {"id": 7,  "code": "9439", "name": "9439 [Police Department]"},
        ],
        "Departments retrieved",
    )


@router.get("/LookUps/BillCodes")
def get_bill_codes():
    return _fasterweb_envelope(
        [
            {"id": 1, "code": "001", "name": "001 [Bill everything]"},
            {"id": 2, "code": "002", "name": "002 [Internal only]"},
            {"id": 3, "code": "003", "name": "003 [Warranty]"},
            {"id": 4, "code": "004", "name": "004 [Insurance claim]"},
            {"id": 5, "code": "005", "name": "005 [No charge]"},
        ],
        "Bill codes retrieved",
    )


@router.get("/LookUps/RepairSchedules")
def get_repair_schedules():
    return _fasterweb_envelope(
        [
            {"id": 1, "name": "Scheduled Maintenance"},
            {"id": 2, "name": "Unscheduled Repair"},
            {"id": 3, "name": "Preventive Maintenance"},
            {"id": 4, "name": "Emergency Repair"},
            {"id": 5, "name": "Recall Service"},
        ],
        "Repair schedules retrieved",
    )


@router.get("/LookUps/RepairActions")
def get_repair_actions():
    return _fasterweb_envelope(
        [
            {"id": 1, "code": "ACC", "name": "Accident"},
            {"id": 2, "code": "INS", "name": "Inspection"},
            {"id": 3, "code": "REP", "name": "Repair"},
            {"id": 4, "code": "REC", "name": "Recall"},
            {"id": 5, "code": "REP", "name": "Replacement"},
            {"id": 6, "code": "SVC", "name": "Service"},
        ],
        "Repair actions retrieved",
    )


@router.get("/LookUps/RepairGroups")
def get_repair_groups(actionId: Optional[int] = None):
    all_groups = [
        {"id": 1,  "actionId": None, "code": "BOD", "name": "Body"},
        {"id": 2,  "actionId": None, "code": "BRK", "name": "Brakes"},
        {"id": 3,  "actionId": None, "code": "ELC", "name": "Electrical"},
        {"id": 4,  "actionId": None, "code": "ENG", "name": "Engine"},
        {"id": 5,  "actionId": None, "code": "EXH", "name": "Exhaust"},
        {"id": 6,  "actionId": None, "code": "FUL", "name": "Fuel System"},
        {"id": 7,  "actionId": None, "code": "HTR", "name": "Heating & Cooling"},
        {"id": 8,  "actionId": None, "code": "OIL", "name": "Oil & Fluids"},
        {"id": 9,  "actionId": None, "code": "SUS", "name": "Suspension"},
        {"id": 10, "actionId": None, "code": "TIR", "name": "Tires"},
        {"id": 11, "actionId": None, "code": "TRN", "name": "Transmission"},
    ]
    return _fasterweb_envelope(all_groups, "Repair groups retrieved")


@router.get("/LookUps/RepairComponents")
def get_repair_components(groupId: Optional[int] = None):
    components_map = {
        1:  [("Bumper", "BMP"), ("Door Panel", "DRP"), ("Hood", "HUD"), ("Fender", "FND")],
        2:  [("Front Pads", "FPD"), ("Rear Pads", "RPD"), ("Rotor", "ROT"), ("Caliper", "CAL"), ("Drum", "DRM")],
        3:  [("Battery", "BAT"), ("Alternator", "ALT"), ("Starter", "STR"), ("Wiring", "WIR"), ("Fuse", "FUS")],
        4:  [("Spark Plugs", "SPK"), ("Air Filter", "AFT"), ("Belt", "BLT"), ("Gasket", "GSK"), ("Valve", "VLV")],
        5:  [("Manifold", "MNF"), ("Muffler", "MFL"), ("Catalytic", "CAT"), ("Pipe", "PIP")],
        6:  [("Injector", "INJ"), ("Pump", "PMP"), ("Filter", "FLT"), ("Carburetor", "CRB")],
        7:  [("Heater Core", "HCR"), ("Radiator", "RAD"), ("Thermostat", "THS"), ("Fan", "FAN"), ("Compressor", "CMP")],
        8:  [("Engine Oil", "EOL"), ("Trans Fluid", "TRF"), ("Coolant", "CLT"), ("Power Steering", "PSF")],
        9:  [("Strut", "STR"), ("Spring", "SPR"), ("Control Arm", "CAR"), ("Tie Rod", "TRD"), ("Ball Joint", "BLJ")],
        10: [("Front Tire", "FTR"), ("Rear Tire", "RTR"), ("Spare", "SPR"), ("Wheel", "WHL")],
        11: [("Fluid", "FLD"), ("Filter Kit", "FLK"), ("Torque Converter", "TQC"), ("Solenoid", "SOL")],
    }
    items = components_map.get(groupId, [c for lst in components_map.values() for c in lst]) if groupId else [
        c for lst in components_map.values() for c in lst
    ]
    return _fasterweb_envelope(
        [{"id": i + 1, "code": code, "name": name} for i, (name, code) in enumerate(items)],
        "Repair components retrieved",
    )


@router.get("/LookUps/RepairCategories")
def get_repair_categories(db: Session = Depends(get_db)):
    repair_codes = (
        db.query(WorkOrderRepair.repair_code)
        .filter(WorkOrderRepair.repair_code.isnot(None))
        .distinct()
        .all()
    )
    seen = {}
    for (code,) in repair_codes:
        if not code:
            continue
        prefix = code.split("-")[0].upper()
        if prefix not in seen:
            label_map = {
                "TIR": "Tires", "BRK": "Brakes", "OIL": "Oil & Fluids",
                "TRN": "Transmission", "ENG": "Engine", "EXH": "Exhaust",
                "SUS": "Suspension", "CLU": "Clutch", "HTR": "Heating & Cooling",
                "ELC": "Electrical", "BOD": "Body & Frame",
            }
            seen[prefix] = label_map.get(prefix, prefix)
    categories = [{"code": k, "name": v} for k, v in sorted(seen.items(), key=lambda x: x[1])]
    return _fasterweb_envelope(categories, "Repair categories retrieved")
