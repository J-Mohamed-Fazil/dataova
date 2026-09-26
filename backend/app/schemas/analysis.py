from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict

class KpiMetricSchema(BaseModel):
    id: str
    name: str
    display_name: str
    value: float
    formatted_value: str
    unit: str = ""
    calculation_type: str
    source_table: str
    source_column: Optional[str] = None
    formula_explanation: str
    impact_summary: Optional[str] = None
    confidence: float
    order_index: int
    # Statistical Quintet & AI Insights
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    sum_value: Optional[float] = None
    avg_value: Optional[float] = None
    count_value: Optional[int] = None
    formatted_min: Optional[str] = None
    formatted_max: Optional[str] = None
    formatted_sum: Optional[str] = None
    formatted_avg: Optional[str] = None
    formatted_count: Optional[str] = None
    ai_insight: Optional[str] = None
    statistical_summary: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)

class InsightSchema(BaseModel):
    id: str
    title: str
    category: str  # trend, anomaly, opportunity, risk, performance, data_quality, comparison
    statement_type: str  # fact, calculation, inference, recommendation
    description: str
    calculation_details: Dict[str, Any]
    why_it_matters: str
    recommendation: Optional[str] = None
    severity: str
    confidence: float
    source_table: Optional[str] = None
    source_columns: List[str] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AnomalyRecordSchema(BaseModel):
    id: str
    table_name: str
    column_name: str
    method: str
    anomaly_count: int
    severity: str
    details: Dict[str, Any]
    explanation: str

    model_config = ConfigDict(from_attributes=True)

class AnalysisOverviewSchema(BaseModel):
    dataset_id: str
    dataset_name: str
    data_health_score: float
    detected_domain: str
    domain_confidence: float
    domain_reasoning: Optional[str] = None
    row_count: int
    column_count: int
    kpis: List[KpiMetricSchema] = []
    insights: List[InsightSchema] = []
    anomalies: List[AnomalyRecordSchema] = []

# --- Advanced Analytics & AutoML Schemas ---

class AutoMLTrainRequest(BaseModel):
    target_column: str
    feature_columns: Optional[List[str]] = None
    task_type: str = "auto"
    table_name: Optional[str] = None

class AutoMLPredictRequest(BaseModel):
    model_id: str
    feature_inputs: Dict[str, Any]

class ParetoAnalysisRequest(BaseModel):
    dimension_col: str
    metric_col: str
    top_n: int = 30
    table_name: Optional[str] = None

class MultivariateRegressionRequest(BaseModel):
    target_col: str
    feature_cols: Optional[List[str]] = None
    table_name: Optional[str] = None

# --- Data Health & Relationship Intelligence Schemas ---

class TableHealthSummarySchema(BaseModel):
    table_name: str
    row_count: int
    column_count: int
    health_score: int
    rating: str
    completeness_pct: float
    duplicate_rows: int
    null_cells: int
    outlier_cells: int
    primary_keys: List[str] = []
    summary_narrative: str
    column_breakdown: List[Dict[str, Any]] = []

class RelationshipFindingSchema(BaseModel):
    relationship_type: str
    source: str
    target: str
    status: str
    strength_score: float
    metric_label: str
    category: str
    explanation: str
    impact: str
    recommendation: str

class HealthRelationshipSummarySchema(BaseModel):
    dataset_id: str
    dataset_name: str
    overall_health_score: int
    overall_rating: str
    total_tables: int
    total_records: int
    total_cells: int
    total_nulls: int
    total_duplicates: int
    executive_summary: str
    tables_summary: List[TableHealthSummarySchema] = []
    good_relationships: List[RelationshipFindingSchema] = []
    bad_relationships: List[RelationshipFindingSchema] = []
    good_count: int
    bad_count: int
    warning_count: int
    key_takeaways: List[str] = []
    actionable_recommendations: List[str] = []
    report_ready_markdown: str

