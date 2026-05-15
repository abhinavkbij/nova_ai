from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Part(Base):
    __tablename__ = "parts"

    id = Column(Integer, primary_key=True, index=True)
    repair_id = Column(Integer, ForeignKey("work_order_repairs.id"), nullable=True)
    wo_number = Column(String, nullable=True)
    part_id = Column(Integer, nullable=True)
    part_name = Column(String, nullable=True)
    repair_code = Column(String, nullable=True)
    request_part_status_id = Column(Integer, nullable=True)
    requested_qty = Column(Integer, default=1)
    issued_qty = Column(Integer, default=0)
    technician_id = Column(Integer, ForeignKey("technicians.id"), nullable=True)
    store_room = Column(String, nullable=True)
    request_comment = Column(Text, nullable=True)
    created_user_id = Column(Integer, nullable=True)
    is_own_request = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    repair = relationship("WorkOrderRepair", back_populates="parts")
