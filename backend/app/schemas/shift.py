from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ShiftOut(BaseModel):
    id: int
    technicianId: int
    shopId: int
    beginTime: Optional[datetime] = None
    endTime: Optional[datetime] = None
    statusIndicator: Optional[str] = None

    model_config = {"from_attributes": True}


class ShiftEndOut(ShiftOut):
    completedRepairsCount: int = 0


class CompletedRepairsCountOut(BaseModel):
    shiftId: int
    completedRepairsCount: int


class StatusIndicatorOut(BaseModel):
    shiftId: Optional[int] = None
    isActive: bool
    statusIndicator: Optional[str] = None
    startedAt: Optional[datetime] = None
    durationSeconds: Optional[int] = None
