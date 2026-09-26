import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from app.database import Base, utc_now

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="uploaded")  # uploaded, processing, ready, failed
    row_count = Column(Integer, default=0)
    column_count = Column(Integer, default=0)
    data_health_score = Column(Float, default=100.0)
    detected_domain = Column(String(100), default="General")
    domain_confidence = Column(Float, default=0.5)
    domain_reasoning = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    files = relationship("FileRecord", back_populates="dataset", cascade="all, delete-orphan")
    tables = relationship("TableMetadata", back_populates="dataset", cascade="all, delete-orphan")
    relationships = relationship("TableRelationship", back_populates="dataset", cascade="all, delete-orphan")
    analysis_runs = relationship("AnalysisRun", back_populates="dataset", cascade="all, delete-orphan")
    kpis = relationship("KpiMetric", back_populates="dataset", cascade="all, delete-orphan")
    insights = relationship("Insight", back_populates="dataset", cascade="all, delete-orphan")
    sheets = relationship("DashboardSheet", back_populates="dataset", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="dataset", cascade="all, delete-orphan")
    reports = relationship("ReportDocument", back_populates="dataset", cascade="all, delete-orphan")


class FileRecord(Base):
    __tablename__ = "file_records"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size_bytes = Column(Integer, default=0)
    file_type = Column(String(50), nullable=False)  # csv, xlsx, tsv
    created_at = Column(DateTime, default=utc_now)

    dataset = relationship("Dataset", back_populates="files")
    tables = relationship("TableMetadata", back_populates="file", cascade="all, delete-orphan")


class TableMetadata(Base):
    __tablename__ = "tables_metadata"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    file_id = Column(String, ForeignKey("file_records.id", ondelete="CASCADE"), nullable=True)
    table_name = Column(String(255), nullable=False)
    row_count = Column(Integer, default=0)
    column_count = Column(Integer, default=0)
    storage_path = Column(String(500), nullable=False)
    sample_data = Column(JSON, default=list)  # First 10 rows for preview
    created_at = Column(DateTime, default=utc_now)

    dataset = relationship("Dataset", back_populates="tables")
    file = relationship("FileRecord", back_populates="tables")
    columns = relationship("ColumnMetadata", back_populates="table", cascade="all, delete-orphan")


class ColumnMetadata(Base):
    __tablename__ = "columns_metadata"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    table_id = Column(String, ForeignKey("tables_metadata.id", ondelete="CASCADE"), nullable=False)
    column_name = Column(String(255), nullable=False)
    data_type = Column(String(50), nullable=False)  # numeric, categorical, datetime, boolean, text, identifier
    original_type = Column(String(50), nullable=False)
    missing_count = Column(Integer, default=0)
    missing_percentage = Column(Float, default=0.0)
    unique_count = Column(Integer, default=0)
    cardinality_ratio = Column(Float, default=0.0)
    is_identifier = Column(Boolean, default=False)
    is_potential_kpi = Column(Boolean, default=False)
    statistics = Column(JSON, default=dict)  # min, max, mean, median, std, percentiles, date_min, date_max
    sample_values = Column(JSON, default=list)

    table = relationship("TableMetadata", back_populates="columns")
