import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base, utc_now

class TableRelationship(Base):
    __tablename__ = "table_relationships"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    source_table = Column(String(255), nullable=False)
    source_column = Column(String(255), nullable=False)
    target_table = Column(String(255), nullable=False)
    target_column = Column(String(255), nullable=False)
    confidence = Column(Float, default=0.0)
    relationship_type = Column(String(50), default="many_to_one")  # one_to_one, one_to_many, many_to_one
    status = Column(String(50), default="detected")  # detected, accepted, rejected
    reasoning = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    dataset = relationship("Dataset", back_populates="relationships")
