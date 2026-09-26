import pytest
import pandas as pd
import numpy as np

from app.services.audio_brief_service import AudioBriefService
from app.services.scenario_planner import ScenarioPlanner
from app.services.driver_tree_service import DriverTreeService

@pytest.fixture
def sample_retail_df():
    np.random.seed(42)
    n = 60
    dates = pd.date_range("2024-01-01", periods=n, freq="W")
    categories = ["Electronics", "Apparel", "Home & Garden", "Books"]
    regions = ["North", "South", "East", "West"]
    
    return pd.DataFrame({
        "Order_Date": dates,
        "Region": np.random.choice(regions, n),
        "Category": np.random.choice(categories, n),
        "Sales": np.random.uniform(50, 500, n),
        "Profit": np.random.uniform(5, 120, n),
        "Discount": np.random.uniform(0.0, 0.3, n),
        "Quantity": np.random.randint(1, 10, n)
    })

def test_audio_brief_generation(sample_retail_df):
    kpis = [
        {"name": "Total Sales", "formatted_value": "$15,200", "status": "positive"},
        {"name": "Net Profit", "formatted_value": "$3,400", "status": "positive"}
    ]
    anomalies = [
        {"severity": "high", "column_name": "Sales", "explanation": "Spike in West region"}
    ]

    brief = AudioBriefService.generate_brief(
        df=sample_retail_df,
        dataset_name="Superstore Retail",
        domain="Retail & E-Commerce",
        kpis=kpis,
        anomalies=anomalies
    )

    assert brief["dataset_name"] == "Superstore Retail"
    assert brief["domain"] == "Retail & E-Commerce"
    assert brief["duration_est_seconds"] > 10
    assert len(brief["key_takeaways"]) >= 3
    assert len(brief["dialogue"]) >= 5

    # Verify speakers alternate and have required attributes
    speakers = [t["speaker"] for t in brief["dialogue"]]
    assert "Alex" in speakers
    assert "Morgan" in speakers
    for turn in brief["dialogue"]:
        assert "text" in turn
        assert len(turn["text"]) > 10
        assert turn["role"] in ["Lead Data Strategist", "Risk & Operations Analyst"]

def test_scenario_planner_config_and_simulate(sample_retail_df):
    config = ScenarioPlanner.get_scenario_config(sample_retail_df)
    assert "target_metric" in config
    assert config["target_metric"] in ["Sales", "Profit"]
    assert len(config["recommended_drivers"]) > 0

    # Positive expansion simulation
    drivers = [
        {"column": "Sales", "shift_pct": 15.0}
    ]
    res_pos = ScenarioPlanner.simulate(
        df=sample_retail_df,
        target_metric="Sales",
        drivers=drivers,
        dimension_col="Region"
    )

    assert res_pos["baseline_total"] > 0
    assert res_pos["projected_total"] > res_pos["baseline_total"]
    assert res_pos["net_delta"] > 0
    assert abs(res_pos["variance_pct"] - 15.0) < 0.1
    assert len(res_pos["comparison_chart"]) == 2
    assert len(res_pos["waterfall_steps"]) >= 3
    assert len(res_pos["segment_breakdown"]) >= 2

    # Negative contraction simulation
    drivers_neg = [
        {"column": "Sales", "shift_pct": -20.0}
    ]
    res_neg = ScenarioPlanner.simulate(
        df=sample_retail_df,
        target_metric="Sales",
        drivers=drivers_neg,
        dimension_col="Region"
    )
    assert res_neg["projected_total"] < res_neg["baseline_total"]
    assert res_neg["net_delta"] < 0
    assert abs(res_neg["variance_pct"] - (-20.0)) < 0.1

def test_driver_tree_decomposition(sample_retail_df):
    config = DriverTreeService.get_tree_config(sample_retail_df)
    assert "default_metric" in config
    assert len(config["all_dimension_columns"]) >= 2

    tree_res = DriverTreeService.build_tree(
        df=sample_retail_df,
        metric_col="Sales",
        dimension_cols=["Region", "Category"]
    )

    assert "tree" in tree_res
    root = tree_res["tree"]
    assert root["id"] == "root"
    assert root["share_of_total_pct"] == 100.0
    assert root["value"] > 0

    # Level 1 nodes
    l1_nodes = root["children"]
    assert len(l1_nodes) >= 2
    l1_shares = sum(n["share_of_total_pct"] for n in l1_nodes)
    assert abs(l1_shares - 100.0) < 1.0  # Sums to ~100%

    # Check leader and drag
    assert "growth_leader" in tree_res
    assert "primary_drag" in tree_res
    assert tree_res["growth_leader"]["segment"] != ""
    assert tree_res["primary_drag"]["segment"] != ""

    # Check Level 2 children exist under at least one L1 node
    has_l2 = any(len(n.get("children", [])) > 0 for n in l1_nodes)
    assert has_l2 is True

    # Test edge case: invalid / nonexistent dimensions gracefully fall back
    res_fallback = DriverTreeService.build_tree(
        df=sample_retail_df,
        metric_col="Sales",
        dimension_cols=["NonExistentColumn", ""]
    )
    assert "error" not in res_fallback
    assert "tree" in res_fallback

    # Test edge case: empty dataframe returns clean error dict
    res_empty = DriverTreeService.build_tree(df=pd.DataFrame())
    assert "error" in res_empty

def test_driver_tree_differentiated_kpis(sample_retail_df):
    """Verify that Count, Sum, and Unique KPI driver trees produce distinct, non-identical results."""
    # 1. Total Volume / Orders (COUNT)
    res_count = DriverTreeService.build_tree(
        df=sample_retail_df,
        metric_col="total_records",
        calculation_type="count",
        dimension_cols=["Region", "Category"],
        display_name="Total Orders / Transactions"
    )
    assert res_count["calculation_type"] == "count"
    assert res_count["total_value"] == float(len(sample_retail_df))

    # 2. Sales / Revenue (SUM)
    res_sum = DriverTreeService.build_tree(
        df=sample_retail_df,
        metric_col="Sales",
        calculation_type="sum",
        dimension_cols=["Region", "Category"],
        display_name="Total Sales"
    )
    assert res_sum["calculation_type"] == "sum"
    assert abs(res_sum["total_value"] - float(sample_retail_df["Sales"].sum())) < 0.1

    # 3. Active Categories (UNIQUE)
    res_unique = DriverTreeService.build_tree(
        df=sample_retail_df,
        metric_col="distinct_category",
        calculation_type="unique",
        dimension_cols=["Region", "Category"],
        display_name="Active Categories"
    )
    assert res_unique["calculation_type"] == "unique"
    assert res_unique["total_value"] == float(sample_retail_df["Category"].nunique())

    # Crucial assertion: Total values and metric names are differentiated
    assert res_count["total_value"] != res_sum["total_value"]
    assert res_count["total_value"] != res_unique["total_value"]
    assert res_count["metric_name"] != res_sum["metric_name"]
    assert res_count["formatted_total"] != res_sum["formatted_total"]
