from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base


class Shop(Base):
    __tablename__ = "shops"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)

    technicians = relationship("Technician", back_populates="shop")
    shifts = relationship("Shift", back_populates="shop")
