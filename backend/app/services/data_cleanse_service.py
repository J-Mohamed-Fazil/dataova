from io import StringIO
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
from app.services.quality_scorer import QualityScorer

class DataCleanseService:
    """
    Autonomous Data Engineering and Cleanse Studio engine.
    Supports:
    - Comprehensive defect auditing (nulls, duplicates, outliers, whitespace)
    - 1-Click Autonomous Repair Pipeline
    - Targeted column transformations & formula column synthesis
    - Real-time Data Health Score improvement delta calculation
    - Cleaned CSV generation and table replacement
    """

    @staticmethod
    def calculate_score_for_df(df: pd.DataFrame) -> float:
        """Calculates deterministic 0-100 data health score for a DataFrame."""
        total_cells = df.size
        total_rows = len(df)
        if total_rows == 0 or total_cells == 0:
            return 0.0
        total_nulls = int(df.isnull().sum().sum())
        total_dups = int(df.duplicated().sum())

        missing_ratio = total_nulls / total_cells
        dup_ratio = total_dups / total_rows

        score = 100.0 - min(35.0, missing_ratio * 70.0) - min(25.0, dup_ratio * 100.0)
        for col in df.columns:
            col_null_pct = df[col].isnull().sum() / total_rows
            if col_null_pct > 0.5:
                score -= 3.0
        return max(5.0, min(100.0, round(score, 1)))

    @staticmethod
    def audit_dataset_cleanliness(df: pd.DataFrame) -> Dict[str, Any]:
        """Audits current dataset cleanliness metrics and defects."""
        total_cells = df.size
        total_rows = len(df)
        if total_rows == 0:
            return {"error": "Empty dataset."}

        # Nulls
        null_counts = df.isnull().sum().to_dict()
        total_nulls = sum(null_counts.values())
        null_pct = round((total_nulls / max(total_cells, 1)) * 100, 2)

        # Duplicates
        duplicate_rows = int(df.duplicated().sum())

        # Whitespace defects
        whitespace_cols = []
        for col in df.select_dtypes(include=["object", "string"]).columns:
            str_series = df[col].dropna().astype(str)
            has_ws = (str_series != str_series.str.strip()).any()
            if has_ws:
                whitespace_cols.append(col)

        # Outlier count across numeric columns
        outlier_summary = {}
        for col in df.select_dtypes(include=[np.number]).columns:
            series = pd.to_numeric(df[col], errors="coerce").dropna()
            if len(series) > 10:
                q1 = series.quantile(0.25)
                q3 = series.quantile(0.75)
                iqr = q3 - q1
                if iqr > 0:
                    outliers = series[(series < q1 - 1.5 * iqr) | (series > q3 + 1.5 * iqr)]
                    if len(outliers) > 0:
                        outlier_summary[col] = len(outliers)

        current_score = DataCleanseService.calculate_score_for_df(df)

        defects = []
        if duplicate_rows > 0:
            defects.append({
                "type": "duplicate_rows",
                "severity": "high",
                "count": duplicate_rows,
                "message": f"Found {duplicate_rows} redundant duplicate rows.",
                "remedy": "Drop identical row entries"
            })
        if total_nulls > 0:
            defects.append({
                "type": "missing_values",
                "severity": "medium",
                "count": total_nulls,
                "message": f"Found {total_nulls} missing/null cells ({null_pct}% of total cells).",
                "remedy": "Impute with median (numeric) or mode (categorical)"
            })
        if whitespace_cols:
            defects.append({
                "type": "whitespace_padding",
                "severity": "low",
                "count": len(whitespace_cols),
                "message": f"Unstripped whitespace padding detected in columns: {', '.join(whitespace_cols)}.",
                "remedy": "Strip leading and trailing whitespace"
            })
        if outlier_summary:
            total_outliers = sum(outlier_summary.values())
            defects.append({
                "type": "extreme_outliers",
                "severity": "medium",
                "count": total_outliers,
                "message": f"Detected {total_outliers} statistical anomalies beyond 1.5x IQR in {len(outlier_summary)} columns.",
                "remedy": "Clip values to statistical boundary limits"
            })

        # Per-column quality profile & statistics
        column_stats = {}
        for col in df.columns:
            series = df[col]
            n_null = int(null_counts.get(col, 0))
            n_unique = int(series.nunique())

            if pd.api.types.is_numeric_dtype(series):
                dt = "numeric"
            elif pd.api.types.is_datetime64_any_dtype(series):
                dt = "datetime"
            elif pd.api.types.is_bool_dtype(series):
                dt = "boolean"
            else:
                dt = "string"

            column_stats[col] = {
                "name": col,
                "dtype": dt,
                "null_count": n_null,
                "null_percentage": round((n_null / max(total_rows, 1)) * 100, 1),
                "unique_count": n_unique,
                "has_whitespace": col in whitespace_cols,
                "outlier_count": outlier_summary.get(col, 0)
            }

        return {
            "total_rows": total_rows,
            "total_columns": len(df.columns),
            "total_cells": total_cells,
            "total_nulls": total_nulls,
            "null_percentage": null_pct,
            "null_counts": null_counts,
            "column_stats": column_stats,
            "duplicate_rows": duplicate_rows,
            "whitespace_columns": whitespace_cols,
            "outlier_columns": outlier_summary,
            "current_health_score": round(current_score, 1),
            "defects": defects
        }

    @staticmethod
    def auto_cleanse(df: pd.DataFrame) -> Dict[str, Any]:
        """
        Applies autonomous best-practice data cleansing pipeline:
        1. Strips leading/trailing whitespace across all text columns.
        2. Drops redundant duplicate rows.
        3. Imputes numeric nulls with median.
        4. Imputes categorical nulls with mode or 'Unknown'.
        5. Clips extreme outliers to IQR bounds (Q1 - 3*IQR, Q3 + 3*IQR).
        """
        audit_before = DataCleanseService.audit_dataset_cleanliness(df)
        clean_df = df.copy()
        log: List[str] = []

        # 1. Whitespace stripping
        str_cols = clean_df.select_dtypes(include=["object", "string"]).columns
        for c in str_cols:
            clean_df[c] = clean_df[c].astype(str).str.strip().replace("nan", np.nan).replace("None", np.nan)
        if audit_before["whitespace_columns"]:
            log.append(f"Trimmed leading & trailing whitespace across {len(str_cols)} text columns.")

        # 2. Duplicate rows removal
        initial_rows = len(clean_df)
        clean_df = clean_df.drop_duplicates()
        dropped_dups = initial_rows - len(clean_df)
        if dropped_dups > 0:
            log.append(f"Removed {dropped_dups} duplicate rows.")

        # 3. Numeric nulls imputation
        num_cols = clean_df.select_dtypes(include=[np.number]).columns
        imputed_num = 0
        for c in num_cols:
            n_null = clean_df[c].isnull().sum()
            if n_null > 0:
                med = clean_df[c].median()
                clean_df[c] = clean_df[c].fillna(med)
                imputed_num += n_null
        if imputed_num > 0:
            log.append(f"Imputed {imputed_num} numeric missing values using column median.")

        # 4. Categorical nulls imputation
        imputed_cat = 0
        for c in str_cols:
            n_null = clean_df[c].isnull().sum()
            if n_null > 0:
                mode_val = clean_df[c].mode()
                fill_val = mode_val.iloc[0] if not mode_val.empty else "Unknown"
                clean_df[c] = clean_df[c].fillna(fill_val)
                imputed_cat += n_null
        if imputed_cat > 0:
            log.append(f"Imputed {imputed_cat} categorical missing values with predominant mode.")

        # 5. Outlier clipping (3x IQR extreme bound)
        clipped_count = 0
        for c in num_cols:
            series = pd.to_numeric(clean_df[c], errors="coerce")
            q1 = series.quantile(0.25)
            q3 = series.quantile(0.75)
            iqr = q3 - q1
            if iqr > 0:
                lower_bound = q1 - 3.0 * iqr
                upper_bound = q3 + 3.0 * iqr
                mask = (series < lower_bound) | (series > upper_bound)
                n_clip = mask.sum()
                if n_clip > 0:
                    clean_df[c] = series.clip(lower=lower_bound, upper=upper_bound)
                    clipped_count += n_clip
        if clipped_count > 0:
            log.append(f"Clipped {clipped_count} extreme 3-sigma outliers to statistical boundaries.")

        if not log:
            log.append("Dataset already in pristine condition. Zero defects found.")

        # Calculate new health score
        new_score = DataCleanseService.calculate_score_for_df(clean_df)
        score_gain = round(new_score - audit_before["current_health_score"], 1)

        # Sample rows preview
        sample_preview = clean_df.head(15).to_dict(orient="records")
        for r in sample_preview:
            for k_col, v_val in r.items():
                if pd.isna(v_val):
                    r[k_col] = None

        return {
            "initial_health_score": audit_before["current_health_score"],
            "cleaned_health_score": round(new_score, 1),
            "score_improvement": max(0.0, score_gain),
            "initial_rows": initial_rows,
            "cleaned_rows": len(clean_df),
            "columns": list(clean_df.columns),
            "transformation_log": log,
            "diff_summary": {
                "imputed_numeric": imputed_num,
                "imputed_categorical": imputed_cat,
                "dropped_duplicates": dropped_dups,
                "clipped_outliers": clipped_count,
                "trimmed_columns": len(audit_before.get("whitespace_columns", []))
            },
            "sample_preview": sample_preview,
            "cleansed_df": clean_df
        }

    @staticmethod
    def apply_custom_pipeline(df: pd.DataFrame, steps: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Executes a user-defined transformation pipeline."""
        initial_score = DataCleanseService.calculate_score_for_df(df)
        initial_rows = len(df)
        clean_df = df.copy()
        log: List[str] = []
        imputed_count = 0
        clipped_count = 0

        for step in steps:
            action = step.get("action")
            field = step.get("field")

            if action == "drop_column" and field in clean_df.columns:
                clean_df.drop(columns=[field], inplace=True)
                log.append(f"Dropped column '{field}'.")

            elif action == "drop_duplicates":
                before_cnt = len(clean_df)
                clean_df.drop_duplicates(inplace=True)
                dups_dropped = before_cnt - len(clean_df)
                if dups_dropped > 0:
                    log.append(f"Removed {dups_dropped} duplicate rows.")

            elif action == "strip_whitespace":
                str_cols = clean_df.select_dtypes(include=["object", "string"]).columns
                for c in str_cols:
                    clean_df[c] = clean_df[c].astype(str).str.strip().replace("nan", np.nan).replace("None", np.nan)
                log.append(f"Trimmed whitespace across {len(str_cols)} string columns.")

            elif action == "impute" and field in clean_df.columns:
                strategy = step.get("strategy", "median")
                n_null = clean_df[field].isnull().sum()
                if n_null > 0:
                    if strategy == "median" and pd.api.types.is_numeric_dtype(clean_df[field]):
                        clean_df[field] = clean_df[field].fillna(clean_df[field].median())
                        log.append(f"Imputed {n_null} missing in '{field}' with median.")
                    elif strategy == "mean" and pd.api.types.is_numeric_dtype(clean_df[field]):
                        clean_df[field] = clean_df[field].fillna(clean_df[field].mean())
                        log.append(f"Imputed {n_null} missing in '{field}' with mean.")
                    elif strategy == "zero":
                        clean_df[field] = clean_df[field].fillna(0)
                        log.append(f"Filled {n_null} missing in '{field}' with 0.")
                    elif strategy == "mode":
                        mode_val = clean_df[field].mode()
                        fill_val = mode_val.iloc[0] if not mode_val.empty else "Unknown"
                        clean_df[field] = clean_df[field].fillna(fill_val)
                        log.append(f"Imputed {n_null} missing in '{field}' with mode ({fill_val}).")
                    elif strategy == "drop_rows":
                        clean_df = clean_df.dropna(subset=[field])
                        log.append(f"Dropped rows with missing '{field}'.")
                    imputed_count += n_null

            elif action == "clip_outliers" and field in clean_df.columns:
                series = pd.to_numeric(clean_df[field], errors="coerce")
                q1 = series.quantile(0.25)
                q3 = series.quantile(0.75)
                iqr = q3 - q1
                if iqr > 0:
                    multiplier = float(step.get("iqr_multiplier", 1.5))
                    lower_bound = q1 - multiplier * iqr
                    upper_bound = q3 + multiplier * iqr
                    n_clip = ((series < lower_bound) | (series > upper_bound)).sum()
                    if n_clip > 0:
                        clean_df[field] = series.clip(lower=lower_bound, upper=upper_bound)
                        log.append(f"Clipped {n_clip} outliers in '{field}' using {multiplier}x IQR boundaries.")
                        clipped_count += n_clip

            elif action == "create_column":
                new_col = step.get("new_col", "calculated_metric")
                col_a = step.get("col_a")
                col_b = step.get("col_b")
                op = step.get("operation", "multiply")

                if col_a in clean_df.columns and col_b in clean_df.columns:
                    s_a = pd.to_numeric(clean_df[col_a], errors="coerce")
                    s_b = pd.to_numeric(clean_df[col_b], errors="coerce")
                    if op == "multiply":
                        clean_df[new_col] = (s_a * s_b).round(2)
                    elif op == "divide":
                        clean_df[new_col] = (s_a / s_b.replace(0, np.nan)).round(4)
                    elif op == "add":
                        clean_df[new_col] = (s_a + s_b).round(2)
                    elif op == "subtract":
                        clean_df[new_col] = (s_a - s_b).round(2)
                    log.append(f"Synthesized new calculated column '{new_col}' = {col_a} {op} {col_b}.")

        if not log:
            log.append("Pipeline executed successfully. No changes were required.")

        new_score = DataCleanseService.calculate_score_for_df(clean_df)
        score_gain = round(new_score - initial_score, 1)

        sample_preview = clean_df.head(15).to_dict(orient="records")
        for r in sample_preview:
            for k_col, v_val in r.items():
                if pd.isna(v_val):
                    r[k_col] = None

        return {
            "initial_health_score": round(initial_score, 1),
            "cleaned_health_score": round(new_score, 1),
            "score_improvement": max(0.0, score_gain),
            "initial_rows": initial_rows,
            "cleaned_rows": len(clean_df),
            "columns": list(clean_df.columns),
            "transformation_log": log,
            "diff_summary": {
                "imputed_cells": imputed_count,
                "clipped_outliers": clipped_count,
                "rows_delta": initial_rows - len(clean_df)
            },
            "sample_preview": sample_preview,
            "cleansed_df": clean_df
        }

    @staticmethod
    def df_to_csv_string(df: pd.DataFrame) -> str:
        """Serializes dataframe to CSV string."""
        buf = StringIO()
        df.to_csv(buf, index=False)
        return buf.getvalue()
