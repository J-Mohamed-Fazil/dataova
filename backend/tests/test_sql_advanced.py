import pytest
import pandas as pd
import numpy as np

from app.services.sql_engine import SQLEngine


@pytest.fixture
def sales_df():
    return pd.DataFrame({
        "Order_ID": [1, 2, 3, 4, 5, 6],
        "Customer_Name": ["Alice", "Bob", "Charlie", "David", "Emma", "Frank"],
        "Region": ["West", "East", "West", "Central", "East", "South"],
        "Category": ["Technology", "Furniture", "Technology", "Office Supplies", "Furniture", "Technology"],
        "Sales": [550.0, 120.0, 890.0, 45.0, 780.0, 310.0],
        "Profit": [150.0, -20.0, 220.0, 12.0, -50.0, 80.0],
        "Discount": [0.1, 0.25, 0.05, 0.0, 0.3, 0.15]
    })


def test_sql_engine_multi_alias_mounting(sales_df):
    """Verifies that tables can be queried by filename, sanitized name, or 'data' alias."""
    dataframes = {"superstore_orders.csv": sales_df}

    # Query with raw filename
    res_raw = SQLEngine.execute_sql(dataframes, "SELECT * FROM [superstore_orders.csv] LIMIT 5;")
    assert "error" not in res_raw
    assert len(res_raw["rows"]) == 5

    # Query with base name without extension
    res_base = SQLEngine.execute_sql(dataframes, "SELECT COUNT(*) as count FROM superstore_orders;")
    assert "error" not in res_base
    assert res_base["rows"][0]["count"] == 6

    # Query with default 'data' alias
    res_data = SQLEngine.execute_sql(dataframes, "SELECT * FROM data LIMIT 2;")
    assert "error" not in res_data
    assert len(res_data["rows"]) == 2


def test_sql_engine_top_ranking(sales_df):
    """Tests top N grouped aggregation translation and execution."""
    res = SQLEngine.generate_sql_from_nl(sales_df, "Show top 3 categories by total sales")
    assert "SELECT" in res["sql_query"]
    assert "GROUP BY [Category]" in res["sql_query"]
    assert "DESC" in res["sql_query"]
    assert "LIMIT 3" in res["sql_query"]

    # Execute generated SQL
    exec_res = SQLEngine.execute_sql({"data": sales_df}, res["sql_query"], question="Show top 3 categories by total sales")
    assert "error" not in exec_res
    assert len(exec_res["rows"]) == 3
    assert exec_res["rows"][0]["Category"] == "Technology"
    assert "Technology" in exec_res["summary"]


def test_sql_engine_lowest_ranking(sales_df):
    """Tests lowest / bottom ranking uses ASC ordering."""
    res = SQLEngine.generate_sql_from_nl(sales_df, "Show lowest 3 categories by sales")
    assert "ASC" in res["sql_query"]

    exec_res = SQLEngine.execute_sql({"data": sales_df}, res["sql_query"], question="Show lowest 3 categories by sales")
    assert "error" not in exec_res
    assert exec_res["rows"][0]["Category"] == "Office Supplies"


def test_sql_engine_scalar_aggregations(sales_df):
    """Tests single metric aggregations without grouping."""
    res_sum = SQLEngine.generate_sql_from_nl(sales_df, "What is the total revenue?")
    assert "SUM" in res_sum["sql_query"]
    assert "GROUP BY" not in res_sum["sql_query"]

    exec_sum = SQLEngine.execute_sql({"data": sales_df}, res_sum["sql_query"], question="What is the total revenue?")
    assert "error" not in exec_sum
    assert exec_sum["rows"][0]["sum_sales"] == 2695.0
    assert "2,695" in exec_sum["summary"]


def test_sql_engine_where_filtering(sales_df):
    """Tests WHERE clause categorical and numeric condition extraction."""
    # Categorical filter matching dataframe values
    res_cat = SQLEngine.generate_sql_from_nl(sales_df, "Show all records where Region is West")
    assert "WHERE LOWER([Region]) = 'west'" in res_cat["sql_query"]

    exec_cat = SQLEngine.execute_sql({"data": sales_df}, res_cat["sql_query"])
    assert "error" not in exec_cat
    assert len(exec_cat["rows"]) == 2

    # Numeric filter
    res_num = SQLEngine.generate_sql_from_nl(sales_df, "Find all orders with sales > 500")
    assert "[Sales] > 500" in res_num["sql_query"]

    exec_num = SQLEngine.execute_sql({"data": sales_df}, res_num["sql_query"])
    assert "error" not in exec_num
    assert len(exec_num["rows"]) == 3


def test_sql_engine_distinct_query(sales_df):
    """Tests DISTINCT queries."""
    res = SQLEngine.generate_sql_from_nl(sales_df, "Show unique categories")
    assert "SELECT DISTINCT [Category]" in res["sql_query"]

    exec_res = SQLEngine.execute_sql({"data": sales_df}, res["sql_query"])
    assert "error" not in exec_res
    assert len(exec_res["rows"]) == 3


def test_sql_engine_self_healing_column(sales_df):
    """Tests that misspelled column names automatically self-heal in the execution sandbox."""
    # Column 'CategoryName' misspelled for 'Category'
    broken_query = "SELECT CategoryName, SUM(Sales) as tot FROM data GROUP BY CategoryName;"
    res = SQLEngine.execute_sql({"data": sales_df}, broken_query)
    assert "error" not in res
    assert len(res["rows"]) == 3
    assert "Category" in res["columns"]


def test_sql_engine_between_range_filter(sales_df):
    """Tests between/range query compilation and execution."""
    res = SQLEngine.generate_sql_from_nl(sales_df, "Orders with sales between 100 and 600")
    assert "BETWEEN 100 AND 600" in res["sql_query"]

    exec_res = SQLEngine.execute_sql({"data": sales_df}, res["sql_query"])
    assert "error" not in exec_res
    assert len(exec_res["rows"]) == 3


def test_sql_engine_date_extraction():
    """Tests date and year extraction in natural language queries."""
    df_with_dates = pd.DataFrame({
        "Order_Date": ["2023-01-15", "2023-06-20", "2024-02-10", "2024-08-15"],
        "Revenue": [100.0, 200.0, 300.0, 400.0]
    })
    res = SQLEngine.generate_sql_from_nl(df_with_dates, "Total revenue in 2023")
    assert "strftime('%Y', [Order_Date]) = '2023'" in res["sql_query"]

    exec_res = SQLEngine.execute_sql({"data": df_with_dates}, res["sql_query"])
    assert "error" not in exec_res
    assert exec_res["rows"][0]["sum_revenue"] == 300.0


def test_sql_engine_multi_word_and_id_handling(sales_df):
    """Tests that 'by customer' correctly picks Customer_Name over Order_ID and generates valid SQL & Pandas."""
    res = SQLEngine.generate_sql_from_nl(sales_df, "Show top 5 customers by sales")
    assert "Customer_Name" in res["sql_query"]
    assert "Order_ID" not in res["sql_query"]
    assert "GROUP BY [Customer_Name]" in res["sql_query"]
    assert "sort_values" in res["pandas_code"]

    exec_res = SQLEngine.execute_sql({"data": sales_df}, res["sql_query"])
    assert "error" not in exec_res
    assert len(exec_res["rows"]) == 5


def test_sql_engine_extended_comparison_operators(sales_df):
    """Tests natural language operators like 'over', 'under', 'at least'."""
    res_over = SQLEngine.generate_sql_from_nl(sales_df, "Show records with sales over 500")
    assert "[Sales] > 500" in res_over["sql_query"]

    res_loss = SQLEngine.generate_sql_from_nl(sales_df, "Show all loss making records")
    assert "[Profit] < 0" in res_loss["sql_query"]


def test_sql_engine_relational_join_synthesis():
    """Tests automatic EER relational JOIN synthesis when dimension and metric reside in separate tables."""
    categories_df = pd.DataFrame({
        "category_id": [1, 2, 3],
        "category_name": ["Technology", "Furniture", "Office Supplies"]
    })
    orders_df = pd.DataFrame({
        "order_id": [101, 102, 103, 104, 105],
        "category_id": [1, 1, 2, 3, 2],
        "revenue": [500.0, 750.0, 300.0, 150.0, 450.0],
        "quantity": [2, 3, 1, 5, 2]
    })
    all_dfs = {
        "categories": categories_df,
        "orders": orders_df
    }

    res = SQLEngine.generate_sql_from_nl(
        df=categories_df,
        nl_prompt="Show top 10 category_id by total Revenue",
        table_name="categories",
        all_dfs=all_dfs
    )

    assert "JOIN [orders]" in res["sql_query"]
    assert "[categories].[category_id] = [orders].[category_id]" in res["sql_query"] or "[orders].[category_id] = [categories].[category_id]" in res["sql_query"]
    assert "merge" in res["pandas_code"]

    # Execute against SQLite sandbox with all mounted tables
    exec_res = SQLEngine.execute_sql(all_dfs, res["sql_query"], question="Show top 10 category_id by total Revenue")
    assert "error" not in exec_res
    # Top performer has 500 + 750 = 1250 total revenue
    first_row = exec_res["rows"][0]
    assert first_row.get("category_name") == "Technology" or first_row.get("category_id") == 1
    assert first_row["sum_revenue"] == 1250.0



