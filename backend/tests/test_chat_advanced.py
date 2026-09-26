import pytest
import pandas as pd
import numpy as np
from app.services.chat_agent import ChatAgent

@pytest.fixture
def sample_retail_df():
    data = {
        "Order_Date": pd.date_range("2023-01-01", periods=100, freq="D"),
        "Category": ["Technology", "Furniture", "Office Supplies", "Technology", "Furniture"] * 20,
        "Region": ["North", "South", "East", "West", "North"] * 20,
        "Sales": [150.0, 80.0, 25.0, 300.0, 95.0] * 20,
        "Quantity": [2, 1, 5, 3, 2] * 20,
        "Profit": [45.0, -10.0, 5.0, 90.0, 15.0] * 20,
        "Discount": [0.0, 0.2, 0.0, 0.1, 0.15] * 20
    }
    return pd.DataFrame(data)

@pytest.mark.asyncio
async def test_comparative_benchmarking(sample_retail_df):
    query = "Compare Technology vs Furniture"
    result = await ChatAgent.process_user_query(
        query=query,
        dataframes={"sales_table": sample_retail_df},
        domain="Retail & E-Commerce",
        kpis=[]
    )
    assert "Comparative Benchmark" in result["content"]
    assert "action_payload" in result
    payload = result["action_payload"]
    assert "kpi_highlights" in payload
    assert len(payload["kpi_highlights"]) >= 3
    assert "table_data" in payload
    assert len(payload["table_data"]["rows"]) >= 2
    assert "suggested_followups" in payload
    assert len(payload["suggested_followups"]) == 3
    assert "execution_time_ms" in payload

@pytest.mark.asyncio
async def test_root_cause_analysis(sample_retail_df):
    query = "Why did sales drop?"
    result = await ChatAgent.process_user_query(
        query=query,
        dataframes={"sales_table": sample_retail_df},
        domain="Retail & E-Commerce",
        kpis=[]
    )
    assert "Root-Cause" in result["content"]
    payload = result["action_payload"]
    assert "kpi_highlights" in payload
    assert "Primary Drag" in [k["label"] for k in payload["kpi_highlights"]]
    assert "table_data" in payload

@pytest.mark.asyncio
async def test_what_if_simulation(sample_retail_df):
    query = "What if sales increase by 15%?"
    result = await ChatAgent.process_user_query(
        query=query,
        dataframes={"sales_table": sample_retail_df},
        domain="Retail & E-Commerce",
        kpis=[]
    )
    assert "What-If Scenario Simulation" in result["content"]
    payload = result["action_payload"]
    assert "kpi_highlights" in payload
    labels = [k["label"] for k in payload["kpi_highlights"]]
    assert "Baseline Total" in labels
    assert "Projected Total" in labels
    assert "Net Delta (Δ)" in labels

@pytest.mark.asyncio
async def test_correlation_analysis(sample_retail_df):
    query = "What correlates with Sales?"
    result = await ChatAgent.process_user_query(
        query=query,
        dataframes={"sales_table": sample_retail_df},
        domain="Retail & E-Commerce",
        kpis=[]
    )
    assert "Correlation Analysis" in result["content"]
    payload = result["action_payload"]
    assert "kpi_highlights" in payload
    assert "table_data" in payload

@pytest.mark.asyncio
async def test_statistical_distribution(sample_retail_df):
    query = "Show distribution of Sales"
    result = await ChatAgent.process_user_query(
        query=query,
        dataframes={"sales_table": sample_retail_df},
        domain="Retail & E-Commerce",
        kpis=[]
    )
    assert "Statistical Distribution" in result["content"]
    payload = result["action_payload"]
    assert "kpi_highlights" in payload
    assert "Median" in [k["label"] for k in payload["kpi_highlights"]]
    assert "table_data" in payload

@pytest.mark.asyncio
async def test_multiturn_context_memory(sample_retail_df):
    # First turn: ask top categories
    history = [
        {"role": "user", "content": "Top categories by sales"},
        {
            "role": "assistant",
            "content": "Top performer is Technology",
            "action_type": "SHOW_CHART",
            "action_payload": {
                "chart": {
                    "table_name": "sales_table",
                    "x_field": "Category",
                    "y_field": "Sales"
                }
            },
            "citations": [{"table": "sales_table", "columns": ["Category", "Sales"]}]
        }
    ]

    # Follow-up with pronoun / context: "Now show that by month"
    followup_query = "Now show monthly trend"
    result = await ChatAgent.process_user_query(
        query=followup_query,
        dataframes={"sales_table": sample_retail_df},
        domain="Retail & E-Commerce",
        kpis=[],
        conversation_history=history
    )
    assert "Trend Analysis" in result["content"]
    payload = result["action_payload"]
    assert payload["chart"]["chart_type"] == "line"
