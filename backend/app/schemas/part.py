from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class PartOut(BaseModel):
    id: int
    repairId: Optional[int] = None
    woNumber: Optional[str] = None
    partId: Optional[int] = None
    partName: Optional[str] = None
    repairCode: Optional[str] = None
    requestPartStatusId: Optional[int] = None
    statusName: Optional[str] = None
    requestedQty: int = 1
    issuedQty: int = 0
    technicianId: Optional[int] = None
    requestComment: Optional[str] = None
    createdAt: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PaginatedParts(BaseModel):
    data: List[PartOut]
    total: int
    pageNumber: int
    pageSize: int
    totalPages: int


class PartInventoryOut(PaginatedParts):
    requested: int = 0
    issued: int = 0
    delayed: int = 0


class PartCreateIn(BaseModel):
    repairId: Optional[int] = None
    partId: Optional[int] = None
    technicianId: Optional[int] = None
    storeRoom: Optional[str] = None
    requestedQty: int = 1
    requestPartStatusID: int = 1
    createdUserID: Optional[int] = None
    requestComment: Optional[str] = None
    issuedQty: int = 0
    isOwnRequest: bool = True


class PartRequestStatusOut(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}
