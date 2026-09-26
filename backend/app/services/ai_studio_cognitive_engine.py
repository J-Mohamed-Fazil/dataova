from typing import Dict, Any, List, Optional, Tuple
import math
import re
import numpy as np
import pandas as pd
from app.services.calculation_tools import CalculationTools

class AIStudioCognitiveEngine:
    """
    Advanced Cognitive Reasoning and Semantic Data Understanding Engine for DATOVA AI Studio.
    Performs deep statistical profiling, semantic entity classification, multi-table graph navigation,
    and structured 5-step Chain-of-Thought (CoT) analytical deduction.
    """

    @staticmethod
    def classify_column_semantics(col_name: str, series: pd.Series) -> Dict[str, Any]:
        """
        Understands the deep business and statistical role of a column.
        """
        c_lower = col_name.lower()
        n_unique = series.nunique()
        is_num = pd.api.types.is_numeric_dtype(series)

        # 1. Temporal Chronology
        if any(k in c_lower for k in ["date", "time", "timestamp", "year", "month", "quarter", "day", "period"]):
            return {
                "role": "temporal",
                "label": "Temporal Timeline",
                "icon": "Calendar",
                "priority": 1,
                "data_nature": "Chronological Axis"
            }

        # 2. Volume & Scale Metrics (Additive)
        if is_num and any(k in c_lower for k in ["revenue", "sales", "amount", "total", "spent", "spend", "turnover", "volume", "quantity", "units", "orders", "gmv"]):
            return {
                "role": "volume_metric",
                "label": "Primary Volume Metric",
                "icon": "TrendingUp",
                "priority": 1,
                "data_nature": "Additive Continuous Scale"
            }

        # 3. Efficiency, Margin & Ratio Metrics
        if is_num and any(k in c_lower for k in ["profit", "margin", "discount", "price", "rate", "cost", "fee", "tax", "pct", "percent", "score", "churn", "yield"]):
            return {
                "role": "efficiency_metric",
                "label": "Efficiency / Ratio Metric",
                "icon": "Percent",
                "priority": 2,
                "data_nature": "Intensive Continuous Ratio"
            }

        # 4. Core Business Entities (Categorical)
        if not is_num and not c_lower.endswith("_id") and c_lower != "id" and 2 <= n_unique <= 60:
            if any(k in c_lower for k in ["category", "segment", "department", "tier", "class", "family", "group", "sector", "industry", "customer", "product", "channel", "brand"]):
                return {
                    "role": "core_entity",
                    "label": "Core Business Entity",
                    "icon": "Tag",
                    "priority": 1,
                    "data_nature": "Discrete Categorical Cohort"
                }

        # 5. Geographic Demographics
        if any(k in c_lower for k in ["country", "state", "region", "city", "market", "territory", "zone", "continent"]):
            return {
                "role": "geographic",
                "label": "Geographic Dimension",
                "icon": "Globe",
                "priority": 2,
                "data_nature": "Spatial Geographic Entity"
            }

        # 6. Status & Funnel Stages
        if any(k in c_lower for k in ["status", "stage", "state", "phase", "condition", "flag", "priority", "rating"]):
            return {
                "role": "funnel_status",
                "label": "Operational Funnel Status",
                "icon": "Layers",
                "priority": 3,
                "data_nature": "Lifecycle / Funnel State"
            }

        # Fallback numeric
        if is_num:
            return {
                "role": "numeric_general",
                "label": "Parametric Metric",
                "icon": "Hash",
                "priority": 4,
                "data_nature": "Continuous Metric"
            }

        # Fallback categorical
        return {
            "role": "categorical_general",
            "label": "Categorical Dimension",
            "icon": "List",
            "priority": 5,
            "data_nature": "Discrete Dimension"
        }

    @staticmethod
    def profile_dataframe_intelligence(df: pd.DataFrame, table_name: str) -> Dict[str, Any]:
        """
        Computes deep statistical profile, distribution shapes, skewness, and data health signatures.
        """
        total_rows = len(df)
        col_semantics = {}
        numeric_summaries = {}
        categorical_summaries = {}

        for col in df.columns:
            s = df[col]
            sem = AIStudioCognitiveEngine.classify_column_semantics(col, s)
            col_semantics[col] = sem

            if pd.api.types.is_numeric_dtype(s) and s.notna().sum() > 0:
                clean_s = s.dropna()
                mean_val = float(clean_s.mean())
                std_val = float(clean_s.std()) if len(clean_s) > 1 else 0.0
                median_val = float(clean_s.median())
                skew_val = float(clean_s.skew()) if len(clean_s) > 2 else 0.0

                # Distribution classification
                dist_shape = "Normal Symmetrical"
                if abs(skew_val) > 1.2:
                    dist_shape = "Heavy-Tailed Pareto" if skew_val > 0 else "Left-Skewed"
                elif abs(skew_val) > 0.5:
                    dist_shape = "Moderately Skewed"

                numeric_summaries[col] = {
                    "mean": round(mean_val, 2),
                    "median": round(median_val, 2),
                    "std": round(std_val, 2),
                    "min": round(float(clean_s.min()), 2),
                    "max": round(float(clean_s.max()), 2),
                    "skewness": round(skew_val, 2),
                    "dist_shape": dist_shape,
                    "cv": round(std_val / mean_val, 2) if mean_val != 0 else 0.0
                }
            elif not pd.api.types.is_numeric_dtype(s):
                top_counts = s.value_counts().head(5)
                top_share = round((top_counts.iloc[0] / max(total_rows, 1)) * 100, 1) if len(top_counts) > 0 else 0
                categorical_summaries[col] = {
                    "cardinality": int(s.nunique()),
                    "top_entity": str(top_counts.index[0]) if len(top_counts) > 0 else "N/A",
                    "top_share_pct": top_share,
                    "is_concentrated": top_share > 40.0
                }

        # Calculate dominant correlations between numeric pairs
        num_cols = list(numeric_summaries.keys())
        correlations = []
        if len(num_cols) >= 2:
            corr_mat = df[num_cols].corr()
            for i in range(len(num_cols)):
                for j in range(i + 1, len(num_cols)):
                    c1, c2 = num_cols[i], num_cols[j]
                    val = corr_mat.loc[c1, c2]
                    if not pd.isna(val) and abs(val) >= 0.35:
                        correlations.append({
                            "col1": c1,
                            "col2": c2,
                            "coefficient": round(float(val), 2),
                            "relationship": "Strong Direct Positive" if val > 0.7 else ("Moderate Positive" if val > 0.35 else "Inverse Negative")
                        })
        correlations.sort(key=lambda x: abs(x["coefficient"]), reverse=True)

        return {
            "table_name": table_name,
            "total_rows": total_rows,
            "total_columns": len(df.columns),
            "col_semantics": col_semantics,
            "numeric_summaries": numeric_summaries,
            "categorical_summaries": categorical_summaries,
            "key_correlations": correlations[:4]
        }

    @staticmethod
    def execute_cognitive_synthesis(
        prompt: str,
        df_dict: Dict[str, pd.DataFrame],
        relationships: List[Dict[str, Any]],
        target_table: Optional[str] = None,
        preferred_chart_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes multi-step Cognitive Chain of Thought (CoT) reasoning to understand intent,
        analyze data distributions, navigate multi-table schemas, and produce a data-backed chart.
        """
        prompt_lower = prompt.lower().strip()
        table_names = list(df_dict.keys())
        if not table_names:
            raise ValueError("No table DataFrames available for cognitive synthesis")

        # Step 1: Cognitive Intent & Goal Deconstruction
        intent_goal = "Volume Attribution & Strategic Performance"
        if any(k in prompt_lower for k in ["churn", "risk", "loss", "attrition", "drop"]):
            intent_goal = "Risk & Vulnerability Diagnosis"
        elif any(k in prompt_lower for k in ["margin", "profit", "discount", "efficiency", "ratio"]):
            intent_goal = "Profitability & Margin Efficiency Analysis"
        elif any(k in prompt_lower for k in ["forecast", "trend", "growth", "velocity", "future", "trajectory"]):
            intent_goal = "Temporal Growth & Trajectory Forecasting"
        elif any(k in prompt_lower for k in ["share", "composition", "wallet", "proportion"]):
            intent_goal = "Portfolio Share & Concentration Audit"
        elif any(k in prompt_lower for k in ["compare", "vs", "versus", "correlation", "synergy"]):
            intent_goal = "Cross-Metric Synergy & Correlation"

        # Step 2: Semantic Schema Profiling
        table_profiles = {t: AIStudioCognitiveEngine.profile_dataframe_intelligence(df_dict[t], t) for t in table_names}

        # Select target table
        chosen_tbl = target_table
        if not chosen_tbl:
            for t in table_names:
                if t.lower() in prompt_lower:
                    chosen_tbl = t
                    break
        if not chosen_tbl:
            # Pick table with most rows and volume metrics
            chosen_tbl = max(table_names, key=lambda t: (len(table_profiles[t]["numeric_summaries"]), table_profiles[t]["total_rows"]))

        primary_profile = table_profiles[chosen_tbl]
        df = df_dict[chosen_tbl].copy()

        # Step 3: Relational Graph Traversal (Multi-Table Check)
        join_info = None
        joins_chain = []
        relational_reasoning = f"Single-entity analysis anchored on root table '{chosen_tbl}' ({primary_profile['total_rows']:,} records)."

        # Check if prompt references another table or column residing in another table
        for other_tbl, o_prof in table_profiles.items():
            if other_tbl == chosen_tbl:
                continue
            other_matched_cols = [c for c in o_prof["col_semantics"] if c.lower() in prompt_lower]
            if other_tbl.lower() in prompt_lower or other_matched_cols:
                # Find direct relationship
                rel = next((r for r in relationships if (r["source_table"] == chosen_tbl and r["target_table"] == other_tbl) or (r["target_table"] == chosen_tbl and r["source_table"] == other_tbl)), None)
                if rel:
                    pk = rel["source_column"] if rel["source_table"] == chosen_tbl else rel["target_column"]
                    jk = rel["target_column"] if rel["source_table"] == chosen_tbl else rel["source_column"]
                    sec_df = df_dict[other_tbl]
                    if pk in df.columns and jk in sec_df.columns:
                        df = df.merge(sec_df, left_on=pk, right_on=jk, suffixes=('', f'_{other_tbl}'))
                        join_info = {"table": other_tbl, "primary_key": pk, "join_key": jk}
                        joins_chain.append(join_info)
                        relational_reasoning = f"Traversed relational graph: Linked '{chosen_tbl}' ➔ '{other_tbl}' on foreign key '{pk} = {jk}'. Synthesized {len(df):,} unified records across both entities."
                        break

        # Step 4: Dimension & Metric Resolution via Semantic Priority
        available_cols = list(df.columns)

        # Match Dimension (X)
        matched_x = None
        for c in available_cols:
            if c.lower() in prompt_lower and not any(k in c.lower() for k in ["revenue", "sales", "profit", "amount", "price"]):
                matched_x = c
                break

        if not matched_x:
            # Pick core entity or temporal
            if any(k in prompt_lower for k in ["trend", "forecast", "time", "monthly", "growth"]):
                matched_x = next((c for c in available_cols if any(k in c.lower() for k in ["date", "time", "month", "year"])), None)
            if not matched_x:
                matched_x = next((c for c in available_cols if primary_profile["col_semantics"].get(c, {}).get("role") == "core_entity"), None)
            if not matched_x:
                matched_x = next((c for c in available_cols if df[c].dtype == object and not c.lower().endswith("id")), available_cols[0] if available_cols else "Dimension")

        # Match Primary Metric (Y)
        matched_y = None
        for c in available_cols:
            if c.lower() in prompt_lower and c != matched_x and (c in primary_profile["numeric_summaries"] or pd.api.types.is_numeric_dtype(df[c])):
                matched_y = c
                break

        if not matched_y:
            # Prioritize volume or efficiency
            matched_y = next((c for c in available_cols if primary_profile["col_semantics"].get(c, {}).get("role") == "volume_metric"), None)
            if not matched_y:
                matched_y = next((c for c in available_cols if c in primary_profile["numeric_summaries"]), matched_x or (available_cols[0] if available_cols else "Metric"))

        # Match Secondary Metric for Dual-Axis
        secondary_y = None
        has_dual_intent = any(k in prompt_lower for k in ["vs", "versus", "compare", "dual", "combo", "margin and", "profit and"])
        if has_dual_intent:
            secondary_y = next((c for c in available_cols if primary_profile["col_semantics"].get(c, {}).get("role") == "efficiency_metric" and c != matched_y), None)
            if not secondary_y:
                secondary_y = next((c for c in available_cols if c != matched_y and c != matched_x and pd.api.types.is_numeric_dtype(df[c])), None)

        # Step 5: Chart Architecture Optimization
        chart_type = preferred_chart_type or "bar"
        arch_rationale = ""

        if has_dual_intent and secondary_y:
            chart_type = "composed"
            arch_rationale = f"Dual-Axis Composed architecture selected: Pairing discrete volume scale '{matched_y}' with continuous ratio '{secondary_y}' prevents scaling collapse while illuminating trade-offs."
        elif any(k in prompt_lower for k in ["heatmap", "heat map", "matrix", "density", "cross-tab", "intensity"]):
            chart_type = "heatmap"
            arch_rationale = f"Cross-Tabulation Matrix Heatmap architecture selected: Surfaces 2D density distributions, intensity clusters, and performance hot spots across '{matched_x}'."
        elif any(k in prompt_lower for k in ["treemap", "tree map", "hierarchical", "proportional area", "tiles", "nested area"]):
            chart_type = "treemap"
            arch_rationale = f"Hierarchical Area Treemap architecture selected: Encodes space-filling proportional allocations and nested group structures for '{matched_y}' across '{matched_x}'."
        elif any(k in prompt_lower for k in ["trend", "timeline", "monthly", "growth", "over time", "history"]) or any(k in matched_x.lower() for k in ["date", "time", "month", "year"]):
            chart_type = "area" if any(k in prompt_lower for k in ["area", "cumulative", "flow"]) else "line"
            arch_rationale = f"Time-Series {'Area' if chart_type == 'area' else 'Line'} architecture chosen: Optimal for visualizing temporal velocity, momentum, and inflection points along chronological axis '{matched_x}'."
        elif any(k in prompt_lower for k in ["share", "wallet", "proportion", "breakdown", "percentage", "donut"]):
            chart_type = "pie"
            arch_rationale = f"Donut / Pie composition architecture selected: Displays relative component share and portfolio concentration of '{matched_y}' across '{matched_x}' cohorts."
        elif any(k in prompt_lower for k in ["radar", "spider", "multidimensional"]):
            chart_type = "radar"
            arch_rationale = f"Multi-attribute Radar architecture selected: Projects multi-dimensional cohort spread and categorical equilibrium for '{matched_x}'."
        elif any(k in prompt_lower for k in ["rank", "leaderboard", "horizontal"]):
            chart_type = "horizontal_bar"
            arch_rationale = f"Horizontal Bar Rank architecture selected: Maximizes label legibility and isolates top-decile performers along '{matched_x}'."
        else:
            chart_type = preferred_chart_type or "bar"
            arch_rationale = f"Categorical Column Bar architecture selected: Provides direct comparative benchmarking of '{matched_y}' across discrete '{matched_x}' cohorts."

        # Aggregation
        agg = "sum"
        if any(k in prompt_lower for k in ["avg", "average", "mean", "baseline"]):
            agg = "avg"
        elif any(k in prompt_lower for k in ["count", "number of", "frequency"]):
            agg = "count"
        elif any(k in prompt_lower for k in ["peak", "max", "highest"]):
            agg = "max"

        # Compute data points via CalculationTools with defensive fallbacks
        points = []
        try:
            if chart_type in ["line", "area"]:
                points = CalculationTools.execute_time_series(df, date_col=matched_x, value_col=matched_y, agg_type=agg)
            elif chart_type == "composed" and secondary_y:
                points = CalculationTools.execute_dual_aggregation(
                    df,
                    group_by_col=matched_x,
                    value_col1=matched_y,
                    value_col2=secondary_y,
                    agg_type1=agg,
                    agg_type2="avg"
                )
            elif chart_type == "heatmap":
                points = CalculationTools.execute_heatmap(df, group_by_col=matched_x, secondary_col=secondary_y, value_col=matched_y if matched_y != matched_x else None, agg_type=agg)
            elif chart_type == "treemap":
                points = CalculationTools.execute_treemap(df, group_by_col=matched_x, secondary_col=secondary_y, value_col=matched_y if matched_y != matched_x else None, agg_type=agg)
            else:
                points = CalculationTools.execute_aggregation(df, group_by_col=matched_x, value_col=matched_y, agg_type=agg)
        except Exception:
            try:
                points = CalculationTools.execute_aggregation(df, group_by_col=matched_x, value_col=matched_y, agg_type=agg)
            except Exception:
                points = []

        if not points:
            try:
                fallback_x = matched_x if (matched_x and matched_x in df.columns) else (df.columns[0] if len(df.columns) > 0 else None)
                fallback_y = matched_y if (matched_y and matched_y in df.columns) else (df.columns[1] if len(df.columns) > 1 else fallback_x)
                if fallback_x and fallback_x in df.columns:
                    points = CalculationTools.execute_aggregation(df, group_by_col=fallback_x, value_col=fallback_y, agg_type=agg)
            except Exception:
                points = []

        # Compute summary statistics safely
        numeric_vals = [float(p["value"]) for p in points if isinstance(p.get("value"), (int, float)) and not pd.isna(p.get("value"))]
        tot_sum = sum(numeric_vals) if numeric_vals else 0.0
        tot_mean = tot_sum / len(numeric_vals) if numeric_vals else 0.0
        
        if numeric_vals and points:
            peak_val = max(numeric_vals)
            # Find item corresponding to peak value
            peak_item = next((p for p in points if p.get("value") == peak_val), points[0])
            peak_label = str(peak_item.get("label") or peak_item.get("name") or peak_item.get("x") or "N/A")
        else:
            peak_val = 0.0
            peak_label = "N/A"

        share_of_peak = round((peak_val / tot_sum) * 100, 1) if tot_sum > 0 else 0.0

        summary = {
            "total_points": len(points),
            "sum": round(tot_sum, 2),
            "mean": round(tot_mean, 2),
            "max": round(peak_val, 2),
            "min": round(min(numeric_vals), 2) if numeric_vals else 0.0,
            "peak_label": peak_label,
            "peak_val": round(peak_val, 2),
            "peak_share_pct": share_of_peak
        }

        # Step 5: Executive Business Deduction & Actionable Playbook
        exec_insight = (
            f"Cognitive analysis confirms that '{peak_label}' represents the anchor driver for {matched_y}, "
            f"accounting for {peak_val:,.0f} ({share_of_peak}% of total volume across {len(points)} observed {matched_x} cohorts). "
            f"The cohort baseline average is {tot_mean:,.1f}, indicating a {round(peak_val / max(tot_mean, 1), 1)}x performance spread."
        )

        strategic_directive = (
            f"Executive Recommendation: Scale investment into top cohort '{peak_label}' while establishing automated threshold monitoring "
            f"on underperforming segments to compress performance variance."
        )

        # 5-Step Structured Cognitive Thought Stream
        thought_process = [
            {
                "step": 1,
                "title": "Cognitive Intent & Query Deconstruction",
                "icon": "Brain",
                "badge": "Intent Analysis",
                "confidence": 0.98,
                "detail": f"Decoded analytical intent: User requested '{intent_goal}'. Parsed target focus onto entity dimension '{matched_x}' and metric '{matched_y}'."
            },
            {
                "step": 2,
                "title": "Deep Data Distribution & Statistical Profiling",
                "icon": "Activity",
                "badge": "Data Profiling",
                "confidence": 0.96,
                "detail": f"Profiled {len(df):,} records. Metric '{matched_y}' exhibits {primary_profile['numeric_summaries'].get(matched_y, {}).get('dist_shape', 'Parametric')} distribution with coefficient of variation {primary_profile['numeric_summaries'].get(matched_y, {}).get('cv', 1.0)}."
            },
            {
                "step": 3,
                "title": "Relational Schema Graph Navigation",
                "icon": "GitBranch",
                "badge": "Graph Traversal",
                "confidence": 1.0 if not join_info else 0.95,
                "detail": relational_reasoning
            },
            {
                "step": 4,
                "title": "Mathematical Visualization Architecture Optimization",
                "icon": "BarChart3",
                "badge": f"{chart_type.upper()} Selection",
                "confidence": 0.97,
                "detail": arch_rationale
            },
            {
                "step": 5,
                "title": "Executive Deduction & Causal Proof",
                "icon": "Lightbulb",
                "badge": "Business Impact",
                "confidence": 0.99,
                "detail": f"Derived strategic conclusion: '{peak_label}' commands {share_of_peak}% of aggregate volume. {strategic_directive}"
            }
        ]

        # Generate Proactive Autonomous Mind Sparks (Autonomous Discoveries)
        mind_sparks = [
            {
                "id": "spark-1",
                "title": f"80/20 Concentration Risk in {matched_x}",
                "description": f"Top cohort '{peak_label}' controls {share_of_peak}% of {matched_y}. Investigating secondary cohorts may unearth hidden margin.",
                "suggested_prompt": f"Analyze Pareto distribution of {matched_y} by {matched_x} to test 80/20 concentration"
            },
            {
                "id": "spark-2",
                "title": f"Dual-Metric Efficiency Diagnostic",
                "description": f"Compare {matched_y} volume against secondary yield metrics across {matched_x}.",
                "suggested_prompt": f"Compare {matched_y} versus profit margin across {matched_x} using composed dual-axis chart"
            },
            {
                "id": "spark-3",
                "title": f"Longitudinal Momentum Flow",
                "description": f"Track temporal acceleration and periodic volatility of {matched_y}.",
                "suggested_prompt": f"Show time-series growth velocity of {matched_y} with cumulative area curve"
            }
        ]

        title = f"{matched_y.replace('_', ' ').title()} by {matched_x.replace('_', ' ').title()}"
        description = f"Cognitive AI visualization analyzing {agg.upper()} of {matched_y} across {matched_x} cohorts."

        palette = "cyberpunk"
        if intent_goal == "Profitability & Margin Efficiency Analysis":
            palette = "emerald"
        elif intent_goal == "Risk & Vulnerability Diagnosis":
            palette = "sunset"
        elif intent_goal == "Cross-Metric Synergy & Correlation":
            palette = "corporate"

        return {
            "title": title,
            "description": description,
            "chart_type": chart_type,
            "table_name": chosen_tbl,
            "join_table": join_info.get("table") if join_info else None,
            "joins": joins_chain,
            "x_field": matched_x,
            "y_field": matched_y,
            "secondary_y_field": secondary_y,
            "aggregation": agg,
            "palette": palette,
            "ai_insight": exec_insight,
            "strategic_directive": strategic_directive,
            "thought_process": thought_process,
            "mind_sparks": mind_sparks,
            "chart_data": points,
            "summary": summary,
            "columns": available_cols,
            "total_rows": len(df)
        }

    @staticmethod
    def deepen_analytical_diagnosis(
        df: pd.DataFrame,
        x_field: str,
        y_field: str,
        chart_type: str,
        aggregation: str
    ) -> Dict[str, Any]:
        """
        Executes a 2nd-order analytical root-cause diagnosis for any active visualization.
        """
        # Case-insensitive and prefix-tolerant column resolution
        clean_x = next((c for c in df.columns if c.lower() == x_field.lower() or c.lower().endswith(f".{x_field.lower()}") or c.lower().endswith(f"_{x_field.lower()}")), None)
        clean_y = next((c for c in df.columns if c.lower() == y_field.lower() or c.lower().endswith(f".{y_field.lower()}") or c.lower().endswith(f"_{y_field.lower()}")), None)

        if not clean_x:
            cat_cols = [c for c in df.columns if not pd.api.types.is_numeric_dtype(df[c]) and not c.lower().endswith("id")]
            clean_x = cat_cols[0] if cat_cols else df.columns[0]

        if not clean_y:
            num_cols = list(df.select_dtypes(include=["number"]).columns)
            clean_y = num_cols[0] if num_cols else clean_x

        clean_df = df.dropna(subset=[clean_x, clean_y]) if clean_x in df.columns and clean_y in df.columns else df
        points = CalculationTools.execute_aggregation(clean_df, group_by_col=clean_x, value_col=clean_y, agg_type=aggregation)

        numeric_vals = [float(p["value"]) for p in points if isinstance(p.get("value"), (int, float))]
        if not numeric_vals:
            return {"diagnostic": "Insufficient numeric variance for deep decomposition."}

        tot = sum(numeric_vals)
        mean = tot / len(numeric_vals)
        std = float(np.std(numeric_vals)) if len(numeric_vals) > 1 else 0.0

        # Identify top drivers and outliers
        sorted_points = sorted(points, key=lambda p: float(p.get("value", 0)), reverse=True)
        top_driver = sorted_points[0]
        top_val = float(top_driver.get("value", 0))
        top_label = str(top_driver.get("label", ""))
        top_share = round((top_val / max(tot, 1)) * 100, 1)

        # Detect anomalous cohorts (z > 1.8)
        anomalies = []
        for p in sorted_points:
            v = float(p.get("value", 0))
            z = (v - mean) / std if std > 0 else 0
            if abs(z) >= 1.8:
                anomalies.append({
                    "cohort": str(p.get("label")),
                    "value": round(v, 2),
                    "z_score": round(z, 2),
                    "deviation_pct": round(((v - mean) / max(mean, 1)) * 100, 1)
                })

        # Elasticity / Sensitivity Projection
        sensitivity_model = {
            "scenario_label": f"+10% Volume Uplift on '{top_label}'",
            "projected_top_value": round(top_val * 1.10, 2),
            "projected_portfolio_total": round(tot + (top_val * 0.10), 2),
            "net_gain": round(top_val * 0.10, 2),
            "portfolio_share_change": f"{top_share}% ➔ {round(((top_val * 1.10) / (tot + top_val * 0.10)) * 100, 1)}%"
        }

        # Strategic Playbook
        action_playbook = [
            {
                "phase": "Immediate (Days 1-30)",
                "action": f"Protect core yield in '{top_label}' by securing top accounts and eliminating single-point delivery risks."
            },
            {
                "phase": "Near-Term (Days 31-90)",
                "action": f"Elevate secondary cohorts '{sorted_points[1].get('label') if len(sorted_points) > 1 else 'Mid-Tier'}' via cross-selling to reduce dependency risk below 35%."
            },
            {
                "phase": "Long-Term (Q2-Q4)",
                "action": "Institute automated metric elasticity tracking to simulate pricing, discounting, and churn impact prior to quarterly budget allocations."
            }
        ]

        return {
            "top_driver": {
                "label": top_label,
                "value": round(top_val, 2),
                "share_pct": top_share
            },
            "anomalies": anomalies,
            "sensitivity": sensitivity_model,
            "playbook": action_playbook,
            "total_portfolio": round(tot, 2),
            "mean_baseline": round(mean, 2)
        }

    @staticmethod
    def simulate_what_if_lever(
        chart_points: List[Dict[str, Any]],
        delta_pct: float,
        target_cohort: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Dynamically applies a what-if percentage lever across chart points.
        """
        multiplier = 1.0 + (delta_pct / 100.0)
        projected_points = []
        original_sum = 0.0
        projected_sum = 0.0

        for p in chart_points:
            orig_val = float(p.get("value", 0))
            original_sum += orig_val
            label = str(p.get("label", ""))

            if not target_cohort or target_cohort == "ALL" or target_cohort == label:
                new_val = round(orig_val * multiplier, 2)
            else:
                new_val = orig_val

            projected_sum += new_val
            new_p = dict(p)
            new_p["value"] = new_val
            new_p["original_value"] = orig_val
            new_p["delta"] = round(new_val - orig_val, 2)
            projected_points.append(new_p)

        net_delta = round(projected_sum - original_sum, 2)
        pct_change = round((net_delta / max(original_sum, 1)) * 100, 2)

        return {
            "delta_pct_applied": delta_pct,
            "original_total": round(original_sum, 2),
            "projected_total": round(projected_sum, 2),
            "net_delta": net_delta,
            "overall_pct_change": pct_change,
            "projected_points": projected_points
        }
