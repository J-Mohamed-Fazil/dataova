from typing import Dict, Any, List, Optional
import math
import numpy as np
import pandas as pd
from app.services.calculation_tools import CalculationTools

class InsightEngine:

    @staticmethod
    def generate_insights(
        dataframes: Dict[str, pd.DataFrame],
        domain: str,
        kpis: List[Dict[str, Any]],
        anomalies: List[Dict[str, Any]],
        quality_info: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        insights: List[Dict[str, Any]] = []
        if not dataframes:
            return insights

        primary_table_name = list(dataframes.keys())[0]
        df = dataframes[primary_table_name]
        total_rows = len(df)

        # -------------------------------------------------------------
        # 1. DATA QUALITY & INTEGRITY AUDIT (Fact)
        # -------------------------------------------------------------
        health_score = quality_info.get("score", 100)
        rating = quality_info.get("rating", "Good")
        dup_count = quality_info.get("metrics", {}).get("duplicate_rows", 0)
        missing_count = quality_info.get("metrics", {}).get("missing_cells", 0)
        total_cells = quality_info.get("metrics", {}).get("total_cells", total_rows * max(len(df.columns), 1))
        missing_pct = round((missing_count / max(total_cells, 1)) * 100, 2)
        
        insights.append({
            "title": f"Data Health Index: {health_score}/100 ({rating})",
            "category": "data_quality",
            "statement_type": "fact",
            "description": f"Comprehensive audit of {total_rows:,} records across {len(df.columns)} columns in '{primary_table_name}'. Identified {missing_count:,} missing values ({missing_pct}%) and {dup_count:,} duplicate observations.",
            "calculation_details": {
                "health_score": health_score,
                "missing_cells": missing_count,
                "missing_percentage": missing_pct,
                "duplicate_rows": dup_count,
                "total_records": total_rows
            },
            "why_it_matters": "High baseline data integrity ensures downstream metric aggregations, statistical distributions, and automated forecasts remain unbiased and audit-ready.",
            "recommendation": "Address high-null fields with imputation or upstream ingestion validation before applying strict parametric thresholds." if health_score < 80 else "Dataset demonstrates high data fidelity and is fully approved for executive decision-making.",
            "severity": "high" if health_score < 70 else ("medium" if health_score < 85 else "low"),
            "confidence": 1.0,
            "source_table": primary_table_name,
            "source_columns": list(df.columns[:5])
        })

        cat_cols = df.select_dtypes(include=["object", "category", "string"]).columns.tolist()
        num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        valid_cats = [
            c for c in cat_cols
            if not c.lower().endswith("_id") and c.lower() != "id"
            and 2 <= df[c].nunique() <= 50
            and not any(k in c.lower() for k in ["date", "time", "year", "month", "day", "timestamp", "code", "zip"])
        ]
        # Prioritize true categorical business entities
        dim_priority = ["category", "segment", "department", "product", "channel", "region", "country", "type", "status", "tier"]
        for kw in dim_priority:
            found = [c for c in valid_cats if kw in c.lower()]
            if found:
                valid_cats = found + [c for c in valid_cats if c not in found]
                break

        valid_nums = [c for c in num_cols if not c.lower().endswith("_id") and not c.lower().endswith("code") and c.lower() != "id"]
        metric_priority = ["revenue", "sales", "profit", "amount", "total", "spent", "spend", "salary", "price", "quantity", "score"]
        for kw in metric_priority:
            found = [c for c in valid_nums if kw in c.lower()]
            if found:
                valid_nums = found + [c for c in valid_nums if c not in found]
                break

        # -------------------------------------------------------------
        # 2. TOP CONTRIBUTOR / SEGMENT PERFORMANCE (Calculation)
        # -------------------------------------------------------------
        if valid_cats and valid_nums:
            cat_col = valid_cats[0]
            num_col = valid_nums[0]

            breakdown = CalculationTools.execute_aggregation(df, cat_col, num_col, agg_type="sum", top_n=8)
            if len(breakdown) >= 2:
                top_segment = breakdown[0]
                total_sum = sum(b["value"] for b in breakdown)
                top_pct = round((top_segment["value"] / max(total_sum, 1)) * 100, 1)

                insights.append({
                    "title": f"Segment Dominance: '{top_segment['label']}' leads {num_col.replace('_', ' ').title()}",
                    "category": "performance",
                    "statement_type": "calculation",
                    "description": f"'{top_segment['label']}' generated {top_segment['value']:,} in {num_col.replace('_', ' ')}, capturing {top_pct}% of the combined top segment performance.",
                    "calculation_details": {
                        "category_column": cat_col,
                        "metric_column": num_col,
                        "top_label": top_segment["label"],
                        "top_value": top_segment["value"],
                        "share_percentage": top_pct
                    },
                    "why_it_matters": f"A single segment generating {top_pct}% of total {num_col.replace('_', ' ')} represents an acute volume dependency requiring active hedging and dedicated operational support.",
                    "recommendation": f"Protect margin and SLA fidelity for '{top_segment['label']}' while deploying targeted expansion programs in runner-up categories.",
                    "severity": "high" if top_pct > 40 else "medium",
                    "confidence": 0.96,
                    "source_table": primary_table_name,
                    "source_columns": [cat_col, num_col]
                })

                # ---------------------------------------------------------
                # 3. PARETO CONCENTRATION & HEAD-TAIL DYNAMICS (Inference)
                # ---------------------------------------------------------
                if len(breakdown) >= 4:
                    top_two_sum = breakdown[0]["value"] + breakdown[1]["value"]
                    top_two_share = round((top_two_sum / max(total_sum, 1)) * 100, 1)
                    tail_sum = sum(b["value"] for b in breakdown[2:])
                    tail_share = round((tail_sum / max(total_sum, 1)) * 100, 1)

                    insights.append({
                        "title": f"Pareto Concentration: Top 2 Segments Drive {top_two_share}% of {num_col.replace('_', ' ').title()}",
                        "category": "opportunity",
                        "statement_type": "inference",
                        "description": f"The top two entities ('{breakdown[0]['label']}' and '{breakdown[1]['label']}') account for {top_two_share}% of aggregate volume, whereas the remaining {len(breakdown)-2} segments account for {tail_share}%.",
                        "calculation_details": {
                            "top_entities": [breakdown[0]["label"], breakdown[1]["label"]],
                            "top_share": top_two_share,
                            "tail_share": tail_share
                        },
                        "why_it_matters": "High revenue/activity concentration leaves the operation vulnerable to single-point segment disruption or demand contraction.",
                        "recommendation": "Initiate cross-tier promotional campaigns or diversification initiatives to develop high-margin mid-tier entities.",
                        "severity": "medium",
                        "confidence": 0.93,
                        "source_table": primary_table_name,
                        "source_columns": [cat_col, num_col]
                    })

                # ---------------------------------------------------------
                # 4. PERFORMANCE SPREAD & DISPARITY RATIO (Calculation)
                # ---------------------------------------------------------
                if len(breakdown) >= 3:
                    top_val = breakdown[0]["value"]
                    lowest_val = breakdown[-1]["value"]
                    if lowest_val > 0:
                        disparity_ratio = round(top_val / lowest_val, 1)
                        insights.append({
                            "title": f"Performance Disparity: {disparity_ratio}x Spread Between Top and Tier-Bottom",
                            "category": "comparison",
                            "statement_type": "calculation",
                            "description": f"Leader '{breakdown[0]['label']}' outperforms lowest observed cluster '{breakdown[-1]['label']}' by a factor of {disparity_ratio}x ({top_val:,} vs {lowest_val:,}).",
                            "calculation_details": {
                                "top_value": top_val,
                                "lowest_value": lowest_val,
                                "spread_multiplier": disparity_ratio
                            },
                            "why_it_matters": "Pronounced disparity indicates untapped capacity or structural friction in lagging operational categories.",
                            "recommendation": f"Perform a diagnostic audit on '{breakdown[-1]['label']}' to isolate operational blockers or consider deprecating non-viable SKU lines.",
                            "severity": "medium" if disparity_ratio > 5 else "low",
                            "confidence": 0.91,
                            "source_table": primary_table_name,
                            "source_columns": [cat_col, num_col]
                        })

        # -------------------------------------------------------------
        # 5. TEMPORAL TREND & RUN-RATE MOMENTUM (Trend & Velocity)
        # -------------------------------------------------------------
        date_cols = [c for c in df.columns if any(k in c.lower() for k in ["date", "time", "period", "timestamp", "year", "month"])]
        if date_cols and valid_nums:
            date_col = date_cols[0]
            metric_col = valid_nums[0]
            time_series = CalculationTools.execute_time_series(df, date_col, metric_col, agg_type="sum")
            
            if len(time_series) >= 3:
                first_period = time_series[0]["value"]
                last_period = time_series[-1]["value"]
                max_period = max(time_series, key=lambda x: x["value"])
                min_period = min(time_series, key=lambda x: x["value"])

                if first_period > 0:
                    pct_change = round(((last_period - first_period) / first_period) * 100, 1)
                    direction = "expanded" if pct_change > 0 else "contracted"

                    insights.append({
                        "title": f"Longitudinal Momentum: {metric_col.replace('_', ' ').title()} {direction} {abs(pct_change)}%",
                        "category": "trend",
                        "statement_type": "inference",
                        "description": f"Over the observed periods ({time_series[0]['label']} to {time_series[-1]['label']}), {metric_col.replace('_', ' ')} transitioned from {first_period:,} to {last_period:,} ({pct_change:+}% shift). Historical peak occurred in {max_period['label']} ({max_period['value']:,}).",
                        "calculation_details": {
                            "date_column": date_col,
                            "metric_column": metric_col,
                            "initial_value": first_period,
                            "final_value": last_period,
                            "growth_rate_pct": pct_change,
                            "peak_period": max_period["label"],
                            "peak_value": max_period["value"],
                            "trough_period": min_period["label"],
                            "trough_value": min_period["value"]
                        },
                        "why_it_matters": "Longitudinal velocity provides empirical grounding for quarterly run-rate forecasts, inventory procurement, and staffing models.",
                        "recommendation": "Capitalize on upward velocity by locking in fulfillment capacity ahead of forecasted peak cycles." if pct_change > 0 else "Conduct immediate root-cause retrospective on systemic drivers behind consecutive period contraction.",
                        "severity": "low" if pct_change > 0 else "high",
                        "confidence": 0.94,
                        "source_table": primary_table_name,
                        "source_columns": [date_col, metric_col]
                    })

        # -------------------------------------------------------------
        # 6. STATISTICAL SKEWNESS & DISPERSION ALERT (Risk & Variance)
        # -------------------------------------------------------------
        if valid_nums:
            for num_col in valid_nums[:3]:
                series = pd.to_numeric(df[num_col], errors="coerce").dropna()
                if len(series) > 10:
                    mean_val = float(series.mean())
                    median_val = float(series.median())
                    std_val = float(series.std())

                    if median_val > 0:
                        skew_pct = round(((mean_val - median_val) / median_val) * 100, 1)
                        cv_val = std_val / abs(mean_val) if mean_val != 0 else 0
                        
                        if abs(skew_pct) >= 20.0:
                            direction = "positively skewed (heavy right-tail)" if skew_pct > 0 else "negatively skewed (heavy left-tail)"
                            
                            # Upgrade severity if highly volatile and highly skewed
                            severity = "high" if (abs(skew_pct) > 40 and cv_val > 0.5) else "medium"
                            
                            insights.append({
                                "title": f"Distribution Skew Alert: {num_col.replace('_', ' ').title()} exhibits {abs(skew_pct)}% Divergence",
                                "category": "risk",
                                "statement_type": "calculation",
                                "description": f"Parametric distribution of {num_col.replace('_', ' ')} is {direction}. Mean ({mean_val:,.2f}) diverges from Median ({median_val:,.2f}) by {skew_pct:+}% with Std Dev of {std_val:,.2f} (CV: {round(cv_val, 2)}).",
                                "calculation_details": {
                                    "column": num_col,
                                    "mean": round(mean_val, 2),
                                    "median": round(median_val, 2),
                                    "std_dev": round(std_val, 2),
                                    "divergence_pct": skew_pct,
                                    "cv": round(cv_val, 2)
                                },
                                "why_it_matters": "When distributions exhibit high skew, traditional arithmetic averages distort reality. Using the mean for goal-setting or SLA forecasts creates severe baseline inaccuracies.",
                                "recommendation": f"Utilize median-based (P50/IQR) performance baselines rather than arithmetic averages when evaluating {num_col.replace('_', ' ')} KPIs.",
                                "severity": severity,
                                "confidence": 0.95,
                                "source_table": primary_table_name,
                                "source_columns": [num_col]
                            })
                            break

        # -------------------------------------------------------------
        # 7. CORRELATION & CO-MOVEMENT DISCOVERY (Inference)
        # -------------------------------------------------------------
        if len(valid_nums) >= 2:
            num_clean_df = df[valid_nums[:6]].apply(pd.to_numeric, errors="coerce").dropna()
            if len(num_clean_df) > 10:
                corr_matrix = num_clean_df.corr()
                found_corr = False
                for i in range(len(valid_nums[:6])):
                    if found_corr:
                        break
                    for j in range(i + 1, len(valid_nums[:6])):
                        c1 = valid_nums[i]
                        c2 = valid_nums[j]
                        r_val = corr_matrix.loc[c1, c2]
                        if not math.isnan(r_val) and abs(r_val) >= 0.65:
                            corr_type = "Strong Positive" if r_val >= 0.8 else ("Moderate Positive" if r_val > 0 else "Strong Inverse")
                            insights.append({
                                "title": f"Metric Correlation: {corr_type} Association Between {c1.replace('_', ' ').title()} & {c2.replace('_', ' ').title()}",
                                "category": "trend",
                                "statement_type": "inference",
                                "description": f"Statistical correlation coefficient r = {r_val:+.2f} discovered between '{c1}' and '{c2}'. Movement in one metric consistently tracks or counter-balances the other.",
                                "calculation_details": {
                                    "feature_x": c1,
                                    "feature_y": c2,
                                    "correlation_coefficient": round(r_val, 3)
                                },
                                "why_it_matters": "Identifying co-movement relationships reveals hidden operational levers and elasticity factors that drive business outcomes.",
                                "recommendation": f"Model predictive cross-elasticity between {c1} and {c2} in forecasting simulations to optimize joint performance.",
                                "severity": "low",
                                "confidence": 0.90,
                                "source_table": primary_table_name,
                                "source_columns": [c1, c2]
                            })
                            found_corr = True
                            break

        # -------------------------------------------------------------
        # 8. STATISTICAL OUTLIERS / ANOMALIES (Fact & Risk)
        # -------------------------------------------------------------
        if anomalies:
            top_anomaly = anomalies[0]
            insights.append({
                "title": f"Anomaly Alert: Critical Variance in '{top_anomaly['column_name']}'",
                "category": "anomaly",
                "statement_type": "fact",
                "description": top_anomaly["explanation"],
                "calculation_details": top_anomaly.get("details", {}),
                "why_it_matters": "Extreme outliers distort parameter estimates, skew automated thresholds, and frequently reveal transactional defects or unprecedented customer transactions.",
                "recommendation": f"Isolate these {top_anomaly['anomaly_count']} record(s) in a triage view to verify legitimate mega-transactions vs data entry corruption.",
                "severity": top_anomaly["severity"],
                "confidence": 0.92,
                "source_table": top_anomaly["table_name"],
                "source_columns": [top_anomaly["column_name"]]
            })

        # -------------------------------------------------------------
        # 9. DOMAIN-SPECIFIC STRATEGIC ACTION INITIATIVES (Recommendation)
        # -------------------------------------------------------------
        domain_initiatives = {
            "Retail & E-Commerce": [
                {
                    "title": "Strategic Optimization: Margin Protection & Assortment Rationalization",
                    "description": "Cross-tabulation reveals heavy dependency on primary SKUs. Re-allocating merchandising bandwidth to high-margin mid-tier categories will mitigate seasonal concentration risks.",
                    "rec": "Implement automated basket-level elasticity monitoring and rebalance inventory commitments toward runner-up clusters.",
                    "severity": "high"
                },
                {
                    "title": "Commercial Velocity: Cart Value Expansion",
                    "description": "Order frequency patterns indicate consistent baseline volume with room for bundle attachment.",
                    "rec": "Introduce targeted cross-category bundling algorithms at checkout to increase average order values by 8-12%.",
                    "severity": "medium"
                }
            ],
            "Human Resources": [
                {
                    "title": "Workforce Strategy: Retention & Parity Harmonization",
                    "description": "Compensation dispersion across departments demonstrates structural salary bands requiring benchmark calibration.",
                    "rec": "Conduct structured equity reviews across top compensation quartiles to reduce unforced turnover risk in key technical roles.",
                    "severity": "high"
                }
            ],
            "Banking & Finance": [
                {
                    "title": "Capital Allocation: Liquidity Concentration Mitigation",
                    "description": "Transactional exposure registers elevated concentration in top account classes.",
                    "rec": "Establish strict intra-day exposure caps and rebalance counterparty allocations to safeguard portfolio resilience.",
                    "severity": "high"
                }
            ],
            "Healthcare & Clinical": [
                {
                    "title": "Clinical Operations: Protocol Standardization & Length of Stay",
                    "description": "Diagnostic and treatment variances point to disparate clinical pathways across patient cohorts.",
                    "rec": "Adopt unified diagnostic protocols across specialty departments to standardize treatment costs and outcomes.",
                    "severity": "medium"
                }
            ],
            "Logistics & Supply Chain": [
                {
                    "title": "Throughput Optimization: Carrier Allocation & Lead Time Hedge",
                    "description": "Route transit dispersion reveals fulfillment bottlenecks on secondary freight lanes.",
                    "rec": "Dynamically re-route shipments to backup regional carriers whenever lane congestion exceeds 1.5 standard deviations.",
                    "severity": "high"
                }
            ],
            "SaaS & Digital Product": [
                {
                    "title": "Revenue Retention: Net Expansion & Churn Prevention",
                    "description": "Cohort usage telemetry indicates tier stagnation in standard account tiers.",
                    "rec": "Deploy proactive customer success playbooks triggered when account feature utilization contracts by 15% in a 30-day window.",
                    "severity": "high"
                }
            ]
        }

        initiatives = domain_initiatives.get(domain, [
            {
                "title": f"Strategic Optimization: Empirical Resource Re-allocation across {domain}",
                "description": f"Autonomous synthesis confirms core performance is concentrated in key operational clusters. Systematic re-allocation will accelerate ROI.",
                "rec": "Establish monthly KPI review cadences tracking the top discovered metrics against empirical baseline thresholds.",
                "severity": "medium"
            }
        ])

        for init in initiatives:
            insights.append({
                "title": init["title"],
                "category": "opportunity",
                "statement_type": "recommendation",
                "description": init["description"],
                "calculation_details": {"domain": domain, "initiative": init["title"]},
                "why_it_matters": "Proactive strategic adaptation prevents operational plateauing and optimizes resource deployment.",
                "recommendation": init["rec"],
                "severity": init["severity"],
                "confidence": 0.88,
                "source_table": primary_table_name,
                "source_columns": valid_nums[:2] if valid_nums else []
            })

        return insights
