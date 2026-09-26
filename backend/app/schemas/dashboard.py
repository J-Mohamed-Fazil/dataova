from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict

class ChartFilterSchema(BaseModel):
    field: str
    operator: str  # equals, contains, greater_than, less_than, in
    value: Any

class DashboardChartSchema(BaseModel):
    id: str
    sheet_id: str
    title: str
    description: Optional[str] = None
    chart_type: str
    table_name: str
    join_table: Optional[str] = None
    primary_key: Optional[str] = None
    join_key: Optional[str] = None
    x_field: Optional[str] = None
    y_field: Optional[str] = None
    secondary_y_field: Optional[str] = None
    aggregation: str
    group_by: Optional[str] = None
    filters: Optional[List[Dict[str, Any]]] = []
    config: Optional[Dict[str, Any]] = {}
    grid_x: int = 0
    grid_y: int = 0
    grid_w: int = 6
    grid_h: int = 4
    order_index: int = 0
    data: Optional[List[Dict[str, Any]]] = None  # Populated when querying/rendering

    model_config = ConfigDict(from_attributes=True)

class DashboardChartCreateSchema(BaseModel):
    sheet_id: str
    title: str
    description: Optional[str] = None
    chart_type: str
    table_name: str
    join_table: Optional[str] = None
    primary_key: Optional[str] = None
    join_key: Optional[str] = None
    x_field: Optional[str] = None
    y_field: Optional[str] = None
    secondary_y_field: Optional[str] = None
    aggregation: str = "sum"
    group_by: Optional[str] = None
    filters: Optional[List[Dict[str, Any]]] = []
    config: Optional[Dict[str, Any]] = {}
    grid_w: int = 6
    grid_h: int = 4

class DashboardChartUpdateSchema(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    chart_type: Optional[str] = None
    table_name: Optional[str] = None
    join_table: Optional[str] = None
    primary_key: Optional[str] = None
    join_key: Optional[str] = None
    x_field: Optional[str] = None
    y_field: Optional[str] = None
    secondary_y_field: Optional[str] = None
    aggregation: Optional[str] = None
    group_by: Optional[str] = None
    filters: Optional[List[Dict[str, Any]]] = None
    config: Optional[Dict[str, Any]] = None
    grid_x: Optional[int] = None
    grid_y: Optional[int] = None
    grid_w: Optional[int] = None
    grid_h: Optional[int] = None
    order_index: Optional[int] = None

class DashboardSheetSchema(BaseModel):
    id: str
    dataset_id: str
    title: str
    sheet_type: str
    order_index: int
    is_default: bool
    business_questions: Optional[List[Dict[str, Any]]] = []
    charts: Optional[List[DashboardChartSchema]] = []

    model_config = ConfigDict(from_attributes=True)

class DashboardSheetCreateSchema(BaseModel):
    title: str
    sheet_type: str = "custom"

class DashboardSheetUpdateSchema(BaseModel):
    title: Optional[str] = None
    order_index: Optional[int] = None
