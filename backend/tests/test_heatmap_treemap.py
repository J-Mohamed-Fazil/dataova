import pandas as pd
from app.services.calculation_tools import CalculationTools
from app.services.ai_studio_cognitive_engine import AIStudioCognitiveEngine

def test_heatmap_calculation():
    df = pd.DataFrame({
        "Category": ["Tech", "Tech", "Furniture", "Furniture", "Office", "Office"],
        "Region": ["North", "South", "North", "South", "North", "South"],
        "Sales": [100.0, 150.0, 50.0, 75.0, 20.0, 30.0]
    })

    points = CalculationTools.execute_heatmap(
        df,
        group_by_col="Category",
        secondary_col="Region",
        value_col="Sales",
        agg_type="sum"
    )

    assert len(points) == 6
    for p in points:
        assert "x" in p
        assert "y" in p
        assert "value" in p
        assert "intensity" in p
        assert 0.0 <= p["intensity"] <= 1.0

def test_treemap_calculation():
    df = pd.DataFrame({
        "Category": ["Tech", "Tech", "Furniture", "Furniture", "Office"],
        "Subcategory": ["Phones", "Laptops", "Chairs", "Tables", "Paper"],
        "Sales": [500.0, 300.0, 200.0, 100.0, 50.0]
    })

    points = CalculationTools.execute_treemap(
        df,
        group_by_col="Category",
        secondary_col="Subcategory",
        value_col="Sales",
        agg_type="sum"
    )

    assert len(points) > 0
    for p in points:
        assert "name" in p
        assert "value" in p
        assert "size" in p
        assert "children" in p

def test_cognitive_engine_heatmap_and_treemap_synthesis():
    df = pd.DataFrame({
        "Department": ["Sales", "Sales", "Engineering", "Engineering", "Marketing"],
        "Office_Location": ["NY", "SF", "NY", "SF", "NY"],
        "Budget": [50000.0, 60000.0, 120000.0, 150000.0, 40000.0]
    })

    # 1. Heatmap prompt
    res_heat = AIStudioCognitiveEngine.execute_cognitive_synthesis(
        prompt="Generate a heat map density matrix of budget across departments and office locations",
        df_dict={"departments": df},
        relationships=[]
    )
    assert res_heat["chart_type"] == "heatmap"
    assert len(res_heat["chart_data"]) > 0

    # 2. Treemap prompt
    res_tree = AIStudioCognitiveEngine.execute_cognitive_synthesis(
        prompt="Show a proportional tree map of budget allocation by department",
        df_dict={"departments": df},
        relationships=[]
    )
    assert res_tree["chart_type"] == "treemap"
    assert len(res_tree["chart_data"]) > 0

