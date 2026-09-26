import pytest
import pandas as pd
import numpy as np
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
from app.models import Dataset, TableMetadata, KpiMetric
from app.services.kpi_engine import KpiEngine

@pytest.fixture(scope="module")
def client():
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c

def test_kpi_engine_compute_column_kpi_unit():
    # Test with known series
    data = [10.0, 20.0, 30.0, 40.0, 100.0]
    series = pd.Series(data)

    kpi = KpiEngine.compute_column_kpi(
        series=series,
        col_name="revenue",
        table_name="transactions",
        domain="Retail / E-Commerce",
        order_index=1
    )

    assert kpi is not None
    assert kpi["count_value"] == 5
    assert kpi["sum_value"] == 200.0
    assert kpi["avg_value"] == 40.0
    assert kpi["min_value"] == 10.0
    assert kpi["max_value"] == 100.0
    assert "$10" in kpi["formatted_min"] or "10" in kpi["formatted_min"]
    assert "$100" in kpi["formatted_max"] or "100" in kpi["formatted_max"]
    assert "$200" in kpi["formatted_sum"] or "200" in kpi["formatted_sum"]
    assert "$40" in kpi["formatted_avg"] or "40" in kpi["formatted_avg"]
    assert kpi["ai_insight"] is not None
    assert len(kpi["ai_insight"]) > 20
    assert "Revenue" in kpi["ai_insight"]

def test_kpi_engine_discover_kpis():
    df = pd.DataFrame({
        "sales": [100.0, 250.0, 350.0, 500.0, 1200.0],
        "profit": [20.0, 45.0, 60.0, 110.0, 300.0],
        "category": ["Electronics", "Furniture", "Electronics", "Office", "Furniture"]
    })

    dfs = {"orders": df}
    kpis = KpiEngine.discover_kpis(dfs, "Retail")

    assert len(kpis) >= 2
    # Verify base record volume KPI has quintet
    base_kpi = next(k for k in kpis if k["name"] == "total_records")
    assert base_kpi["count_value"] == 5
    assert base_kpi["sum_value"] == 5.0
    assert base_kpi["min_value"] == 1.0
    assert base_kpi["max_value"] == 5.0
    assert base_kpi["ai_insight"] is not None

    # Verify metric KPI has quintet
    sales_kpi = next((k for k in kpis if "sales" in k["name"]), None)
    assert sales_kpi is not None
    assert sales_kpi["min_value"] == 100.0
    assert sales_kpi["max_value"] == 1200.0
    assert sales_kpi["sum_value"] == 2400.0
    assert sales_kpi["avg_value"] == 480.0
    assert sales_kpi["count_value"] == 5
    assert sales_kpi["ai_insight"] is not None

def test_api_kpis_and_table_kpis(client):
    db = SessionLocal()
    try:
        # Create a test dataset and table
        ds = Dataset(
            id="test-kpi-stats-dataset-id",
            name="KPI Stats Dataset",
            row_count=5,
            column_count=3,
            detected_domain="Retail",
            data_health_score=98.0
        )
        db.add(ds)

        import tempfile
        import os
        tmp_file = tempfile.NamedTemporaryFile(suffix=".csv", delete=False)
        tmp_path = tmp_file.name
        tmp_file.close()

        df = pd.DataFrame({
            "amount": [50.0, 100.0, 150.0, 200.0, 500.0],
            "units": [1, 2, 3, 4, 10],
            "segment": ["Consumer", "Corporate", "Home", "Consumer", "Corporate"]
        })
        df.to_csv(tmp_path, index=False)

        table = TableMetadata(
            id="test-kpi-table-id",
            dataset_id=ds.id,
            table_name="orders",
            storage_path=tmp_path,
            row_count=5,
            column_count=3
        )
        db.add(table)

        # Add a KPI metric record
        kpi_rec = KpiMetric(
            id="test-kpi-metric-1",
            dataset_id=ds.id,
            name="kpi_amount",
            display_name="Total Amount",
            value=1000.0,
            formatted_value="$1,000",
            unit="Currency",
            calculation_type="sum",
            source_table="orders",
            source_column="amount",
            formula_explanation="SUM(orders.amount)",
            order_index=0
        )
        db.add(kpi_rec)
        db.commit()

        # 1. Test GET /api/datasets/{dataset_id}/tables/{table_name}/kpis
        res = client.get(f"/api/datasets/{ds.id}/tables/orders/kpis")
        assert res.status_code == 200
        data = res.json()
        assert data["table_name"] == "orders"
        assert len(data["kpis"]) >= 2
        amount_kpi = next(k for k in data["kpis"] if k["source_column"] == "amount")
        assert amount_kpi["min_value"] == 50.0
        assert amount_kpi["max_value"] == 500.0
        assert amount_kpi["sum_value"] == 1000.0
        assert amount_kpi["avg_value"] == 200.0
        assert amount_kpi["count_value"] == 5
        assert amount_kpi["ai_insight"] is not None

        # 2. Test GET /api/analysis/{dataset_id}/kpis (enrichment test)
        res2 = client.get(f"/api/analysis/{ds.id}/kpis")
        assert res2.status_code == 200
        kpis_data = res2.json()
        assert len(kpis_data) >= 1
        kpi_obj = kpis_data[0]
        assert kpi_obj["min_value"] == 50.0
        assert kpi_obj["max_value"] == 500.0
        assert kpi_obj["avg_value"] == 200.0
        assert kpi_obj["count_value"] == 5
        assert kpi_obj["ai_insight"] is not None

        # 3. Test GET /api/analysis/{dataset_id}/kpis/comprehensive
        res3 = client.get(f"/api/analysis/{ds.id}/kpis/comprehensive")
        assert res3.status_code == 200
        comp_data = res3.json()
        assert comp_data["dataset_id"] == ds.id
        assert len(comp_data["tables"]) >= 1

        # Clean up
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
    finally:
        db.query(KpiMetric).filter(KpiMetric.dataset_id == "test-kpi-stats-dataset-id").delete()
        db.query(TableMetadata).filter(TableMetadata.dataset_id == "test-kpi-stats-dataset-id").delete()
        db.query(Dataset).filter(Dataset.id == "test-kpi-stats-dataset-id").delete()
        db.commit()
        db.close()
