from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd

class CalculationTools:

    GEO_COORDINATES = {
        "united states": {"lat": 37.0902, "lng": -95.7129, "code": "USA"},
        "usa": {"lat": 37.0902, "lng": -95.7129, "code": "USA"},
        "us": {"lat": 37.0902, "lng": -95.7129, "code": "USA"},
        "canada": {"lat": 56.1304, "lng": -106.3468, "code": "CAN"},
        "united kingdom": {"lat": 55.3781, "lng": -3.4360, "code": "GBR"},
        "uk": {"lat": 55.3781, "lng": -3.4360, "code": "GBR"},
        "germany": {"lat": 51.1657, "lng": 10.4515, "code": "DEU"},
        "france": {"lat": 46.2276, "lng": 2.2137, "code": "FRA"},
        "italy": {"lat": 41.8719, "lng": 12.5674, "code": "ITA"},
        "spain": {"lat": 40.4637, "lng": -3.7492, "code": "ESP"},
        "brazil": {"lat": -14.2350, "lng": -51.9253, "code": "BRA"},
        "australia": {"lat": -25.2744, "lng": 133.7751, "code": "AUS"},
        "japan": {"lat": 36.2048, "lng": 138.2529, "code": "JPN"},
        "china": {"lat": 35.8617, "lng": 104.1954, "code": "CHN"},
        "india": {"lat": 20.5937, "lng": 78.9629, "code": "IND"},
        "mexico": {"lat": 23.6345, "lng": -102.5528, "code": "MEX"},
        "singapore": {"lat": 1.3521, "lng": 103.8198, "code": "SGP"},
        "netherlands": {"lat": 52.1326, "lng": 5.2913, "code": "NLD"},
        "sweden": {"lat": 60.1282, "lng": 18.6435, "code": "SWE"},
        "switzerland": {"lat": 46.8182, "lng": 8.2275, "code": "CHE"},
        "north": {"lat": 44.0, "lng": -90.0, "code": "NORTH"},
        "south": {"lat": 32.0, "lng": -85.0, "code": "SOUTH"},
        "east": {"lat": 40.0, "lng": -75.0, "code": "EAST"},
        "west": {"lat": 37.0, "lng": -120.0, "code": "WEST"},
        "central": {"lat": 39.0, "lng": -98.0, "code": "CENTRAL"},
    }

    @staticmethod
    def execute_aggregation(
        df: pd.DataFrame,
        group_by_col: str,
        value_col: Optional[str] = None,
        agg_type: str = "sum",
        top_n: int = 15,
        filters: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        working_df = CalculationTools.apply_filters(df, filters)
        
        if group_by_col not in working_df.columns:
            return []

        if agg_type == "count" or not value_col or value_col not in working_df.columns:
            # Frequency count of categories
            grouped = working_df.groupby(group_by_col).size().reset_index(name="value")
        else:
            # Numeric aggregation
            clean_series = pd.to_numeric(working_df[value_col], errors="coerce")
            working_df = working_df.assign(**{value_col: clean_series})
            
            if agg_type == "avg" or agg_type == "mean":
                grouped = working_df.groupby(group_by_col)[value_col].mean().reset_index(name="value")
            elif agg_type == "min":
                grouped = working_df.groupby(group_by_col)[value_col].min().reset_index(name="value")
            elif agg_type == "max":
                grouped = working_df.groupby(group_by_col)[value_col].max().reset_index(name="value")
            elif agg_type == "count_unique":
                grouped = working_df.groupby(group_by_col)[value_col].nunique().reset_index(name="value")
            else: # default sum
                grouped = working_df.groupby(group_by_col)[value_col].sum().reset_index(name="value")

        grouped = grouped.sort_values(by="value", ascending=False).head(top_n)
        total_val = float(grouped["value"].sum()) if not grouped.empty else 1.0

        results = []
        for _, row in grouped.iterrows():
            val = row["value"]
            if pd.isna(val) or np.isnan(val):
                continue
            lbl = str(row[group_by_col])
            lbl_lower = lbl.lower().strip()
            geo = CalculationTools.GEO_COORDINATES.get(lbl_lower)
            pt = {
                "label": lbl,
                "value": round(float(val), 2),
                "share_pct": round((float(val) / max(total_val, 1e-6)) * 100, 1)
            }
            if geo:
                pt["lat"] = geo["lat"]
                pt["lng"] = geo["lng"]
                pt["code"] = geo["code"]
            results.append(pt)
        return results

    @staticmethod
    def execute_dual_aggregation(
        df: pd.DataFrame,
        group_by_col: str,
        value_col1: Optional[str] = None,
        value_col2: Optional[str] = None,
        agg_type1: str = "sum",
        agg_type2: str = "avg",
        top_n: int = 15,
        filters: Optional[List[Dict[str, Any]]] = None,
        primary_value_col: Optional[str] = None,
        secondary_value_col: Optional[str] = None,
        agg_type: Optional[str] = None,
        **kwargs
    ) -> List[Dict[str, Any]]:
        # Map parameter aliases seamlessly
        if primary_value_col is not None and value_col1 is None:
            value_col1 = primary_value_col
        if secondary_value_col is not None and value_col2 is None:
            value_col2 = secondary_value_col
        if agg_type is not None:
            agg_type1 = agg_type

        working_df = CalculationTools.apply_filters(df, filters)
        if group_by_col not in working_df.columns:
            return []

        v1 = value_col1 if (value_col1 and value_col1 in working_df.columns) else None
        v2 = value_col2 if (value_col2 and value_col2 in working_df.columns) else None

        if not v1:
            return CalculationTools.execute_aggregation(working_df, group_by_col, v2, agg_type2, top_n)

        if group_by_col == v1 or (v2 and group_by_col == v2):
            target_val = v2 if group_by_col == v1 else v1
            target_agg = agg_type2 if group_by_col == v1 else agg_type1
            return CalculationTools.execute_aggregation(working_df, group_by_col, target_val, target_agg, top_n)

        working_df = working_df.copy()
        working_df[v1] = pd.to_numeric(working_df[v1], errors="coerce")
        if v2 and v2 != v1:
            working_df[v2] = pd.to_numeric(working_df[v2], errors="coerce")

        agg_dict = {v1: agg_type1 if agg_type1 != "avg" else "mean"}
        if v2 and v2 != v1:
            agg_dict[v2] = agg_type2 if agg_type2 != "avg" else "mean"

        grouped = working_df.groupby(group_by_col).agg(agg_dict).reset_index()
        grouped = grouped.sort_values(by=v1, ascending=False).head(top_n)

        results = []
        for _, row in grouped.iterrows():
            val1 = row[v1]
            val2 = row[v2] if (v2 and v2 in row) else None
            results.append({
                "label": str(row[group_by_col]),
                "value": round(float(val1), 2) if pd.notnull(val1) else 0.0,
                "secondary_value": round(float(val2), 2) if val2 is not None and pd.notnull(val2) else None
            })
        return results

    @staticmethod
    def execute_time_series(
        df: pd.DataFrame,
        date_col: str,
        value_col: Optional[str] = None,
        agg_type: str = "sum",
        filters: Optional[List[Dict[str, Any]]] = None,
        enable_forecast: bool = False,
        forecast_periods: int = 6
    ) -> List[Dict[str, Any]]:
        if df is None or len(df) == 0:
            return []

        working_df = CalculationTools.apply_filters(df, filters).copy()

        # Resolve date column if missing or referencing internal temporary column
        if not date_col or str(date_col).startswith("_") or date_col not in working_df.columns:
            date_candidates = [
                c for c in working_df.columns
                if not str(c).startswith("_") and (
                    pd.api.types.is_datetime64_any_dtype(working_df[c]) or
                    any(k in str(c).lower() for k in ["date", "time", "timestamp", "year", "month", "day", "quarter", "period"])
                )
            ]
            if date_candidates:
                date_col = date_candidates[0]
            elif date_col not in working_df.columns:
                # Fall back to aggregation on first available column
                group_col = [c for c in working_df.columns if not str(c).startswith("_")][0] if len(working_df.columns) > 0 else working_df.columns[0]
                return CalculationTools.execute_aggregation(working_df, group_by_col=group_col, value_col=value_col, agg_type=agg_type, top_n=30)

        # Parse datetime
        parsed = pd.to_datetime(working_df[date_col], errors="coerce")
        working_df = working_df.assign(_parsed_dt=parsed)
        working_df = working_df.dropna(subset=["_parsed_dt"]).sort_values(by="_parsed_dt")

        if working_df.empty or len(working_df) == 0:
            # Fall back to categorical/sequential aggregation if date parsing yielded no timestamps
            return CalculationTools.execute_aggregation(df, group_by_col=date_col, value_col=value_col, agg_type=agg_type, top_n=30)

        # Auto-determine frequency based on span
        min_d = working_df["_parsed_dt"].min()
        max_d = working_df["_parsed_dt"].max()
        days_span = (max_d - min_d).days

        if days_span > 730:
            freq = "YE"
            date_format = "%Y"
            pd_freq = "YE"
        elif days_span > 60:
            freq = "ME"
            date_format = "%Y-%m"
            pd_freq = "ME"
        elif days_span > 14:
            freq = "W"
            date_format = "%Y-%m-%d"
            pd_freq = "W"
        else:
            freq = "D"
            date_format = "%Y-%m-%d"
            pd_freq = "D"

        working_df = working_df.set_index("_parsed_dt")

        try:
            if not value_col or value_col not in working_df.columns or agg_type == "count":
                resampled = working_df.resample(freq).size().reset_index(name="value")
            else:
                num_series = pd.to_numeric(working_df[value_col], errors="coerce")
                working_df = working_df.assign(**{value_col: num_series})
                if agg_type in ["avg", "mean"]:
                    resampled = working_df[value_col].resample(freq).mean().reset_index(name="value")
                else:
                    resampled = working_df[value_col].resample(freq).sum().reset_index(name="value")
        except Exception:
            # Resample frequency fallback (e.g. older/newer pandas differences)
            alt_freq = "Y" if freq == "YE" else ("M" if freq == "ME" else freq)
            try:
                if not value_col or value_col not in working_df.columns or agg_type == "count":
                    resampled = working_df.resample(alt_freq).size().reset_index(name="value")
                else:
                    num_series = pd.to_numeric(working_df[value_col], errors="coerce")
                    working_df = working_df.assign(**{value_col: num_series})
                    if agg_type in ["avg", "mean"]:
                        resampled = working_df[value_col].resample(alt_freq).mean().reset_index(name="value")
                    else:
                        resampled = working_df[value_col].resample(alt_freq).sum().reset_index(name="value")
            except Exception:
                return CalculationTools.execute_aggregation(df, group_by_col=date_col, value_col=value_col, agg_type=agg_type, top_n=30)

        historical_points = []
        raw_vals = []
        for _, row in resampled.iterrows():
            dt = row["_parsed_dt"]
            val = row["value"]
            if pd.isna(val) or np.isnan(val):
                val = 0.0
            float_val = round(float(val), 2)
            raw_vals.append(float_val)
            historical_points.append({
                "label": dt.strftime(date_format) if hasattr(dt, 'strftime') else str(dt),
                "value": float_val,
                "dt": dt
            })

        if not historical_points:
            return CalculationTools.execute_aggregation(df, group_by_col=date_col, value_col=value_col, agg_type=agg_type, top_n=30)

        if not enable_forecast or len(historical_points) < 3:
            return [{"label": p["label"], "value": p["value"]} for p in historical_points]

        # Double Exponential Smoothing (Holt's Linear Trend Model)
        n = len(raw_vals)
        alpha = 0.35
        beta = 0.15

        # Initialize level and trend
        level = raw_vals[0]
        trend = (raw_vals[-1] - raw_vals[0]) / max(n - 1, 1)

        residuals = []
        for t in range(1, n):
            pred_t = level + trend
            residuals.append(raw_vals[t] - pred_t)

            new_level = alpha * raw_vals[t] + (1 - alpha) * (level + trend)
            trend = beta * (new_level - level) + (1 - beta) * trend
            level = new_level

        # Root Mean Square Error for 95% confidence intervals
        rmse = float(np.sqrt(np.mean(np.square(residuals)))) if residuals else (np.std(raw_vals) or 1.0)
        is_non_negative = all(v >= 0 for v in raw_vals)

        # Build output list
        results = []
        for idx, p in enumerate(historical_points):
            pt = {
                "label": p["label"],
                "value": p["value"],
                "is_forecast": False
            }
            # For the last point, set forecast = value so the chart lines connect seamlessly
            if idx == len(historical_points) - 1:
                pt["forecast"] = p["value"]
                pt["forecast_lower"] = p["value"]
                pt["forecast_upper"] = p["value"]
            results.append(pt)

        # Generate future forecast points
        last_dt = historical_points[-1]["dt"]
        periods = max(1, min(forecast_periods, 24))

        future_dates = pd.date_range(start=last_dt, periods=periods + 1, freq=pd_freq)[1:]

        for h, f_dt in enumerate(future_dates, start=1):
            pred = level + h * trend
            margin = 1.96 * rmse * np.sqrt(h)

            if is_non_negative:
                pred = max(0.0, pred)
                lower = max(0.0, pred - margin)
            else:
                lower = pred - margin
            upper = pred + margin

            results.append({
                "label": f"{f_dt.strftime(date_format)} (Fcst)",
                "value": None,
                "forecast": round(float(pred), 2),
                "forecast_lower": round(float(lower), 2),
                "forecast_upper": round(float(upper), 2),
                "is_forecast": True
            })

        return results

    @staticmethod
    def execute_distribution(
        df: pd.DataFrame,
        num_col: str,
        bins_count: int = 8,
        filters: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        working_df = CalculationTools.apply_filters(df, filters)
        if num_col not in working_df.columns:
            return []

        clean_series = pd.to_numeric(working_df[num_col], errors="coerce").dropna()
        if len(clean_series) < 2:
            return []

        counts, bin_edges = np.histogram(clean_series, bins=bins_count)
        results = []
        for i in range(len(counts)):
            low = round(float(bin_edges[i]), 1)
            high = round(float(bin_edges[i+1]), 1)
            results.append({
                "label": f"{low} - {high}",
                "value": int(counts[i])
            })
        return results

    @staticmethod
    def execute_scatter(
        df: pd.DataFrame,
        x_col: str,
        y_col: str,
        sample_size: int = 100,
        filters: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        working_df = CalculationTools.apply_filters(df, filters)
        if x_col not in working_df.columns or y_col not in working_df.columns:
            return []

        x_num = pd.to_numeric(working_df[x_col], errors="coerce")
        y_num = pd.to_numeric(working_df[y_col], errors="coerce")
        valid = pd.DataFrame({"x": x_num, "y": y_num}).dropna()

        if len(valid) > sample_size:
            valid = valid.sample(n=sample_size, random_state=42)

        results = []
        for _, row in valid.iterrows():
            results.append({
                "x": round(float(row["x"]), 2),
                "y": round(float(row["y"]), 2)
            })
        return results

    @staticmethod
    def compute_correlation_matrix(df: pd.DataFrame, max_cols: int = 6) -> List[Dict[str, Any]]:
        num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        # Drop ID-like columns
        clean_cols = [c for c in num_cols if not c.lower().endswith("id") and not c.lower().endswith("code")][:max_cols]
        if len(clean_cols) < 2:
            return []

        corr = df[clean_cols].corr().round(2)
        results = []
        for c1 in clean_cols:
            row_dict = {"column": c1}
            for c2 in clean_cols:
                val = corr.loc[c1, c2]
                row_dict[c2] = 0.0 if np.isnan(val) else float(val)
            results.append(row_dict)
        return results

    @staticmethod
    def apply_filters(df: pd.DataFrame, filters: Optional[List[Dict[str, Any]]]) -> pd.DataFrame:
        if df is None or len(df) == 0:
            return pd.DataFrame() if df is None else df.copy()
        result = df.copy()
        if not filters:
            return result
        for f in filters:
            field = f.get("field")
            op = f.get("operator", "equals")
            val = f.get("value")
            if field not in result.columns or val is None:
                continue
            
            if op == "equals":
                result = result[result[field].astype(str) == str(val)]
            elif op == "greater_than":
                try:
                    result = result[pd.to_numeric(result[field], errors="coerce") > float(val)]
                except Exception:
                    pass
            elif op == "less_than":
                try:
                    result = result[pd.to_numeric(result[field], errors="coerce") < float(val)]
                except Exception:
                    pass
            elif op == "contains":
                result = result[result[field].astype(str).str.contains(str(val), case=False, na=False)]
            elif op == "in" and isinstance(val, list):
                result = result[result[field].isin(val)]
        return result

    @staticmethod
    def execute_pareto_analysis(
        df: pd.DataFrame,
        dimension_col: str,
        metric_col: str,
        top_n: int = 30
    ) -> Dict[str, Any]:
        """
        Executes Pareto (80/20 Rule) concentration analysis.
        Computes cumulative distribution, Gini inequality coefficient,
        and identifies the 'Vital Few' entities driving 80% of total volume.
        """
        if dimension_col not in df.columns or metric_col not in df.columns:
            return {"error": f"Columns {dimension_col} or {metric_col} not found"}

        clean_df = df.copy()
        clean_df[metric_col] = pd.to_numeric(clean_df[metric_col], errors="coerce").fillna(0)
        clean_df = clean_df[clean_df[metric_col] > 0]

        if clean_df.empty:
            return {"error": "No positive values found for Pareto analysis"}

        grouped = clean_df.groupby(dimension_col)[metric_col].sum().reset_index()
        grouped = grouped.sort_values(by=metric_col, ascending=False).reset_index(drop=True)

        total_val = float(grouped[metric_col].sum())
        if total_val <= 0:
            return {"error": "Total volume must be positive"}

        grouped["share_pct"] = (grouped[metric_col] / total_val) * 100.0
        grouped["cumulative_val"] = grouped[metric_col].cumsum()
        grouped["cumulative_pct"] = (grouped["cumulative_val"] / total_val) * 100.0

        # Calculate Gini coefficient for inequality
        vals = np.sort(grouped[metric_col].values)
        n = len(vals)
        index = np.arange(1, n + 1)
        gini = float((2 * np.sum(index * vals) - (n + 1) * np.sum(vals)) / (n * np.sum(vals))) if total_val > 0 else 0.0
        gini = max(0.0, min(1.0, round(gini, 3)))

        # Find 80% cutoff
        cutoff_idx = int(np.searchsorted(grouped["cumulative_pct"].values, 80.0))
        cutoff_idx = min(cutoff_idx, len(grouped) - 1)
        vital_few_count = cutoff_idx + 1
        vital_few_pct = round((vital_few_count / len(grouped)) * 100, 1)
        vital_few_share = round(float(grouped.iloc[cutoff_idx]["cumulative_pct"]), 1)

        items = []
        for idx, row in grouped.head(top_n).iterrows():
            items.append({
                "rank": idx + 1,
                "label": str(row[dimension_col]),
                "value": round(float(row[metric_col]), 2),
                "share_pct": round(float(row["share_pct"]), 2),
                "cumulative_pct": round(float(row["cumulative_pct"]), 2),
                "is_vital_few": bool(idx <= cutoff_idx)
            })

        takeaway = (
            f"High Pareto concentration: Top {vital_few_count} {dimension_col}s "
            f"({vital_few_pct}% of entities) account for {vital_few_share}% of total {metric_col}. "
            f"Gini coefficient is {gini}, indicating {'strong operational concentration' if gini >= 0.5 else 'moderate dispersion'}."
        )

        return {
            "dimension_col": dimension_col,
            "metric_col": metric_col,
            "total_entities": len(grouped),
            "total_value": round(total_val, 2),
            "vital_few_count": vital_few_count,
            "vital_few_entity_pct": vital_few_pct,
            "vital_few_volume_pct": vital_few_share,
            "gini_coefficient": gini,
            "executive_takeaway": takeaway,
            "items": items
        }

    @staticmethod
    def execute_multivariate_regression(
        df: pd.DataFrame,
        target_col: str,
        feature_cols: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Fits Ordinary Least Squares (OLS) multivariate linear regression using vectorized NumPy.
        Calculates coefficients, intercept, R², adjusted R², standard errors, t-statistics, and p-values.
        """
        if target_col not in df.columns:
            return {"error": f"Target column '{target_col}' not found"}

        num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if not feature_cols:
            feature_cols = [
                c for c in num_cols 
                if c != target_col 
                and not c.lower().endswith("id") 
                and not c.lower().endswith("key")
                and df[c].nunique() > 1
            ][:6]
        else:
            feature_cols = [c for c in feature_cols if c in df.columns and c != target_col]

        if not feature_cols:
            return {"error": "At least one numeric predictor feature is required"}

        # Prepare clean numeric dataset
        cols_needed = [target_col] + feature_cols
        sub_df = df[cols_needed].apply(pd.to_numeric, errors="coerce").dropna()

        n = len(sub_df)
        p = len(feature_cols)

        if n < p + 2:
            return {"error": f"Insufficient non-null rows ({n}) for {p} features"}

        y = sub_df[target_col].values.astype(float)
        X_raw = sub_df[feature_cols].values.astype(float)

        # Add intercept column of 1s
        X = np.column_stack([np.ones(n), X_raw])

        try:
            # Solve OLS via pseudo-inverse for numerical stability
            XtX = X.T @ X
            XtX_inv = np.linalg.pinv(XtX)
            beta = XtX_inv @ X.T @ y

            intercept = float(beta[0])
            coefs = beta[1:]

            # Predictions & Residuals
            y_pred = X @ beta
            residuals = y - y_pred
            rss = float(np.sum(residuals ** 2))
            tss = float(np.sum((y - np.mean(y)) ** 2))

            r_squared = 1.0 - (rss / tss) if tss > 0 else 0.0
            r_squared = max(0.0, min(1.0, float(r_squared)))

            # Adjusted R-squared
            adj_r2 = 1.0 - ((rss / max(n - p - 1, 1)) / (tss / max(n - 1, 1))) if tss > 0 else 0.0
            adj_r2 = max(0.0, min(1.0, float(adj_r2)))

            # Residual Variance & Standard Errors
            sigma_sq = rss / max(n - p - 1, 1)
            var_beta = sigma_sq * np.diag(XtX_inv)
            se_beta = np.sqrt(np.maximum(var_beta, 1e-12))

            t_stats = beta / se_beta

            # Normal approximation for two-tailed p-values: 2 * (1 - norm.cdf(|t|))
            # norm.cdf(x) approx using error function
            def p_val_approx(t):
                import math
                return max(0.0001, min(1.0, round(math.erfc(abs(t) / math.sqrt(2)), 4)))

            coefficients_table = []
            for i, feat in enumerate(feature_cols):
                c_val = float(coefs[i])
                t_val = float(t_stats[i + 1])
                p_val = p_val_approx(t_val)
                se_val = float(se_beta[i + 1])
                coefficients_table.append({
                    "feature": feat,
                    "coefficient": round(c_val, 4),
                    "standard_error": round(se_val, 4),
                    "t_statistic": round(t_val, 2),
                    "p_value": p_val,
                    "is_statistically_significant": bool(p_val < 0.05),
                    "impact_direction": "positive" if c_val > 0 else "negative"
                })

            # Sort features by absolute impact (t-stat magnitude)
            coefficients_table.sort(key=lambda x: abs(x["t_statistic"]), reverse=True)

            # Build readable model formula equation
            terms = [f"{round(c['coefficient'], 2)} * {c['feature']}" for c in coefficients_table[:3]]
            formula_equation = f"{target_col} = {round(intercept, 2)} + {' + '.join(terms)}"

            return {
                "target_column": target_col,
                "features_analyzed": feature_cols,
                "sample_size": n,
                "intercept": round(intercept, 4),
                "r_squared": round(r_squared, 4),
                "adjusted_r_squared": round(adj_r2, 4),
                "residual_std_error": round(float(np.sqrt(sigma_sq)), 3),
                "formula_equation": formula_equation,
                "model_fit_quality": "Excellent" if r_squared > 0.7 else ("Good" if r_squared > 0.4 else "Moderate"),
                "coefficients": coefficients_table
            }
        except Exception as e:
            return {"error": f"Regression computation failed: {str(e)}"}

    @staticmethod
    def execute_technical_momentum(
        df: pd.DataFrame,
        date_col: str,
        value_col: str,
        window: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Computes 20-period Exponential Moving Average (EMA) and Bollinger Bands
        (Upper, Middle, Lower bands with 2-sigma envelope) for time-series momentum.
        """
        if date_col not in df.columns or value_col not in df.columns:
            return []

        working = df[[date_col, value_col]].copy()
        working["_dt"] = pd.to_datetime(working[date_col], errors="coerce")
        working[value_col] = pd.to_numeric(working[value_col], errors="coerce")
        working = working.dropna().sort_values(by="_dt")

        if len(working) < 5:
            return []

        # Resample daily or aggregate
        s = working[value_col]
        ema = s.ewm(span=window, adjust=False).mean()
        rolling_std = s.rolling(window=min(window, len(s)), min_periods=2).std().fillna(s.std() or 1.0)

        upper_band = ema + 2 * rolling_std
        lower_band = np.maximum(0.0, ema - 2 * rolling_std)

        results = []
        for idx, row in working.iterrows():
            v = float(row[value_col])
            m = float(ema.loc[idx])
            u = float(upper_band.loc[idx])
            l = float(lower_band.loc[idx])
            results.append({
                "date": row["_dt"].strftime("%Y-%m-%d") if pd.notnull(row["_dt"]) else str(row[date_col]),
                "actual": round(v, 2),
                "ema_trend": round(m, 2),
                "upper_band": round(u, 2),
                "lower_band": round(l, 2),
                "is_overbought": bool(v > u),
                "is_oversold": bool(v < l)
            })

        return results[-40:]  # Return most recent 40 periods for clean charting

    @staticmethod
    def execute_heatmap(
        df: pd.DataFrame,
        group_by_col: str,
        secondary_col: Optional[str] = None,
        value_col: Optional[str] = None,
        agg_type: str = "sum",
        top_x: int = 10,
        top_y: int = 8,
        filters: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        """
        Computes 2D matrix cross-tabulation and normalized cell intensity for Heat Map visualizations.
        """
        working_df = CalculationTools.apply_filters(df, filters)
        if group_by_col not in working_df.columns:
            return []

        # Find secondary dimension if not provided
        if not secondary_col or secondary_col not in working_df.columns or secondary_col == group_by_col:
            cat_cols = [
                c for c in working_df.select_dtypes(include=["object", "category", "string"]).columns
                if c != group_by_col and not c.lower().endswith("id") and 1 < working_df[c].nunique() <= 30
            ]
            if cat_cols:
                secondary_col = cat_cols[0]
            else:
                # Try date column
                date_cols = [
                    c for c in working_df.columns
                    if c != group_by_col and (any(k in c.lower() for k in ["date", "time", "month", "year", "quarter"]) or pd.api.types.is_datetime64_any_dtype(working_df[c]))
                ]
                if date_cols:
                    secondary_col = date_cols[0]

        # Single-dimension fallback if no secondary column could be found
        if not secondary_col or secondary_col not in working_df.columns or secondary_col == group_by_col:
            base_points = CalculationTools.execute_aggregation(working_df, group_by_col, value_col, agg_type, top_n=top_x * 2)
            if not base_points:
                return []
            vals = [float(p["value"]) for p in base_points if isinstance(p.get("value"), (int, float))]
            min_v = min(vals) if vals else 0.0
            max_v = max(vals) if vals else 1.0
            span = max(max_v - min_v, 1e-6)
            total_v = sum(vals) if vals else 1.0

            results = []
            for p in base_points:
                v = float(p.get("value", 0))
                intensity = round(max(0.05, min(1.0, (v - min_v) / span)), 3)
                results.append({
                    "label": p["label"],
                    "x": p["label"],
                    "y": value_col or "Metric",
                    "value": v,
                    "intensity": intensity,
                    "share_pct": round((v / max(total_v, 1e-6)) * 100, 1)
                })
            return results

        # 2D Cross Tabulation
        df_copy = working_df.copy()
        
        # Format secondary if date
        if pd.api.types.is_datetime64_any_dtype(df_copy[secondary_col]) or any(k in secondary_col.lower() for k in ["date", "time"]):
            dt_s = pd.to_datetime(df_copy[secondary_col], errors="coerce")
            df_copy["_sec_fmt"] = dt_s.dt.strftime("%Y-%m")
            sec_use_col = "_sec_fmt"
        else:
            sec_use_col = secondary_col

        # Filter to top categories for legibility
        top_x_vals = df_copy[group_by_col].value_counts().head(top_x).index.tolist()
        top_y_vals = df_copy[sec_use_col].value_counts().head(top_y).index.tolist()
        df_copy = df_copy[df_copy[group_by_col].isin(top_x_vals) & df_copy[sec_use_col].isin(top_y_vals)]

        if df_copy.empty:
            return []

        if not value_col or value_col not in df_copy.columns or agg_type == "count":
            pivot = pd.crosstab(df_copy[sec_use_col], df_copy[group_by_col])
        else:
            df_copy[value_col] = pd.to_numeric(df_copy[value_col], errors="coerce")
            piv_func = "mean" if agg_type in ["avg", "mean"] else ("max" if agg_type == "max" else "sum")
            pivot = df_copy.pivot_table(
                index=sec_use_col,
                columns=group_by_col,
                values=value_col,
                aggfunc=piv_func,
                fill_value=0.0
            )

        all_vals = pivot.values.flatten()
        clean_vals = [float(v) for v in all_vals if not np.isnan(v) and not pd.isna(v)]
        min_v = min(clean_vals) if clean_vals else 0.0
        max_v = max(clean_vals) if clean_vals else 1.0
        span = max(max_v - min_v, 1e-6)
        total_v = sum(clean_vals) if clean_vals else 1.0

        results = []
        for y_label in pivot.index:
            for x_label in pivot.columns:
                raw_val = float(pivot.loc[y_label, x_label])
                if np.isnan(raw_val):
                    raw_val = 0.0
                intensity = round(max(0.04, min(1.0, (raw_val - min_v) / span)), 3)
                results.append({
                    "label": f"{x_label} × {y_label}",
                    "x": str(x_label),
                    "y": str(y_label),
                    "value": round(raw_val, 2),
                    "intensity": intensity,
                    "share_pct": round((raw_val / max(total_v, 1e-6)) * 100, 1)
                })

        return results

    @staticmethod
    def execute_treemap(
        df: pd.DataFrame,
        group_by_col: str,
        secondary_col: Optional[str] = None,
        value_col: Optional[str] = None,
        agg_type: str = "sum",
        top_n: int = 18,
        filters: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        """
        Computes proportional area and hierarchical tree data for Tree Map visualizations.
        """
        working_df = CalculationTools.apply_filters(df, filters)
        if group_by_col not in working_df.columns:
            return []

        # Color palette sequence for distinct tile cohorts
        TILES_PALETTE = [
            "#6366f1", "#06b6d4", "#10b981", "#f59e0b",
            "#ec4899", "#8b5cf6", "#3b82f6", "#14b8a6",
            "#f43f5e", "#84cc16", "#a855f7", "#eab308"
        ]

        # 1. If secondary grouping column is available, create hierarchical nested treemap
        if secondary_col and secondary_col in working_df.columns and secondary_col != group_by_col:
            df_copy = working_df.copy()
            if value_col and value_col in df_copy.columns and agg_type != "count":
                df_copy[value_col] = pd.to_numeric(df_copy[value_col], errors="coerce").fillna(0)
                piv_func = "mean" if agg_type in ["avg", "mean"] else "sum"
                grouped = df_copy.groupby([group_by_col, secondary_col])[value_col].agg(piv_func).reset_index()
            else:
                grouped = df_copy.groupby([group_by_col, secondary_col]).size().reset_index(name="value")
                value_col = "value"

            top_parents = grouped.groupby(group_by_col)[value_col].sum().sort_values(ascending=False).head(8).index.tolist()
            grouped = grouped[grouped[group_by_col].isin(top_parents)]

            grand_total = float(grouped[value_col].sum()) if not grouped.empty else 1.0

            results = []
            for p_idx, parent_name in enumerate(top_parents):
                sub_df = grouped[grouped[group_by_col] == parent_name].sort_values(by=value_col, ascending=False).head(6)
                p_total = float(sub_df[value_col].sum())
                children = []
                for _, row in sub_df.iterrows():
                    val = float(row[value_col])
                    children.append({
                        "name": str(row[secondary_col]),
                        "label": str(row[secondary_col]),
                        "parent": str(parent_name),
                        "value": round(val, 2),
                        "size": round(val, 2),
                        "share_pct": round((val / max(grand_total, 1e-6)) * 100, 1),
                        "color": TILES_PALETTE[p_idx % len(TILES_PALETTE)]
                    })

                results.append({
                    "name": str(parent_name),
                    "label": str(parent_name),
                    "value": round(p_total, 2),
                    "size": round(p_total, 2),
                    "share_pct": round((p_total / max(grand_total, 1e-6)) * 100, 1),
                    "color": TILES_PALETTE[p_idx % len(TILES_PALETTE)],
                    "children": children
                })
            return results

        # 2. Flat proportional tile treemap
        base_points = CalculationTools.execute_aggregation(working_df, group_by_col, value_col, agg_type, top_n=top_n)
        total_v = sum(float(p["value"]) for p in base_points if isinstance(p.get("value"), (int, float))) or 1.0

        results = []
        for idx, p in enumerate(base_points):
            val = float(p.get("value", 0))
            results.append({
                "name": str(p.get("label")),
                "label": str(p.get("label")),
                "value": round(val, 2),
                "size": round(val, 2),
                "share_pct": round((val / max(total_v, 1e-6)) * 100, 1),
                "color": TILES_PALETTE[idx % len(TILES_PALETTE)]
            })

        return results


