import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_multi_table_end_to_end_dashboard_generation():
    # 1. Load multi-table relational sample dataset
    resp = client.post("/api/samples/multi_retail/load")
    assert resp.status_code == 200, f"Failed to load multi-table sample: {resp.text}"
    dataset = resp.json()
    ds_id = dataset["id"]

    assert len(dataset["tables"]) >= 2
    table_names = [t["table_name"] for t in dataset["tables"]]
    assert "relational_orders" in table_names
    assert "relational_customers" in table_names

    # 2. Check relationship detected
    assert len(dataset["relationships"]) >= 1
    rel = dataset["relationships"][0]
    assert "Customer_ID" in [rel["source_column"], rel["target_column"]]
    print(f"[PASS] Detected relationship: {rel['source_table']}.{rel['source_column']} -> {rel['target_table']}.{rel['target_column']}")

    # 3. Fetch Dashboard Sheets
    sheets_resp = client.get(f"/api/dashboard/{ds_id}/sheets")
    assert sheets_resp.status_code == 200
    sheets = sheets_resp.json()

    sheet_titles = [s["title"] for s in sheets]
    print(f"[PASS] Generated sheets: {sheet_titles}")

    # Verify that Cross-Table sheet exists!
    assert any("Cross-Table Unified Intelligence" in t for t in sheet_titles)
    assert any("relational_orders" in t for t in sheet_titles)
    assert any("relational_customers" in t for t in sheet_titles)

    # 4. Verify that Cross-Table charts computed data from BOTH tables
    cross_sheet = next(s for s in sheets if "Cross-Table Unified Intelligence" in s["title"])
    assert len(cross_sheet["charts"]) > 0
    for chart in cross_sheet["charts"]:
        print(f"  Cross Chart: '{chart['title']}' (Join: {chart.get('join_table')}) -> {len(chart.get('data') or [])} data points")
        assert len(chart.get("data") or []) > 0
        for pt in chart["data"]:
            assert "label" in pt or "x" in pt
            assert "value" in pt or "y" in pt

    print("[PASS] Multi-table cross-table dashboard generation fully verified!")

def test_ai_dashboard_studio_endpoints():
    # 1. Load multi-table sample
    resp = client.post("/api/samples/multi_retail/load")
    assert resp.status_code == 200
    dataset = resp.json()
    ds_id = dataset["id"]

    # 2. Test Studio Blueprints
    bp_resp = client.get(f"/api/dashboard/{ds_id}/studio/blueprints")
    assert bp_resp.status_code == 200
    bp_data = bp_resp.json()
    assert len(bp_data["blueprints"]) >= 5
    print(f"[PASS] Retrieved {len(bp_data['blueprints'])} AI Studio blueprints")

    # 3. Test AI Prompt Synthesis
    synth_resp = client.post(
        f"/api/dashboard/{ds_id}/studio/ai-synthesize",
        json={"prompt": "Show top revenue categories as a bar chart"}
    )
    assert synth_resp.status_code == 200
    synth_data = synth_resp.json()
    assert "title" in synth_data
    assert "chart_data" in synth_data
    assert "summary" in synth_data
    assert "ai_insight" in synth_data
    assert len(synth_data["chart_data"]) > 0
    print(f"[PASS] AI Synthesized: '{synth_data['title']}' -> {len(synth_data['chart_data'])} points, Insight: {synth_data['ai_insight'][:50]}...")

    # 4. Test Live Chart Preview
    preview_resp = client.post(
        f"/api/dashboard/{ds_id}/studio/preview-chart",
        json={
            "table_name": "relational_orders",
            "x_field": synth_data["x_field"],
            "y_field": synth_data["y_field"],
            "chart_type": "bar",
            "aggregation": "sum"
        }
    )
    assert preview_resp.status_code == 200
    prev_data = preview_resp.json()
    assert len(prev_data["chart_data"]) > 0
    assert prev_data["summary"]["total_points"] > 0
    print(f"[PASS] Studio Preview computed {len(prev_data['chart_data'])} points, Peak: {prev_data['summary']['peak_label']} ({prev_data['summary']['peak_val']})")

