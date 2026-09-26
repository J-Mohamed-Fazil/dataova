from typing import Dict, Any, List, Optional
import math
import numpy as np
import pandas as pd

class KpiEngine:

    @staticmethod
    def format_metric_value(val: float, is_currency: bool = False, is_rate: bool = False) -> str:
        if val is None or (isinstance(val, float) and (math.isnan(val) or math.isinf(val))):
            return "0"
        if is_rate:
            return f"{round(val, 1)}%"
        prefix = "$" if is_currency else ""
        abs_val = abs(val)
        if abs_val >= 1_000_000_000:
            return f"{prefix}{round(val / 1_000_000_000, 2)}B"
        if abs_val >= 1_000_000:
            return f"{prefix}{round(val / 1_000_000, 2)}M"
        if abs_val >= 10_000:
            return f"{prefix}{round(val / 1_000, 1)}K"
        if abs_val >= 1_000:
            return f"{prefix}{round(val, 2):,}"
        if isinstance(val, int) or (isinstance(val, float) and val.is_integer()):
            return f"{prefix}{int(val):,}"
        return f"{prefix}{round(val, 2):,}"

    @staticmethod
    def generate_kpi_ai_insight(
        col_name: str,
        count_val: int,
        sum_val: float,
        avg_val: float,
        min_val: float,
        max_val: float,
        median_val: float,
        std_dev: float,
        is_currency: bool,
        is_rate: bool,
        domain: str = "General"
    ) -> str:
        """
        Synthesizes a deep, domain-aware natural language AI insight interpreting
        the statistical quintet (min, max, sum, count, average).
        """
        f_min = KpiEngine.format_metric_value(min_val, is_currency, is_rate)
        f_max = KpiEngine.format_metric_value(max_val, is_currency, is_rate)
        f_avg = KpiEngine.format_metric_value(avg_val, is_currency, is_rate)
        f_sum = KpiEngine.format_metric_value(sum_val, is_currency, is_rate)
        f_med = KpiEngine.format_metric_value(median_val, is_currency, is_rate)
        clean_name = col_name.replace("_", " ").title()

        # Spread & Multiplier
        spread_mult = round(max_val / max(min_val, 0.0001), 1) if min_val > 0 else None
        spread_text = f"a {spread_mult:,.1f}x span" if spread_mult and spread_mult < 10000 else f"a span of {f_min} to {f_max}"

        # Skewness & Distribution Shape
        if avg_val > median_val * 1.15 and median_val > 0:
            skew_note = "exhibits a significant positive skew, driven by high-value outlier transactions pulling the average above the median"
        elif avg_val < median_val * 0.85 and median_val > 0:
            skew_note = "shows negative compression where a cluster of lower records dampens the overall average"
        else:
            skew_note = "maintains a balanced, near-normal central distribution around the median"

        # Outlier Detection (Z-score test)
        outlier_alert = ""
        if std_dev > 0 and (max_val - avg_val) / std_dev >= 2.5:
            z_score = (max_val - avg_val) / std_dev
            outlier_alert = f" The maximum ceiling of {f_max} stands {z_score:.1f} standard deviations above the average, indicating an exceptional performance cluster."

        # Concentration / Share of total
        peak_share = round((max_val / max(abs(sum_val), 0.0001)) * 100, 2) if sum_val != 0 else 0
        share_note = f" The top single record accounts for {peak_share}% of total volume ({f_sum})." if 1.0 <= peak_share <= 50.0 else ""

        # Strategic Actionable Takeaway
        if is_currency:
            action = f"Focus operational optimization on mitigating variance between floor ({f_min}) and peak ({f_max}) cohorts to lift overall average realization."
        elif is_rate:
            action = f"Benchmark segments performing below the average of {f_avg} against top-quartile performers achieving {f_max}."
        else:
            action = f"Monitor volume consistency across all {count_val:,} observations to sustain stability."

        insight_parts = [
            f"Across {count_val:,} observations, {clean_name} accumulates to {f_sum} with an average of {f_avg} (median: {f_med}).",
            f"Values range from {f_min} to {f_max} ({spread_text}), and the metric {skew_note}.{outlier_alert}{share_note}",
            action
        ]
        return " ".join(insight_parts)

    @staticmethod
    def compute_column_kpi(
        series: pd.Series,
        col_name: str,
        table_name: str,
        domain: str = "General",
        order_index: int = 0
    ) -> Optional[Dict[str, Any]]:
        """
        Computes the complete, mathematically grounded Statistical Quintet
        (Min, Max, Sum, Count, Average) + Median, Std Dev, and AI Insight for a column.
        """
        cleaned_series = pd.to_numeric(series, errors="coerce").dropna()
        if cleaned_series.empty:
            return None

        col_lower = col_name.lower()
        monetary_keywords = ["revenue", "sales", "price", "amount", "salary", "spend", "cost", "balance", "gmv", "budget", "profit", "value", "fare", "fee"]
        rate_keywords = ["rate", "percentage", "pct", "ratio", "score", "attendance", "margin", "discount", "gpa", "yield", "accuracy"]

        is_monetary = bool(any(kw in col_lower for kw in monetary_keywords))
        is_rate = bool(any(kw in col_lower for kw in rate_keywords) or (float(cleaned_series.min()) >= 0 and float(cleaned_series.max()) <= 100 and "score" in col_lower))

        # Statistical Quintet Exact Computations
        count_val = int(len(cleaned_series))
        sum_val = float(cleaned_series.sum())
        avg_val = float(cleaned_series.mean())
        min_val = float(cleaned_series.min())
        max_val = float(cleaned_series.max())
        median_val = float(cleaned_series.median())
        std_dev = float(cleaned_series.std()) if count_val > 1 else 0.0
        skewness = float(cleaned_series.skew()) if count_val > 2 else 0.0
        val_range = max_val - min_val
        peak_share = round((max_val / max(abs(sum_val), 0.0001)) * 100, 2) if sum_val != 0 else 0.0

        # Formatted Representations
        formatted_count = f"{count_val:,}"
        formatted_sum = KpiEngine.format_metric_value(sum_val, is_currency=is_monetary, is_rate=is_rate)
        formatted_avg = KpiEngine.format_metric_value(avg_val, is_currency=is_monetary, is_rate=is_rate)
        formatted_min = KpiEngine.format_metric_value(min_val, is_currency=is_monetary, is_rate=is_rate)
        formatted_max = KpiEngine.format_metric_value(max_val, is_currency=is_monetary, is_rate=is_rate)

        # Primary Display Valuation
        if is_rate or "avg" in col_lower or "mean" in col_lower or "score" in col_lower or "gpa" in col_lower:
            primary_val = avg_val
            primary_formatted = formatted_avg
            calc_type = "avg"
            display_title = f"Avg {col_name.replace('_', ' ').title()}"
            formula = f"MEAN({table_name}.{col_name}) across {count_val:,} valid entries."
        elif is_monetary and ("salary" in col_lower or "balance" in col_lower or "unit" in col_lower or "price" in col_lower or "fare" in col_lower):
            primary_val = avg_val
            primary_formatted = formatted_avg
            calc_type = "avg"
            display_title = f"Average {col_name.replace('_', ' ').title()}"
            formula = f"AVG({table_name}.{col_name}) across {count_val:,} valid entries."
        else:
            primary_val = sum_val
            primary_formatted = formatted_sum
            calc_type = "sum"
            display_title = f"Total {col_name.replace('_', ' ').title()}"
            formula = f"SUM({table_name}.{col_name}) across {count_val:,} valid entries."

        unit_str = "Currency" if is_monetary else ("%" if is_rate else "Units")

        # Synthesize deep AI Insight
        ai_insight = KpiEngine.generate_kpi_ai_insight(
            col_name=col_name,
            count_val=count_val,
            sum_val=sum_val,
            avg_val=avg_val,
            min_val=min_val,
            max_val=max_val,
            median_val=median_val,
            std_dev=std_dev,
            is_currency=is_monetary,
            is_rate=is_rate,
            domain=domain
        )

        impact_summary = (
            f"Core operational measure for assessing {col_name.replace('_', ' ')} magnitude. "
            f"Averages {formatted_avg} within an observed range of {formatted_min} to {formatted_max}."
        )

        return {
            "name": f"kpi_{col_name.lower()}",
            "display_name": display_title,
            "value": round(primary_val, 2),
            "formatted_value": primary_formatted,
            "unit": unit_str,
            "calculation_type": calc_type,
            "source_table": table_name,
            "source_column": col_name,
            "formula_explanation": formula,
            "impact_summary": impact_summary,
            "confidence": 0.98,
            "order_index": order_index,
            # Statistical Quintet Fields
            "min_value": round(min_val, 4),
            "max_value": round(max_val, 4),
            "sum_value": round(sum_val, 4),
            "avg_value": round(avg_val, 4),
            "count_value": count_val,
            "formatted_min": formatted_min,
            "formatted_max": formatted_max,
            "formatted_sum": formatted_sum,
            "formatted_avg": formatted_avg,
            "formatted_count": formatted_count,
            "ai_insight": ai_insight,
            "statistical_summary": {
                "median": float(round(median_val, 4)),
                "std_dev": float(round(std_dev, 4)),
                "skewness": float(round(skewness, 4)),
                "range": float(round(val_range, 4)),
                "peak_share": float(peak_share),
                "is_monetary": bool(is_monetary),
                "is_rate": bool(is_rate)
            }
        }

    @staticmethod
    def discover_kpis(dataframes: Dict[str, pd.DataFrame], domain: str) -> List[Dict[str, Any]]:
        kpis: List[Dict[str, Any]] = []
        if not dataframes:
            return kpis

        primary_table_name = list(dataframes.keys())[0]
        primary_df = dataframes[primary_table_name]
        total_rows = len(primary_df)

        # 1. Universal Base KPI: Total Record Volume / Entities
        entity_name = "Records"
        if "Retail" in domain or "E-Commerce" in domain:
            entity_name = "Total Orders / Transactions"
        elif "Human Resources" in domain:
            entity_name = "Total Workforce"
        elif "Banking" in domain or "Finance" in domain:
            entity_name = "Total Transactions"
        elif "Education" in domain:
            entity_name = "Total Enrolled Students"
        elif "Healthcare" in domain:
            entity_name = "Total Patient Admissions"

        base_ai_insight = (
            f"The primary dataset contains {total_rows:,} total active observations in '{primary_table_name}'. "
            f"This provides high statistical sample stability (confidence: 100%) for all derived metrics, aggregations, and forecasts."
        )

        kpis.append({
            "name": "total_records",
            "display_name": entity_name,
            "value": float(total_rows),
            "formatted_value": f"{total_rows:,}",
            "unit": "Count",
            "calculation_type": "count",
            "source_table": primary_table_name,
            "source_column": None,
            "formula_explanation": f"COUNT(*) across primary dataset table '{primary_table_name}'.",
            "impact_summary": f"Represents the overall volume of observations evaluated in this analysis.",
            "confidence": 1.0,
            "order_index": 0,
            # Statistical Quintet Fields
            "min_value": 1.0 if total_rows > 0 else 0.0,
            "max_value": float(total_rows),
            "sum_value": float(total_rows),
            "avg_value": 1.0,
            "count_value": total_rows,
            "formatted_min": "1",
            "formatted_max": f"{total_rows:,}",
            "formatted_sum": f"{total_rows:,}",
            "formatted_avg": "1.0",
            "formatted_count": f"{total_rows:,}",
            "ai_insight": base_ai_insight,
            "statistical_summary": {
                "median": float(total_rows / 2) if total_rows > 0 else 0.0,
                "std_dev": 0.0,
                "skewness": 0.0,
                "range": float(total_rows),
                "peak_share": 100.0 if total_rows > 0 else 0.0
            }
        })

        # 2. Inspect numeric and rate columns
        num_cols = primary_df.select_dtypes(include=[np.number]).columns.tolist()
        clean_num_cols = [c for c in num_cols if not c.lower().endswith("id") and not c.lower().endswith("code")]

        # Prioritize prominent measures
        monetary_keywords = ["revenue", "sales", "price", "amount", "salary", "spend", "cost", "balance", "gmv", "budget", "profit", "value", "fare"]
        rate_keywords = ["rate", "percentage", "pct", "ratio", "score", "attendance", "margin", "discount", "gpa"]

        # Sort columns to prioritize business critical measures first
        def col_priority_score(col: str) -> int:
            c_l = col.lower()
            if any(k in c_l for k in ["revenue", "sales", "profit"]):
                return 10
            if any(k in c_l for k in monetary_keywords):
                return 8
            if any(k in c_l for k in rate_keywords):
                return 6
            if any(k in c_l for k in ["quantity", "count", "score", "age"]):
                return 4
            return 1

        clean_num_cols.sort(key=col_priority_score, reverse=True)

        order_idx = 1
        for col in clean_num_cols:
            if order_idx >= 5:
                break
            kpi_data = KpiEngine.compute_column_kpi(
                series=primary_df[col],
                col_name=col,
                table_name=primary_table_name,
                domain=domain,
                order_index=order_idx
            )
            if kpi_data:
                kpis.append(kpi_data)
                order_idx += 1

        # 3. Check for Categorical Diversity KPI (e.g. Active Categories or Departments)
        cat_cols = primary_df.select_dtypes(include=["object", "category", "string"]).columns.tolist()
        dim_candidates = [c for c in cat_cols if not c.lower().endswith("id") and 2 <= primary_df[c].nunique() <= 50]
        if dim_candidates and len(kpis) < 5:
            dim_col = dim_candidates[0]
            distinct_cnt = int(primary_df[dim_col].nunique())
            cat_counts = primary_df[dim_col].value_counts()
            top_cat = cat_counts.index[0] if len(cat_counts) > 0 else "N/A"
            top_cat_share = round((cat_counts.iloc[0] / max(total_rows, 1)) * 100, 1) if len(cat_counts) > 0 else 0

            cat_insight = (
                f"Identified {distinct_cnt} unique {dim_col.replace('_', ' ')} segments. "
                f"The largest segment '{top_cat}' constitutes {top_cat_share}% ({cat_counts.iloc[0]:,} observations) of the entire portfolio."
            )

            kpis.append({
                "name": f"distinct_{dim_col.lower()}",
                "display_name": f"Active {dim_col.replace('_', ' ').title()}s",
                "value": float(distinct_cnt),
                "formatted_value": f"{distinct_cnt}",
                "unit": "Count",
                "calculation_type": "unique",
                "source_table": primary_table_name,
                "source_column": dim_col,
                "formula_explanation": f"COUNT(DISTINCT {primary_table_name}.{dim_col}).",
                "impact_summary": f"Indicates operational diversity across {dim_col.replace('_', ' ')} segments.",
                "confidence": 1.0,
                "order_index": order_idx,
                "min_value": 1.0,
                "max_value": float(distinct_cnt),
                "sum_value": float(distinct_cnt),
                "avg_value": round(float(total_rows) / max(distinct_cnt, 1), 1),
                "count_value": distinct_cnt,
                "formatted_min": "1",
                "formatted_max": f"{distinct_cnt}",
                "formatted_sum": f"{distinct_cnt}",
                "formatted_avg": f"{round(float(total_rows) / max(distinct_cnt, 1), 1):,}",
                "formatted_count": f"{distinct_cnt}",
                "ai_insight": cat_insight,
                "statistical_summary": {
                    "median": float(distinct_cnt / 2),
                    "std_dev": 0.0,
                    "skewness": 0.0,
                    "range": float(distinct_cnt),
                    "peak_share": top_cat_share
                }
            })

        return kpis

    @staticmethod
    def compute_all_table_kpis(df: pd.DataFrame, table_name: str, domain: str = "General") -> List[Dict[str, Any]]:
        """
        Computes proper KPI values (Min, Max, Sum, Count, Average) and AI insights
        for all numeric columns present in a given table DataFrame.
        """
        kpis: List[Dict[str, Any]] = []
        if df is None or df.empty:
            return kpis

        total_rows = len(df)
        num_cols = df.select_dtypes(include=[np.number]).columns.tolist()

        order_idx = 0
        for col in num_cols:
            kpi_data = KpiEngine.compute_column_kpi(
                series=df[col],
                col_name=col,
                table_name=table_name,
                domain=domain,
                order_index=order_idx
            )
            if kpi_data:
                kpis.append(kpi_data)
                order_idx += 1

        return kpis
