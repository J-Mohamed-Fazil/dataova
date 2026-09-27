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


def test_discover_ai_archetypes_clinical_healthcare():
    """Verify that clinical healthcare data generates domain-native archetypes and not pre-built business ones."""
    healthcare_df = pd.DataFrame({
        "patient_id": [f"P_{i}" for i in range(100)],
        "diagnosis": ["Cardiology", "Neurology", "Orthopedics", "Oncology"] * 25,
        "department": ["Emergency", "Inpatient", "Surgery", "ICU"] * 25,
        "length_of_stay": [3.2, 5.1, 7.8, 2.4] * 25,
        "readmission_rate": [0.08, 0.14, 0.05, 0.22] * 25,
        "treatment_cost": [4500, 8900, 12000, 3100] * 25,
        "admission_date": pd.date_range("2024-01-01", periods=100, freq="D").strftime("%Y-%m-%d")
    })

    result = DashboardGenerator.discover_ai_archetypes(
        all_dataframes={"clinical_admissions": healthcare_df},
        dataset_name="Hospital Admissions",
        dataset_id="ds-health-1"
    )

    assert "Healthcare" in result["domain"]
    archetypes = result["archetypes"]
    assert len(archetypes) >= 4

    # Top recommended archetype should reference the actual columns
    rec = next(a for a in archetypes if a["recommended"])
    assert "Length Of Stay" in rec["title"] or "Treatment Cost" in rec["title"]
    assert "Diagnosis" in rec["title"] or "Department" in rec["title"]
    assert any("Readmission Rate" in chart or "Length Of Stay" in chart for chart in rec["charts_planned"])

    # Ensure no generic hardcoded "Executive Pulse" appears in the dynamic titles
    for arch in archetypes:
        assert "Executive Pulse" not in arch["title"]
        assert "Revenue, Margin & Growth" not in arch["title"]


def test_discover_ai_archetypes_workforce_hr():
    """Verify that HR data generates workforce-native archetypes."""
    hr_df = pd.DataFrame({
        "emp_id": [f"E_{i}" for i in range(80)],
        "department": ["Engineering", "Product", "Sales", "People"] * 20,
        "salary": [120000, 110000, 95000, 85000] * 20,
        "performance_score": [4.2, 3.8, 4.5, 3.9] * 20,
        "tenure_years": [3.5, 2.1, 5.0, 1.2] * 20,
        "attrition_risk": [0.05, 0.12, 0.02, 0.18] * 20
    })

    result = DashboardGenerator.discover_ai_archetypes(
        all_dataframes={"workforce": hr_df},
        dataset_name="People Analytics",
        dataset_id="ds-hr-1"
    )

    assert "Workforce" in result["domain"]
    titles = [a["title"] for a in result["archetypes"]]
    assert any("Salary" in t for t in titles)
    assert any("Department" in t for t in titles)


def test_auto_preset_dynamic_synthesis(retail_dataset):
    """Verify that preset='auto' generates a dynamic archetype sheet grounded in real columns."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.database import Base
    from app.models import Dataset

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    ds = Dataset(id="ds-auto-test", name="Retail Test Dataset")
    db.add(ds)
    db.commit()

    dfs = {"orders": retail_dataset}
    sheets = DashboardGenerator.generate_ai_themed_dashboard(
        dataset_id="ds-auto-test",
        all_dataframes=dfs,
        detected_rels=[],
        db=db,
        preset="auto",
        mode="replace_all"
    )
    assert len(sheets) == 1
    sheet = sheets[0]
    assert sheet.title.startswith("AI Agent:") or sheet.title.startswith("AI Archetype:")
    assert any(term in sheet.title for term in ["Commerce", "Sales", "Revenue", "Profitability", "Scale", "Driver"])
    assert len(sheet.charts) >= 3
    assert sheet.business_questions and len(sheet.business_questions) >= 1
    first_q = sheet.business_questions[0]
    assert "question" in first_q
    assert len(first_q.get("metric", "")) > 0


def test_generate_all_preset_and_prompt_synthesis(retail_dataset):
    """Verify that preset='all' or 'all dashboards' prompt synthesizes all possible charts across all tables."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.database import Base
    from app.models import Dataset

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    ds = Dataset(id="ds-all-test", name="Multi-Table Retail")
    db.add(ds)
    db.commit()

    customers_df = pd.DataFrame({
        "customer_id": [f"CUST_{i:03d}" for i in range(1, 21)],
        "segment": ["Enterprise", "SMB", "Consumer", "Strategic"] * 5,
        "region": ["North America", "EMEA", "APAC", "LATAM"] * 5,
        "credit_score": [720, 680, 790, 810] * 5
    })

    dfs = {
        "orders": retail_dataset,
        "customers": customers_df
    }
    rels = [{
        "source_table": "orders",
        "source_column": "customer_id",
        "target_table": "customers",
        "target_column": "customer_id",
        "confidence": 0.95,
        "relationship_type": "many_to_one"
    }]

    # Test preset="all"
    sheets = DashboardGenerator.generate_ai_themed_dashboard(
        dataset_id="ds-all-test",
        all_dataframes=dfs,
        detected_rels=rels,
        db=db,
        preset="all",
        mode="replace_all"
    )

    # Should create cross-table unified intelligence sheet PLUS individual table sheets
    assert len(sheets) >= 2
    sheet_titles = [s.title for s in sheets]
    assert any("Cross-Table" in t or "Connected" in t for t in sheet_titles)
    assert any("orders" in t.lower() for t in sheet_titles)
    assert any("customers" in t.lower() for t in sheet_titles)

    total_charts = sum(len(s.charts) for s in sheets)
    assert total_charts >= 8, f"Expected exhaustive chart synthesis, got {total_charts}"




