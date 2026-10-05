import uuid
import re
import math
import logging
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
from app.services.llm_orchestrator import LLMOrchestrator

logger = logging.getLogger("datova.ai_business_chart")


class AIBusinessChartService:
    """
    Intelligent AI service that generates executive-grade, domain-specific business charts.
    Calculates verified Pandas aggregations (Pareto 80/20, growth velocity, value tiering,
    unit economics, risk exposure) and equips each chart with strategic business takeaways.
    """

    @staticmethod
    def _clean_numeric_cols(df: pd.DataFrame) -> List[str]:
        num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        return [
            c for c in num_cols
            if not any(k in c.lower() for k in ["_id", "id_", "code", "index", "row_num", "uuid"])
            and not (c.lower().endswith("id") and len(c) <= 6)
        ]

    @staticmethod
    def _clean_categorical_cols(df: pd.DataFrame) -> List[str]:
        cat_cols = df.select_dtypes(include=["object", "category", "string"]).columns.tolist()
        return [
            c for c in cat_cols
            if 2 <= df[c].nunique() <= 50
            and not any(k in c.lower() for k in ["_id", "id_", "uuid", "guid", "hash", "url", "email", "address", "phone"])
        ]

    @staticmethod
    def _find_date_col(df: pd.DataFrame) -> Optional[str]:
        for col in df.columns:
            if any(k in col.lower() for k in ["date", "time", "timestamp", "year", "month", "day", "created_at"]):
                try:
                    pd.to_datetime(df[col].dropna().head(10))
                    return col
                except Exception:
                    continue
        return None

    @classmethod
    def get_best_dataframe(cls, dataframes: Dict[str, pd.DataFrame]) -> pd.DataFrame:
        """
        Finds the richest transactional/fact dataframe among uploaded tables,
        and enriches it by joining dimension tables on shared ID keys (e.g. products, categories, orders).
        """
        if not dataframes:
            return pd.DataFrame()
        if len(dataframes) == 1:
            return next(iter(dataframes.values()))

        # Score all tables to find the best primary anchor table
        fact_keywords = ["order_item", "order", "item", "trans", "sale", "payment", "revenue", "invoice", "fact", "event", "log", "employee"]
        candidates = []
        for name, df in dataframes.items():
            if df.empty:
                continue
            nums = cls._clean_numeric_cols(df)
            cats = cls._clean_categorical_cols(df)
            dates = cls._find_date_col(df)
            is_fact = any(k in name.lower() for k in fact_keywords)
            score = (len(nums) * 6) + (len(cats) * 3) + (10 if dates else 0) + (15 if is_fact else 0) + min(len(df), 5000) / 500
            candidates.append((score, name, df))

        if not candidates:
            return next(iter(dataframes.values()))

        candidates.sort(key=lambda x: x[0], reverse=True)
        best_name, base_df = candidates[0][1], candidates[0][2]
        # Use head sample if huge to ensure responsive generation
        out_df = base_df.head(50000).copy() if len(base_df) > 50000 else base_df.copy()

        # If order_items has qty and price, create total_amount
        if "qty" in out_df.columns and "price" in out_df.columns and "total_amount" not in out_df.columns:
            out_df["total_amount"] = out_df["qty"] * out_df["price"]
        elif "quantity" in out_df.columns and "unit_price" in out_df.columns and "total_amount" not in out_df.columns:
            out_df["total_amount"] = out_df["quantity"] * out_df["unit_price"]

        # Iteratively enrich with dimension tables on foreign keys
        for name, other_df in dataframes.items():
            if name == best_name or other_df.empty:
                continue
            shared_id_cols = [c for c in out_df.columns if c in other_df.columns and (c.lower().endswith("id") or c.lower().endswith("code"))]
            if shared_id_cols:
                key = shared_id_cols[0]
                desc_cols = [c for c in other_df.columns if c != key and not (c.lower().endswith("id") or c.lower().endswith("code"))]
                if desc_cols:
                    try:
                        dim_sample = other_df[[key] + desc_cols].drop_duplicates(subset=[key])
                        out_df = out_df.merge(dim_sample, on=key, how="left")
                    except Exception:
                        pass

        # If still no numeric columns, check if another table has them
        if not cls._clean_numeric_cols(out_df):
            for name, df in dataframes.items():
                if cls._clean_numeric_cols(df):
                    return df

        return out_df

    @classmethod
    def generate_pareto_driver_chart(
        cls,
        df: pd.DataFrame,
        cat_col: Optional[str] = None,
        num_col: Optional[str] = None,
        domain: str = "Business Intelligence"
    ) -> Optional[Dict[str, Any]]:
        """
        Builds a Pareto 80/20 Driver Concentration Chart showing which business segments
        drive the majority of revenue, activity, or volume.
        """
        if df.empty:
            return None

        num_cols = cls._clean_numeric_cols(df)
        cat_cols = cls._clean_categorical_cols(df)

        if not cat_cols:
            return None

        cat = cat_col if (cat_col and cat_col in df.columns) else cat_cols[0]
        num = num_col if (num_col and num_col in df.columns) else (num_cols[0] if num_cols else None)

        if num:
            grouped = df.groupby(cat)[num].sum().reset_index()
            val_col = num
        else:
            grouped = df.groupby(cat).size().reset_index(name="count")
            val_col = "count"

        grouped = grouped.sort_values(by=val_col, ascending=False).head(8)
        total_sum = grouped[val_col].sum()

        if total_sum <= 0:
            return None

        data = []
        running_sum = 0.0
        for _, r in grouped.iterrows():
            v = float(r[val_col]) if not pd.isna(r[val_col]) else 0.0
            share = round((v / total_sum) * 100, 1)
            running_sum += v
            cum_share = round((running_sum / total_sum) * 100, 1)
            data.append({
                "label": str(r[cat]),
                "value": round(v, 2),
                "share_pct": share,
                "cumulative_share": cum_share
            })

        if not data:
            return None

        top_leader = data[0]["label"]
        top_share = data[0]["share_pct"]
        top_3_share = sum(d["share_pct"] for d in data[:3])
        metric_name = val_col.replace("_", " ").title()
        dim_name = cat.replace("_", " ").title()

        return {
            "id": f"chart_pareto_{uuid.uuid4().hex[:8]}",
            "title": f"Pareto Driver Concentration: {metric_name} by {dim_name}",
            "subtitle": f"Top segment contribution & cumulative share across {len(data)} key categories",
            "chart_type": "bar",
            "x_field": cat,
            "y_field": val_col,
            "data": data,
            "metric_highlight": f"Top 3: {top_3_share:.1f}% Share",
            "insight": {
                "headline": f"Driver Concentration: '{top_leader}' Commands {top_share}% of Total {metric_name}",
                "description": f"The top 3 segments generate {top_3_share:.1f}% of aggregate volume. Leader '{top_leader}' alone accounts for {top_share}%, demonstrating significant commercial concentration.",
                "impact": f"Prioritize strategic retention and quality assurances on top {dim_name} segments while diversifying secondary channels to mitigate portfolio concentration risk.",
                "severity": "high" if top_share > 40 else "positive"
            }
        }

    @classmethod
    def generate_growth_velocity_chart(
        cls,
        df: pd.DataFrame,
        date_col: Optional[str] = None,
        num_col: Optional[str] = None,
        domain: str = "Business Intelligence"
    ) -> Optional[Dict[str, Any]]:
        """
        Builds a Longitudinal Growth Velocity & Run-rate Trajectory Chart showing period-over-period
        pacing, velocity changes, and run-rate baseline.
        """
        if df.empty:
            return None

        date = date_col if (date_col and date_col in df.columns) else cls._find_date_col(df)
        if not date:
            return None

        num_cols = cls._clean_numeric_cols(df)
        num = num_col if (num_col and num_col in df.columns) else (num_cols[0] if num_cols else None)

        temp_df = df.copy()
        temp_df["_parsed_date"] = pd.to_datetime(temp_df[date], errors="coerce")
        temp_df = temp_df.dropna(subset=["_parsed_date"])
        if temp_df.empty:
            return None

        span_days = (temp_df["_parsed_date"].max() - temp_df["_parsed_date"].min()).days
        if span_days > 730:
            temp_df["_period"] = temp_df["_parsed_date"].dt.strftime("%Y")
            period_label = "Year"
        elif span_days > 60:
            temp_df["_period"] = temp_df["_parsed_date"].dt.strftime("%b %Y")
            period_label = "Month"
        else:
            temp_df["_period"] = temp_df["_parsed_date"].dt.strftime("%Y-%m-%d")
            period_label = "Period"

        if num:
            grouped = temp_df.groupby(["_period"], sort=False)[num].sum().reset_index()
            val_col = num
        else:
            grouped = temp_df.groupby(["_period"], sort=False).size().reset_index(name="count")
            val_col = "count"

        # Keep chronological order up to last 12 periods
        grouped = grouped.tail(12)
        if len(grouped) < 2:
            return None

        data = []
        for _, r in grouped.iterrows():
            v = float(r[val_col]) if not pd.isna(r[val_col]) else 0.0
            data.append({"label": str(r["_period"]), "value": round(v, 2)})

        first_val = data[0]["value"]
        last_val = data[-1]["value"]
        pct_change = round(((last_val - first_val) / max(first_val, 1)) * 100, 1)
        peak = max(data, key=lambda d: d["value"])
        avg_val = sum(d["value"] for d in data) / len(data)
        metric_name = val_col.replace("_", " ").title()

        return {
            "id": f"chart_velocity_{uuid.uuid4().hex[:8]}",
            "title": f"Growth Velocity & Run-Rate Trajectory ({period_label}-over-{period_label})",
            "subtitle": f"Longitudinal trendline for {metric_name} based on '{date}'",
            "chart_type": "line",
            "x_field": date,
            "y_field": val_col,
            "data": data,
            "metric_highlight": f"{pct_change:+}% Trajectory",
            "insight": {
                "headline": f"Operational Momentum: {pct_change:+}% Shift Across Tracked Intervals",
                "description": f"Performance moved from {first_val:,.1f} to {last_val:,.1f}, reaching peak volume of {peak['value']:,.1f} in {peak['label']}. Average periodic velocity is {avg_val:,.1f}.",
                "impact": f"Enables reliable run-rate forecasting and capacity alignment for forthcoming {period_label.lower()} cycles.",
                "severity": "positive" if pct_change >= 0 else "high"
            }
        }

    @classmethod
    def generate_tier_segmentation_chart(
        cls,
        df: pd.DataFrame,
        num_col: Optional[str] = None,
        domain: str = "Business Intelligence"
    ) -> Optional[Dict[str, Any]]:
        """
        Builds a Value Tier & Cohort Performance Distribution Chart segmenting records into
        High-Tier (VIP/Top 25%), Core Performance, and Standard/Long-Tail tiers.
        """
        if df.empty:
            return None

        num_cols = cls._clean_numeric_cols(df)
        num = num_col if (num_col and num_col in df.columns) else (num_cols[0] if num_cols else None)

        if not num:
            return None

        series = df[num].dropna()
        if len(series) < 6:
            return None

        q75 = float(series.quantile(0.75))
        q25 = float(series.quantile(0.25))

        tier_high = series[series >= q75]
        tier_mid = series[(series >= q25) & (series < q75)]
        tier_standard = series[series < q25]

        total_sum = float(series.sum()) if series.sum() > 0 else 1.0
        data = [
            {
                "label": f"High-Value Tier (Top 25% ≥ {q75:,.0f})",
                "value": round(float(tier_high.sum()), 2),
                "count": int(len(tier_high)),
                "share_pct": round((float(tier_high.sum()) / total_sum) * 100, 1),
                "avg_ticket": round(float(tier_high.mean()), 2) if len(tier_high) else 0.0
            },
            {
                "label": f"Core Mid-Tier ({q25:,.0f} - {q75:,.0f})",
                "value": round(float(tier_mid.sum()), 2),
                "count": int(len(tier_mid)),
                "share_pct": round((float(tier_mid.sum()) / total_sum) * 100, 1),
                "avg_ticket": round(float(tier_mid.mean()), 2) if len(tier_mid) else 0.0
            },
            {
                "label": f"Standard Tier (< {q25:,.0f})",
                "value": round(float(tier_standard.sum()), 2),
                "count": int(len(tier_standard)),
                "share_pct": round((float(tier_standard.sum()) / total_sum) * 100, 1),
                "avg_ticket": round(float(tier_standard.mean()), 2) if len(tier_standard) else 0.0
            },
        ]

        high_share = data[0]["share_pct"]
        metric_name = num.replace("_", " ").title()

        return {
            "id": f"chart_tiers_{uuid.uuid4().hex[:8]}",
            "title": f"Value Tier Distribution: '{metric_name}' Cohorts",
            "subtitle": f"Segmentation into High, Mid, and Standard performance tiers across {len(series):,} records",
            "chart_type": "bar",
            "data": data,
            "metric_highlight": f"Tier 1: {high_share}% Volume",
            "insight": {
                "headline": f"Tier Asymmetry: High-Value Cohort Generates {high_share}% of {metric_name}",
                "description": f"The top quartile ({len(tier_high):,} observations) captures {high_share}% of total value with an average ticket of {data[0]['avg_ticket']:,.2f}, compared to {data[2]['avg_ticket']:,.2f} in the standard tier.",
                "impact": "Establish differentiated account tiers and premium service levels to protect and upsell high-value contributors.",
                "severity": "positive" if high_share < 60 else "high"
            }
        }

    @classmethod
    def generate_efficiency_matrix_chart(
        cls,
        df: pd.DataFrame,
        domain: str = "Business Intelligence"
    ) -> Optional[Dict[str, Any]]:
        """
        Builds an Operational Efficiency & Unit Economics Chart comparing average output per entity.
        """
        if df.empty:
            return None

        cat_cols = cls._clean_categorical_cols(df)
        num_cols = cls._clean_numeric_cols(df)

        if not cat_cols or not num_cols:
            return None

        cat = cat_cols[0]
        num = num_cols[0]

        grouped = df.groupby(cat)[num].agg(["mean", "count"]).reset_index()
        # Filter segments with at least 1 record
        grouped = grouped[grouped["count"] >= 1].sort_values(by="mean", ascending=False).head(7)

        if grouped.empty:
            return None

        overall_mean = float(df[num].mean())
        data = []
        for _, r in grouped.iterrows():
            avg_v = float(r["mean"])
            variance_pct = round(((avg_v - overall_mean) / max(overall_mean, 1)) * 100, 1)
            data.append({
                "label": str(r[cat]),
                "value": round(avg_v, 2),
                "count": int(r["count"]),
                "variance_pct": variance_pct
            })

        best = data[0]
        dim_name = cat.replace("_", " ").title()
        metric_name = num.replace("_", " ").title()

        return {
            "id": f"chart_efficiency_{uuid.uuid4().hex[:8]}",
            "title": f"Operational Unit Economics: Avg {metric_name} by {dim_name}",
            "subtitle": f"Benchmarking segment productivity against dataset benchmark of {overall_mean:,.2f}",
            "chart_type": "bar",
            "data": data,
            "metric_highlight": f"{best['label']}: +{best['variance_pct']}% vs Avg",
            "insight": {
                "headline": f"Unit Efficiency Leader: '{best['label']}' Outperforms Benchmark by {best['variance_pct']}%",
                "description": f"Average {metric_name} across '{best['label']}' is {best['value']:,.2f}, surpassing the aggregate average of {overall_mean:,.2f}. Trailing tiers require operational workflow tuning.",
                "impact": "Examine operational best practices in high-efficiency segments to replicate workflows across lower-performing tiers.",
                "severity": "positive"
            }
        }

    @classmethod
    def generate_recommendation_impact_chart(
        cls,
        insights: List[Dict[str, Any]],
        domain: str = "Business Intelligence"
    ) -> Optional[Dict[str, Any]]:
        """
        Builds a Strategic Value Realization & Prioritized ROI Potential Chart from insights.
        """
        recs = [ins for ins in insights if ins.get("recommendation")]
        if not recs:
            return None

        severity_scores = {"critical": 95, "high": 85, "medium": 65, "low": 45, "positive": 75}
        data = []
        for idx, ins in enumerate(recs[:5]):
            rec_text = ins.get("recommendation", "")
            short_label = rec_text[:28] + ("..." if len(rec_text) > 28 else "")
            sev = ins.get("severity", "medium").lower()
            score = severity_scores.get(sev, 60)
            data.append({
                "label": f"Action {idx+1}: {short_label}",
                "value": score,
                "full_action": rec_text,
                "urgency": sev.upper()
            })

        return {
            "id": f"chart_actions_{uuid.uuid4().hex[:8]}",
            "title": "Strategic Implementation Impact Matrix",
            "subtitle": "Prioritized execution sequence ranked by business value and urgency",
            "chart_type": "bar",
            "data": data,
            "metric_highlight": f"{len(data)} High-Value Directives",
            "insight": {
                "headline": "Prioritized Implementation Pipeline: Focus on Critical Impact Actions",
                "description": f"Targeting Action 1 provides the highest immediate operational leverage for {domain}. Actions are prioritized by urgency score.",
                "impact": "Execute recommendations in order of impact score to maximize return on invested capital and operational time.",
                "severity": "positive"
            }
        }

    @classmethod
    async def synthesize_charts_for_dataset(
        cls,
        dataset_name: str,
        domain: str,
        dataframes: Dict[str, pd.DataFrame],
        kpis: List[Dict[str, Any]],
        insights: List[Dict[str, Any]],
        anomalies: List[Dict[str, Any]],
        prompt: Optional[str] = None,
        count: int = 4
    ) -> List[Dict[str, Any]]:
        """
        Synthesizes a curated collection of meaningful executive business charts for any dataset.
        Combines deterministic quantitative rigor with optional LLM prompt interpretation.
        """
        if not dataframes:
            return []

        df = cls.get_best_dataframe(dataframes)
        if df.empty:
            return []
        primary_name = "unified_store"

        # If user supplied a specific business prompt, attempt AI synthesis
        if prompt and prompt.strip():
            ai_chart = await cls._synthesize_custom_prompt_chart(df, primary_name, prompt.strip(), domain)
            if ai_chart:
                # Also include 2-3 core contextual charts
                suite = [ai_chart]
                pareto = cls.generate_pareto_driver_chart(df, domain=domain)
                if pareto: suite.append(pareto)
                velocity = cls.generate_growth_velocity_chart(df, domain=domain)
                if velocity: suite.append(velocity)
                return suite[:count]

        # Standard comprehensive business chart suite
        charts = []
        
        # 1. Pareto Driver Concentration (80/20)
        pareto = cls.generate_pareto_driver_chart(df, domain=domain)
        if pareto:
            charts.append(pareto)

        # 2. Longitudinal Velocity / Trajectory
        velocity = cls.generate_growth_velocity_chart(df, domain=domain)
        if velocity:
            charts.append(velocity)

        # 3. Value Tier / Cohort Distribution
        tiers = cls.generate_tier_segmentation_chart(df, domain=domain)
        if tiers:
            charts.append(tiers)

        # 4. Operational Unit Economics / Efficiency
        efficiency = cls.generate_efficiency_matrix_chart(df, domain=domain)
        if efficiency:
            charts.append(efficiency)

        # 5. Recommendation Action Impact
        actions = cls.generate_recommendation_impact_chart(insights, domain=domain)
        if actions:
            charts.append(actions)

        return charts[:count]

    @classmethod
    async def _synthesize_custom_prompt_chart(
        cls,
        df: pd.DataFrame,
        table_name: str,
        user_prompt: str,
        domain: str
    ) -> Optional[Dict[str, Any]]:
        """
        Uses LLM reasoning to map an executive business prompt into an aggregated chart.
        """
        cols = list(df.columns)
        num_cols = cls._clean_numeric_cols(df)
        cat_cols = cls._clean_categorical_cols(df)
        date_col = cls._find_date_col(df)

        system = (
            "You are Datova's Principal Business Intelligence Visualizer. "
            "Given dataset columns and a business question, pick the best dimension, measure, aggregation type (sum, mean, count), "
            "and chart type (bar, line, pie) to generate a high-impact business chart. "
            "Respond in valid JSON only with keys: dimension_col, measure_col, agg_func, chart_type, title, subtitle, takeaway."
        )

        user_content = (
            f"Dataset columns: {cols}\n"
            f"Numerical: {num_cols}\n"
            f"Categorical: {cat_cols}\n"
            f"Date column: {date_col}\n"
            f"Domain: {domain}\n"
            f"User Prompt: '{user_prompt}'\n"
            "Return JSON matching keys: dimension_col, measure_col, agg_func, chart_type, title, subtitle, takeaway."
        )

        try:
            raw = await LLMOrchestrator.query_llm(system, user_content, response_format_json=True)
            cleaned = LLMOrchestrator._clean_llm_json(raw)
            import json
            plan = json.loads(cleaned)

            dim = plan.get("dimension_col")
            meas = plan.get("measure_col")
            agg = plan.get("agg_func", "sum").lower()
            ch_type = plan.get("chart_type", "bar").lower()
            title = plan.get("title", f"Custom Business Analysis: {user_prompt[:30]}")
            subtitle = plan.get("subtitle", f"Aggregated analysis based on '{table_name}'")
            takeaway = plan.get("takeaway", "Empirical aggregation based on business prompt.")

            if not dim or dim not in df.columns:
                dim = cat_cols[0] if cat_cols else (date_col or cols[0])
            if meas and meas not in df.columns:
                meas = num_cols[0] if num_cols else None

            if meas:
                if agg == "mean":
                    grouped = df.groupby(dim)[meas].mean().reset_index()
                elif agg == "count":
                    grouped = df.groupby(dim).size().reset_index(name="count")
                    meas = "count"
                else:
                    grouped = df.groupby(dim)[meas].sum().reset_index()
            else:
                grouped = df.groupby(dim).size().reset_index(name="count")
                meas = "count"

            grouped = grouped.sort_values(by=meas, ascending=False).head(8)
            total_sum = grouped[meas].sum()

            data = []
            for _, r in grouped.iterrows():
                val = float(r[meas]) if not pd.isna(r[meas]) else 0.0
                share = round((val / max(total_sum, 1)) * 100, 1)
                data.append({"label": str(r[dim]), "value": round(val, 2), "share_pct": share})

            if not data:
                return None

            top_item = data[0]
            return {
                "id": f"chart_custom_{uuid.uuid4().hex[:8]}",
                "title": title,
                "subtitle": subtitle,
                "chart_type": ch_type if ch_type in ["bar", "pie", "line", "area"] else "bar",
                "x_field": dim,
                "y_field": meas,
                "data": data,
                "metric_highlight": f"Leader: {top_item['share_pct']}% Share",
                "insight": {
                    "headline": f"Custom Business Takeaway: '{top_item['label']}' Commands {top_item['share_pct']}%",
                    "description": takeaway,
                    "impact": "Incorporate findings into operational scheduling and strategic resource allocation.",
                    "severity": "positive"
                }
            }
        except Exception as e:
            logger.warning(f"Custom prompt chart synthesis failed: {e}. Falling back to Pareto chart.")
            return cls.generate_pareto_driver_chart(df, domain=domain)
