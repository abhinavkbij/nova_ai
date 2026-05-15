from pydantic import BaseModel
from typing import Optional


class IndirectActivityOut(BaseModel):
    repairGroupComponentActionID: Optional[int] = None
    partName: str

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_obj(cls, obj):
        return cls(
            repairGroupComponentActionID=obj.repair_group_component_action_id,
            partName=obj.name,
        )


class WorkOrderStatusOut(BaseModel):
    id: int
    code: str
    description: str

    model_config = {"from_attributes": True}


class RepairReasonOut(BaseModel):
    id: int
    description: str

    model_config = {"from_attributes": True}
