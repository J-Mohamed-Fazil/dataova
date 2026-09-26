import pytest
import pandas as pd
import numpy as np

from app.services.dashboard_generator import DashboardGenerator

@pytest.fixture
def retail_dataset():
    np.random.seed(42)
    n = 100
    dates = pd.date_range("2024-01-01", periods=n, freq="D")
    categories = ["Electronics", "Apparel", "Home Goods", "Books"]
    regions = ["North", "South", "East", "West"]

    return pd.DataFrame({
        "order_date": dates,
        "region": np.random.choice(regions, n),
        "product_category": np.random.choice(categories, n),
        "sales_revenue": np.random.uniform(100, 1000, n),
        "profit_margin": np.random.uniform(0.05, 0.45, n),
        "transaction_count": np.random.randint(1, 20, n)
    })

def test_business_questions_synthesis_executive(retail_dataset):
    dfs = {"orders": retail_dataset}
    profiles = DashboardGenerator._extract_table_profiles(dfs)

    questions = DashboardGenerator._generate_business_questions(
        sheet_title="Executive Pulse",
        tables=["orders"],
        dataframes=dfs,
        profiles=profiles,
        preset="executive"
    )

    assert len(questions) >= 3
    assert any(q.get("impact_level") in ["High Impact", "Strategic", "Tactical"] for q in questions)
    assert any("driver" in q.get("id", "").lower() or "top" in q.get("badge", "").lower() for q in questions)

def test_business_questions_synthesis_revenue_growth(retail_dataset):
    dfs = {"orders": retail_dataset}
    profiles = DashboardGenerator._extract_table_profiles(dfs)

    questions = DashboardGenerator._generate_business_questions(
        sheet_title="Revenue & Growth",
        tables=["orders"],
        dataframes=dfs,
        profiles=profiles,
        preset="revenue_growth"
    )

    assert len(questions) >= 3
    rev_q = next((q for q in questions if q.get("badge") == "Revenue Driver"), None)
    assert rev_q is not None
    assert "$" in rev_q["metric"] or "%" in rev_q["metric"]
    assert rev_q["confidence"] >= 0.90

def test_business_questions_synthesis_customer_cohort(retail_dataset):
    dfs = {"orders": retail_dataset}
    profiles = DashboardGenerator._extract_table_profiles(dfs)

    questions = DashboardGenerator._generate_business_questions(
        sheet_title="Customer Cohort Segmentation",
        tables=["orders"],
        dataframes=dfs,
        profiles=profiles,
        preset="customer_cohort"
    )

    assert len(questions) >= 2
    cohort_q = next((q for q in questions if q.get("badge") == "Dominant Cohort"), None)
    assert cohort_q is not None
    assert "Accounts" in cohort_q["metric"] or "%" in cohort_q["metric"]
    assert cohort_q["category"] == "Cohorts & Demographics"

def test_business_questions_synthesis_operations_risk(retail_dataset):
    dfs = {"orders": retail_dataset}
    profiles = DashboardGenerator._extract_table_profiles(dfs)

    questions = DashboardGenerator._generate_business_questions(
        sheet_title="Operational Velocity & Risk",
        tables=["orders"],
        dataframes=dfs,
        profiles=profiles,
        preset="operations_risk"
    )

    assert len(questions) >= 2
    risk_q = next((q for q in questions if q.get("badge") == "Variance & Risk"), None)
    assert risk_q is not None
    assert "Peak Variance" in risk_q["metric"] or "x" in risk_q["metric"]
    assert risk_q["impact_level"] == "Risk Alert"

def test_business_questions_synthesis_profitability_frontier(retail_dataset):
    dfs = {"orders": retail_dataset}
    profiles = DashboardGenerator._extract_table_profiles(dfs)

    questions = DashboardGenerator._generate_business_questions(
        sheet_title="Unit Economics",
        tables=["orders"],
        dataframes=dfs,
        profiles=profiles,
        preset="profitability_frontier"
    )

    assert len(questions) >= 2
    prof_q = next((q for q in questions if q.get("badge") == "Unit Economics"), None)
    assert prof_q is not None
    assert "Margin Spread" in prof_q["metric"] or "x" in prof_q["metric"]

def test_business_questions_synthesis_predictive_momentum(retail_dataset):
    dfs = {"orders": retail_dataset}
    profiles = DashboardGenerator._extract_table_profiles(dfs)

    questions = DashboardGenerator._generate_business_questions(
        sheet_title="Predictive Momentum",
        tables=["orders"],
        dataframes=dfs,
        profiles=profiles,
        preset="predictive_momentum"
    )

    assert len(questions) >= 2
    mom_q = next((q for q in questions if q.get("badge") == "Momentum Velocity"), None)
    assert mom_q is not None
    assert "%" in mom_q["metric"]

def test_business_questions_synthesis_custom_prompt(retail_dataset):
    dfs = {"orders": retail_dataset}
    profiles = DashboardGenerator._extract_table_profiles(dfs)

    questions = DashboardGenerator._generate_business_questions(
        sheet_title="Custom Regional Synthesis",
        tables=["orders"],
        dataframes=dfs,
        profiles=profiles,
        prompt="Focus on regional sales revenue and profit margin spreads"
    )

    assert len(questions) >= 3
    target_q = next((q for q in questions if q.get("badge") == "Targeted Finding"), None)
    assert target_q is not None
    assert target_q["impact_level"] == "High Impact"


def test_all_presets_generate_distinct_charts(retail_dataset):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.database import Base
    from app.models import Dataset, DashboardSheet, DashboardChart

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    ds = Dataset(id="ds-test", name="Retail Test Dataset")
    db.add(ds)
    db.commit()

    dfs = {"orders": retail_dataset}

    presets = [
        "executive",
        "revenue_growth",
        "customer_cohort",
        "operations_risk",
        "profitability_frontier",
        "predictive_momentum"
    ]

    preset_charts = {}

    for p in presets:
        sheets = DashboardGenerator.generate_ai_themed_dashboard(
            dataset_id="ds-test",
            all_dataframes=dfs,
            detected_rels=[],
            db=db,
            preset=p,
            mode="add_sheet"
        )
        assert len(sheets) > 0
        sheet = sheets[0]
        charts = db.query(DashboardChart).filter(DashboardChart.sheet_id == sheet.id).all()
        assert len(charts) >= 3
        chart_types = [c.chart_type for c in charts]
        chart_titles = [c.title for c in charts]
        preset_charts[p] = {
            "sheet_title": sheet.title,
            "chart_types": chart_types,
            "chart_titles": chart_titles
        }

    # Verify each preset produced a distinct sheet title and distinct chart configuration
    sheet_titles = [v["sheet_title"] for v in preset_charts.values()]
    assert len(sheet_titles) == len(set(sheet_titles)), "All presets must produce unique sheet titles"

    # Verify specialized chart types
    assert "treemap" in preset_charts["customer_cohort"]["chart_types"]
    assert "heatmap" in preset_charts["operations_risk"]["chart_types"]
    assert "horizontal_bar" in preset_charts["profitability_frontier"]["chart_types"]
    assert "area" in preset_charts["predictive_momentum"]["chart_types"]
    assert "composed" in preset_charts["revenue_growth"]["chart_types"]

