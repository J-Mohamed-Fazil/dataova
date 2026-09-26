from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np

class ScenarioPlanner:
    """
    Multivariate scenario simulation engine. Models the sensitivity of a target
    metric (e.g. Revenue, Margin) under simulated percentage shifts across
    multiple operational driver levers.
    """

    @staticmethod
    def get_scenario_config(df: pd.DataFrame) -> Dict[str, Any]:
        """
        Discovers candidate target metrics and driver levers for a given dataframe.
        """
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        cat_cols = df.select_dtypes(include=["object", "category", "string"]).columns.tolist()

        if not numeric_cols:
            return {"error": "No numeric metrics available for scenario simulation."}

        # Select candidate target metric (prefer revenue, sales, profit, amount, or first numeric)
        target_candidates = [c for c in numeric_cols if any(k in c.lower() for k in ["revenue", "sales", "profit", "amount", "spend", "margin"])]
        default_target = target_candidates[0] if target_candidates else numeric_cols[0]

        # Find drivers with highest absolute correlation to target
        correlations = {}
        target_series = pd.to_numeric(df[default_target], errors="coerce").dropna()
        if len(target_series) > 5:
            for col in numeric_cols:
                if col != default_target:
                    s = pd.to_numeric(df[col], errors="coerce")
                    valid_idx = target_series.index.intersection(s.dropna().index)
                    if len(valid_idx) > 5:
                        c_val = target_series.loc[valid_idx].corr(s.loc[valid_idx])
                        if not np.isnan(c_val):
                            correlations[col] = round(float(c_val), 3)

        # Sort drivers by absolute correlation
        sorted_drivers = sorted(correlations.items(), key=lambda x: abs(x[1]), reverse=True)
        recommended_drivers = [
            {"column": d[0], "correlation": d[1], "default_shift": 5.0}
            for d in sorted_drivers[:4]
        ]
        if not recommended_drivers and len(numeric_cols) > 1:
            recommended_drivers = [
                {"column": col, "correlation": 1.0, "default_shift": 5.0}
                for col in numeric_cols if col != default_target
            ][:3]

        return {
            "target_metric": default_target,
            "all_numeric_columns": numeric_cols,
            "all_dimension_columns": cat_cols[:10],
            "default_dimension": cat_cols[0] if cat_cols else None,
            "recommended_drivers": recommended_drivers
        }

    @staticmethod
    def simulate(
        df: pd.DataFrame,
        target_metric: str,
        drivers: List[Dict[str, Any]],
        dimension_col: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes multivariate simulation.
        drivers: [{'column': 'Price', 'shift_pct': 10.0}, ...]
        """
        if target_metric not in df.columns:
            numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            if not numeric_cols:
                return {"error": "Target metric not found and no numeric columns available."}
            target_metric = numeric_cols[0]

        clean_df = df.copy()
        clean_df[target_metric] = pd.to_numeric(clean_df[target_metric], errors="coerce").fillna(0)
        baseline_total = float(clean_df[target_metric].sum())

        if baseline_total == 0:
            return {
                "baseline_total": 0,
                "projected_total": 0,
                "net_delta": 0,
                "variance_pct": 0,
                "drivers_applied": [],
                "comparison_chart": [],
                "waterfall_steps": [],
                "segment_breakdown": []
            }

        # Calculate composite multiplier based on drivers
        driver_deltas: List[Dict[str, Any]] = []
        composite_multiplier = 1.0

        for d in drivers:
            col = d.get("column")
            shift_pct = float(d.get("shift_pct", 0.0))
            if shift_pct == 0:
                continue

            if col == target_metric or col not in clean_df.columns:
                # Direct uniform shift
                driver_impact = (shift_pct / 100.0)
            else:
                # Correlated driver shift: adjust by correlation coefficient
                s_col = pd.to_numeric(clean_df[col], errors="coerce")
                corr = clean_df[target_metric].corr(s_col)
                if np.isnan(corr) or abs(corr) < 0.05:
                    corr = 0.5  # default moderate sensitivity assumption

                driver_impact = (shift_pct / 100.0) * float(corr)

            composite_multiplier *= (1.0 + driver_impact)
            driver_dollar_delta = baseline_total * driver_impact
            driver_deltas.append({
                "column": col or "Uniform Shift",
                "shift_pct": shift_pct,
                "estimated_impact_pct": round(driver_impact * 100, 2),
                "dollar_delta": round(driver_dollar_delta, 2)
            })

        projected_total = baseline_total * composite_multiplier
        net_delta = projected_total - baseline_total
        variance_pct = (net_delta / baseline_total) * 100 if baseline_total != 0 else 0.0

        # Comparison chart for Recharts
        comparison_chart = [
            {"label": "Current Baseline", "value": round(baseline_total, 2), "fill": "#6366f1"},
            {"label": "Simulated Scenario", "value": round(projected_total, 2), "fill": "#10b981" if net_delta >= 0 else "#f43f5e"}
        ]

        # Waterfall steps
        waterfall_steps = [
            {"step": "Baseline", "value": round(baseline_total, 2), "type": "base"}
        ]
        running_total = baseline_total
        for dd in driver_deltas:
            waterfall_steps.append({
                "step": f"{dd['column']} ({dd['shift_pct']:+0.1f}%)",
                "value": dd["dollar_delta"],
                "type": "positive" if dd["dollar_delta"] >= 0 else "negative"
            })
            running_total += dd["dollar_delta"]
        waterfall_steps.append({
            "step": "Projected Total",
            "value": round(projected_total, 2),
            "type": "total"
        })

        # Segment breakdown if dimension is available
        segment_breakdown: List[Dict[str, Any]] = []
        if not dimension_col:
            cat_cols = df.select_dtypes(include=["object", "category", "string"]).columns.tolist()
            dimension_col = cat_cols[0] if cat_cols else None

        if dimension_col and dimension_col in clean_df.columns:
            seg_agg = clean_df.groupby(dimension_col)[target_metric].sum().reset_index()
            seg_agg = seg_agg.sort_values(by=target_metric, ascending=False).head(8)

            for _, row in seg_agg.iterrows():
                seg_name = str(row[dimension_col])
                b_val = float(row[target_metric])
                p_val = b_val * composite_multiplier
                d_val = p_val - b_val
                pct = (d_val / max(b_val, 1e-6)) * 100

                segment_breakdown.append({
                    "segment": seg_name,
                    "baseline": round(b_val, 2),
                    "projected": round(p_val, 2),
                    "delta": round(d_val, 2),
                    "variance_pct": round(pct, 1)
                })

        risk_index = "Low" if abs(variance_pct) < 15 else ("Moderate" if abs(variance_pct) < 30 else "High Sensitivity")

        return {
            "target_metric": target_metric,
            "baseline_total": round(baseline_total, 2),
            "projected_total": round(projected_total, 2),
            "net_delta": round(net_delta, 2),
            "variance_pct": round(variance_pct, 2),
            "risk_index": risk_index,
            "drivers_applied": driver_deltas,
            "comparison_chart": comparison_chart,
            "waterfall_steps": waterfall_steps,
            "segment_breakdown": segment_breakdown
        }
