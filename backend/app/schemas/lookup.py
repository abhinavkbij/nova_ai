from pydantic import BaseModel
from typing import Optional


class IndirectActivityOut(BaseModel):
    id: int
    name: str
    category: Optional[str] = None

    model_config = {"from_attributes": True}


class WorkOrderStatusOut(BaseModel):
    id: int
    code: str
    description: str

    model_config = {"from_attributes": True}


class RepairReasonOut(BaseModel):
    id: int
    description: str

    model_config = {"from_attributes": True}
