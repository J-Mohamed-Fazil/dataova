import pytest
import pandas as pd
import numpy as np

from app.services.forecast_engine import ForecastEngine
from app.services.ml_clustering import MLClusteringEngine
from app.services.data_cleanse_service import DataCleanseService
from app.services.sql_engine import SQLEngine
from app.services.calculation_tools import CalculationTools

@pytest.fixture
def sample_timeseries_df():
    dates = pd.date_range("2024-01-01", periods=24, freq="ME")
    sales = [100 + i * 5 + (i % 3) * 4 for i in range(24)]
    return pd.DataFrame({
        "Order_Date": dates,
        "Revenue": sales,
        "Quantity": [10 + (i % 5) for i in range(24)],
        "Region": ["East", "West", "North", "South"] * 6
    })

@pytest.fixture
def sample_clustering_df():
    np.random.seed(42)
    return pd.DataFrame({
        "Customer_ID": [f"C{i+1}" for i in range(30)],
        "Total_Spend": np.random.uniform(100, 5000, 30),
        "Order_Count": np.random.randint(1, 40, 30),
        "Discount_Rate": np.random.uniform(0.0, 0.35, 30),
        "Profit_Margin": np.random.uniform(0.05, 0.45, 30)
    })

@pytest.fixture
def sample_dirty_df():
    return pd.DataFrame({
        "Product": [" Laptop ", "Phone", "Phone", " Tablet", None, "Monitor"],
        "Sales": [1200.0, 800.0, 800.0, None, 450.0, 99999.0],  # Outlier and null
        "Category": ["Electronics", "Electronics", "Electronics", "Mobile", "Gadgets", None]
    })

def test_forecast_engine(sample_timeseries_df):
    result = ForecastEngine.generate_forecast(
        df=sample_timeseries_df,
        metric_col="Revenue",
        date_col="Order_Date",
        horizon=6
    )
    assert "error" not in result
    assert result["metric"] == "Revenue"
    assert len(result["forecast"]) == 6
    assert result["summary"]["last_actual"] > 0
    assert result["summary"]["horizon_target"] > 0
    assert result["summary"]["confidence_score"] >= 30.0
    
    # Verify confidence bounds logic
    for pt in result["forecast"]:
        assert pt["upper_95"] >= pt["forecast"]
        assert pt["lower_95"] <= pt["forecast"]
        assert pt["bull_scenario"] >= pt["forecast"]
        assert pt["bear_scenario"] <= pt["forecast"]

def test_forecast_engine_custom_bandwidth(sample_timeseries_df):
    for bw in [5, 10, 20, 30, 50, 80, 95]:
        res = ForecastEngine.generate_forecast(
            df=sample_timeseries_df,
            metric_col="Revenue",
            date_col="Order_Date",
            horizon=4,
            confidence_level=bw
        )
        assert res["confidence_level"] == bw
        for pt in res["forecast"]:
            assert "upper_bound" in pt
            assert "lower_bound" in pt
            assert pt["upper_bound"] >= pt["forecast"]
            assert pt["lower_bound"] <= pt["forecast"]

    # Verify 5% band is narrower than 95% band
    res_5 = ForecastEngine.generate_forecast(df=sample_timeseries_df, horizon=4, confidence_level=5)
    res_95 = ForecastEngine.generate_forecast(df=sample_timeseries_df, horizon=4, confidence_level=95)
    width_5 = res_5["forecast"][0]["upper_bound"] - res_5["forecast"][0]["lower_bound"]
    width_95 = res_95["forecast"][0]["upper_bound"] - res_95["forecast"][0]["lower_bound"]
    assert width_5 < width_95

def test_ml_clustering_engine(sample_clustering_df):
    result = MLClusteringEngine.discover_clusters(
        df=sample_clustering_df,
        k=3
    )
    assert "error" not in result
    assert result["k"] == 3
    assert len(result["cohorts"]) == 3
    assert len(result["features_used"]) >= 2
    assert "Customer_ID" not in result["features_used"]  # Identifier properly excluded
    assert len(result["radar_series"]) == 3
    assert result["metrics"]["variance_explained_pct"] > 0

    # Ensure cohorts have descriptive archetype names and recommendations
    for c in result["cohorts"]:
        assert c["name"].startswith("Tier")
        assert len(c["recommendation"]) > 10
        assert c["record_count"] > 0

def test_data_cleanse_service(sample_dirty_df):
    audit = DataCleanseService.audit_dataset_cleanliness(sample_dirty_df)
    assert audit["total_nulls"] >= 2
    assert audit["duplicate_rows"] >= 1
    assert len(audit["defects"]) >= 2

    # Run auto-cleanse
    cleanse_res = DataCleanseService.auto_cleanse(sample_dirty_df)
    assert cleanse_res["cleaned_health_score"] >= audit["current_health_score"]
    assert cleanse_res["cleaned_rows"] < audit["total_rows"]  # Duplicate removed
    assert len(cleanse_res["transformation_log"]) > 0

    cleansed_df = cleanse_res["cleansed_df"]
    # Verify no nulls remain in the cleansed dataframe
    assert cleansed_df.isnull().sum().sum() == 0
    # Verify whitespace trimmed
    assert cleansed_df["Product"].iloc[0] == "Laptop"

def test_sql_engine(sample_timeseries_df):
    dataframes = {"sales_data": sample_timeseries_df}
    
    # Valid Analytical Query
    res = SQLEngine.execute_sql(
        dataframes=dataframes,
        sql_query="SELECT Region, SUM(Revenue) as total_rev FROM sales_data GROUP BY Region ORDER BY total_rev DESC;"
    )
    assert "error" not in res
    assert len(res["rows"]) == 4
    assert res["columns"] == ["Region", "total_rev"]
    assert res["execution_time_ms"] >= 0.0

    # Test Security Guard
    forbidden_res = SQLEngine.execute_sql(
        dataframes=dataframes,
        sql_query="DROP TABLE sales_data;"
    )
    assert "error" in forbidden_res
    assert "Security restriction" in forbidden_res["error"]

    # Test Natural Language Translation
    nl_res = SQLEngine.generate_sql_from_nl(
        sample_timeseries_df,
        "show top 3 regions by revenue"
    )
    assert "SELECT" in nl_res["sql_query"]
    assert "LIMIT 3" in nl_res["sql_query"]
    assert "df.groupby" in nl_res["pandas_code"]

    # Test NL Translation on purely numeric dataframe (no string/dimension columns)
    num_only_df = pd.DataFrame({
        "temperature": [20.1, 22.4, 19.8, 25.0],
        "pressure": [1013.2, 1012.8, 1014.1, 1011.9]
    })
    nl_num_res = SQLEngine.generate_sql_from_nl(num_only_df, "count total records")
    assert "None" not in nl_num_res["sql_query"]
    assert "COUNT" in nl_num_res["sql_query"]

def test_execute_time_series_forecasting(sample_timeseries_df):
    # Without forecast
    history_only = CalculationTools.execute_time_series(
        sample_timeseries_df,
        date_col="Order_Date",
        value_col="Revenue",
        enable_forecast=False
    )
    assert len(history_only) > 0
    assert all(not pt.get("is_forecast") for pt in history_only)

    # With forecast
    periods = 6
    forecast_res = CalculationTools.execute_time_series(
        sample_timeseries_df,
        date_col="Order_Date",
        value_col="Revenue",
        enable_forecast=True,
        forecast_periods=periods
    )
    assert len(forecast_res) == len(history_only) + periods
    forecast_points = [pt for pt in forecast_res if pt.get("is_forecast")]
    assert len(forecast_points) == periods

    # Check structure & confidence intervals
    for pt in forecast_points:
        assert pt["is_forecast"] is True
        assert pt["forecast"] is not None
        assert pt["forecast_upper"] >= pt["forecast"]
        assert pt["forecast_lower"] <= pt["forecast"]
        assert pt["value"] is None  # Projected points have None for actual value, only forecast

    # Check seamless line bridge: last historical point has both value and forecast
    last_hist = forecast_res[len(history_only) - 1]
    assert "value" in last_hist
    assert "forecast" in last_hist
    assert last_hist["value"] == last_hist["forecast"]

