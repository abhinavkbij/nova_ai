from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.job import JobStatus, JobPriority
from .technician import TechnicianOut


class JobBase(BaseModel):
    title: str
    description: Optional[str] = None
    customer_name: str
    customer_address: str
    customer_phone: Optional[str] = None
    priority: JobPriority = JobPriority.MEDIUM
    scheduled_at: Optional[datetime] = None
    notes: Optional[str] = None


class JobCreate(JobBase):
    technician_id: Optional[int] = None


class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    customer_name: Optional[str] = None
    customer_address: Optional[str] = None
    customer_phone: Optional[str] = None
    status: Optional[JobStatus] = None
    priority: Optional[JobPriority] = None
    technician_id: Optional[int] = None
    notes: Optional[str] = None
    scheduled_at: Optional[datetime] = None


class JobOut(JobBase):
    id: int
    status: JobStatus
    technician_id: Optional[int] = None
    technician: Optional[TechnicianOut] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
