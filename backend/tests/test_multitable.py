import pytest
import pandas as pd
from app.config import settings
from app.services.relationship_finder import RelationshipFinder
from app.services.calculation_tools import CalculationTools

@pytest.fixture
def orders_df():
    return pd.read_csv(settings.SAMPLES_DIR / "relational_orders.csv")

@pytest.fixture
def customers_df():
    return pd.read_csv(settings.SAMPLES_DIR / "relational_customers.csv")

def test_relationship_detection_multi_table(orders_df, customers_df):
    dataframes = {
        "orders": orders_df,
        "customers": customers_df
    }
    rels = RelationshipFinder.detect_relationships(dataframes)
    assert len(rels) >= 1
    rel = rels[0]
    # Check that Customer_ID is matched across orders and customers
    assert "Customer_ID" in [rel["source_column"], rel["target_column"]]
    assert rel["confidence"] >= 0.8
    assert rel["relationship_type"] in ["one_to_many", "many_to_one"]

def test_cross_table_joined_aggregation(orders_df, customers_df):
    # Merge tables on Customer_ID
    merged = orders_df.merge(customers_df, on="Customer_ID")
    assert len(merged) == len(orders_df)
    assert "Customer_Segment" in merged.columns
    assert "Revenue" in merged.columns

    # Aggregate Revenue by Customer_Segment (Cross-table metric)
    res = CalculationTools.execute_aggregation(
        merged,
        group_by_col="Customer_Segment",
        value_col="Revenue",
        agg_type="sum"
    )
    assert len(res) >= 2
    assert "label" in res[0]
    assert "value" in res[0]
    assert res[0]["value"] > 0
    # Verify segments exist like Corporate, Enterprise, Small Business, Consumer
    labels = [r["label"] for r in res]
    assert any("Corporate" in l or "Enterprise" in l for l in labels)
