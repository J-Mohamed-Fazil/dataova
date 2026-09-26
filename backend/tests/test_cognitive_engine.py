import pytest
import pandas as pd
from fastapi.testclient import TestClient
from app.main import app
from app.services.ai_studio_cognitive_engine import AIStudioCognitiveEngine

client = TestClient(app)

def test_cognitive_engine_unit_analysis():
    # 1. Semantic Column Classification
    rev_series = pd.Series([1000.0, 2500.0, 3200.0, 4100.0, 500.0])
    sem_rev = AIStudioCognitiveEngine.classify_column_semantics("total_revenue", rev_series)
    assert sem_rev["role"] == "volume_metric"

    margin_series = pd.Series([0.15, 0.22, 0.35, 0.08, 0.19])
    sem_margin = AIStudioCognitiveEngine.classify_column_semantics("profit_margin", margin_series)
    assert sem_margin["role"] == "efficiency_metric"

    cat_series = pd.Series(["Electronics", "Home Decor", "Footwear", "Apparel", "Beauty"])
    sem_cat = AIStudioCognitiveEngine.classify_column_semantics("product_category", cat_series)
    assert sem_cat["role"] == "core_entity"

    # 2. DataFrame Intelligence Profiling
    test_df = pd.DataFrame({
        "product_category": ["Electronics", "Home Decor", "Footwear", "Apparel", "Beauty"] * 20,
        "total_revenue": [1200, 450, 800, 2100, 350] * 20,
        "profit_margin": [0.25, 0.15, 0.30, 0.10, 0.40] * 20
    })
    prof = AIStudioCognitiveEngine.profile_dataframe_intelligence(test_df, "sales_table")
    assert prof["total_rows"] == 100
    assert "total_revenue" in prof["numeric_summaries"]
    assert prof["numeric_summaries"]["total_revenue"]["mean"] > 0
    assert len(prof["key_correlations"]) >= 0

    # 3. Cognitive Synthesis with 5-Step Thought Process
    res = AIStudioCognitiveEngine.execute_cognitive_synthesis(
        prompt="Analyze revenue by product category and highlight top cohort",
        df_dict={"sales_table": test_df},
        relationships=[]
    )
    assert "thought_process" in res
    assert len(res["thought_process"]) == 5
    assert res["thought_process"][0]["title"] == "Cognitive Intent & Query Deconstruction"
    assert res["thought_process"][1]["title"] == "Deep Data Distribution & Statistical Profiling"
    assert "mind_sparks" in res
    assert len(res["mind_sparks"]) == 3
    assert len(res["chart_data"]) > 0

    # 4. Deep Analytical Diagnosis (Outliers, Sensitivity, Playbook)
    diag = AIStudioCognitiveEngine.deepen_analytical_diagnosis(
        df=test_df,
        x_field="product_category",
        y_field="total_revenue",
        chart_type="bar",
        aggregation="sum"
    )
    assert "top_driver" in diag
    assert diag["top_driver"]["label"] == "Apparel"
    assert "sensitivity" in diag
    assert diag["sensitivity"]["net_gain"] > 0
    assert "playbook" in diag
    assert len(diag["playbook"]) == 3

    # 5. What-If Scenario Levers
    sim = AIStudioCognitiveEngine.simulate_what_if_lever(
        chart_points=res["chart_data"],
        delta_pct=15.0,
        target_cohort="ALL"
    )
    assert sim["delta_pct_applied"] == 15.0
    assert sim["net_delta"] > 0
    assert sim["projected_total"] > sim["original_total"]

    # 6. Test Composed Chart Synthesis
    composed_res = AIStudioCognitiveEngine.execute_cognitive_synthesis(
        prompt="Compare total_revenue vs profit_margin across product_category",
        df_dict={"sales_table": test_df},
        relationships=[]
    )
    assert composed_res["chart_type"] == "composed"
    assert len(composed_res["chart_data"]) > 0
    assert "secondary_value" in composed_res["chart_data"][0]

    # 7. Test Treemap Chart Synthesis
    treemap_res = AIStudioCognitiveEngine.execute_cognitive_synthesis(
        prompt="Show treemap breakdown of total_revenue by product_category",
        df_dict={"sales_table": test_df},
        relationships=[]
    )
    assert treemap_res["chart_type"] == "treemap"
    assert len(treemap_res["chart_data"]) > 0

    # 8. Test Heatmap Chart Synthesis
    heatmap_res = AIStudioCognitiveEngine.execute_cognitive_synthesis(
        prompt="Show heatmap intensity matrix of product_category",
        df_dict={"sales_table": test_df},
        relationships=[]
    )
    assert heatmap_res["chart_type"] == "heatmap"
    assert len(heatmap_res["chart_data"]) > 0

def test_cognitive_api_endpoints():
    # 1. Load multi_retail sample
    resp = client.post("/api/samples/multi_retail/load")
    assert resp.status_code == 200
    dataset = resp.json()
    ds_id = dataset["id"]

    # 2. Test /studio/ai-synthesize returns 5-step thought_process & mind_sparks
    synth_resp = client.post(
        f"/api/dashboard/{ds_id}/studio/ai-synthesize",
        json={"prompt": "Analyze sales by category and assess margin"}
    )
    assert synth_resp.status_code == 200
    s_data = synth_resp.json()
    assert "thought_process" in s_data
    assert len(s_data["thought_process"]) == 5
    assert "mind_sparks" in s_data
    assert len(s_data["mind_sparks"]) == 3
    assert "strategic_directive" in s_data
    assert len(s_data["chart_data"]) > 0

    # 3. Test /studio/deepen-thinking
    deep_resp = client.post(
        f"/api/dashboard/{ds_id}/studio/deepen-thinking",
        json={
            "table_name": s_data["table_name"],
            "x_field": s_data["x_field"],
            "y_field": s_data["y_field"],
            "chart_type": s_data["chart_type"],
            "aggregation": s_data["aggregation"]
        }
    )
    assert deep_resp.status_code == 200
    d_data = deep_resp.json()
    assert "top_driver" in d_data
    assert "sensitivity" in d_data
    assert "playbook" in d_data
    assert len(d_data["playbook"]) == 3

    # 4. Test /studio/what-if-simulate
    sim_resp = client.post(
        f"/api/dashboard/{ds_id}/studio/what-if-simulate",
        json={
            "points": s_data["chart_data"],
            "delta_pct": 20.0,
            "target_cohort": "ALL"
        }
    )
    assert sim_resp.status_code == 200
    sim_data = sim_resp.json()
    assert sim_data["delta_pct_applied"] == 20.0
    assert sim_data["projected_total"] > sim_data["original_total"]
    assert len(sim_data["projected_points"]) == len(s_data["chart_data"])
