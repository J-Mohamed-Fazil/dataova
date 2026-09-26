from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.fusion_engine import FusionEngine

router = APIRouter(prefix="/fusion", tags=["fusion"])

class EvaluateJoinRequest(BaseModel):
    dataset_id_1: str
    table_name_1: str
    key_1: str
    dataset_id_2: str
    table_name_2: str
    key_2: str
    join_type: str = "inner"

class PreviewFusionRequest(BaseModel):
    dataset_id_1: str
    table_name_1: str
    key_1: str
    dataset_id_2: str
    table_name_2: str
    key_2: str
    join_type: str = "inner"
    max_rows: int = 25

class CrossCorrelationRequest(BaseModel):
    dataset_id_1: str
    table_name_1: str
    key_1: str
    dataset_id_2: str
    table_name_2: str
    key_2: str
    join_type: str = "inner"

class MaterializeFusionRequest(BaseModel):
    dataset_id_1: str
    table_name_1: str
    key_1: str
    dataset_id_2: str
    table_name_2: str
    key_2: str
    join_type: str = "inner"
    name: str = "Fused Intelligence"

@router.get("/candidates")
def get_fusion_candidates(db: Session = Depends(get_db)):
    """
    Returns all candidate tables across ingested datasets available for cross-table fusion.
    """
    candidates = FusionEngine.get_candidates(db)
    return {"candidates": candidates, "total_tables": len(candidates)}

@router.post("/evaluate")
def evaluate_semantic_join(payload: EvaluateJoinRequest, db: Session = Depends(get_db)):
    """
    Evaluates key overlap, match rate %, orphan keys, nulls, and cartesian risk.
    """
    df1 = FusionEngine.load_table_df(db, payload.dataset_id_1, payload.table_name_1)
    if df1 is None:
        raise HTTPException(status_code=404, detail=f"Table '{payload.table_name_1}' not found in dataset 1.")

    df2 = FusionEngine.load_table_df(db, payload.dataset_id_2, payload.table_name_2)
    if df2 is None:
        raise HTTPException(status_code=404, detail=f"Table '{payload.table_name_2}' not found in dataset 2.")

    try:
        eval_res = FusionEngine.evaluate_semantic_join(
            df1, df2, payload.key_1, payload.key_2, payload.join_type
        )
        return eval_res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/preview")
def preview_fusion(payload: PreviewFusionRequest, db: Session = Depends(get_db)):
    """
    Merges selected tables in memory and returns a live sample preview with column provenance.
    """
    df1 = FusionEngine.load_table_df(db, payload.dataset_id_1, payload.table_name_1)
    if df1 is None:
        raise HTTPException(status_code=404, detail=f"Table '{payload.table_name_1}' not found in dataset 1.")

    df2 = FusionEngine.load_table_df(db, payload.dataset_id_2, payload.table_name_2)
    if df2 is None:
        raise HTTPException(status_code=404, detail=f"Table '{payload.table_name_2}' not found in dataset 2.")

    try:
        merged_df, provenance = FusionEngine.execute_fusion(
            df1, df2, payload.key_1, payload.key_2, payload.join_type,
            payload.table_name_1, payload.table_name_2
        )

        total_rows = len(merged_df)
        total_cols = len(merged_df.columns)

        # Sanitize NaN/inf values for JSON response
        sample_df = merged_df.head(payload.max_rows).copy()
        sample_records = sample_df.replace({float("nan"): None, float("inf"): None, float("-inf"): None}).to_dict(orient="records")

        columns_meta = []
        for col in merged_df.columns:
            p_info = provenance.get(col, {"source_table": "Unknown", "original_name": col})
            dtype = str(merged_df[col].dtype)
            columns_meta.append({
                "column_name": col,
                "source_table": p_info["source_table"],
                "original_name": p_info["original_name"],
                "data_type": "numeric" if ("int" in dtype or "float" in dtype) else "string",
                "missing_count": int(merged_df[col].isna().sum()),
                "missing_pct": round((merged_df[col].isna().sum() / max(1, total_rows)) * 100, 1)
            })

        return {
            "total_rows": total_rows,
            "total_columns": total_cols,
            "columns": columns_meta,
            "sample_rows": sample_records,
            "provenance": provenance
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/correlations")
def compute_cross_correlations(payload: CrossCorrelationRequest, db: Session = Depends(get_db)):
    """
    Computes cross-table correlation matrix, synergies, and scatter plots between numeric columns.
    """
    df1 = FusionEngine.load_table_df(db, payload.dataset_id_1, payload.table_name_1)
    if df1 is None:
        raise HTTPException(status_code=404, detail=f"Table '{payload.table_name_1}' not found in dataset 1.")

    df2 = FusionEngine.load_table_df(db, payload.dataset_id_2, payload.table_name_2)
    if df2 is None:
        raise HTTPException(status_code=404, detail=f"Table '{payload.table_name_2}' not found in dataset 2.")

    try:
        merged_df, _ = FusionEngine.execute_fusion(
            df1, df2, payload.key_1, payload.key_2, payload.join_type,
            payload.table_name_1, payload.table_name_2
        )

        corr_res = FusionEngine.compute_cross_correlations(
            merged_df, df1.columns.tolist(), df2.columns.tolist()
        )
        return corr_res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/materialize")
def materialize_fused_dataset(payload: MaterializeFusionRequest, db: Session = Depends(get_db)):
    """
    Materializes the joined dataset as a permanent, first-class Dataset in DATOVA.
    """
    df1 = FusionEngine.load_table_df(db, payload.dataset_id_1, payload.table_name_1)
    if df1 is None:
        raise HTTPException(status_code=404, detail=f"Table '{payload.table_name_1}' not found in dataset 1.")

    df2 = FusionEngine.load_table_df(db, payload.dataset_id_2, payload.table_name_2)
    if df2 is None:
        raise HTTPException(status_code=404, detail=f"Table '{payload.table_name_2}' not found in dataset 2.")

    try:
        merged_df, provenance = FusionEngine.execute_fusion(
            df1, df2, payload.key_1, payload.key_2, payload.join_type,
            payload.table_name_1, payload.table_name_2
        )

        if len(merged_df) == 0:
            raise HTTPException(status_code=400, detail="Fused dataset produced 0 rows. Please select a compatible join key or change join type to LEFT or FULL OUTER.")

        new_dataset = FusionEngine.materialize_dataset(
            payload.name, merged_df, db, provenance
        )

        return {
            "success": True,
            "dataset_id": new_dataset.id,
            "dataset_name": new_dataset.name,
            "row_count": new_dataset.row_count,
            "column_count": new_dataset.column_count,
            "detected_domain": new_dataset.detected_domain,
            "data_health_score": new_dataset.data_health_score,
            "status": new_dataset.status
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
