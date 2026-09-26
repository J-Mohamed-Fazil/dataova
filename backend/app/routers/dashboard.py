import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
import pandas as pd

logger = logging.getLogger("datova.dashboard")

from app.database import get_db
from app.models import DashboardSheet, DashboardChart, TableMetadata, Dataset, TableRelationship
from app.schemas.dashboard import (
    DashboardSheetSchema,
    DashboardSheetCreateSchema,
    DashboardSheetUpdateSchema,
    DashboardChartSchema,
    DashboardChartCreateSchema,
    DashboardChartUpdateSchema
)
from app.services.file_processor import FileProcessor
from app.services.cache_manager import DataFrameCache
from app.services.calculation_tools import CalculationTools
from app.services.dashboard_generator import DashboardGenerator
from app.services.llm_orchestrator import LLMOrchestrator
from app.services.ai_studio_cognitive_engine import AIStudioCognitiveEngine

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

import time

class ChartDataCache:
    _cache: Dict[str, Dict[str, Any]] = {}
    _MAX_ENTRIES = 1000

    @classmethod
    def get(cls, key: str) -> Optional[List[Dict[str, Any]]]:
        item = cls._cache.get(key)
        if item:
            if time.time() - item["ts"] < 1200:  # 20-minute cache TTL
                return item["data"]
            cls._cache.pop(key, None)
        return None

    @classmethod
    def set(cls, key: str, data: List[Dict[str, Any]]) -> None:
        if len(cls._cache) >= cls._MAX_ENTRIES:
            sorted_keys = sorted(cls._cache.keys(), key=lambda k: cls._cache[k]["ts"])
            for old_k in sorted_keys[:200]:
                cls._cache.pop(old_k, None)
        cls._cache[key] = {"data": data, "ts": time.time()}

    @classmethod
    def invalidate(cls, prefix: str = "") -> None:
        if not prefix:
            cls._cache.clear()
        else:
            to_del = [k for k in cls._cache if k.startswith(prefix)]
            for k in to_del:
                cls._cache.pop(k, None)

class JoinedPreviewRequest(BaseModel):
    primary_table: str
    join_table: Optional[str] = None
    primary_key: Optional[str] = None
    join_key: Optional[str] = None
    additional_joins: Optional[List[Dict[str, str]]] = None

class AISynthesizeChartRequest(BaseModel):
    prompt: str
    target_table: Optional[str] = None
    preferred_chart_type: Optional[str] = None

class AIGenerateDashboardRequest(BaseModel):
    prompt: Optional[str] = None
    preset: Optional[str] = "executive"
    palette: Optional[str] = "cyberpunk"
    mode: Optional[str] = "add_sheet"

class GenerateSheetInsightsRequest(BaseModel):
    prompt: Optional[str] = None
    preset: Optional[str] = None

class StudioPreviewChartRequest(BaseModel):
    table_name: str
    join_table: Optional[str] = None
    primary_key: Optional[str] = None
    join_key: Optional[str] = None
    joins: Optional[List[Dict[str, str]]] = None
    x_field: str
    y_field: str
    secondary_y_field: Optional[str] = None
    aggregation: Optional[str] = "sum"
    chart_type: str = "bar"
    palette: Optional[str] = None
    filters: Optional[List[Dict[str, Any]]] = None

class DeepenThinkingRequest(BaseModel):
    table_name: str
    x_field: str
    y_field: str
    chart_type: Optional[str] = "bar"
    aggregation: Optional[str] = "sum"

class WhatIfSimulateRequest(BaseModel):
    points: List[Dict[str, Any]]
    delta_pct: float
    target_cohort: Optional[str] = None

def _resolve_column_name(df: pd.DataFrame, col_name: Optional[str]) -> Optional[str]:
    """
    Resolves column name handling table prefixes (e.g. 'table.column'), case mismatches,
    punctuation/spacing differences, and internal temporary column artifacts.
    """
    if not col_name or df is None or len(df.columns) == 0:
        return None

    c_clean = str(col_name).strip()
    if c_clean.startswith("_") or "parsed_dt" in c_clean.lower():
        # Internal artifact column - find real date or first non-internal column
        date_candidates = [
            c for c in df.columns
            if not str(c).startswith("_") and (
                pd.api.types.is_datetime64_any_dtype(df[c]) or
                any(k in str(c).lower() for k in ["date", "time", "timestamp", "year", "month", "day", "quarter", "period"])
            )
        ]
        if date_candidates:
            return date_candidates[0]
        return None

    # 1. Exact match
    if c_clean in df.columns:
        return c_clean

    # 2. Check if table prefix was included (e.g., 'orders.OrderDate' -> 'OrderDate')
    clean_part = c_clean.split(".")[-1].strip() if "." in c_clean else c_clean
    if clean_part in df.columns:
        return clean_part

    # 3. Case-insensitive exact match
    clean_lower = clean_part.lower()
    for c in df.columns:
        if not str(c).startswith("_") and c.lower() == clean_lower:
            return c

    # 4. Normalized alphanumeric match (ignores underscores, spaces, hyphens, case)
    # e.g., 'order_date' matches 'OrderDate', 'Order Date', 'Order_Date', 'order-date'
    norm_target = "".join(ch for ch in clean_part.lower() if ch.isalnum())
    if norm_target:
        for c in df.columns:
            if not str(c).startswith("_") and "".join(ch for ch in str(c).lower() if ch.isalnum()) == norm_target:
                return c

    # 5. Prefix/suffix joined column match (e.g., 'CategoryName_joined' or 'CategoryName_categories')
    for c in df.columns:
        if not str(c).startswith("_"):
            c_low = str(c).lower()
            if c_low.startswith(clean_lower + "_") or c_low.endswith("_" + clean_lower):
                return c

    # 6. Target contained inside column name or vice-versa
    for c in df.columns:
        if not str(c).startswith("_") and (clean_lower in str(c).lower() or str(c).lower() in clean_lower):
            return c

    return None

def _calculate_points_from_df(
    df: pd.DataFrame,
    chart_type: str,
    x_field: Optional[str],
    y_field: Optional[str],
    secondary_y_field: Optional[str] = None,
    aggregation: Optional[str] = "sum",
    filters: Optional[List[Dict[str, Any]]] = None,
    config: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """
    Computes chart visualization data points from a DataFrame with guaranteed non-empty fallbacks.
    """
    if df is None or len(df) == 0:
        return []

    try:
        ctype = (chart_type or "bar").lower()
        chart_config = config or {}
        agg = aggregation or "sum"

        valid_cols = [c for c in df.columns if not str(c).startswith("_")]
        if not valid_cols:
            valid_cols = list(df.columns)

        num_cols = [c for c in df.select_dtypes(include=["number"]).columns if not str(c).startswith("_")]
        date_cols = [
            c for c in valid_cols
            if pd.api.types.is_datetime64_any_dtype(df[c]) or
            any(k in str(c).lower() for k in ["date", "time", "timestamp", "year", "month", "day", "quarter", "period"])
        ]
        cat_cols = [c for c in valid_cols if c not in date_cols and c not in num_cols]
        if not cat_cols:
            cat_cols = [c for c in valid_cols if c not in date_cols]

        resolved_x = _resolve_column_name(df, x_field)
        resolved_y = _resolve_column_name(df, y_field)

        # Smart defaults based on visualization archetype
        if ctype in ["line", "area"]:
            if not resolved_x or resolved_x not in df.columns:
                resolved_x = date_cols[0] if date_cols else (cat_cols[0] if cat_cols else valid_cols[0])
            if not resolved_y or resolved_y not in df.columns:
                resolved_y = num_cols[0] if num_cols else valid_cols[-1]

            pts = CalculationTools.execute_time_series(
                df,
                date_col=resolved_x,
                value_col=resolved_y,
                agg_type=agg,
                filters=filters,
                enable_forecast=chart_config.get("enable_forecast", False),
                forecast_periods=chart_config.get("forecast_periods", 6)
            )
            if not pts:
                pts = CalculationTools.execute_aggregation(
                    df,
                    group_by_col=resolved_x,
                    value_col=resolved_y,
                    agg_type=agg,
                    top_n=30,
                    filters=filters
                )
            return pts

        elif ctype in ["composed", "combo"]:
            if not resolved_x or resolved_x not in df.columns:
                resolved_x = cat_cols[0] if cat_cols else (date_cols[0] if date_cols else valid_cols[0])
            if not resolved_y or resolved_y not in df.columns:
                resolved_y = num_cols[0] if num_cols else valid_cols[0]

            sec_y = _resolve_column_name(df, secondary_y_field or chart_config.get("secondary_y_field"))
            if not sec_y or sec_y not in df.columns:
                other_nums = [c for c in num_cols if c != resolved_y and c != resolved_x]
                sec_y = other_nums[0] if other_nums else resolved_y

            pts = CalculationTools.execute_dual_aggregation(
                df,
                group_by_col=resolved_x,
                primary_value_col=resolved_y,
                secondary_value_col=sec_y,
                agg_type=agg,
                top_n=20,
                filters=filters
            )
            if not pts:
                pts = CalculationTools.execute_aggregation(df, group_by_col=resolved_x, value_col=resolved_y, agg_type=agg, top_n=20, filters=filters)
            return pts

        elif ctype in ["heatmap", "heat_map"]:
            if not resolved_x or resolved_x not in df.columns:
                resolved_x = cat_cols[0] if cat_cols else valid_cols[0]
            sec_dim = _resolve_column_name(df, secondary_y_field or chart_config.get("secondary_y_field") or chart_config.get("secondary_dimension"))
            pts = CalculationTools.execute_heatmap(
                df,
                group_by_col=resolved_x,
                secondary_col=sec_dim,
                value_col=resolved_y if (resolved_y and resolved_y != resolved_x and resolved_y in df.columns) else None,
                agg_type=agg,
                top_x=12,
                top_y=8,
                filters=filters
            )
            if not pts:
                pts = CalculationTools.execute_aggregation(df, group_by_col=resolved_x, value_col=resolved_y if (resolved_y and resolved_y in df.columns) else None, agg_type=agg, top_n=15, filters=filters)
            return pts

        elif ctype in ["treemap", "tree_map"]:
            if not resolved_x or resolved_x not in df.columns:
                resolved_x = cat_cols[0] if cat_cols else valid_cols[0]
            sec_dim = _resolve_column_name(df, secondary_y_field or chart_config.get("secondary_y_field") or chart_config.get("secondary_dimension"))
            pts = CalculationTools.execute_treemap(
                df,
                group_by_col=resolved_x,
                secondary_col=sec_dim,
                value_col=resolved_y if (resolved_y and resolved_y != resolved_x and resolved_y in df.columns) else None,
                agg_type=agg,
                top_n=20,
                filters=filters
            )
            if not pts:
                pts = CalculationTools.execute_aggregation(df, group_by_col=resolved_x, value_col=resolved_y if (resolved_y and resolved_y in df.columns) else None, agg_type=agg, top_n=15, filters=filters)
            return pts

        elif ctype == "scatter":
            if not resolved_x or resolved_x not in df.columns:
                resolved_x = num_cols[0] if num_cols else valid_cols[0]
            if not resolved_y or resolved_y not in df.columns:
                resolved_y = num_cols[1] if len(num_cols) > 1 else (num_cols[0] if num_cols else valid_cols[-1])

            pts = CalculationTools.execute_scatter(
                df,
                x_col=resolved_x,
                y_col=resolved_y,
                sample_size=150,
                filters=filters
            )
            if not pts:
                pts = CalculationTools.execute_aggregation(df, group_by_col=resolved_x, value_col=resolved_y, agg_type="count", top_n=25, filters=filters)
            return pts

        elif ctype == "histogram":
            target_col = resolved_y if (resolved_y and resolved_y in df.columns) else (resolved_x if (resolved_x and resolved_x in df.columns) else (num_cols[0] if num_cols else valid_cols[0]))
            pts = CalculationTools.execute_distribution(
                df,
                num_col=target_col,
                bins_count=10,
                filters=filters
            )
            if not pts:
                pts = CalculationTools.execute_aggregation(df, group_by_col=target_col, value_col=None, agg_type="count", top_n=10, filters=filters)
            return pts

        elif ctype == "table":
            preview = df.head(12).to_dict(orient="records")
            return [{"label": "row", "value": row} for row in preview]

        else: # bar, stacked_bar, horizontal_bar, pie, map, geo, radar
            if not resolved_x or resolved_x not in df.columns:
                resolved_x = cat_cols[0] if cat_cols else (date_cols[0] if date_cols else valid_cols[0])
            if not resolved_y or resolved_y not in df.columns:
                resolved_y = num_cols[0] if num_cols else (valid_cols[1] if len(valid_cols) > 1 else valid_cols[0])

            pts = CalculationTools.execute_aggregation(
                df,
                group_by_col=resolved_x,
                value_col=resolved_y,
                agg_type=agg,
                top_n=30 if ctype in ["map", "geo", "horizontal_bar"] else 20,
                filters=filters
            )
            if not pts and len(valid_cols) > 0:
                pts = CalculationTools.execute_aggregation(
                    df,
                    group_by_col=valid_cols[0],
                    value_col=valid_cols[1] if len(valid_cols) > 1 else None,
                    agg_type="count",
                    top_n=15
                )
            return pts
    except Exception as e:
        logger.warning(f"Error computing chart points: {e}")
        try:
            first_col = [c for c in df.columns if not str(c).startswith("_")][0] if len(df.columns) > 0 else df.columns[0]
            return CalculationTools.execute_aggregation(df, group_by_col=first_col, value_col=None, agg_type="count", top_n=15)
        except Exception:
            return []

def _compute_summary_from_points(points: List[Dict[str, Any]]) -> Dict[str, Any]:
    vals = []
    labels = []
    for p in points:
        v = p.get("value")
        l = p.get("label") or p.get("name") or str(p.get("x", ""))
        if isinstance(v, (int, float)) and not pd.isna(v):
            vals.append(float(v))
            labels.append(l)

    if not vals:
        return {
            "total_points": len(points),
            "sum": 0.0,
            "mean": 0.0,
            "max": 0.0,
            "min": 0.0,
            "peak_label": "N/A",
            "peak_val": 0.0
        }

    s = sum(vals)
    m = s / len(vals)
    max_val = max(vals)
    min_val = min(vals)
    peak_idx = vals.index(max_val)
    peak_label = labels[peak_idx] if peak_idx < len(labels) else "N/A"

    return {
        "total_points": len(points),
        "sum": round(s, 2),
        "mean": round(m, 2),
        "max": round(max_val, 2),
        "min": round(min_val, 2),
        "peak_label": str(peak_label),
        "peak_val": round(max_val, 2)
    }

def _generate_studio_insight(title: str, x_field: str, y_field: str, summary: Dict[str, Any], chart_type: str) -> str:
    peak_label = summary.get("peak_label", "Top entity")
    peak_val = summary.get("peak_val", 0)
    total = summary.get("sum", 0)
    mean = summary.get("mean", 0)

    if total > 0 and peak_val > 0:
        share = round((peak_val / total) * 100, 1)
        return (
            f"Strategic analysis indicates '{peak_label}' is the standout performance driver for {y_field}, "
            f"commanding {peak_val:,.0f} ({share}% of total across {summary.get('total_points', 0)} observed {x_field} cohorts). "
            f"Baseline observation mean stands at {mean:,.1f}."
        )
    return f"Synthesized {chart_type.upper()} visualization across {summary.get('total_points', 0)} records of {x_field} tracking {y_field}."

def _calculate_chart_data(
    chart: DashboardChart,
    db: Session,
    dataset_id: Optional[str] = None,
    tables_map: Optional[Dict[str, TableMetadata]] = None,
    df_cache: Optional[Dict[str, pd.DataFrame]] = None
) -> List[Dict[str, Any]]:
    """
    Deterministically computes data points for a chart configuration using Pandas.
    Supports single-table, 2-table joins, and chained multi-table joins.
    """
    cache_key = f"{dataset_id or ''}:{chart.id}:{chart.chart_type}:{chart.x_field}:{chart.y_field}:{chart.secondary_y_field}:{chart.aggregation}:{str(chart.filters)}:{str(chart.config)}"
    cached = ChartDataCache.get(cache_key)
    if cached is not None:
        return cached

    if not dataset_id:
        sheet = db.query(DashboardSheet).filter(DashboardSheet.id == chart.sheet_id).first()
        dataset_id = sheet.dataset_id if sheet else None

    # Find primary table via O(1) tables_map if provided, else DB query
    if tables_map is not None:
        table = tables_map.get(chart.table_name)
        if not table and tables_map:
            table = next(iter(tables_map.values()), None)
    else:
        table_query = db.query(TableMetadata).filter(TableMetadata.table_name == chart.table_name)
        if dataset_id:
            table_query = table_query.filter(TableMetadata.dataset_id == dataset_id)
        table = table_query.first()
        if not table and dataset_id:
            table = db.query(TableMetadata).filter(TableMetadata.dataset_id == dataset_id).first()

    if not table:
        return []

    try:
        if df_cache is not None and table.table_name in df_cache:
            df = df_cache[table.table_name]
        else:
            df = DataFrameCache.get_table_dataframe(table.storage_path, table.table_name)
            if df_cache is not None and df is not None:
                df_cache[table.table_name] = df

        if df is None or df.empty:
            return []

        # Check for multi-table chained joins (e.g. 3+ tables configured in config.joins)
        chart_config = chart.config or {}
        joins_list = chart_config.get("joins", [])
        has_joins = bool(joins_list or chart.join_table)

        # Only copy or sample if joins are required; otherwise read directly without cloning
        if has_joins:
            if len(df) > 30000:
                df = df.sample(30000, random_state=42)
            else:
                df = df.copy()
        else:
            df = df if len(df) <= 30000 else df.iloc[:30000]

        # Gather columns required for this chart visualization
        needed_fields = {
            f.lower() for f in [
                chart.x_field,
                chart.y_field,
                chart.secondary_y_field,
                chart_config.get("secondary_y_field")
            ] if f
        }
        for flt in (chart.filters or []):
            if isinstance(flt, dict) and flt.get("field"):
                needed_fields.add(flt["field"].lower())

        if joins_list:
            for idx, j_info in enumerate(joins_list):
                # If all needed fields are already available in df, stop further merges
                if needed_fields and all(any(nf == c.lower() for c in df.columns) for nf in needed_fields):
                    break

                j_tbl_name = j_info.get("table")
                p_key = j_info.get("primary_key")
                j_key = j_info.get("join_key")

                j_meta = tables_map.get(j_tbl_name) if tables_map else None
                if not j_meta:
                    j_meta = db.query(TableMetadata).filter(
                        TableMetadata.table_name == j_tbl_name,
                        TableMetadata.dataset_id == dataset_id
                    ).first() or db.query(TableMetadata).filter(TableMetadata.table_name == j_tbl_name).first()

                if j_meta:
                    if df_cache is not None and j_meta.table_name in df_cache:
                        j_df = df_cache[j_meta.table_name]
                    else:
                        j_df = DataFrameCache.get_table_dataframe(j_meta.storage_path, j_meta.table_name)
                        if df_cache is not None and j_df is not None:
                            df_cache[j_meta.table_name] = j_df

                    if j_df is not None:
                        if len(j_df) > 30000:
                            j_df = j_df.sample(30000, random_state=42)
                        else:
                            j_df = j_df.copy()

                        actual_p = next((c for c in df.columns if c.lower() == str(p_key).lower()), None) if p_key else None
                        actual_j = next((c for c in j_df.columns if c.lower() == str(j_key).lower()), None) if j_key else None
                        if not actual_p or not actual_j:
                            shared = [c for c in df.columns if c in j_df.columns]
                            if shared:
                                actual_p, actual_j = shared[0], shared[0]

                        if actual_p and actual_j:
                            if df[actual_p].dtype != j_df[actual_j].dtype:
                                df[actual_p] = df[actual_p].astype(str)
                                j_df[actual_j] = j_df[actual_j].astype(str)
                            df = df.merge(j_df, left_on=actual_p, right_on=actual_j, how="left", suffixes=('', f'_{j_tbl_name}'))

        # Standard 2-Table Join if not handled by joins_list
        elif chart.join_table:
            # Only join if needed fields are not already present in df
            if not (needed_fields and all(any(nf == c.lower() for c in df.columns) for nf in needed_fields)):
                join_tbl = tables_map.get(chart.join_table) if tables_map else None
                if not join_tbl:
                    join_tbl = db.query(TableMetadata).filter(
                        TableMetadata.table_name == chart.join_table,
                        TableMetadata.dataset_id == dataset_id
                    ).first() or db.query(TableMetadata).filter(TableMetadata.table_name == chart.join_table).first()

                if join_tbl:
                    if df_cache is not None and join_tbl.table_name in df_cache:
                        j_df = df_cache[join_tbl.table_name]
                    else:
                        j_df = DataFrameCache.get_table_dataframe(join_tbl.storage_path, join_tbl.table_name)
                        if df_cache is not None and j_df is not None:
                            df_cache[join_tbl.table_name] = j_df

                    if j_df is not None:
                        if len(j_df) > 30000:
                            j_df = j_df.sample(30000, random_state=42)
                        else:
                            j_df = j_df.copy()

                        p_key = chart.primary_key
                        j_key = chart.join_key

                        if not p_key or not j_key or p_key not in df.columns or j_key not in j_df.columns:
                            rel = db.query(TableRelationship).filter(
                                TableRelationship.dataset_id == dataset_id,
                                ((TableRelationship.source_table == chart.table_name) & (TableRelationship.target_table == chart.join_table)) |
                                ((TableRelationship.target_table == chart.table_name) & (TableRelationship.source_table == chart.join_table))
                            ).first()
                            if rel:
                                if rel.source_table == chart.table_name:
                                    p_key, j_key = rel.source_column, rel.target_column
                                else:
                                    p_key, j_key = rel.target_column, rel.source_column

                        if not p_key or not j_key or p_key not in df.columns or j_key not in j_df.columns:
                            shared = [c for c in df.columns if c in j_df.columns]
                            if shared:
                                p_key, j_key = shared[0], shared[0]

                        if p_key and j_key and p_key in df.columns and j_key in j_df.columns:
                            if df[p_key].dtype != j_df[j_key].dtype:
                                df[p_key] = df[p_key].astype(str)
                                j_df[j_key] = j_df[j_key].astype(str)
                            df = df.merge(j_df, left_on=p_key, right_on=j_key, how="left", suffixes=('', '_joined'))

        # Auto-repair chart x_field if referencing an internal temporary column
        if chart.x_field and (str(chart.x_field).startswith("_") or "parsed_dt" in str(chart.x_field).lower()):
            date_candidates = [
                c for c in df.columns
                if not str(c).startswith("_") and (
                    pd.api.types.is_datetime64_any_dtype(df[c]) or
                    any(k in str(c).lower() for k in ["date", "time", "timestamp", "year", "month", "day", "quarter", "period"])
                )
            ]
            if date_candidates:
                chart.x_field = date_candidates[0]
                if "( Parsed Dt)" in (chart.title or ""):
                    chart.title = chart.title.replace("( Parsed Dt)", f"({chart.x_field.replace('_', ' ').title()})")

        pts = _calculate_points_from_df(
            df=df,
            chart_type=chart.chart_type,
            x_field=chart.x_field,
            y_field=chart.y_field,
            secondary_y_field=chart.secondary_y_field or chart_config.get("secondary_y_field"),
            aggregation=chart.aggregation,
            filters=chart.filters,
            config=chart.config
        )
        ChartDataCache.set(cache_key, pts)
        return pts
    except Exception as e:
        logger.warning(f"Error calculating chart {chart.id} ({chart.title}): {e}")
        return []

@router.get("/{dataset_id}/sheets", response_model=List[DashboardSheetSchema])
def get_dashboard_sheets(dataset_id: str, db: Session = Depends(get_db)):
    sheets = db.query(DashboardSheet).filter(
        DashboardSheet.dataset_id == dataset_id
    ).order_by(DashboardSheet.order_index).all()

    if not sheets:
        return []

    tables_map = {t.table_name: t for t in db.query(TableMetadata).filter(TableMetadata.dataset_id == dataset_id).all()}
    df_cache: Dict[str, pd.DataFrame] = {}

    # Populate chart data for frontend
    for sheet in sheets:
        if sheet.business_questions is None:
            sheet.business_questions = []
        for chart in sheet.charts:
            chart.data = _calculate_chart_data(
                chart,
                db,
                dataset_id=dataset_id,
                tables_map=tables_map,
                df_cache=df_cache
            )

    return sheets

@router.post("/{dataset_id}/generate-all", response_model=List[DashboardSheetSchema])
def generate_all_dashboards(dataset_id: str, db: Session = Depends(get_db)):
    """
    Exhaustively synthesizes all possible dashboards and charts for every table
    and all corresponding tables that join 2 or more tables together.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # 1. Delete existing sheets and charts
    ChartDataCache.invalidate()
    existing_sheets = db.query(DashboardSheet).filter(DashboardSheet.dataset_id == dataset_id).all()
    for s in existing_sheets:
        db.delete(s)
    db.commit()

    # 2. Load all tables into DataFrames via cache
    all_dfs: Dict[str, pd.DataFrame] = {}
    for tbl in dataset.tables:
        t_df = DataFrameCache.get_table_dataframe(tbl.storage_path, tbl.table_name)
        if t_df is not None:
            all_dfs[tbl.table_name] = t_df

    if not all_dfs:
        raise HTTPException(status_code=400, detail="No table data available to generate dashboards")

    # 3. Retrieve detected relationships
    rels = db.query(TableRelationship).filter(TableRelationship.dataset_id == dataset_id).all()
    rel_dicts = [
        {
            "source_table": r.source_table,
            "source_column": r.source_column,
            "target_table": r.target_table,
            "target_column": r.target_column,
            "confidence": r.confidence,
            "relationship_type": r.relationship_type
        }
        for r in rels
    ]

    # 4. Generate all sheets & charts
    sheets = DashboardGenerator.generate_all_sheets_and_charts(
        dataset_id=dataset_id,
        all_dataframes=all_dfs,
        detected_rels=rel_dicts,
        db=db
    )

    # 5. Populate calculated chart data
    for sheet in sheets:
        if sheet.business_questions is None:
            sheet.business_questions = []
        for chart in sheet.charts:
            chart.data = _calculate_chart_data(chart, db)

    return sheets

@router.post("/{dataset_id}/ai-generate-dashboard", response_model=List[DashboardSheetSchema])
def ai_generate_dashboard(
    dataset_id: str,
    payload: AIGenerateDashboardRequest,
    db: Session = Depends(get_db)
):
    """
    Synthesizes custom AI dashboards based on natural language prompts or strategic presets,
    complete with dual-axis composed charts, area gradients, radar profiles, and business questions.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    all_dfs: Dict[str, pd.DataFrame] = {}
    for tbl in dataset.tables:
        try:
            t_df = DataFrameCache.get_table_dataframe(tbl.storage_path, tbl.table_name)
            if t_df is not None and not t_df.empty:
                all_dfs[tbl.table_name] = t_df
        except Exception as e:
            logger.warning(f"Could not load table {tbl.table_name}: {e}")

    if not all_dfs:
        raise HTTPException(status_code=400, detail="No table data available to generate dashboards")

    rels = db.query(TableRelationship).filter(TableRelationship.dataset_id == dataset_id).all()
    rel_dicts = [
        {
            "source_table": r.source_table,
            "source_column": r.source_column,
            "target_table": r.target_table,
            "target_column": r.target_column,
            "confidence": r.confidence,
            "relationship_type": r.relationship_type
        }
        for r in rels
    ]

    try:
        new_sheets = DashboardGenerator.generate_ai_themed_dashboard(
            dataset_id=dataset_id,
            all_dataframes=all_dfs,
            detected_rels=rel_dicts,
            db=db,
            prompt=payload.prompt,
            preset=payload.preset,
            palette=payload.palette or "cyberpunk",
            mode=payload.mode or "add_sheet"
        )
    except Exception as e:
        logger.error(f"Failed in generate_ai_themed_dashboard: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Synthesis failed: {str(e)}")

    all_sheets = db.query(DashboardSheet).filter(
        DashboardSheet.dataset_id == dataset_id
    ).order_by(DashboardSheet.order_index).all()

    tables_map = {t.table_name: t for t in db.query(TableMetadata).filter(TableMetadata.dataset_id == dataset_id).all()}
    df_cache: Dict[str, pd.DataFrame] = dict(all_dfs)

    for sheet in all_sheets:
        if sheet.business_questions is None:
            sheet.business_questions = []
        for chart in sheet.charts:
            try:
                chart.data = _calculate_chart_data(
                    chart,
                    db,
                    dataset_id=dataset_id,
                    tables_map=tables_map,
                    df_cache=df_cache
                )
            except Exception:
                chart.data = []

    return all_sheets

@router.post("/{dataset_id}/ai-agent-generate", response_model=List[DashboardSheetSchema])
def ai_agent_generate_dashboard(
    dataset_id: str,
    payload: Optional[AIGenerateDashboardRequest] = None,
    db: Session = Depends(get_db)
):
    """
    Dedicated AI Agent endpoint to autonomously analyze dataset and synthesize
    optimal executive dashboard sheets and charts with ultra-low latency.
    """
    if payload is None:
        payload = AIGenerateDashboardRequest(preset="executive", palette="cyberpunk", mode="replace_all")
    elif not payload.mode:
        payload.mode = "replace_all"
    return ai_generate_dashboard(dataset_id=dataset_id, payload=payload, db=db)


@router.post("/{dataset_id}/sheets/{sheet_id}/generate-insights")
def generate_sheet_insights(
    dataset_id: str,
    sheet_id: str,
    payload: Optional[GenerateSheetInsightsRequest] = None,
    db: Session = Depends(get_db)
):
    """
    Synthesizes rich, data-backed business questions and executive findings
    on-demand for a specific sheet.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    sheet = db.query(DashboardSheet).filter(
        DashboardSheet.id == sheet_id,
        DashboardSheet.dataset_id == dataset_id
    ).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")

    all_dfs: Dict[str, pd.DataFrame] = {}
    for tbl in dataset.tables:
        try:
            t_df = DataFrameCache.get_table_dataframe(tbl.storage_path, tbl.table_name)
            if t_df is not None and not t_df.empty:
                all_dfs[tbl.table_name] = t_df
        except Exception as e:
            logger.warning(f"Could not load table {tbl.table_name}: {e}")

    if not all_dfs:
        raise HTTPException(status_code=400, detail="No table data available")

    # Determine tables used in this sheet
    sheet_tables = list(set([c.table_name for c in sheet.charts if c.table_name] or list(all_dfs.keys())))
    if not sheet_tables:
        sheet_tables = list(all_dfs.keys())

    prompt = payload.prompt if payload else None
    preset = payload.preset if payload else sheet.sheet_type

    new_insights = DashboardGenerator.generate_sheet_insights(
        sheet_title=sheet.title,
        tables=sheet_tables,
        dataframes=all_dfs,
        prompt=prompt,
        preset=preset
    )

    sheet.business_questions = new_insights
    db.commit()
    db.refresh(sheet)

    return {"sheet_id": sheet.id, "business_questions": sheet.business_questions}

@router.get("/{dataset_id}/corresponding-tables")
def get_corresponding_tables(dataset_id: str, db: Session = Depends(get_db)):
    """
    Discovers and itemizes all pairs and groups of corresponding tables
    that can be joined together to produce cross-table charts.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    rels = db.query(TableRelationship).filter(TableRelationship.dataset_id == dataset_id).all()
    tables = {t.table_name: t for t in dataset.tables}

    pairs = []
    for r in rels:
        t1 = tables.get(r.source_table)
        t2 = tables.get(r.target_table)
        pairs.append({
            "id": r.id,
            "source_table": r.source_table,
            "source_column": r.source_column,
            "source_rows": t1.row_count if t1 else 0,
            "target_table": r.target_table,
            "target_column": r.target_column,
            "target_rows": t2.row_count if t2 else 0,
            "confidence": r.confidence,
            "relationship_type": r.relationship_type,
            "status": r.status,
            "reasoning": r.reasoning
        })

    return {
        "dataset_id": dataset_id,
        "total_tables": len(dataset.tables),
        "corresponding_pairs": pairs
    }

@router.post("/{dataset_id}/joined-preview")
def preview_joined_tables(dataset_id: str, payload: JoinedPreviewRequest, db: Session = Depends(get_db)):
    """
    Generates a live preview of merged data from 2 or more corresponding tables.
    """
    t1_meta = db.query(TableMetadata).filter(
        TableMetadata.table_name == payload.primary_table,
        TableMetadata.dataset_id == dataset_id
    ).first()
    if not t1_meta:
        raise HTTPException(status_code=404, detail=f"Primary table {payload.primary_table} not found")

    df = DataFrameCache.get_table_dataframe(t1_meta.storage_path, t1_meta.table_name)
    if df is None:
        raise HTTPException(status_code=400, detail="Failed to load primary table")

    df = df.copy()

    # If single join
    if payload.join_table:
        t2_meta = db.query(TableMetadata).filter(
            TableMetadata.table_name == payload.join_table,
            TableMetadata.dataset_id == dataset_id
        ).first()
        if t2_meta:
            j_df = DataFrameCache.get_table_dataframe(t2_meta.storage_path, t2_meta.table_name)

            if j_df is not None:
                p_key = payload.primary_key
                j_key = payload.join_key
                if not p_key or not j_key or p_key not in df.columns or j_key not in j_df.columns:
                    # look up in relationships
                    rel = db.query(TableRelationship).filter(
                        TableRelationship.dataset_id == dataset_id,
                        ((TableRelationship.source_table == payload.primary_table) & (TableRelationship.target_table == payload.join_table)) |
                        ((TableRelationship.target_table == payload.primary_table) & (TableRelationship.source_table == payload.join_table))
                    ).first()
                    if rel:
                        if rel.source_table == payload.primary_table:
                            p_key, j_key = rel.source_column, rel.target_column
                        else:
                            p_key, j_key = rel.target_column, rel.source_column

                if p_key and j_key and p_key in df.columns and j_key in j_df.columns:
                    df = df.merge(j_df, left_on=p_key, right_on=j_key, suffixes=('', f'_{payload.join_table}'))

    # Additional chained joins
    if payload.additional_joins:
        for idx, j_info in enumerate(payload.additional_joins):
            j_name = j_info.get("table")
            pk = j_info.get("primary_key")
            jk = j_info.get("join_key")
            j_meta = db.query(TableMetadata).filter(
                TableMetadata.table_name == j_name,
                TableMetadata.dataset_id == dataset_id
            ).first()
            if j_meta:
                sec_df = DataFrameCache.get_table_dataframe(j_meta.storage_path, j_meta.table_name)
                if sec_df is not None:
                    actual_pk = next((c for c in df.columns if c.lower() == str(pk).lower()), None) if pk else None
                    actual_jk = next((c for c in sec_df.columns if c.lower() == str(jk).lower()), None) if jk else None
                    if not actual_pk or not actual_jk:
                        shared = [c for c in df.columns if c in sec_df.columns]
                        if shared:
                            actual_pk, actual_jk = shared[0], shared[0]
                    if actual_pk and actual_jk:
                        df = df.merge(sec_df, left_on=actual_pk, right_on=actual_jk, suffixes=('', f'_{j_name}'))

    preview_rows = df.head(15).fillna("").to_dict(orient="records")
    return {
        "total_rows": len(df),
        "total_columns": len(df.columns),
        "columns": list(df.columns),
        "sample_data": preview_rows
    }

@router.post("/{dataset_id}/sheets", response_model=DashboardSheetSchema)
def create_sheet(dataset_id: str, payload: DashboardSheetCreateSchema, db: Session = Depends(get_db)):
    count = db.query(DashboardSheet).filter(DashboardSheet.dataset_id == dataset_id).count()
    new_sheet = DashboardSheet(
        dataset_id=dataset_id,
        title=payload.title,
        sheet_type=payload.sheet_type,
        order_index=count,
        is_default=False
    )
    db.add(new_sheet)
    db.commit()
    db.refresh(new_sheet)
    return new_sheet

@router.put("/{dataset_id}/sheets/{sheet_id}", response_model=DashboardSheetSchema)
def update_sheet(dataset_id: str, sheet_id: str, payload: DashboardSheetUpdateSchema, db: Session = Depends(get_db)):
    sheet = db.query(DashboardSheet).filter(
        DashboardSheet.id == sheet_id,
        DashboardSheet.dataset_id == dataset_id
    ).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")

    if payload.title is not None:
        sheet.title = payload.title
    if payload.order_index is not None:
        sheet.order_index = payload.order_index

    db.commit()
    db.refresh(sheet)
    return sheet

@router.delete("/{dataset_id}/sheets/{sheet_id}")
def delete_sheet(dataset_id: str, sheet_id: str, db: Session = Depends(get_db)):
    sheet = db.query(DashboardSheet).filter(
        DashboardSheet.id == sheet_id,
        DashboardSheet.dataset_id == dataset_id
    ).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")

    total_sheets = db.query(DashboardSheet).filter(DashboardSheet.dataset_id == dataset_id).count()
    if total_sheets <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the only sheet in the dashboard.")

    db.delete(sheet)
    db.commit()
    ChartDataCache.invalidate()
    return {"message": "Sheet deleted successfully"}

@router.post("/charts", response_model=DashboardChartSchema)
def create_chart(payload: DashboardChartCreateSchema, db: Session = Depends(get_db)):
    sheet = db.query(DashboardSheet).filter(DashboardSheet.id == payload.sheet_id).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Target sheet not found")

    chart_count = db.query(DashboardChart).filter(DashboardChart.sheet_id == payload.sheet_id).count()
    new_chart = DashboardChart(
        sheet_id=payload.sheet_id,
        title=payload.title,
        description=payload.description,
        chart_type=payload.chart_type,
        table_name=payload.table_name,
        join_table=payload.join_table,
        primary_key=payload.primary_key,
        join_key=payload.join_key,
        x_field=payload.x_field,
        y_field=payload.y_field,
        secondary_y_field=payload.secondary_y_field,
        aggregation=payload.aggregation,
        group_by=payload.group_by,
        filters=payload.filters,
        config=payload.config or {},
        grid_w=payload.grid_w,
        grid_h=payload.grid_h,
        order_index=chart_count
    )
    db.add(new_chart)
    db.commit()
    db.refresh(new_chart)
    new_chart.data = _calculate_chart_data(new_chart, db)
    return new_chart

@router.put("/charts/{chart_id}", response_model=DashboardChartSchema)
def update_chart(chart_id: str, payload: DashboardChartUpdateSchema, db: Session = Depends(get_db)):
    chart = db.query(DashboardChart).filter(DashboardChart.id == chart_id).first()
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(chart, field, val)

    db.commit()
    db.refresh(chart)
    ChartDataCache.invalidate(chart_id)
    chart.data = _calculate_chart_data(chart, db)
    return chart

@router.delete("/charts/{chart_id}")
def delete_chart(chart_id: str, db: Session = Depends(get_db)):
    chart = db.query(DashboardChart).filter(DashboardChart.id == chart_id).first()
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    db.delete(chart)
    db.commit()
    ChartDataCache.invalidate(chart_id)
    return {"message": "Chart deleted successfully"}

@router.post("/{dataset_id}/studio/preview-chart")
def preview_studio_chart(dataset_id: str, payload: StudioPreviewChartRequest, db: Session = Depends(get_db)):
    """
    Executes live calculation and statistical summarization for the AI Dashboard Studio.
    Supports single-table and arbitrary N-table chained joins.
    """
    t1_meta = db.query(TableMetadata).filter(
        TableMetadata.table_name == payload.table_name,
        TableMetadata.dataset_id == dataset_id
    ).first()
    if not t1_meta:
        t1_meta = db.query(TableMetadata).filter(TableMetadata.dataset_id == dataset_id).first()
    if not t1_meta:
        raise HTTPException(status_code=404, detail="Primary table not found")

    df = DataFrameCache.get_table_dataframe(t1_meta.storage_path, t1_meta.table_name)
    if df is None:
        raise HTTPException(status_code=400, detail="Failed to load primary table dataframe")

    df = df.copy()

    # Chained joins
    if payload.joins:
        for idx, j_info in enumerate(payload.joins):
            j_tbl = j_info.get("table")
            pk = j_info.get("primary_key")
            jk = j_info.get("join_key")
            j_meta = db.query(TableMetadata).filter(
                TableMetadata.table_name == j_tbl,
                TableMetadata.dataset_id == dataset_id
            ).first()
            if j_meta:
                j_df = DataFrameCache.get_table_dataframe(j_meta.storage_path, j_meta.table_name)
                if j_df is not None:
                    actual_pk = next((c for c in df.columns if c.lower() == str(pk).lower()), None) if pk else None
                    actual_jk = next((c for c in j_df.columns if c.lower() == str(jk).lower()), None) if jk else None
                    if not actual_pk or not actual_jk:
                        shared = [c for c in df.columns if c in j_df.columns]
                        if shared:
                            actual_pk, actual_jk = shared[0], shared[0]
                    if actual_pk and actual_jk:
                        if df[actual_pk].dtype != j_df[actual_jk].dtype:
                            df[actual_pk] = df[actual_pk].astype(str).str.strip()
                            j_df = j_df.copy()
                            j_df[actual_jk] = j_df[actual_jk].astype(str).str.strip()
                        df = df.merge(j_df, left_on=actual_pk, right_on=actual_jk, how="left", suffixes=('', f'_{j_tbl}'))
    elif payload.join_table:
        j_meta = db.query(TableMetadata).filter(
            TableMetadata.table_name == payload.join_table,
            TableMetadata.dataset_id == dataset_id
        ).first()
        if j_meta:
            j_df = DataFrameCache.get_table_dataframe(j_meta.storage_path, j_meta.table_name)
            if j_df is not None:
                pk = payload.primary_key
                jk = payload.join_key
                actual_pk = next((c for c in df.columns if c.lower() == str(pk).lower()), None) if pk else None
                actual_jk = next((c for c in j_df.columns if c.lower() == str(jk).lower()), None) if jk else None
                if not actual_pk or not actual_jk:
                    shared = [c for c in df.columns if c in j_df.columns]
                    if shared:
                        actual_pk, actual_jk = shared[0], shared[0]
                if actual_pk and actual_jk:
                    if df[actual_pk].dtype != j_df[actual_jk].dtype:
                        df[actual_pk] = df[actual_pk].astype(str).str.strip()
                        j_df = j_df.copy()
                        j_df[actual_jk] = j_df[actual_jk].astype(str).str.strip()
                    df = df.merge(j_df, left_on=actual_pk, right_on=actual_jk, how="left", suffixes=('', f'_{payload.join_table}'))

    points = _calculate_points_from_df(
        df=df,
        chart_type=payload.chart_type,
        x_field=payload.x_field,
        y_field=payload.y_field,
        secondary_y_field=payload.secondary_y_field,
        aggregation=payload.aggregation or "sum",
        filters=payload.filters
    )
    summary = _compute_summary_from_points(points)
    insight = _generate_studio_insight(
        title=f"{payload.chart_type.title()} of {payload.y_field} by {payload.x_field}",
        x_field=payload.x_field,
        y_field=payload.y_field,
        summary=summary,
        chart_type=payload.chart_type
    )

    sample_preview = df.head(10).fillna("").to_dict(orient="records")

    return {
        "chart_data": points,
        "summary": summary,
        "ai_insight": insight,
        "columns": list(df.columns),
        "total_rows": len(df),
        "sample_data": sample_preview
    }

@router.post("/{dataset_id}/studio/ai-synthesize")
async def ai_synthesize_chart(dataset_id: str, payload: AISynthesizeChartRequest, db: Session = Depends(get_db)):
    """
    Translates natural language prompts into a fully configured, data-backed visualization
    using deep statistical profiling, cognitive schema understanding, and 5-step Chain of Thought reasoning.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset or not dataset.tables:
        raise HTTPException(status_code=404, detail="Dataset not found or has no tables")

    df_dict = {}
    for tbl in dataset.tables:
        t_df = DataFrameCache.get_table_dataframe(tbl.storage_path, tbl.table_name)
        if t_df is not None:
            df_dict[tbl.table_name] = t_df

    if not df_dict:
        raise HTTPException(status_code=400, detail="No table data available")

    rels = [
        {
            "source_table": r.source_table,
            "source_column": r.source_column,
            "target_table": r.target_table,
            "target_column": r.target_column,
        }
        for r in (dataset.relationships or [])
    ]

    try:
        return AIStudioCognitiveEngine.execute_cognitive_synthesis(
            prompt=payload.prompt,
            df_dict=df_dict,
            relationships=rels,
            target_table=payload.target_table,
            preferred_chart_type=payload.preferred_chart_type
        )
    except Exception as e:
        # Fallback heuristic
        primary_tbl = dataset.tables[0]
        df = df_dict.get(primary_tbl.table_name, list(df_dict.values())[0])
        num_cols = list(df.select_dtypes(include=["number"]).columns)
        cat_cols = [c for c in df.columns if c not in num_cols and not c.lower().endswith("id")]
        matched_x = cat_cols[0] if cat_cols else df.columns[0]
        matched_y = num_cols[0] if num_cols else matched_x
        points = _calculate_points_from_df(df=df, chart_type="bar", x_field=matched_x, y_field=matched_y, aggregation="sum")
        summary = _compute_summary_from_points(points)
        return {
            "title": f"{matched_y.replace('_', ' ').title()} by {matched_x.replace('_', ' ').title()}",
            "description": f"AI-Synthesized BAR visualization analyzing SUM of {matched_y} grouped by {matched_x}.",
            "chart_type": "bar",
            "table_name": primary_tbl.table_name,
            "join_table": None,
            "x_field": matched_x,
            "y_field": matched_y,
            "secondary_y_field": None,
            "aggregation": "sum",
            "palette": "cyberpunk",
            "ai_insight": f"Analysis shows {matched_y} aggregated across {matched_x}.",
            "strategic_directive": "Monitor cohort divergence and optimize resource allocation.",
            "thought_process": [],
            "mind_sparks": [],
            "chart_data": points,
            "summary": summary,
            "columns": list(df.columns),
            "total_rows": len(df)
        }

@router.post("/{dataset_id}/studio/deepen-thinking")
def deepen_thinking_diagnostic(dataset_id: str, payload: DeepenThinkingRequest, db: Session = Depends(get_db)):
    """
    Executes an autonomous 2nd-order analytical root-cause diagnosis, anomaly detection,
    sensitivity elasticity modeling, and strategic execution playbook for active studio charts.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset or not dataset.tables:
        raise HTTPException(status_code=404, detail="Dataset not found")

    target_table = payload.table_name
    tbl = next((t for t in dataset.tables if t.table_name == target_table), dataset.tables[0])
    df = DataFrameCache.get_table_dataframe(tbl.storage_path, tbl.table_name)
    if df is None:
        raise HTTPException(status_code=400, detail="Failed to load table data")

    # If x_field or y_field is in another related table, join it
    x_in_df = any(c.lower() == payload.x_field.lower() for c in df.columns)
    y_in_df = any(c.lower() == payload.y_field.lower() for c in df.columns)
    if (not x_in_df or not y_in_df) and dataset.tables:
        for other_tbl in dataset.tables:
            if other_tbl.table_name == tbl.table_name:
                continue
            other_df = DataFrameCache.get_table_dataframe(other_tbl.storage_path, other_tbl.table_name)
            if other_df is not None:
                has_x = any(c.lower() == payload.x_field.lower() for c in other_df.columns)
                has_y = any(c.lower() == payload.y_field.lower() for c in other_df.columns)
                if has_x or has_y:
                    rel = next((r for r in (dataset.relationships or []) if 
                        (r.source_table == tbl.table_name and r.target_table == other_tbl.table_name) or
                        (r.target_table == tbl.table_name and r.source_table == other_tbl.table_name)), None)
                    if rel:
                        pk = rel.source_column if rel.source_table == tbl.table_name else rel.target_column
                        jk = rel.target_column if rel.source_table == tbl.table_name else rel.source_column
                        if pk in df.columns and jk in other_df.columns:
                            df = df.merge(other_df, left_on=pk, right_on=jk, suffixes=('', f'_{other_tbl.table_name}'))
                            break

    return AIStudioCognitiveEngine.deepen_analytical_diagnosis(
        df=df,
        x_field=payload.x_field,
        y_field=payload.y_field,
        chart_type=payload.chart_type or "bar",
        aggregation=payload.aggregation or "sum"
    )

@router.post("/{dataset_id}/studio/what-if-simulate")
def what_if_simulate(dataset_id: str, payload: WhatIfSimulateRequest):
    """
    Dynamically simulates what-if scenario levers across chart points in real time.
    """
    return AIStudioCognitiveEngine.simulate_what_if_lever(
        chart_points=payload.points,
        delta_pct=payload.delta_pct,
        target_cohort=payload.target_cohort
    )

@router.get("/{dataset_id}/studio/blueprints")
def get_studio_blueprints(dataset_id: str, db: Session = Depends(get_db)):
    """
    Returns 6 domain-aware AI visualization blueprints configured specifically for this dataset.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset or not dataset.tables:
        raise HTTPException(status_code=404, detail="Dataset not found or has no tables")

    primary_meta = dataset.tables[0]
    df = DataFrameCache.get_table_dataframe(primary_meta.storage_path, primary_meta.table_name)
    if df is None:
        raise HTTPException(status_code=400, detail="Failed to load primary table")

    num_cols = list(df.select_dtypes(include=["number"]).columns)
    cat_cols = [c for c in df.columns if c not in num_cols and not c.lower().endswith("id")]
    date_cols = [c for c in df.columns if any(k in c.lower() for k in ["date", "time", "month", "year", "quarter"])]

    primary_num = num_cols[0] if num_cols else df.columns[0]
    secondary_num = num_cols[1] if len(num_cols) > 1 else primary_num
    primary_cat = cat_cols[0] if cat_cols else (df.columns[1] if len(df.columns) > 1 else primary_num)
    secondary_cat = cat_cols[1] if len(cat_cols) > 1 else primary_cat
    date_col = date_cols[0] if date_cols else None

    blueprints = [
        {
            "id": "bp-leaderboard",
            "title": f"Executive {primary_cat.replace('_', ' ').title()} Leaderboard",
            "description": f"Ranks leading {primary_cat} cohorts by total {primary_num.replace('_', ' ')}.",
            "chart_type": "bar",
            "table_name": primary_meta.table_name,
            "x_field": primary_cat,
            "y_field": primary_num,
            "aggregation": "sum",
            "palette": "cyberpunk",
            "badge": "Top Driver",
            "ai_rationale": f"Instantly isolates the highest-volume {primary_cat} cohorts generating peak output."
        },
        {
            "id": "bp-temporal",
            "title": f"{primary_num.replace('_', ' ').title()} Velocity & Momentum",
            "description": f"Tracks historical and seasonal velocity across {date_col or secondary_cat}.",
            "chart_type": "area" if date_col else "line",
            "table_name": primary_meta.table_name,
            "x_field": date_col or secondary_cat,
            "y_field": primary_num,
            "aggregation": "sum",
            "palette": "emerald",
            "badge": "Time Series",
            "ai_rationale": "Surfaces period-over-period momentum and acceleration patterns."
        },
        {
            "id": "bp-portfolio",
            "title": f"{secondary_cat.replace('_', ' ').title()} Portfolio Share",
            "description": f"Breakdown of total {primary_num.replace('_', ' ')} across {secondary_cat} segments.",
            "chart_type": "pie",
            "table_name": primary_meta.table_name,
            "x_field": secondary_cat,
            "y_field": primary_num,
            "aggregation": "sum",
            "palette": "sunset",
            "badge": "Distribution",
            "ai_rationale": "Evaluates portfolio diversification and highlights concentration dependencies."
        },
        {
            "id": "bp-synergy",
            "title": f"{primary_num.replace('_', ' ').title()} vs {secondary_num.replace('_', ' ').title()} Synergy",
            "description": f"Dual-metric comparative analysis of volume versus secondary performance.",
            "chart_type": "composed",
            "table_name": primary_meta.table_name,
            "x_field": primary_cat,
            "y_field": primary_num,
            "secondary_y_field": secondary_num,
            "aggregation": "sum",
            "palette": "corporate",
            "badge": "Dual-Axis",
            "ai_rationale": "Compares absolute volume scale against unit efficiency or margin yield."
        },
        {
            "id": "bp-pareto",
            "title": f"Pareto 80/20 Spread by {primary_cat.replace('_', ' ').title()}",
            "description": f"Horizontal distribution identifying outsized performance concentration.",
            "chart_type": "horizontal_bar",
            "table_name": primary_meta.table_name,
            "x_field": primary_cat,
            "y_field": primary_num,
            "aggregation": "sum",
            "palette": "purple",
            "badge": "Pareto 80/20",
            "ai_rationale": "Detects if top 20% of segments represent over 60% of aggregate results."
        },
        {
            "id": "bp-radar",
            "title": f"Multi-Dimensional {primary_cat.replace('_', ' ').title()} Spread",
            "description": f"Radial distribution benchmark of {primary_num.replace('_', ' ')} across segments.",
            "chart_type": "radar",
            "table_name": primary_meta.table_name,
            "x_field": primary_cat,
            "y_field": primary_num,
            "aggregation": "avg",
            "palette": "cyberpunk",
            "badge": "AI Radar",
            "ai_rationale": "Highlights variance and equilibrium across categorical entities."
        },
        {
            "id": "bp-heatmap",
            "title": f"Multi-Cohort Matrix Heatmap ({primary_cat.replace('_', ' ').title()} × {secondary_cat.replace('_', ' ').title()})",
            "description": f"2D cross-tabulation density heatmap analyzing {primary_num.replace('_', ' ')} intensity.",
            "chart_type": "heatmap",
            "table_name": primary_meta.table_name,
            "x_field": primary_cat,
            "y_field": primary_num,
            "secondary_y_field": secondary_cat,
            "aggregation": "sum",
            "palette": "cyberpunk",
            "badge": "Heatmap",
            "ai_rationale": "Surfaces high-density performance hot spots and low-activity cold zones across cross-cutting cohorts."
        },
        {
            "id": "bp-treemap",
            "title": f"{primary_cat.replace('_', ' ').title()} Portfolio Treemap",
            "description": f"Proportional hierarchical area layout of {primary_num.replace('_', ' ')} breakdown.",
            "chart_type": "treemap",
            "table_name": primary_meta.table_name,
            "x_field": primary_cat,
            "y_field": primary_num,
            "secondary_y_field": secondary_cat if secondary_cat != primary_cat else None,
            "aggregation": "sum",
            "palette": "emerald",
            "badge": "Treemap",
            "ai_rationale": "Visualizes nested proportional contribution, space efficiency, and relative scale across portfolio assets."
        }
    ]

    return {
        "dataset_id": dataset_id,
        "blueprints": blueprints
    }
