import pytest
import pandas as pd
from fastapi.testclient import TestClient
from app.main import app
from app.services.executive_report_generator import ExecutiveReportGenerator

client = TestClient(app)

def test_executive_report_generator_unit():
    test_df = pd.DataFrame({
        "revenue": [1200, 4500, 3200, 5800, 9100],
        "category": ["Hardware", "Software", "Cloud", "Security", "Services"],
        "order_date": ["2021-01-01", "2021-02-01", "2021-03-01", "2021-04-01", "2021-05-01"]
    })
    data = ExecutiveReportGenerator.generate_template_data(
        dataset_id="test-ds-1",
        dataset_name="Test Enterprise Dataset",
        df_dict={"sales": test_df},
        user_name="Mike Lock",
        user_role="UI Designer"
    )

    assert data["dataset_id"] == "test-ds-1"
    assert data["user_profile"]["name"] == "Mike Lock"
    assert data["user_profile"]["role"] == "UI Designer"

    # Top KPIs
    assert len(data["top_kpis"]) == 4
    for kpi in data["top_kpis"]:
        assert "title" in kpi
        assert "value" in kpi
        assert "delta" in kpi
        assert "icon" in kpi

    # Growth Capsule Chart
    assert data["growth_chart"]["title"] == "Profile Growth"
    assert len(data["growth_chart"]["bars"]) == 11
    assert any(b["is_peak"] for b in data["growth_chart"]["bars"])
    assert data["growth_chart"]["floating_tooltip"]["label"] == "10 of September"

    # Driver Cards
    assert len(data["driver_cards"]) == 4

    # Table Rows
    assert len(data["table_data"]) >= 3
    for row in data["table_data"]:
        assert "category" in row
        assert "owner" in row
        assert "role" in row
        assert "status" in row

    # Milestones & Right Column
    assert len(data["milestone_cards"]) == 3
    assert len(data["analytics_card"]["bars"]) == 3
    assert len(data["calendar_strip"]["days"]) == 7
    assert data["calendar_strip"]["active_day"] == 13
    assert data["audit_card"]["radial_percentage"] == 75

def test_executive_report_endpoints():
    # 1. Load sample dataset
    resp = client.post("/api/samples/multi_retail/load")
    assert resp.status_code == 200
    dataset = resp.json()
    ds_id = dataset["id"]

    # 2. Test GET /api/reports/{ds_id}/executive-template
    get_resp = client.post(f"/api/reports/{ds_id}/executive-template")
    # Wait, GET endpoint is GET!
    get_resp = client.get(f"/api/reports/{ds_id}/executive-template")
    assert get_resp.status_code == 200
    template_data = get_resp.json()

    assert template_data["dataset_id"] == ds_id
    assert len(template_data["top_kpis"]) == 4
    assert len(template_data["growth_chart"]["bars"]) == 11
    assert len(template_data["driver_cards"]) == 4
    assert len(template_data["table_data"]) >= 3
    assert template_data["audit_card"]["radial_percentage"] == 75

    # 3. Test POST /api/reports/{ds_id}/executive-template/generate with custom prompt
    post_resp = client.post(
        f"/api/reports/{ds_id}/executive-template/generate",
        json={"prompt": "Executive SaaS Audit for Board Meeting", "user_name": "Sarah Connor", "user_role": "VP Analytics"}
    )
    assert post_resp.status_code == 200
    custom_data = post_resp.json()
    assert custom_data["user_profile"]["name"] == "Sarah Connor"
    assert custom_data["user_profile"]["role"] == "VP Analytics"
    assert custom_data["custom_prompt"] == "Executive SaaS Audit for Board Meeting"
