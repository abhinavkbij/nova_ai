from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List
import math
from datetime import datetime, timezone

from app.database import get_db
from app.models.part import Part, PartCatalog
from app.models.lookup import PartRequestStatus
from app.schemas.part import PartOut, PaginatedParts, PartInventoryOut, PartCreateIn, PartRequestStatusOut

router = APIRouter(tags=["parts"])

STATUS_NAMES = {1: "Requested", 2: "Issued", 3: "Cancelled", 4: "Delayed"}


def _part_to_out(p: Part) -> PartOut:
    return PartOut(
        id=p.id,
        repairId=p.repair_id,
        woNumber=p.wo_number,
        partId=p.part_id,
        partName=p.part_name,
        repairCode=p.repair_code,
        requestPartStatusId=p.request_part_status_id,
        statusName=STATUS_NAMES.get(p.request_part_status_id or 0),
        requestedQty=p.requested_qty,
        issuedQty=p.issued_qty,
        technicianId=p.technician_id,
        requestComment=p.request_comment,
        createdAt=p.created_at,
    )


def _utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _pagination(page: int, page_size: int, total: int) -> dict:
    total_pages = max(1, math.ceil(total / page_size))
    return {
        "currentPage": page,
        "pageSize": page_size,
        "totalItems": total,
        "totalPages": total_pages,
        "hasNextPage": page < total_pages,
        "hasPreviousPage": page > 1,
    }


def _name_parts(full_name: str | None) -> tuple[str, None, str]:
    parts = (full_name or "").split()
    if not parts:
        return "", None, ""
    if len(parts) == 1:
        return parts[0], None, ""
    return parts[0], None, parts[-1]


def _part_to_message(p: Part) -> dict:
    technician = p.repair.technician if p.repair and p.repair.technician else None
    first_name, middle_initial, last_name = _name_parts(technician.name if technician else "")
    part_code = p.part_name or f"Part {p.part_id or p.id}"
    store_room = p.store_room or "MAIN PARTS STOREROOM"
    document_id = p.wo_number or (p.repair.wo_number if p.repair else "")
    asset_number = p.repair.wo_number if p.repair else ""

    return {
        "messageID": p.id,
        "messageType": 1,
        "referenceID": p.part_id or p.id,
        "technicianID": p.technician_id,
        "messageBody": f"Your item {part_code} is available. You can collect {p.issued_qty or p.requested_qty or 1:03d} from {store_room}",
        "messageSubject": f"Please collect your item {part_code}",
        "isRead": False,
        "createdDate": p.created_at,
        "createdUserID": p.created_user_id,
        "modifiedDate": p.created_at,
        "modifiedUserID": p.created_user_id,
        "firstName": first_name,
        "middleInitial": middle_initial,
        "lastName": last_name,
        "documentID": document_id,
        "assetNumber": asset_number,
        "notificationCount": 1,
        "repairID": p.repair_id,
        "fullName": technician.name if technician else "",
    }


def _fasterweb_message_envelope(data: list[dict], page: int, page_size: int, total: int) -> dict:
    return {
        "success": True,
        "data": data,
        "message": None,
        "pagination": _pagination(page, page_size, total),
        "timestamp": _utc_timestamp(),
    }


@router.get("/parts/catalog")
def search_part_catalog(
    q: Optional[str] = Query(None),
    pageNumber: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(PartCatalog)
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            PartCatalog.name.ilike(term) | PartCatalog.part_number.ilike(term)
        )
    total = query.count()
    items = query.offset((pageNumber - 1) * pageSize).limit(pageSize).all()
    return {
        "success": True,
        "data": [
            {
                "partId": c.part_number,
                "name": c.name,
                "description": c.description or "",
                "inStock": c.available_qty > 0,
                "availableQty": c.available_qty,
            }
            for c in items
        ],
        "total": total,
        "pageNumber": pageNumber,
        "pageSize": pageSize,
    }


@router.get("/parts/repair/{repair_id}", response_model=PaginatedParts)
def get_parts_for_repair(
    repair_id: int,
    pageNumber: int = Query(1, ge=1),
    pageSize: int = Query(9, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Part).filter(Part.repair_id == repair_id)
    total = query.count()
    parts = query.offset((pageNumber - 1) * pageSize).limit(pageSize).all()
    return PaginatedParts(
        data=[_part_to_out(p) for p in parts],
        total=total,
        pageNumber=pageNumber,
        pageSize=pageSize,
        totalPages=max(1, math.ceil(total / pageSize)),
    )


@router.get("/parts/requested", response_model=PartInventoryOut)
def get_requested_parts(
    technicianId: int = Query(...),
    isRequestActive: Optional[bool] = Query(None),
    requestedPartStatusId: Optional[int] = Query(None),
    pageNumber: int = Query(1, ge=1),
    pageSize: int = Query(6, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Part).filter(Part.technician_id == technicianId)
    if isRequestActive is not None:
        if isRequestActive:
            query = query.filter(Part.request_part_status_id.in_([1, 4]))
        else:
            query = query.filter(Part.request_part_status_id.in_([2, 3]))
    if requestedPartStatusId:
        query = query.filter(Part.request_part_status_id == requestedPartStatusId)

    total = query.count()
    all_parts = query.all()
    requested = sum(1 for p in all_parts if p.request_part_status_id == 1)
    issued = sum(1 for p in all_parts if p.request_part_status_id == 2)
    delayed = sum(1 for p in all_parts if p.request_part_status_id == 4)

    paginated = all_parts[(pageNumber - 1) * pageSize : pageNumber * pageSize]
    return PartInventoryOut(
        data=[_part_to_out(p) for p in paginated],
        total=total,
        pageNumber=pageNumber,
        pageSize=pageSize,
        totalPages=max(1, math.ceil(total / pageSize)),
        requested=requested,
        issued=issued,
        delayed=delayed,
    )


@router.get("/parts/messages")
def get_parts_messages(
    technicianID: int = Query(...),
    pageNumber: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Part)
        .filter(
            Part.technician_id == technicianID,
            Part.request_part_status_id == 2,
        )
        .order_by(Part.created_at.desc(), Part.id.desc())
    )
    total = query.count()
    messages = query.offset((pageNumber - 1) * pageSize).limit(pageSize).all()
    return _fasterweb_message_envelope(
        [_part_to_message(p) for p in messages],
        pageNumber,
        pageSize,
        total,
    )


@router.get("/parts/getpartsrequestedstatus", response_model=List[PartRequestStatusOut])
def get_part_statuses(db: Session = Depends(get_db)):
    return db.query(PartRequestStatus).order_by(PartRequestStatus.id).all()


@router.post("/PartList", response_model=PartOut, status_code=201)
def create_part_request(payload: PartCreateIn, db: Session = Depends(get_db)):
    part = Part(
        repair_id=payload.repairId,
        part_id=payload.partId,
        technician_id=payload.technicianId,
        store_room=payload.storeRoom,
        requested_qty=payload.requestedQty,
        request_part_status_id=payload.requestPartStatusID,
        created_user_id=payload.createdUserID,
        request_comment=payload.requestComment,
        issued_qty=payload.issuedQty,
        is_own_request=payload.isOwnRequest,
    )
    db.add(part)
    db.commit()
    db.refresh(part)
    return _part_to_out(part)
