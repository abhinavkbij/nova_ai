from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List
import math

from app.database import get_db
from app.models.part import Part
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
