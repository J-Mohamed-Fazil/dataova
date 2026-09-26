import math
from typing import Dict, Any, List, Tuple
import numpy as np
import pandas as pd

class DataProfiler:

    @staticmethod
    def infer_column_type(series: pd.Series, col_name: str) -> Tuple[str, str]:
        """
        Returns (semantic_type, original_dtype_str)
        semantic_type: 'numeric', 'datetime', 'boolean', 'identifier', 'categorical', 'text'
        """
        col_lower = str(col_name).lower().strip()
        orig_dtype = str(series.dtype)
        non_null = series.dropna()
        total_len = len(series)
        unique_len = non_null.nunique()

        # 1. Check boolean
        if orig_dtype == "bool" or (unique_len <= 2 and set(non_null.unique()).issubset({True, False, 0, 1, "0", "1", "yes", "no", "true", "false", "Y", "N"})):
            return "boolean", orig_dtype

        # 2. Check identifier patterns
        id_keywords = ["id", "uuid", "code", "key", "sku", "number", "ssn", "isbn", "token", "hash"]
        has_id_keyword = any(col_lower == kw or col_lower.endswith(f"_{kw}") or col_lower.startswith(f"{kw}_") for kw in id_keywords)
        
        if (unique_len == total_len and total_len > 10) or (has_id_keyword and unique_len / max(total_len, 1) > 0.6):
            return "identifier", orig_dtype

        # 3. Check numeric
        if pd.api.types.is_numeric_dtype(series):
            # If all integer values and unique ratio is high and has id keyword
            if has_id_keyword and unique_len / max(total_len, 1) > 0.5:
                return "identifier", orig_dtype
            return "numeric", orig_dtype

        # 4. Check datetime
        if pd.api.types.is_datetime64_any_dtype(series):
            return "datetime", orig_dtype
            
        # Try parsing strings as datetime if column name suggests date or samples match
        date_keywords = ["date", "time", "timestamp", "year", "month", "day", "created", "updated", "period"]
        if any(dk in col_lower for dk in date_keywords) and len(non_null) > 0:
            sample = non_null.astype(str).head(20)
            try:
                pd.to_datetime(sample, errors="raise")
                return "datetime", orig_dtype
            except Exception:
                pass

        # 5. Categorical vs Text
        cardinality_ratio = unique_len / max(len(non_null), 1)
        if unique_len <= 50 or cardinality_ratio < 0.2:
            return "categorical", orig_dtype
        
        return "text", orig_dtype

    @staticmethod
    def profile_table(df: pd.DataFrame, table_name: str) -> Dict[str, Any]:
        total_rows = len(df)
        total_cols = len(df.columns)
        duplicate_rows = int(df.duplicated().sum())

        columns_profile: List[Dict[str, Any]] = []
        total_missing_cells = 0

        for col in df.columns:
            series = df[col]
            missing_cnt = int(series.isna().sum())
            total_missing_cells += missing_cnt
            missing_pct = round((missing_cnt / max(total_rows, 1)) * 100, 2)
            
            non_null = series.dropna()
            unique_cnt = int(non_null.nunique())
            card_ratio = round(unique_cnt / max(total_rows, 1), 4)

            sem_type, orig_type = DataProfiler.infer_column_type(series, col)
            is_id = (sem_type == "identifier")

            stats: Dict[str, Any] = {}
            is_kpi = False

            if sem_type == "numeric":
                try:
                    clean_num = pd.to_numeric(non_null, errors="coerce").dropna()
                    if len(clean_num) > 0:
                        stats = {
                            "min": float(clean_num.min()),
                            "max": float(clean_num.max()),
                            "mean": round(float(clean_num.mean()), 4),
                            "median": round(float(clean_num.median()), 4),
                            "std": round(float(clean_num.std(ddof=0)), 4) if len(clean_num) > 1 else 0.0,
                            "q25": round(float(clean_num.quantile(0.25)), 4),
                            "q75": round(float(clean_num.quantile(0.75)), 4),
                        }
                        # KPI candidate if std > 0 and not constant and not ID
                        if stats["std"] > 0 and not is_id:
                            is_kpi = True
                except Exception:
                    stats = {}
            elif sem_type == "datetime":
                try:
                    dt_series = pd.to_datetime(non_null, errors="coerce").dropna()
                    if len(dt_series) > 0:
                        stats = {
                            "min_date": str(dt_series.min()),
                            "max_date": str(dt_series.max()),
                            "days_span": (dt_series.max() - dt_series.min()).days
                        }
                except Exception:
                    stats = {}
            elif sem_type in ["categorical", "boolean"]:
                try:
                    val_counts = non_null.astype(str).value_counts().head(10).to_dict()
                    stats = {
                        "top_frequencies": {str(k): int(v) for k, v in val_counts.items()},
                        "mode": str(non_null.mode().iloc[0]) if not non_null.empty else None
                    }
                except Exception:
                    stats = {}

        # Sample values (up to 5 unique stringified)
            samples = [str(x) for x in non_null.head(5).tolist()]

            columns_profile.append({
                "column_name": str(col),
                "data_type": sem_type,
                "original_type": orig_type,
                "missing_count": missing_cnt,
                "missing_percentage": missing_pct,
                "unique_count": unique_cnt,
                "cardinality_ratio": card_ratio,
                "is_identifier": is_id,
                "is_potential_kpi": is_kpi,
                "statistics": stats,
                "sample_values": samples,
            })

        # Sample data: First 10 rows safely formatted for JSON
        sample_rows: List[Dict[str, Any]] = []
        preview_df = df.head(10).replace({np.nan: None})
        for _, row in preview_df.iterrows():
            row_dict = {}
            for k, v in row.items():
                if isinstance(v, (pd.Timestamp, np.datetime64)):
                    row_dict[str(k)] = str(v)
                elif isinstance(v, (np.integer, int)):
                    row_dict[str(k)] = int(v)
                elif isinstance(v, (np.floating, float)):
                    row_dict[str(k)] = None if math.isnan(v) else round(float(v), 4)
                else:
                    row_dict[str(k)] = v
            sample_rows.append(row_dict)

        return {
            "table_name": table_name,
            "row_count": total_rows,
            "column_count": total_cols,
            "duplicate_rows": duplicate_rows,
            "missing_cells": total_missing_cells,
            "columns": columns_profile,
            "sample_data": sample_rows
        }
