from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    asset_number = Column(String, unique=True, nullable=False, index=True)
    org_id = Column(Integer, ForeignKey("shops.id"), nullable=True)
    year = Column(Integer, nullable=True)
    make = Column(String, nullable=True)
    model = Column(String, nullable=True)
    vin = Column(String, nullable=True)
    license = Column(String, nullable=True)
    status = Column(String, default="Active")
    total_point_value = Column(Float, nullable=True)
    original_replacement_date = Column(String, nullable=True)
    point_scale_used = Column(Integer, nullable=True)
    meter_reading = Column(Float, nullable=True)

    org = relationship("Shop")
