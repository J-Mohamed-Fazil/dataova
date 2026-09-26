import pytest
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from app.main import app
from app.services.automl_engine import AutoMLEngine
from app.services.calculation_tools import CalculationTools
from app.services.cache_manager import DataFrameCache

client = TestClient(app)

@pytest.fixture
def classification_sample_df():
    np.random.seed(42)
    n = 100
    departments = ["Sales", "Engineering", "Marketing", "HR"]
    salary = np.random.uniform(40000, 140000, n)
    years = np.random.randint(1, 15, n)
    satisfaction = np.random.uniform(1.0, 5.0, n)
    # Churn probability higher if low satisfaction and low salary
    churn_prob = 1.0 / (1.0 + np.exp(-(2.5 - satisfaction + (80000 - salary) / 60000)))
    attrition = np.where(churn_prob > 0.5, "Yes", "No")

    return pd.DataFrame({
        "Employee_ID": [f"EMP-{i:04d}" for i in range(n)],
        "Department": np.random.choice(departments, n),
        "Salary": salary,
        "Years_At_Company": years,
        "Satisfaction_Score": satisfaction,
        "Attrition": attrition
    })

@pytest.fixture
def regression_sample_df():
    np.random.seed(42)
    n = 120
    ad_spend = np.random.uniform(500, 5000, n)
    discount = np.random.uniform(0.0, 0.3, n)
    store_traffic = np.random.randint(50, 600, n)
    # Ground truth formula: Sales = 1000 + 4.5 * ad_spend - 200 * discount + 12 * traffic + noise
    sales = 1000.0 + 4.5 * ad_spend - 200.0 * discount + 12.0 * store_traffic + np.random.normal(0, 100, n)

    return pd.DataFrame({
        "Ad_Spend": ad_spend,
        "Discount_Rate": discount,
        "Store_Traffic": store_traffic,
        "Sales_Revenue": sales,
        "Store_Region": np.random.choice(["North", "South", "East", "West"], n)
    })

def test_automl_candidate_target_discovery(classification_sample_df):
    candidates = AutoMLEngine.get_candidate_targets(classification_sample_df)
    assert len(candidates) > 0
    attrition_cand = next((c for c in candidates if c["column_name"] == "Attrition"), None)
    assert attrition_cand is not None
    assert attrition_cand["task_type"] == "classification"
    assert attrition_cand["unique_values_count"] == 2

def test_automl_classification_training(classification_sample_df):
    result = AutoMLEngine.run_automl(
        df=classification_sample_df,
        target_col="Attrition",
        feature_cols=["Department", "Salary", "Years_At_Company", "Satisfaction_Score"]
    )

    assert "error" not in result
    assert result["task_type"] == "classification"
    assert len(result["leaderboard"]) >= 3
    assert result["champion_model"] in ["Logistic Regression (L2)", "Decision Tree (CART)", "Random Forest Ensemble"]
    assert len(result["feature_importance"]) == 4
    assert len(result["confusion_matrix"]) == 2

    # Verify What-If Prediction
    pred = AutoMLEngine.predict_what_if(
        model_id=result["model_id"],
        feature_inputs={
            "Department": "Engineering",
            "Salary": 120000,
            "Years_At_Company": 5,
            "Satisfaction_Score": 4.8
        }
    )
    assert "error" not in pred
    assert pred["task_type"] == "classification"
    assert pred["predicted_label"] in ["Yes", "No"]
    assert pred["confidence_pct"] > 50.0

def test_automl_regression_training(regression_sample_df):
    result = AutoMLEngine.run_automl(
        df=regression_sample_df,
        target_col="Sales_Revenue",
        feature_cols=["Ad_Spend", "Discount_Rate", "Store_Traffic", "Store_Region"]
    )

    assert "error" not in result
    assert result["task_type"] == "regression"
    assert len(result["leaderboard"]) >= 3
    
    # Check champion model metrics
    champion_entry = result["leaderboard"][0]
    assert champion_entry["r_squared"] > 0.6
    assert champion_entry["rmse"] > 0
    assert len(result["feature_importance"]) == 4

    # Top feature should be Ad_Spend or Store_Traffic
    top_features = [f["feature"] for f in result["feature_importance"][:2]]
    assert "Ad_Spend" in top_features or "Store_Traffic" in top_features

    # Verify What-If Prediction
    pred = AutoMLEngine.predict_what_if(
        model_id=result["model_id"],
        feature_inputs={
            "Ad_Spend": 3000,
            "Discount_Rate": 0.1,
            "Store_Traffic": 300,
            "Store_Region": "East"
        }
    )
    assert "error" not in pred
    assert pred["task_type"] == "regression"
    assert pred["predicted_value"] > 5000.0
    assert pred["range_lower"] < pred["predicted_value"] < pred["range_upper"]

def test_pareto_analysis_calculation(regression_sample_df):
    res = CalculationTools.execute_pareto_analysis(
        df=regression_sample_df,
        dimension_col="Store_Region",
        metric_col="Sales_Revenue"
    )

    assert "error" not in res
    assert res["total_entities"] == 4
    assert res["vital_few_count"] >= 1
    assert 0.0 <= res["gini_coefficient"] <= 1.0
    assert len(res["items"]) == 4
    assert res["items"][0]["cumulative_pct"] >= res["items"][0]["share_pct"]
    assert "executive_takeaway" in res

def test_multivariate_regression_calculation(regression_sample_df):
    res = CalculationTools.execute_multivariate_regression(
        df=regression_sample_df,
        target_col="Sales_Revenue",
        feature_cols=["Ad_Spend", "Store_Traffic"]
    )

    assert "error" not in res
    assert res["r_squared"] > 0.8
    assert res["adjusted_r_squared"] > 0.8
    assert len(res["coefficients"]) == 2
    # Check p-values and significance
    for coef in res["coefficients"]:
        assert coef["p_value"] < 0.05
        assert coef["is_statistically_significant"] is True
    assert "Sales_Revenue =" in res["formula_equation"]


def test_dataframe_cache_get_and_set_methods():
    """Verify DataFrameCache.get and .set prevent AttributeError regressions."""
    sample_df = pd.DataFrame({"col_a": [1, 2, 3], "col_b": ["x", "y", "z"]})
    fake_path = "C:/mock/data_test_cache.csv"
    table_name = "test_table"

    # Verify set writes to cache
    DataFrameCache.set(fake_path, table_name, sample_df)

    # Verify get retrieves from cache without error
    retrieved = DataFrameCache.get(fake_path, table_name)
    assert retrieved is not None
    assert len(retrieved) == 3
    assert list(retrieved.columns) == ["col_a", "col_b"]

    # Verify get on non-existent path gracefully returns None without throwing AttributeError
    assert DataFrameCache.get("C:/mock/non_existent_file.csv") is None


def test_automl_api_candidates_and_train_endpoints():
    """Test full HTTP lifecycle for AutoML candidates and train endpoints."""
    # 1. Load sample dataset
    load_resp = client.post("/api/samples/retail/load")
    assert load_resp.status_code == 200, f"Sample load failed: {load_resp.text}"
    ds = load_resp.json()
    dataset_id = ds["id"]

    # 2. Query AutoML candidate targets (tests _load_primary_df)
    cand_resp = client.get(f"/api/analysis/{dataset_id}/automl/candidates")
    assert cand_resp.status_code == 200, f"Candidate lookup failed: {cand_resp.text}"
    cand_data = cand_resp.json()
    assert "candidates" in cand_data
    assert len(cand_data["candidates"]) > 0

    # Find a numeric or categorical column to train on
    target = cand_data["candidates"][0]["column_name"]
    features = [c["column_name"] for c in cand_data["candidates"][1:4]]
    task_type = cand_data["candidates"][0]["task_type"]

    # 3. Trigger AutoML train (previously failed with type object 'DataFrameCache' has no attribute 'get')
    train_resp = client.post(
        f"/api/analysis/{dataset_id}/automl/train",
        json={
            "target_column": target,
            "feature_columns": features,
            "task_type": task_type
        }
    )
    assert train_resp.status_code == 200, f"AutoML train endpoint failed: {train_resp.text}"
    train_data = train_resp.json()
    assert "leaderboard" in train_data
    assert len(train_data["leaderboard"]) >= 2
    assert "champion_model" in train_data
    assert "model_id" in train_data

