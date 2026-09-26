from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict

class ReportSectionSchema(BaseModel):
    id: str
    report_id: str
    section_type: str
    title: str
    content: str
    order_index: int
    charts_included: List[Dict[str, Any]] = []
    tables_included: List[Dict[str, Any]] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ReportSectionUpdateSchema(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    order_index: Optional[int] = None
    charts_included: Optional[List[Dict[str, Any]]] = None
    tables_included: Optional[List[Dict[str, Any]]] = None

class ReportSectionCreateSchema(BaseModel):
    title: str
    content: str
    section_type: str = "custom"
    order_index: Optional[int] = 0

class ReportDocumentSchema(BaseModel):
    id: str
    dataset_id: str
    title: str
    subtitle: Optional[str] = None
    summary: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    sections: List[ReportSectionSchema] = []

    model_config = ConfigDict(from_attributes=True)

class ReportUpdateSchema(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    summary: Optional[str] = None
