from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Technician(Base):
    __tablename__ = "technicians"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    role = Column(String, nullable=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=True)
    pin = Column(String(4), nullable=True)

    shop = relationship("Shop", back_populates="technicians")
    shifts = relationship("Shift", back_populates="technician")
    work_order_repairs = relationship("WorkOrderRepair", back_populates="technician")
