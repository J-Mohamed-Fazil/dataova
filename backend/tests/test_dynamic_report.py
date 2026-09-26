import sys
from pathlib import Path

# Ensure backend root is always on sys.path
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

import pytest
import pandas as pd

try:
    from fastapi.testclient import TestClient
except (ImportError, AttributeError):
    from starlette.testclient import TestClient  # type: ignore

from app.main import app
from app.services.report_service import ReportService

client = TestClient(app)

def test_dynamic_sections_retail():
    df = pd.DataFrame({
        "order_id": ["ORD-101", "ORD-102", "ORD-103", "ORD-104", "ORD-105"],
        "customer": ["Alice Corp", "Bob Ltd", "Charlie Inc", "David LLC", "Eve Ent"],
        "category": ["Electronics", "Furniture", "Electronics", "Office Supplies", "Furniture"],
        "sales": [1450.0, 320.5, 2900.0, 110.0, 850.0],
        "quantity": [4, 1, 8, 2, 3],
        "order_date": ["2024-01-15", "2024-02-10", "2024-03-05", "2024-04-20", "2024-05-12"]
    })

    health_info = {
        "score": 96,
        "rating": "Good",
        "metrics": {"total_cells": 30, "missing_cells": 0, "missing_pct": 0, "duplicate_rows": 0, "duplicate_pct": 0},
        "issues": []
    }

    kpis = [{
        "display_name": "Total Sales Revenue",
        "formatted_value": "$5,630.50",
        "calculation_type": "sum",
        "source_table": "Retail Orders"
    }]

    insights = [{
        "title": "Electronics Leads Revenue Contribution",
        "description": "Electronics generated over 75% of total merchandise volume.",
        "statement_type": "calculation",
        "why_it_matters": "Core revenue driver for Q1-Q2."
    }]

    anomalies = [{
        "table_name": "Retail Orders",
        "column_name": "sales",
        "anomaly_count": 1,
        "severity": "medium",
        "explanation": "High value order detected exceeding 2 IQR thresholds."
    }]

    sections = ReportService.generate_dynamic_sections(
        dataset_name="Global Commerce Q1",
        domain="Retail & E-Commerce",
        health_info=health_info,
        kpis=kpis,
        insights=insights,
        anomalies=anomalies,
        dataframes={"Retail Orders": df}
    )

    assert len(sections) >= 6
    section_types = [s["section_type"] for s in sections]
    assert "executive_summary" in section_types
    assert "dataset_overview" in section_types
    assert "key_metrics" in section_types
    assert "segment_analysis" in section_types
    assert "data_quality" in section_types

    # Verify that dataset excerpt table contains real records
    sample_sec = next(s for s in sections if s["section_type"] == "dataset_overview")
    assert len(sample_sec["tables_included"]) == 1
    sample_tbl = sample_sec["tables_included"][0]
    assert len(sample_tbl["rows"]) > 0
    assert "order_id" in sample_tbl["headers"] or "customer" in sample_tbl["headers"]

    # Verify PDF export builds without crashing
    pdf_bytes = ReportService.export_report_pdf("Global Commerce Report", "Q1 Analysis", sections)
    assert len(pdf_bytes) > 1000

    # Verify Excel export
    excel_bytes = ReportService.export_report_excel("Global Commerce Report", sections, {"Retail Orders": df})
    assert len(excel_bytes) > 1000

def test_regenerate_report_api():
    # Load sample dataset
    load_resp = client.post("/api/samples/retail/load")
    assert load_resp.status_code == 200
    ds = load_resp.json()
    ds_id = ds["id"]

    # Call regenerate endpoint
    regen_resp = client.post(f"/api/reports/{ds_id}/regenerate")
    assert regen_resp.status_code == 200
    report_data = regen_resp.json()

    assert report_data["dataset_id"] == ds_id
    assert len(report_data["sections"]) >= 5

    # Check that at least 3 sections have structured tables
    sections_with_tables = [s for s in report_data["sections"] if len(s["tables_included"]) > 0]
    assert len(sections_with_tables) >= 3

    # Test PDF Export via API
    pdf_resp = client.get(f"/api/reports/{ds_id}/export/pdf")
    assert pdf_resp.status_code == 200
    assert "application/pdf" in pdf_resp.headers["content-type"]
    assert len(pdf_resp.content) > 2000

    # Test Excel Export via API
    excel_resp = client.get(f"/api/reports/{ds_id}/export/excel")
    assert excel_resp.status_code == 200
    assert len(excel_resp.content) > 2000

    # Test that charts_included are populated with data and insights
    sections_with_charts = [s for s in report_data["sections"] if len(s.get("charts_included", [])) > 0]
    assert len(sections_with_charts) >= 2
    first_chart = sections_with_charts[0]["charts_included"][0]
    assert "data" in first_chart
    assert len(first_chart["data"]) > 0
    assert "insight" in first_chart
    assert "headline" in first_chart["insight"]

    # Test AI Deepen Endpoint
    ai_resp = client.post(f"/api/reports/{ds_id}/ai-deepen")
    assert ai_resp.status_code == 200
    ai_report = ai_resp.json()
    ai_sections = [s for s in ai_report["sections"] if s["section_type"] == "ai_deepen"]
    assert len(ai_sections) == 1
    assert len(ai_sections[0]["content"]) > 50

def test_dedicated_pdf_executive_dashboard_with_ai_insights():
    """Validates that the PDF generator builds a dedicated executive dashboard page with KPI scorecards, vector charts, and AI directives."""
    kpis = [
        {"display_name": "Gross Merchandise Value", "formatted_value": "$124,500.00", "calculation_type": "sum", "source_table": "Orders", "source_column": "gmv", "impact_summary": "Top revenue anchor."},
        {"display_name": "Average Order Value", "formatted_value": "$342.50", "calculation_type": "mean", "source_table": "Orders", "source_column": "order_total", "impact_summary": "Basket size velocity."},
        {"display_name": "Active Retention Rate", "formatted_value": "88.5%", "calculation_type": "ratio", "source_table": "Customers", "source_column": "retention", "impact_summary": "Customer loyalty index."}
    ]

    insights = [
        {"title": "Enterprise Segment Leads Revenue", "description": "Enterprise accounts contribute 64% of total transaction volume.", "severity": "positive", "recommendation": "Expand tier 1 account coverage."}
    ]

    charts = [
        {
            "title": "Segment Contribution",
            "subtitle": "Distribution of revenue",
            "chart_type": "bar",
            "data": [{"label": "Enterprise", "value": 80000.0}, {"label": "Mid-Market", "value": 32000.0}, {"label": "SMB", "value": 12500.0}],
            "insight": {"headline": "Enterprise Dominance", "description": "Enterprise accounts represent 64% of gross revenue.", "impact": "Primary growth engine.", "severity": "positive"}
        },
        {
            "title": "Quarterly Target Benchmarks",
            "subtitle": "Observed performance metrics",
            "chart_type": "bar",
            "data": [{"label": "Q1 Rev", "value": 31000.0}, {"label": "Q2 Rev", "value": 42000.0}, {"label": "Q3 Rev", "value": 51500.0}],
            "insight": {"headline": "Upward Velocity", "description": "Quarter over quarter acceleration.", "impact": "Positive forecast trajectory.", "severity": "positive"}
        }
    ]

    sections = [
        {
            "title": "Commercial Overview",
            "content": "Executive commercial summary narrative.",
            "charts_included": charts,
            "tables_included": [{"title": "Summary Table", "headers": ["Segment", "Value"], "rows": [["Enterprise", "$80k"], ["Mid-Market", "$32k"]]}]
        }
    ]

    ai_briefing = {
        "executive_headline": "Autonomous Intelligence Briefing",
        "strategic_takeaway": "Commercial velocity expanded by 24% across primary segments.",
        "directives": [
            {"title": "Merchandising Focus", "action": "Scale enterprise tier marketing programs."},
            {"title": "Retention Safeguards", "action": "Ensure high SLA support for top 20 accounts."}
        ]
    }

    pdf_bytes = ReportService.export_report_pdf(
        report_title="C-Suite Executive Briefing",
        subtitle="Autonomous Commercial Dossier",
        sections=sections,
        kpis=kpis,
        insights=insights,
        anomalies=[],
        dataset_meta={"name": "Global Commerce", "domain": "Retail & E-Commerce", "health_score": 97, "row_count": 50000},
        ai_briefing=ai_briefing
    )

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 2000
    assert pdf_bytes.startswith(b"%PDF")

