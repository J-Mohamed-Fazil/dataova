import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from app.database import Base, utc_now

class DashboardSheet(Base):
    __tablename__ = "dashboard_sheets"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    sheet_type = Column(String(50), default="custom")  # overview, trends, categories, anomalies, custom
    order_index = Column(Integer, default=0)
    is_default = Column(Boolean, default=False)
    business_questions = Column(JSON, default=list)  # Executive business questions answered for this dashboard
    created_at = Column(DateTime, default=utc_now)

    dataset = relationship("Dataset", back_populates="sheets")
    charts = relationship("DashboardChart", back_populates="sheet", cascade="all, delete-orphan")


class DashboardChart(Base):
    __tablename__ = "dashboard_charts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    sheet_id = Column(String, ForeignKey("dashboard_sheets.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    chart_type = Column(String(50), default="bar")  # bar, line, stacked_bar, scatter, pie, histogram, table, kpi_card
    table_name = Column(String(255), nullable=False)
    join_table = Column(String(255), nullable=True)     # Secondary table to join with
    primary_key = Column(String(255), nullable=True)    # Key on primary table
    join_key = Column(String(255), nullable=True)       # Key on secondary table
    x_field = Column(String(255), nullable=True)
    y_field = Column(String(255), nullable=True)
    secondary_y_field = Column(String(255), nullable=True)
    aggregation = Column(String(50), default="sum")  # sum, avg, count, min, max, none
    group_by = Column(String(255), nullable=True)
    filters = Column(JSON, default=list)  # list of {field, operator, value}
    config = Column(JSON, default=dict)   # colors, labels, height, custom flags
    grid_x = Column(Integer, default=0)
    grid_y = Column(Integer, default=0)
    grid_w = Column(Integer, default=6)   # 12-column grid system (6 = half width, 12 = full width)
    grid_h = Column(Integer, default=4)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=utc_now)

    sheet = relationship("DashboardSheet", back_populates="charts")
