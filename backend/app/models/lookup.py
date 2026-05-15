from sqlalchemy import Column, Integer, String
from app.database import Base


class IndirectActivity(Base):
    __tablename__ = "indirect_activities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=True)


class WorkOrderStatus(Base):
    __tablename__ = "lookup_wo_status"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, nullable=False, unique=True)
    description = Column(String, nullable=False)


class RepairReason(Base):
    __tablename__ = "lookup_repair_reasons"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(String, nullable=False)


class PartRequestStatus(Base):
    __tablename__ = "lookup_part_status"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
