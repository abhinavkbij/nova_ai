from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class WorkOrderRepairOut(BaseModel):
    id: int
    woNumber: Optional[str] = None
    woStatusCode: Optional[str] = None
    title: str
    assetMake: Optional[str] = None
    assetModel: Optional[str] = None
    vin: Optional[str] = None
    repairCode: Optional[str] = None
    shopId: Optional[int] = None
    shopName: Optional[str] = None
    timeStandard: Optional[float] = None
    dateIn: Optional[datetime] = None
    priority: Optional[str] = None
    partsStatus: Optional[str] = None
    technicianId: Optional[int] = None
    shiftId: Optional[int] = None
    reasonId: Optional[int] = None
    isOpen: bool = True

    model_config = {"from_attributes": True}


class PaginatedWorkOrders(BaseModel):
    data: List[WorkOrderRepairOut]
    total: int
    page: int
    pageSize: int
    totalPages: int


class TaskOut(BaseModel):
    id: int
    repairId: Optional[int] = None
    stepNumber: Optional[int] = None
    resultId: Optional[int] = None
    comment: Optional[str] = None
    title: Optional[str] = None

    model_config = {"from_attributes": True}


class TaskUpdateIn(BaseModel):
    stepNumber: Optional[int] = None
    resultId: Optional[int] = None
    comment: Optional[str] = None


class NoteOut(BaseModel):
    id: int
    repairId: Optional[int] = None
    subject: Optional[str] = None
    note: Optional[str] = None
    isDocument: bool = False
    isPending: bool = False
    createdUserID: Optional[int] = None
    createdTechnicianID: Optional[int] = None
    createdAt: Optional[datetime] = None

    model_config = {"from_attributes": True}


class NoteCreateIn(BaseModel):
    id: Optional[int] = None
    subject: Optional[str] = None
    note: Optional[str] = None
    isDocument: bool = False
    isPending: bool = False
    createdUserID: Optional[int] = None
    createdTechnicianID: Optional[int] = None
