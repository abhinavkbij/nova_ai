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


class TaskStepOut(BaseModel):
    stepNumber: Optional[int] = None
    taskName: Optional[str] = None
    resultName: Optional[str] = None
    comment: Optional[str] = None
    instruction: Optional[str] = None
    repairTaskID: int
    hasInstruction: bool = False

    model_config = {"from_attributes": True}


class TaskListResponse(BaseModel):
    success: bool
    data: List[TaskStepOut]
    message: Optional[str] = None
    errors: Optional[str] = None
    timestamp: str


class TaskUpdateIn(BaseModel):
    stepNumber: Optional[int] = None
    resultId: Optional[int] = None
    comment: Optional[str] = None


class NoteOut(BaseModel):
    documentId: int = 0
    repairId: int
    noteId: int
    noteSubject: Optional[str] = None
    noteText: Optional[str] = None
    createdDate: Optional[datetime] = None
    userName: str = ""
    isWorkOrder: bool = False


class NoteCreateIn(BaseModel):
    id: Optional[int] = None       # work order ID if isDocument=True, repair ID if False
    subject: Optional[str] = None
    note: Optional[str] = None
    isDocument: bool = False
    isPending: bool = False
    createdUserID: Optional[int] = None
    createdTechnicianID: Optional[int] = None
