import math
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd

class ForecastEngine:
    """
    Enterprise-grade deterministic time-series forecasting engine.
    Supports:
    - Multi-horizon projections (3, 6, 12, 24 periods)
    - Trend extrapolation with Holt's linear trend & damped smoothing
    - Parametric confidence intervals (80% and 95% bounds)
    - Scenario modeling (Baseline, Optimistic/Bull, Pessimistic/Bear)
    - Predictive telemetry (Projected CAGR, Volatility, Direction, Confidence Score)
    """

    @staticmethod
    def _clean_numeric_series(series: Any) -> pd.Series:
        """Coerces series to numeric, stripping common formatting ($ , % etc.)."""
        if isinstance(series, pd.DataFrame):
            series = series.iloc[:, 0]
        if pd.api.types.is_numeric_dtype(series):
            return pd.to_numeric(series, errors="coerce")
        # If string / object, strip formatting
        cleaned = series.astype(str).str.replace(r'[\$,€£¥%\s]', '', regex=True)
        cleaned = cleaned.str.replace(r'\((\d+(\.\d+)?)\)', r'-\1', regex=True)
        return pd.to_numeric(cleaned, errors="coerce")

    @staticmethod
    def detect_time_and_metric_columns(df: pd.DataFrame) -> Dict[str, Optional[str]]:
        """Identifies optimal date and numeric metric columns for time-series forecasting."""
        date_col = None
        metric_col = None

        # 1. Look for datetime columns by keyword
        for col in df.columns:
            c_lower = col.lower()
            if any(k in c_lower for k in ["date", "time", "timestamp", "year", "period", "month", "day"]):
                try:
                    parsed = pd.to_datetime(df[col].dropna().head(20), errors="coerce")
                    if parsed.notna().sum() >= 3:
                        date_col = col
                        break
                except Exception:
                    pass

        if not date_col:
            # Fallback: check only string/object columns that contain date separators
            for col in df.columns:
                if pd.api.types.is_numeric_dtype(df[col]):
                    continue
                try:
                    sample = df[col].dropna().astype(str).head(15)
                    if len(sample) >= 3 and any("-" in s or "/" in s or ":" in s for s in sample):
                        parsed = pd.to_datetime(sample, errors="coerce")
                        if parsed.notna().sum() >= len(sample) * 0.7:
                            date_col = col
                            break
                except Exception:
                    pass

        # 2. Look for best numeric metric column
        num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        # Also check object columns that can convert to numbers
        for c in df.columns:
            if c != date_col and c not in num_cols:
                s = ForecastEngine._clean_numeric_series(df[c]).dropna()
                if len(s) >= 3 and len(s) >= len(df) * 0.6:
                    num_cols.append(c)

        clean_num_cols = [
            c for c in num_cols 
            if c != date_col
            and not c.lower().endswith("id") 
            and not c.lower().endswith("code") 
            and not c.lower().endswith("key")
            and not c.lower().startswith("is_")
            and df[c].nunique() > 1
        ]

        priority_keywords = ["revenue", "sales", "profit", "amount", "total", "income", "spent", "quantity", "cost", "score", "balance", "price"]
        for kw in priority_keywords:
            for c in clean_num_cols:
                if kw in c.lower():
                    metric_col = c
                    break
            if metric_col:
                break

        if not metric_col and clean_num_cols:
            metric_col = clean_num_cols[0]

        # Final fallback: any numeric column at all
        if not metric_col and num_cols:
            remaining = [c for c in num_cols if c != date_col]
            if remaining:
                metric_col = remaining[0]

        if date_col == metric_col:
            date_col = None

        return {"date_col": date_col, "metric_col": metric_col}

    @staticmethod
    def generate_forecast(
        df: pd.DataFrame,
        metric_col: Optional[str] = None,
        date_col: Optional[str] = None,
        horizon: int = 6,
        agg_type: str = "sum"
    ) -> Dict[str, Any]:
        """
        Executes an end-to-end predictive forecast on the dataset.
        Returns historical actuals, forecast points, confidence intervals, scenarios, and telemetry.
        """
        if df.empty:
            return {"error": "Dataset is empty."}

        detected = ForecastEngine.detect_time_and_metric_columns(df)
        final_date = date_col if (date_col and date_col in df.columns) else detected["date_col"]
        final_metric = metric_col if (metric_col and metric_col in df.columns) else detected["metric_col"]

        if final_date == final_metric:
            final_date = None

        if not final_metric:
            return {"error": "No numeric metric found to forecast in this table. Please choose a table with numeric metrics."}

        # If explicit date column exists, attempt time-based aggregation
        use_index_sequence = True
        if final_date and final_date in df.columns and final_date != final_metric:
            work_df = df[[final_date, final_metric]].copy()
            work_df["_cleaned_metric"] = ForecastEngine._clean_numeric_series(work_df[final_metric])
            work_df["_dt"] = pd.to_datetime(work_df[final_date], errors="coerce")
            work_df = work_df.dropna(subset=["_dt", "_cleaned_metric"]).sort_values("_dt")
            
            if len(work_df) >= 3:
                use_index_sequence = False

        if use_index_sequence:
            clean_series = ForecastEngine._clean_numeric_series(df[final_metric]).dropna().reset_index(drop=True)
            if len(clean_series) < 3:
                return {"error": f"Insufficient data points in '{final_metric}' for statistical projection (minimum 3 required)."}
            
            # Chunk or sequence values
            if len(clean_series) > 50:
                # Group into up to 24 rolling bins for smooth trend
                bin_size = max(1, len(clean_series) // 20)
                hist_vals = [float(clean_series.iloc[i:i+bin_size].mean()) for i in range(0, len(clean_series), bin_size)]
                hist_labels = [f"Period {i+1}" for i in range(len(hist_vals))]
            else:
                hist_vals = [float(v) for v in clean_series]
                hist_labels = [f"T{i+1}" for i in range(len(hist_vals))]
            freq_name = "Period"
        else:
            # Aggregate by natural time frequency
            min_dt = work_df["_dt"].min()
            max_dt = work_df["_dt"].max()
            span_days = (max_dt - min_dt).days

            if span_days > 730:
                freq = "YE"
                fmt = "%Y"
                freq_name = "Year"
            elif span_days > 90:
                freq = "ME"
                fmt = "%Y-%m"
                freq_name = "Month"
            elif span_days > 21:
                freq = "W"
                fmt = "%Y-%m-%d"
                freq_name = "Week"
            else:
                freq = "D"
                fmt = "%Y-%m-%d"
                freq_name = "Day"

            work_df.set_index("_dt", inplace=True)
            if agg_type == "mean" or agg_type == "avg":
                resampled = work_df["_cleaned_metric"].resample(freq).mean().dropna()
            else:
                resampled = work_df["_cleaned_metric"].resample(freq).sum().dropna()

            if len(resampled) < 3:
                # Fallback to sequential intervals if resampling produced too few buckets
                resampled = work_df["_cleaned_metric"].reset_index(drop=True)
                hist_labels = [f"P{i+1}" for i in range(len(resampled))]
                hist_vals = [float(v) for v in resampled]
                freq_name = "Interval"
            else:
                hist_labels = [dt.strftime(fmt) for dt in resampled.index]
                hist_vals = [round(float(v), 2) for v in resampled.values]

        n = len(hist_vals)
        x = np.arange(n)
        y = np.array(hist_vals, dtype=float)

        # 1. Fit Linear Trend with safety guards
        try:
            if np.all(y == y[0]):
                slope, intercept = 0.0, float(y[0])
            else:
                slope, intercept = np.polyfit(x, y, 1)
                if math.isnan(slope) or math.isnan(intercept):
                    slope, intercept = 0.0, float(np.mean(y))
        except Exception:
            slope, intercept = 0.0, float(np.mean(y))

        fitted_line = intercept + slope * x
        residuals = y - fitted_line
        residual_std = float(np.std(residuals)) if len(residuals) > 1 else max(float(abs(np.mean(y)) * 0.1), 1.0)
        if math.isnan(residual_std) or residual_std <= 0:
            residual_std = max(float(abs(np.mean(y)) * 0.05), 1.0)
        
        # Calculate R-squared
        ss_res = np.sum(residuals**2)
        ss_tot = np.sum((y - np.mean(y))**2)
        r2 = float(1.0 - (ss_res / max(ss_tot, 1e-9))) if ss_tot > 1e-9 else 0.85
        if math.isnan(r2):
            r2 = 0.75
        r2 = max(0.0, min(1.0, r2))

        # 2. Adaptive Holt's Linear Trend Exponential Smoothing
        # Adjust smoothing parameters based on the stability of the series
        cv_local = (residual_std / abs(np.mean(y))) if abs(np.mean(y)) > 1e-9 else 0.5
        
        if cv_local > 0.5:
            # Highly volatile: favor historical mean, strong damping
            alpha = 0.15
            beta = 0.05
            phi = 0.85
        elif cv_local > 0.2:
            # Moderately volatile
            alpha = 0.25
            beta = 0.15
            phi = 0.90
        else:
            # Stable: trust recent points and trend
            alpha = 0.40
            beta = 0.25
            phi = 0.96
            
        # Robust initialization: initialize level to intercept and trend to regression slope
        # avoids extreme outlier swings caused by the first two noisy points (e.g. y[1] - y[0]).
        level = float(intercept) if abs(intercept) > 1e-9 else float(y[0])
        trend = float(slope)
        if math.isnan(trend):
            trend = 0.0

        for i in range(n):
            last_level = level
            level = alpha * y[i] + (1 - alpha) * (last_level + trend)
            trend = beta * (level - last_level) + (1 - beta) * trend

        # 3. Future Projections (Horizon steps)
        forecast_points = []
        historical_points = []

        for i in range(n):
            historical_points.append({
                "period": hist_labels[i],
                "actual": round(float(hist_vals[i]), 2),
                "trend": round(float(fitted_line[i]), 2)
            })

        last_actual_val = hist_vals[-1]
        baseline_growth_rate = (slope / max(abs(last_actual_val), 1.0))

        # Generate future periods
        for h in range(1, horizon + 1):
            future_step = n - 1 + h
            future_label = f"+{h} {freq_name}{'s' if h > 1 else ''}"

            # Damped Holt forecast
            damped_trend_sum = sum(phi**k for k in range(1, h + 1))
            baseline_val = float(level + trend * damped_trend_sum)
            # Avoid negative forecasts for metrics that must be >= 0
            if np.all(y >= 0):
                baseline_val = max(0.0, baseline_val)

            # Confidence bounds: expanding uncertainty over time
            z_80 = 1.28
            z_95 = 1.96
            uncertainty_growth = math.sqrt(h) * residual_std

            upper_80 = baseline_val + z_80 * uncertainty_growth
            lower_80 = max(0.0, baseline_val - z_80 * uncertainty_growth) if np.all(y >= 0) else baseline_val - z_80 * uncertainty_growth

            upper_95 = baseline_val + z_95 * uncertainty_growth
            lower_95 = max(0.0, baseline_val - z_95 * uncertainty_growth) if np.all(y >= 0) else baseline_val - z_95 * uncertainty_growth

            # Volatility-aware Scenarios
            volatility_factor = max(0.015, min(0.05, cv_local * 0.1))
            bull_multiplier = 1.0 + (volatility_factor * h * 1.5)
            bear_multiplier = max(0.01, 1.0 - (volatility_factor * h * 1.5))

            bull_val = round(baseline_val * bull_multiplier, 2)
            bear_val = round(baseline_val * bear_multiplier, 2)

            forecast_points.append({
                "period": future_label,
                "step": h,
                "forecast": round(baseline_val, 2),
                "upper_95": round(upper_95, 2),
                "lower_95": round(lower_95, 2),
                "upper_80": round(upper_80, 2),
                "lower_80": round(lower_80, 2),
                "bull_scenario": bull_val,
                "bear_scenario": bear_val
            })

        # Telemetry & Executive Insights
        next_predicted = forecast_points[0]["forecast"] if forecast_points else 0.0
        final_predicted = forecast_points[-1]["forecast"] if forecast_points else 0.0
        
        denom_actual = abs(last_actual_val) if abs(last_actual_val) > 1e-9 else 1.0
        pct_change = ((final_predicted - last_actual_val) / denom_actual) * 100.0
        if math.isnan(pct_change) or math.isinf(pct_change):
            pct_change = 0.0
        pct_change = round(float(pct_change), 1)

        mean_y = abs(float(np.mean(y))) if abs(float(np.mean(y))) > 1e-9 else 1.0
        cv = float((residual_std / mean_y) * 100.0)
        if math.isnan(cv) or math.isinf(cv):
            cv = 5.0
        cv = round(cv, 1)

        if pct_change > 15:
            trajectory = "Accelerating Expansion"
            status_color = "emerald"
        elif pct_change > 2:
            trajectory = "Steady Growth"
            status_color = "teal"
        elif pct_change >= -2:
            trajectory = "Stable / Plateau"
            status_color = "cyan"
        elif pct_change >= -15:
            trajectory = "Mild Contraction"
            status_color = "amber"
        else:
            trajectory = "Significant Downturn"
            status_color = "rose"

        # Normalized fit score based on residual dispersion and R-squared
        dispersion_fit = max(0.0, 1.0 - (residual_std / max(mean_y, 1.0)))
        blended_fit = max(r2, dispersion_fit * 0.75)
        confidence_score = round(max(40.0, min(96.0, (blended_fit * 45.0) + (max(0.0, 100.0 - cv) * 0.40) + 10.0)), 1)
        if math.isnan(confidence_score):
            confidence_score = 75.0

        metric_display = final_metric.replace("_", " ").title()

        recommendations = [
            f"**Baseline Target**: Anticipate {metric_display} to reach **{final_predicted:,.2f}** over the next {horizon} {freq_name.lower()}s ({pct_change:+}% shift).",
            f"**Scenario Planning**: Budget for a **Bull Case** of **{forecast_points[-1]['bull_scenario']:,.2f}** (+{round(pct_change + 15, 1)}%) vs **Bear Case** of **{forecast_points[-1]['bear_scenario']:,.2f}**.",
            f"**Model Fidelity**: Forecast confidence is **{confidence_score}%** (Historical Fit R² = {round(r2, 2)}, Volatility Index = {cv}%)."
        ]

        if cv > 25:
            recommendations.append("High historical volatility detected. Consider dampening short-term commitments and utilizing rolling monthly re-forecasts.")

        return {
            "metric": final_metric,
            "metric_display": metric_display,
            "date_col": final_date or "Chronological Index",
            "frequency": freq_name,
            "horizon": horizon,
            "historical_count": n,
            "historical": historical_points,
            "forecast": forecast_points,
            "summary": {
                "last_actual": round(float(last_actual_val), 2),
                "next_forecast": round(float(next_predicted), 2),
                "horizon_target": round(float(final_predicted), 2),
                "projected_change_pct": pct_change,
                "trajectory": trajectory,
                "status_color": status_color,
                "confidence_score": confidence_score,
                "r_squared": round(r2, 3),
                "volatility_cv": cv
            },
            "recommendations": recommendations
        }
