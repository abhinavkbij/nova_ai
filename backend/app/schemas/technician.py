from pydantic import BaseModel
from typing import Optional, List


class TechnicianOut(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    role: Optional[str] = None
    shopId: Optional[int] = None
    shopName: Optional[str] = None

    model_config = {"from_attributes": True}


class TechnicianDetailOut(TechnicianOut):
    pin: Optional[str] = None


class PaginatedTechnicians(BaseModel):
    data: List[TechnicianOut]
    total: int
    page: int
    pageSize: int
    totalPages: int


class PinAuthRequest(BaseModel):
    technicianId: int
    pin: str


class PinAuthOut(BaseModel):
    accessToken: str
    tokenType: str = "bearer"
    technician: TechnicianOut
