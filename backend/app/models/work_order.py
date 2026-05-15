from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class WorkOrderRepair(Base):
    __tablename__ = "work_order_repairs"

    id = Column(Integer, primary_key=True, index=True)
    wo_number = Column(String, nullable=True)
    wo_status_code = Column(String, default="A")
    title = Column(String, nullable=False)
    asset_make = Column(String, nullable=True)
    asset_model = Column(String, nullable=True)
    vin = Column(String, nullable=True)
    repair_code = Column(String, nullable=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=True)
    time_standard = Column(Float, nullable=True)
    date_in = Column(DateTime(timezone=True), nullable=True)
    priority = Column(String, default="LOW")
    parts_status = Column(String, default="PARTS UNASSIGNED")
    technician_id = Column(Integer, ForeignKey("technicians.id"), nullable=True)
    shift_id = Column(Integer, ForeignKey("shifts.id"), nullable=True)
    reason_id = Column(Integer, nullable=True)
    is_open = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    technician = relationship("Technician", back_populates="work_order_repairs")
    shift = relationship("Shift", back_populates="work_order_repairs")
    tasks = relationship("Task", back_populates="repair")
    notes = relationship("WorkOrderNote", back_populates="repair")
    parts = relationship("Part", back_populates="repair")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    repair_id = Column(Integer, ForeignKey("work_order_repairs.id"), nullable=True)
    step_number = Column(Integer, nullable=True)
    result_id = Column(Integer, nullable=True)
    comment = Column(Text, nullable=True)
    title = Column(String, nullable=True)

    repair = relationship("WorkOrderRepair", back_populates="tasks")


class WorkOrderNote(Base):
    __tablename__ = "work_order_notes"

    id = Column(Integer, primary_key=True, index=True)
    repair_id = Column(Integer, ForeignKey("work_order_repairs.id"), nullable=True)
    subject = Column(String, nullable=True)
    note = Column(Text, nullable=True)
    is_document = Column(Boolean, default=False)
    is_pending = Column(Boolean, default=False)
    created_user_id = Column(Integer, nullable=True)
    created_technician_id = Column(Integer, ForeignKey("technicians.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    repair = relationship("WorkOrderRepair", back_populates="notes")
