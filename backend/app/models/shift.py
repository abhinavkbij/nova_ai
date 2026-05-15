from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Shift(Base):
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, index=True)
    technician_id = Column(Integer, ForeignKey("technicians.id"), nullable=False)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    begin_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)
    created_user_id = Column(Integer, nullable=True)
    status_indicator = Column(String, nullable=True)

    technician = relationship("Technician", back_populates="shifts")
    shop = relationship("Shop", back_populates="shifts")
    work_order_repairs = relationship("WorkOrderRepair", back_populates="shift")
