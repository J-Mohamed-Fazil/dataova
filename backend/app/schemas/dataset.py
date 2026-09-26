from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict

class ColumnMetadataSchema(BaseModel):
    id: str
    column_name: str
    data_type: str
    original_type: str
    missing_count: int
    missing_percentage: float
    unique_count: int
    cardinality_ratio: float
    is_identifier: bool
    is_potential_kpi: bool
    statistics: Dict[str, Any]
    sample_values: List[Any]

    model_config = ConfigDict(from_attributes=True)

class TableMetadataSchema(BaseModel):
    id: str
    table_name: str
    row_count: int
    column_count: int
    sample_data: List[Dict[str, Any]]
    columns: List[ColumnMetadataSchema] = []

    model_config = ConfigDict(from_attributes=True)

class FileRecordSchema(BaseModel):
    id: str
    filename: str
    original_name: str
    file_size_bytes: int
    file_type: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class TableRelationshipSchema(BaseModel):
    id: str
    source_table: str
    source_column: str
    target_table: str
    target_column: str
    confidence: float
    relationship_type: str
    status: str
    reasoning: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class DatasetSchema(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    status: str
    row_count: int
    column_count: int
    data_health_score: float
    detected_domain: str
    domain_confidence: float
    domain_reasoning: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    files: List[FileRecordSchema] = []
    tables: List[TableMetadataSchema] = []
    relationships: List[TableRelationshipSchema] = []

    model_config = ConfigDict(from_attributes=True)

class DatasetSummarySchema(BaseModel):
    id: str
    name: str
    status: str
    row_count: int
    column_count: int
    data_health_score: float
    detected_domain: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
