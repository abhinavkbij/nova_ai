from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class WorkOrder(Base):
    __tablename__ = "work_orders_documents"

    id = Column(Integer, primary_key=True, index=True)
    wo_number = Column(String, unique=True, nullable=False, index=True)
    asset_number = Column(String, nullable=True, index=True)
    asset_year = Column(Integer, nullable=True)
    asset_make = Column(String, nullable=True)
    asset_model = Column(String, nullable=True)
    org_id = Column(Integer, ForeignKey("shops.id"), nullable=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=True)
    status_code = Column(String, default="A")
    department = Column(String, nullable=True)
    date_in = Column(DateTime(timezone=True), nullable=True)
    date_promised = Column(DateTime(timezone=True), nullable=True)
    bill_code = Column(String, nullable=True)
    contact = Column(String, nullable=True)
    priority = Column(String, default="MEDIUM")
    symptom = Column(Text, nullable=True)
    meter_actual_reading = Column(Float, nullable=True)
    disable_downtime = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    repairs = relationship("WorkOrderRepair", back_populates="work_order", foreign_keys="WorkOrderRepair.work_order_id")


class WorkOrderRepair(Base):
    __tablename__ = "work_order_repairs"

    id = Column(Integer, primary_key=True, index=True)
    work_order_id = Column(Integer, ForeignKey("work_orders_documents.id"), nullable=True)
    wo_number = Column(String, nullable=True)
    wo_status_code = Column(String, default="A")
    title = Column(String, nullable=False)
    asset_year = Column(Integer, nullable=True)
    asset_make = Column(String, nullable=True)
    asset_model = Column(String, nullable=True)
    vin = Column(String, nullable=True)
    license_plate = Column(String, nullable=True)
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
    work_order = relationship("WorkOrder", back_populates="repairs", foreign_keys=[work_order_id])
    tasks = relationship("Task", back_populates="repair")
    notes = relationship("WorkOrderNote", back_populates="repair")
    parts = relationship("Part", back_populates="repair")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    repair_id = Column(Integer, ForeignKey("work_order_repairs.id"), nullable=True)
    step_number = Column(Integer, nullable=True)
    task_name = Column(String, nullable=True)
    result_id = Column(Integer, nullable=True)
    result_name = Column(String, nullable=True)
    comment = Column(Text, nullable=True)
    instruction = Column(Text, nullable=True)
    has_instruction = Column(Boolean, default=False)

    repair = relationship("WorkOrderRepair", back_populates="tasks")


class RepairTimer(Base):
    __tablename__ = "repair_timers"

    id = Column(Integer, primary_key=True, index=True)
    repair_id = Column(Integer, ForeignKey("work_order_repairs.id"), nullable=False)
    technician_id = Column(Integer, ForeignKey("technicians.id"), nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)


class WorkOrderNote(Base):
    __tablename__ = "work_order_notes"

    id = Column(Integer, primary_key=True, index=True)
    repair_id = Column(Integer, ForeignKey("work_order_repairs.id"), nullable=True)
    document_id = Column(Integer, nullable=True)  # work order ID for WO notes, NULL for repair notes
    subject = Column(String, nullable=True)
    note = Column(Text, nullable=True)
    is_work_order = Column(Boolean, default=False)
    user_name = Column(String, nullable=True)
    created_user_id = Column(Integer, nullable=True)
    created_technician_id = Column(Integer, ForeignKey("technicians.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    repair = relationship("WorkOrderRepair", back_populates="notes")
