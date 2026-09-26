import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.database import Base, utc_now

class AnalysisRun(Base):
    __tablename__ = "analysis_runs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), default="completed")  # running, completed, failed
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    dataset = relationship("Dataset", back_populates="analysis_runs")


class KpiMetric(Base):
    __tablename__ = "kpi_metrics"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=False)
    value = Column(Float, nullable=False)
    formatted_value = Column(String(100), nullable=False)
    unit = Column(String(50), default="")
    calculation_type = Column(String(50), default="sum")  # sum, avg, count, unique, rate, ratio
    source_table = Column(String(255), nullable=False)
    source_column = Column(String(255), nullable=True)
    formula_explanation = Column(Text, nullable=False)  # "How was this calculated?"
    impact_summary = Column(Text, nullable=True)        # "Why does this matter?"
    confidence = Column(Float, default=1.0)
    order_index = Column(Integer, default=0)

    # Full Statistical Quintet & Interpretive Intelligence
    min_value = Column(Float, nullable=True)
    max_value = Column(Float, nullable=True)
    sum_value = Column(Float, nullable=True)
    avg_value = Column(Float, nullable=True)
    count_value = Column(Integer, nullable=True)
    formatted_min = Column(String(100), nullable=True)
    formatted_max = Column(String(100), nullable=True)
    formatted_sum = Column(String(100), nullable=True)
    formatted_avg = Column(String(100), nullable=True)
    formatted_count = Column(String(100), nullable=True)
    ai_insight = Column(Text, nullable=True)
    statistical_summary = Column(JSON, default=dict)

    created_at = Column(DateTime, default=utc_now)

    dataset = relationship("Dataset", back_populates="kpis")


class Insight(Base):
    __tablename__ = "insights"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False)  # trend, anomaly, opportunity, risk, performance, data_quality, comparison
    statement_type = Column(String(50), default="calculation")  # fact, calculation, inference, recommendation
    description = Column(Text, nullable=False)
    calculation_details = Column(JSON, default=dict)  # formula, values, dimensions used
    why_it_matters = Column(Text, nullable=False)
    recommendation = Column(Text, nullable=True)
    severity = Column(String(50), default="medium")  # low, medium, high, critical
    confidence = Column(Float, default=0.9)
    source_table = Column(String(255), nullable=True)
    source_columns = Column(JSON, default=list)
    created_at = Column(DateTime, default=utc_now)

    dataset = relationship("Dataset", back_populates="insights")


class AnomalyRecord(Base):
    __tablename__ = "anomalies"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    table_name = Column(String(255), nullable=False)
    column_name = Column(String(255), nullable=False)
    method = Column(String(50), default="iqr")  # iqr, z_score, rolling_deviation
    anomaly_count = Column(Integer, default=0)
    severity = Column(String(50), default="medium")
    details = Column(JSON, default=dict)  # threshold, min_anom, max_anom, sample_anomalies
    explanation = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utc_now)
