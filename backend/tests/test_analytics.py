import pytest
import pandas as pd
from pathlib import Path

from app.config import settings
from app.services.file_processor import FileProcessor
from app.services.profiler import DataProfiler
from app.services.quality_scorer import QualityScorer
from app.services.domain_detector import DomainDetector
from app.services.relationship_finder import RelationshipFinder
from app.services.calculation_tools import CalculationTools
from app.services.anomaly_detector import AnomalyDetector
from app.services.kpi_engine import KpiEngine
from app.services.insight_engine import InsightEngine
from app.services.report_service import ReportService
from app.services.chat_agent import ChatAgent

@pytest.fixture
def retail_df():
    path = settings.SAMPLES_DIR / "retail_sales.csv"
    return pd.read_csv(path)

@pytest.fixture
def hr_df():
    path = settings.SAMPLES_DIR / "hr_workforce.csv"
    return pd.read_csv(path)

def test_profiler_and_types(retail_df):
    profile = DataProfiler.profile_table(retail_df, "retail_sales")
    assert profile["row_count"] == 30
    assert profile["column_count"] == 10
    col_names = [c["column_name"] for c in profile["columns"]]
    assert "Revenue" in col_names
    assert "Category" in col_names

def test_quality_scorer(retail_df):
    profile = DataProfiler.profile_table(retail_df, "retail_sales")
    quality = QualityScorer.calculate_health_score([profile])
    assert quality["score"] >= 90.0
    assert quality["rating"] in ["Good", "Excellent"]

def test_domain_detection(retail_df, hr_df):
    p_retail = DataProfiler.profile_table(retail_df, "retail_sales")
    dom_retail, conf_r, _ = DomainDetector.detect_domain([p_retail])
    assert "Retail" in dom_retail

    p_hr = DataProfiler.profile_table(hr_df, "hr_workforce")
    dom_hr, conf_h, _ = DomainDetector.detect_domain([p_hr])
    assert "Human Resources" in dom_hr

def test_kpi_discovery(retail_df, hr_df):
    kpis_retail = KpiEngine.discover_kpis({"retail_sales": retail_df}, "Retail & E-Commerce")
    assert len(kpis_retail) >= 3
    # Check that formatted value exists and formula is provided
    for k in kpis_retail:
        assert k["formatted_value"] != ""
        assert "formula_explanation" in k

    kpis_hr = KpiEngine.discover_kpis({"hr_workforce": hr_df}, "Human Resources")
    assert any("Salary" in k["display_name"] or "Workforce" in k["display_name"] for k in kpis_hr)

def test_anomaly_detection(retail_df):
    anomalies = AnomalyDetector.detect_anomalies({"retail_sales": retail_df})
    assert isinstance(anomalies, list)

def test_deterministic_aggregations(retail_df):
    res = CalculationTools.execute_aggregation(retail_df, group_by_col="Category", value_col="Revenue", agg_type="sum")
    assert len(res) > 0
    assert "label" in res[0]
    assert "value" in res[0]
    assert res[0]["value"] > 0

def test_report_pdf_and_excel(retail_df):
    sections = [
        {"title": "Executive Summary", "content": "Summary test content."},
        {"title": "Key Metrics", "content": "KPI test content.", "tables_included": [{"data": [["Metric", "Val"], ["Rev", "$100"]]}]}
    ]
    pdf_bytes = ReportService.export_report_pdf("Test Report", "Sub", sections)
    assert len(pdf_bytes) > 500  # Non-empty valid PDF

    excel_bytes = ReportService.export_report_excel("Test Report", sections, {"retail": retail_df})
    assert len(excel_bytes) > 500

@pytest.mark.asyncio
async def test_chat_agent_chart_action(retail_df):
    query = "Create a bar chart showing revenue by category"
    result = await ChatAgent.process_user_query(
        query=query,
        dataframes={"retail_sales": retail_df},
        domain="Retail & E-Commerce",
        kpis=[]
    )
    assert result["action_type"] == "CREATE_CHART"
    assert result["action_payload"]["chart_type"] == "bar"
    assert "citations" in result
