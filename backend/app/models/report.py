import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.database import Base, utc_now

class ReportDocument(Base):
    __tablename__ = "report_documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    subtitle = Column(String(255), nullable=True)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    dataset = relationship("Dataset", back_populates="reports")
    sections = relationship("ReportSection", back_populates="report", cascade="all, delete-orphan")


class ReportSection(Base):
    __tablename__ = "report_sections"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    report_id = Column(String, ForeignKey("report_documents.id", ondelete="CASCADE"), nullable=False)
    section_type = Column(String(50), nullable=False)  # executive_summary, dataset_overview, data_quality, key_metrics, trend_analysis, segment_analysis, anomalies, insights, recommendations, custom
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    order_index = Column(Integer, default=0)
    charts_included = Column(JSON, default=list)  # list of chart configs or IDs
    tables_included = Column(JSON, default=list)  # structured table data for display
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    report = relationship("ReportDocument", back_populates="sections")
