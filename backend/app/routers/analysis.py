from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
import pandas as pd

from app.database import get_db
from app.models import Dataset, KpiMetric, Insight, AnomalyRecord, TableMetadata
from app.schemas.analysis import (
    AnalysisOverviewSchema,
    KpiMetricSchema,
    InsightSchema,
    AnomalyRecordSchema
)
from app.services.file_processor import FileProcessor
from app.services.calculation_tools import CalculationTools
from app.services.forecast_engine import ForecastEngine
from app.services.ml_clustering import MLClusteringEngine
from app.services.sql_engine import SQLEngine
from app.services.cache_manager import DataFrameCache
from app.services.audio_brief_service import AudioBriefService
from app.services.scenario_planner import ScenarioPlanner
from app.services.driver_tree_service import DriverTreeService
from app.services.automl_engine import AutoMLEngine
from app.services.kpi_engine import KpiEngine
from app.schemas.analysis import (
    AutoMLTrainRequest,
    AutoMLPredictRequest
)

router = APIRouter(prefix="/analysis", tags=["analysis"])

class SqlQueryRequest(BaseModel):
    query: str
    table_name: Optional[str] = None
    max_rows: int = 200

class SqlTranslateRequest(BaseModel):
    prompt: str
    table_name: Optional[str] = None

class ScenarioSimulateRequest(BaseModel):
    target_metric: Optional[str] = None
    drivers: List[Dict[str, Any]] = []
    dimension_col: Optional[str] = None
    table_name: Optional[str] = None

class DriverTreeRequest(BaseModel):
    metric_col: Optional[str] = None
    dimension_cols: Optional[List[str]] = None
    table_name: Optional[str] = None
    calculation_type: Optional[str] = None
    kpi_name: Optional[str] = None
    unit: Optional[str] = None
    display_name: Optional[str] = None

def _load_primary_df(dataset_id: str, table_name: Optional[str], db: Session):
    tables = db.query(TableMetadata).filter(TableMetadata.dataset_id == dataset_id).all()
    if not tables:
        raise HTTPException(status_code=404, detail="No tables found for this dataset")
    target_table = tables[0]
    if table_name:
        found = next((t for t in tables if t.table_name == table_name), None)
        if found:
            target_table = found

    # Attempt cached dataframe load using the canonical method
    try:
        df = DataFrameCache.get_table_dataframe(target_table.storage_path, target_table.table_name)
    except Exception:
        df = None

    if df is None:
        try:
            dfs = FileProcessor.read_file_to_dataframes(target_table.storage_path)
            df = dfs.get(target_table.table_name) if dfs else None
            if df is None and dfs:
                df = list(dfs.values())[0]
            if df is not None:
                DataFrameCache.set(target_table.storage_path, target_table.table_name, df)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to load dataset file: {str(e)}")

    if df is None or df.empty:
        raise HTTPException(status_code=400, detail="Table dataframe is empty")
    return df, target_table.table_name

def _enrich_kpis(kpis: List[KpiMetric], dataset_id: str, domain: str, db: Session) -> List[KpiMetric]:
    df = None
    try:
        tables = db.query(TableMetadata).filter(TableMetadata.dataset_id == dataset_id).all()
        if tables:
            df = DataFrameCache.get_table_dataframe(tables[0].storage_path, tables[0].table_name)
    except Exception:
        df = None

    for kpi in kpis:
        if kpi.min_value is not None and kpi.ai_insight is not None:
            continue
        if kpi.name == "total_records":
            total_rows = int(kpi.value)
            kpi.min_value = 1.0 if total_rows > 0 else 0.0
            kpi.max_value = float(total_rows)
            kpi.sum_value = float(total_rows)
            kpi.avg_value = 1.0
            kpi.count_value = total_rows
            kpi.formatted_min = "1"
            kpi.formatted_max = f"{total_rows:,}"
            kpi.formatted_sum = f"{total_rows:,}"
            kpi.formatted_avg = "1.0"
            kpi.formatted_count = f"{total_rows:,}"
            kpi.ai_insight = (
                f"The primary dataset contains {total_rows:,} total observations. "
                f"This provides high sample stability (confidence: 100%) across all subsequent calculations."
            )
            continue

        if df is not None and kpi.source_column and kpi.source_column in df.columns:
            stat = KpiEngine.compute_column_kpi(df[kpi.source_column], kpi.source_column, kpi.source_table, domain)
            if stat:
                kpi.min_value = stat["min_value"]
                kpi.max_value = stat["max_value"]
                kpi.sum_value = stat["sum_value"]
                kpi.avg_value = stat["avg_value"]
                kpi.count_value = stat["count_value"]
                kpi.formatted_min = stat["formatted_min"]
                kpi.formatted_max = stat["formatted_max"]
                kpi.formatted_sum = stat["formatted_sum"]
                kpi.formatted_avg = stat["formatted_avg"]
                kpi.formatted_count = stat["formatted_count"]
                kpi.ai_insight = stat["ai_insight"]
                kpi.statistical_summary = stat["statistical_summary"]
                try:
                    db.commit()
                except Exception:
                    db.rollback()
    return kpis

@router.get("/{dataset_id}/overview", response_model=AnalysisOverviewSchema)
def get_analysis_overview(dataset_id: str, db: Session = Depends(get_db)):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    kpis = db.query(KpiMetric).filter(KpiMetric.dataset_id == dataset_id).order_by(KpiMetric.order_index).all()
    kpis = _enrich_kpis(kpis, dataset_id, ds.detected_domain or "General", db)
    insights = db.query(Insight).filter(Insight.dataset_id == dataset_id).all()
    anomalies = db.query(AnomalyRecord).filter(AnomalyRecord.dataset_id == dataset_id).all()

    return AnalysisOverviewSchema(
        dataset_id=ds.id,
        dataset_name=ds.name,
        data_health_score=ds.data_health_score,
        detected_domain=ds.detected_domain,
        domain_confidence=ds.domain_confidence,
        domain_reasoning=ds.domain_reasoning,
        row_count=ds.row_count,
        column_count=ds.column_count,
        kpis=kpis,
        insights=insights,
        anomalies=anomalies
    )

@router.get("/{dataset_id}/kpis", response_model=List[KpiMetricSchema])
def get_kpis(dataset_id: str, db: Session = Depends(get_db)):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    domain = ds.detected_domain if ds else "General"
    kpis = db.query(KpiMetric).filter(KpiMetric.dataset_id == dataset_id).order_by(KpiMetric.order_index).all()
    return _enrich_kpis(kpis, dataset_id, domain, db)

@router.get("/{dataset_id}/kpis/comprehensive")
def get_comprehensive_kpis(dataset_id: str, db: Session = Depends(get_db)):
    """
    Returns proper KPI values (Min, Max, Sum, Count, Average) and AI insights
    for ALL numeric columns present in the dataset.
    """
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    tables = db.query(TableMetadata).filter(TableMetadata.dataset_id == dataset_id).all()
    if not tables:
        raise HTTPException(status_code=404, detail="No table metadata found")

    results = []
    for table in tables:
        df = DataFrameCache.get_table_dataframe(table.storage_path, table.table_name)
        if df is not None:
            table_kpis = KpiEngine.compute_all_table_kpis(df, table.table_name, ds.detected_domain or "General")
            results.append({
                "table_name": table.table_name,
                "total_rows": len(df),
                "columns_analyzed": len(table_kpis),
                "kpis": table_kpis
            })

    return {
        "dataset_id": dataset_id,
        "dataset_name": ds.name,
        "domain": ds.detected_domain,
        "tables": results
    }

@router.post("/{dataset_id}/kpis/regenerate", response_model=List[KpiMetricSchema])
def regenerate_kpis(dataset_id: str, db: Session = Depends(get_db)):
    """
    Recomputes and persists all proper KPI values with full statistical quintet
    and AI insights into the database for the dataset.
    """
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    tables = db.query(TableMetadata).filter(TableMetadata.dataset_id == dataset_id).all()
    if not tables:
        raise HTTPException(status_code=404, detail="No table metadata found")

    dfs = {}
    for t in tables:
        df = DataFrameCache.get_table_dataframe(t.storage_path, t.table_name)
        if df is not None:
            dfs[t.table_name] = df

    if not dfs:
        raise HTTPException(status_code=400, detail="DataFrames could not be loaded")

    # Wipe existing KPIs and discover fresh ones with full statistical quintet
    db.query(KpiMetric).filter(KpiMetric.dataset_id == dataset_id).delete()
    db.commit()

    fresh_kpis = KpiEngine.discover_kpis(dfs, ds.detected_domain or "General")
    created_kpis = []
    for k in fresh_kpis:
        kpi_rec = KpiMetric(
            dataset_id=dataset_id,
            name=k["name"],
            display_name=k["display_name"],
            value=k["value"],
            formatted_value=k["formatted_value"],
            unit=k["unit"],
            calculation_type=k["calculation_type"],
            source_table=k["source_table"],
            source_column=k["source_column"],
            formula_explanation=k["formula_explanation"],
            impact_summary=k["impact_summary"],
            confidence=k["confidence"],
            order_index=k["order_index"],
            min_value=k.get("min_value"),
            max_value=k.get("max_value"),
            sum_value=k.get("sum_value"),
            avg_value=k.get("avg_value"),
            count_value=k.get("count_value"),
            formatted_min=k.get("formatted_min"),
            formatted_max=k.get("formatted_max"),
            formatted_sum=k.get("formatted_sum"),
            formatted_avg=k.get("formatted_avg"),
            formatted_count=k.get("formatted_count"),
            ai_insight=k.get("ai_insight"),
            statistical_summary=k.get("statistical_summary", {})
        )
        db.add(kpi_rec)
        created_kpis.append(kpi_rec)

    db.commit()
    for k in created_kpis:
        db.refresh(k)
    return created_kpis

@router.get("/{dataset_id}/insights", response_model=List[InsightSchema])
def get_insights(dataset_id: str, db: Session = Depends(get_db)):
    return db.query(Insight).filter(Insight.dataset_id == dataset_id).all()

@router.get("/{dataset_id}/anomalies", response_model=List[AnomalyRecordSchema])
def get_anomalies(dataset_id: str, db: Session = Depends(get_db)):
    return db.query(AnomalyRecord).filter(AnomalyRecord.dataset_id == dataset_id).all()

@router.get("/{dataset_id}/correlations")
def get_correlations(dataset_id: str, db: Session = Depends(get_db)):
    table = db.query(TableMetadata).filter(TableMetadata.dataset_id == dataset_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="No table metadata found")

    dfs = FileProcessor.read_file_to_dataframes(table.storage_path)
    df = dfs.get(table.table_name)
    if df is None:
        df = list(dfs.values())[0]

    matrix = CalculationTools.compute_correlation_matrix(df)
    return {"table_name": table.table_name, "correlations": matrix}

@router.get("/{dataset_id}/forecast")
def get_predictive_forecast(
    dataset_id: str,
    metric: Optional[str] = Query(None),
    date_col: Optional[str] = Query(None),
    horizon: int = Query(6, ge=1, le=36),
    table_name: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Generates statistical time-series forecasting with confidence intervals and scenarios."""
    tables = db.query(TableMetadata).filter(TableMetadata.dataset_id == dataset_id).all()
    if not tables:
        raise HTTPException(status_code=404, detail="No tables found for this dataset")

    target_table = None
    if table_name:
        target_table = next((t for t in tables if t.table_name == table_name), None)
    if not target_table:
        # Prefer a table that contains numeric columns
        for t in tables:
            num_cols = [c for c in t.columns if c.data_type == "numeric" and not c.is_identifier]
            if num_cols:
                target_table = t
                break
        if not target_table:
            target_table = tables[0]

    dfs = FileProcessor.read_file_to_dataframes(target_table.storage_path)
    df = dfs.get(target_table.table_name)
    if df is None and dfs:
        df = list(dfs.values())[0]

    if df is None or df.empty:
        raise HTTPException(status_code=400, detail="Data is empty or could not be loaded")

    result = ForecastEngine.generate_forecast(
        df=df,
        metric_col=metric,
        date_col=date_col,
        horizon=horizon
    )

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    result["table_name"] = target_table.table_name
    result["available_tables"] = [
        {
            "table_name": t.table_name,
            "row_count": t.row_count,
            "columns": [c.column_name for c in t.columns],
            "numeric_columns": [c.column_name for c in t.columns if c.data_type == "numeric" and not c.is_identifier]
        }
        for t in tables
    ]
    return result

@router.get("/{dataset_id}/clusters")
def get_ml_clusters(
    dataset_id: str,
    k: Optional[int] = Query(None, ge=2, le=6),
    table_name: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Executes automated K-Means clustering and cohort discovery."""
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    tables = db.query(TableMetadata).filter(TableMetadata.dataset_id == dataset_id).all()
    if not tables:
        raise HTTPException(status_code=404, detail="No tables found for this dataset")

    target_table = None
    if table_name:
        target_table = next((t for t in tables if t.table_name == table_name), None)
    if not target_table:
        # Prefer table with numeric columns
        for t in tables:
            num_cols = [c for c in t.columns if c.data_type == "numeric" and not c.is_identifier]
            if num_cols:
                target_table = t
                break
        if not target_table:
            target_table = tables[0]

    dfs = FileProcessor.read_file_to_dataframes(target_table.storage_path)
    df = dfs.get(target_table.table_name)
    if df is None and dfs:
        df = list(dfs.values())[0]

    if df is None or df.empty:
        raise HTTPException(status_code=400, detail="Data is empty or could not be loaded")

    result = MLClusteringEngine.discover_clusters(
        df=df,
        k=k,
        domain=ds.detected_domain or "General"
    )

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    result["table_name"] = target_table.table_name
    result["available_tables"] = [
        {
            "table_name": t.table_name,
            "row_count": t.row_count,
            "columns": [c.column_name for c in t.columns],
            "numeric_columns": [c.column_name for c in t.columns if c.data_type == "numeric" and not c.is_identifier]
        }
        for t in tables
    ]
    return result

@router.post("/{dataset_id}/sql")
def execute_sandbox_sql(
    dataset_id: str,
    payload: SqlQueryRequest,
    db: Session = Depends(get_db)
):
    """Executes safe read-only SQL queries against live in-memory SQLite tables."""
    tables = db.query(TableMetadata).filter(TableMetadata.dataset_id == dataset_id).all()
    if not tables:
        raise HTTPException(status_code=404, detail="No tables found for this dataset")

    dataframes: Dict[str, pd.DataFrame] = {}
    for t in tables:
        dfs = FileProcessor.read_file_to_dataframes(t.storage_path)
        if t.table_name in dfs:
            dataframes[t.table_name] = dfs[t.table_name]
        elif dfs:
            dataframes[t.table_name] = list(dfs.values())[0]

    result = SQLEngine.execute_sql(
        dataframes=dataframes,
        sql_query=payload.query,
        max_rows=payload.max_rows
    )

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result

@router.post("/{dataset_id}/sql/translate")
def translate_nl_to_sql(
    dataset_id: str,
    payload: SqlTranslateRequest,
    db: Session = Depends(get_db)
):
    """Translates a natural language question into executable SQL and Pandas code."""
    tables = db.query(TableMetadata).filter(TableMetadata.dataset_id == dataset_id).all()
    if not tables:
        raise HTTPException(status_code=404, detail="No tables found for this dataset")

    target_table = tables[0]
    if payload.table_name:
        found = next((t for t in tables if t.table_name == payload.table_name), None)
        if found:
            target_table = found

    dfs = FileProcessor.read_file_to_dataframes(target_table.storage_path)
    df = dfs.get(target_table.table_name)
    if df is None and dfs:
        df = list(dfs.values())[0]

    if df is None or df.empty:
        raise HTTPException(status_code=400, detail="Table is empty")

    return SQLEngine.generate_sql_from_nl(df, payload.prompt, table_name=target_table.table_name)

# -------------------------------------------------------------
# 1. EXECUTIVE AUDIO BRIEFING ("PODCAST")
# -------------------------------------------------------------
@router.get("/{dataset_id}/audio-brief")
@router.post("/{dataset_id}/audio-brief")
def get_audio_brief(dataset_id: str, db: Session = Depends(get_db)):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    df, _ = _load_primary_df(dataset_id, None, db)
    kpis = db.query(KpiMetric).filter(KpiMetric.dataset_id == dataset_id).all()
    anomalies = db.query(AnomalyRecord).filter(AnomalyRecord.dataset_id == dataset_id).all()

    kpi_dicts = [{"name": k.name, "formatted_value": k.formatted_value, "status": getattr(k, "status", "normal")} for k in kpis]
    anomaly_dicts = [{"severity": a.severity, "column_name": a.column_name, "explanation": a.explanation} for a in anomalies]

    return AudioBriefService.generate_brief(
        df=df,
        dataset_name=ds.name,
        domain=ds.detected_domain or "General",
        kpis=kpi_dicts,
        anomalies=anomaly_dicts
    )

# -------------------------------------------------------------
# 2. INTERACTIVE WHAT-IF SCENARIO PLANNER
# -------------------------------------------------------------
@router.get("/{dataset_id}/scenario-config")
def get_scenario_config(dataset_id: str, table_name: Optional[str] = None, db: Session = Depends(get_db)):
    df, resolved_table = _load_primary_df(dataset_id, table_name, db)
    config = ScenarioPlanner.get_scenario_config(df)
    config["table_name"] = resolved_table
    return config

@router.post("/{dataset_id}/scenario-simulate")
def simulate_scenario(dataset_id: str, payload: ScenarioSimulateRequest, db: Session = Depends(get_db)):
    df, _ = _load_primary_df(dataset_id, payload.table_name, db)
    res = ScenarioPlanner.simulate(
        df=df,
        target_metric=payload.target_metric,
        drivers=payload.drivers,
        dimension_col=payload.dimension_col
    )
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

# -------------------------------------------------------------
# 3. HIERARCHICAL METRIC DRIVER TREE
# -------------------------------------------------------------
@router.get("/{dataset_id}/driver-tree-config")
def get_driver_tree_config(
    dataset_id: str,
    table_name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Retrieve candidate metrics and dimension breakdown configurations for driver tree decomposition."""
    df, resolved_table = _load_primary_df(dataset_id, table_name, db)
    config = DriverTreeService.get_tree_config(df, resolved_table)
    config["table_name"] = resolved_table
    tables = db.query(TableMetadata).filter(TableMetadata.dataset_id == dataset_id).all()
    config["all_tables"] = [
        {"table_name": t.table_name, "row_count": t.row_count, "column_count": t.column_count}
        for t in tables
    ]
    return config

@router.post("/{dataset_id}/driver-tree")
def build_driver_tree(
    dataset_id: str,
    payload: DriverTreeRequest,
    db: Session = Depends(get_db)
):
    """Synthesizes a 2-tier hierarchical driver decomposition tree identifying growth leaders and margin drags."""
    df, resolved_table = _load_primary_df(dataset_id, payload.table_name, db)
    res = DriverTreeService.build_tree(
        df=df,
        metric_col=payload.metric_col,
        dimension_cols=payload.dimension_cols,
        calculation_type=payload.calculation_type,
        kpi_name=payload.kpi_name,
        unit=payload.unit,
        display_name=payload.display_name
    )
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    res["table_name"] = resolved_table
    return res

# -------------------------------------------------------------
# 4. ENTERPRISE AUTOMATED MACHINE LEARNING (AutoML STUDIO)
# -------------------------------------------------------------
@router.get("/{dataset_id}/automl/candidates")
def get_automl_targets(dataset_id: str, table_name: Optional[str] = None, db: Session = Depends(get_db)):
    """Discovers viable predictive target columns and their recommended task types."""
    df, resolved_table = _load_primary_df(dataset_id, table_name, db)
    candidates = AutoMLEngine.get_candidate_targets(df)
    return {
        "table_name": resolved_table,
        "total_rows": len(df),
        "candidates": candidates
    }

@router.post("/{dataset_id}/automl/train")
def train_automl_models(
    dataset_id: str,
    payload: AutoMLTrainRequest,
    db: Session = Depends(get_db)
):
    """Executes automated multi-model machine learning benchmark and registers champion model."""
    df, resolved_table = _load_primary_df(dataset_id, payload.table_name, db)
    result = AutoMLEngine.run_automl(
        df=df,
        target_col=payload.target_column,
        feature_cols=payload.feature_columns,
        task_type=payload.task_type
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    result["table_name"] = resolved_table
    return result

@router.post("/{dataset_id}/automl/predict")
def predict_automl_what_if(
    dataset_id: str,
    payload: AutoMLPredictRequest
):
    """Interactive real-time prediction using the trained champion model."""
    result = AutoMLEngine.predict_what_if(
        model_id=payload.model_id,
        feature_inputs=payload.feature_inputs
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

# -------------------------------------------------------------
# 5. ADVANCED PARETO (80/20) & MULTIVARIATE REGRESSION
# -------------------------------------------------------------
@router.get("/{dataset_id}/pareto")
def get_pareto_analysis(
    dataset_id: str,
    dimension_col: str = Query(...),
    metric_col: str = Query(...),
    top_n: int = Query(30, ge=5, le=100),
    table_name: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Executes Pareto 80/20 concentration analysis with Gini coefficient and cumulative curve."""
    df, resolved_table = _load_primary_df(dataset_id, table_name, db)
    res = CalculationTools.execute_pareto_analysis(
        df=df,
        dimension_col=dimension_col,
        metric_col=metric_col,
        top_n=top_n
    )
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    res["table_name"] = resolved_table
    return res

@router.get("/{dataset_id}/regression")
def get_multivariate_regression(
    dataset_id: str,
    target_col: str = Query(...),
    features: Optional[str] = Query(None),
    table_name: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Fits multivariate OLS linear regression with R², p-values, and feature coefficients."""
    df, resolved_table = _load_primary_df(dataset_id, table_name, db)
    feature_list = [f.strip() for f in features.split(",") if f.strip()] if features else None
    res = CalculationTools.execute_multivariate_regression(
        df=df,
        target_col=target_col,
        feature_cols=feature_list
    )
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    res["table_name"] = resolved_table
    return res



