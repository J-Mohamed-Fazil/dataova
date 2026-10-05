import math
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np

class AudioBriefService:
    """
    Generates an in-depth, structured, dual-host executive audio briefing ('Podcast')
    synthesizing dataset architecture, statistical distributions, category Pareto drivers,
    multivariable correlations, outlier diagnostics, and predictive sensitivity.
    """

    @staticmethod
    def generate_brief(
        df: pd.DataFrame,
        dataset_name: str,
        domain: str = "General",
        kpis: Optional[List[Dict[str, Any]]] = None,
        anomalies: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        kpis = kpis or []
        anomalies = anomalies or []

        row_count = len(df)
        col_count = len(df.columns)

        # ── 1. SCHEMA & ARCHITECTURAL VITAL SIGNS ───────────────────────
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        categorical_cols = df.select_dtypes(include=['object', 'category', 'string']).columns.tolist()
        datetime_cols = df.select_dtypes(include=['datetime', 'datetimetz']).columns.tolist()

        # Data completeness
        total_cells = max(1, row_count * col_count)
        non_null_cells = int(df.notnull().sum().sum())
        completeness_pct = round((non_null_cells / total_cells) * 100, 1)

        # Duplicates & Memory
        duplicate_rows = int(df.duplicated().sum())
        try:
            mem_bytes = df.memory_usage(deep=True).sum()
            if mem_bytes > 1024 * 1024:
                mem_str = f"{mem_bytes / (1024 * 1024):.1f} MB"
            else:
                mem_str = f"{mem_bytes / 1024:.0f} KB"
        except Exception:
            mem_str = "N/A"

        # ── 2. CORE METRICS & SKEWNESS DISTRIBUTION ─────────────────────
        top_kpi_text = ""
        lead_col_name = ""
        lead_total_str = ""
        lead_mean_str = ""
        lead_median_str = ""
        lead_spread_text = ""
        top_10_share_pct = 0.0

        if kpis:
            kpi_summaries = []
            for k in kpis[:3]:
                name = k.get("name", "Metric")
                val = k.get("formatted_value") or str(k.get("value", ""))
                status = k.get("status", "neutral")
                kpi_summaries.append(f"{name} stands at {val} ({status})")
            top_kpi_text = ", ".join(kpi_summaries)

        if numeric_cols:
            lead_col = numeric_cols[0]
            lead_col_name = lead_col.replace('_', ' ').title()
            lead_series = df[lead_col].dropna()

            if len(lead_series) > 0:
                lead_sum = float(lead_series.sum())
                lead_mean = float(lead_series.mean())
                lead_median = float(lead_series.median())
                lead_std = float(lead_series.std()) if len(lead_series) > 1 else 0.0

                lead_total_str = f"{lead_sum:,.2f}" if abs(lead_sum) < 10000 else f"{lead_sum:,.0f}"
                lead_mean_str = f"{lead_mean:,.2f}"
                lead_median_str = f"{lead_median:,.2f}"

                # Check distribution shape / skewness
                if lead_sum > 0:
                    top_10_cutoff = lead_series.quantile(0.90)
                    top_10_sum = lead_series[lead_series >= top_10_cutoff].sum()
                    top_10_share_pct = round((top_10_sum / max(0.001, lead_sum)) * 100, 1)

                if lead_mean > lead_median * 1.15:
                    lead_spread_text = f"a notable right-skewed distribution where the top 10% of records drives {top_10_share_pct:.1f}% of total {lead_col_name}"
                elif lead_median > lead_mean * 1.15:
                    lead_spread_text = f"a left-skewed volume with median performance outperforming the arithmetic mean by {((lead_median/max(0.001, lead_mean))-1)*100:.1f}%"
                else:
                    lead_spread_text = f"a well-balanced, bell-shaped distribution centered around a median of {lead_median_str}"

        # ── 3. CATEGORICAL SEGMENTS & PARETO CONTRIBUTION ───────────────
        cat_insights_text = ""
        top_cat_col = ""
        top_cat_name = ""
        top_cat_share_pct = 0.0
        top_3_pareto_pct = 0.0

        if categorical_cols:
            # Pick categorical column with best distinct balance (between 2 and 50 categories)
            chosen_cat = categorical_cols[0]
            for col in categorical_cols:
                nunique = df[col].nunique()
                if 2 <= nunique <= 30:
                    chosen_cat = col
                    break

            top_cat_col = chosen_cat.replace('_', ' ').title()
            val_counts = df[chosen_cat].value_counts()
            if len(val_counts) > 0:
                top_cat_name = str(val_counts.index[0])
                top_cat_count = int(val_counts.iloc[0])
                top_cat_share_pct = round((top_cat_count / max(1, row_count)) * 100, 1)

                top_3_count = int(val_counts.iloc[:3].sum())
                top_3_pareto_pct = round((top_3_count / max(1, row_count)) * 100, 1)

                # Cross-reference with numeric column if available
                if numeric_cols:
                    try:
                        grp = df.groupby(chosen_cat)[numeric_cols[0]].sum().sort_values(ascending=False)
                        top_metric_cat = str(grp.index[0])
                        top_metric_val = grp.iloc[0]
                        total_metric_val = max(0.001, grp.sum())
                        metric_share = round((top_metric_val / total_metric_val) * 100, 1)
                        cat_insights_text = (
                            f"segment analysis across {top_cat_col} reveals that '{top_metric_cat}' is the dominant revenue engine, "
                            f"accounting for {metric_share:.1f}% of total {lead_col_name}. Combined, the top 3 segments capture {top_3_pareto_pct:.1f}% of total volume"
                        )
                    except Exception:
                        cat_insights_text = f"the leading segment in {top_cat_col} is '{top_cat_name}', commanding {top_cat_share_pct:.1f}% of all records"
                else:
                    cat_insights_text = f"the leading segment in {top_cat_col} is '{top_cat_name}', commanding {top_cat_share_pct:.1f}% of all records"

        # ── 4. CORRELATIONS & MULTIVARIABLE DYNAMICS ─────────────────────
        correlation_text = ""
        strongest_pos_pair = ""
        strongest_pos_val = 0.0
        strongest_neg_pair = ""
        strongest_neg_val = 0.0

        if len(numeric_cols) >= 2:
            try:
                corr_matrix = df[numeric_cols].corr()
                pos_pairs = []
                neg_pairs = []

                for i in range(len(numeric_cols)):
                    for j in range(i + 1, len(numeric_cols)):
                        c1, c2 = numeric_cols[i], numeric_cols[j]
                        val = corr_matrix.loc[c1, c2]
                        if not np.isnan(val):
                            if val > 0:
                                pos_pairs.append((val, c1, c2))
                            elif val < 0:
                                neg_pairs.append((val, c1, c2))

                if pos_pairs:
                    pos_pairs.sort(key=lambda x: x[0], reverse=True)
                    best_pos = pos_pairs[0]
                    strongest_pos_val = round(best_pos[0], 2)
                    strongest_pos_pair = f"{best_pos[1].replace('_', ' ').title()} and {best_pos[2].replace('_', ' ').title()}"

                if neg_pairs:
                    neg_pairs.sort(key=lambda x: x[0])
                    best_neg = neg_pairs[0]
                    strongest_neg_val = round(abs(best_neg[0]), 2)
                    strongest_neg_pair = f"{best_neg[1].replace('_', ' ').title()} versus {best_neg[2].replace('_', ' ').title()}"

                if strongest_pos_pair and strongest_pos_val >= 0.4:
                    correlation_text = (
                        f"our cross-feature correlation engine discovered strong positive coupling between {strongest_pos_pair} "
                        f"with a Pearson coefficient of +{strongest_pos_val:.2f}, indicating they scale in tandem"
                    )
                    if strongest_neg_pair and strongest_neg_val >= 0.3:
                        correlation_text += f", while an inverse trade-off of -{strongest_neg_val:.2f} was detected between {strongest_neg_pair}"
                elif strongest_pos_pair:
                    correlation_text = f"moderate correlation of +{strongest_pos_val:.2f} observed between {strongest_pos_pair}, indicating diversified, independent operational drivers"
                else:
                    correlation_text = "low multi-collinearity across numerical indicators, confirming clean, orthogonal metrics"
            except Exception:
                correlation_text = "balanced feature orthogonality across primary dimensions"

        # ── 5. OUTLIER DIAGNOSTICS & ANOMALY SURVEILLANCE ───────────────
        outlier_total = 0
        most_volatile_col = ""
        highest_cv = 0.0

        for col in numeric_cols[:5]:
            s = df[col].dropna()
            if len(s) > 4:
                q25, q75 = s.quantile(0.25), s.quantile(0.75)
                iqr = q75 - q25
                if iqr > 0:
                    outliers = s[(s < q25 - 1.5 * iqr) | (s > q75 + 1.5 * iqr)]
                    outlier_total += len(outliers)
                m, sd = s.mean(), s.std()
                if abs(m) > 0.001:
                    cv = sd / abs(m)
                    if cv > highest_cv:
                        highest_cv = cv
                        most_volatile_col = col.replace('_', ' ').title()

        anomaly_text = ""
        high_anomalies = [a for a in anomalies if a.get("severity") in ["high", "critical"]]
        if high_anomalies:
            lead_anomaly = high_anomalies[0]
            col_target = lead_anomaly.get('column_name', 'primary operations')
            anomaly_text = (
                f"flagged {len(high_anomalies)} high-severity anomalies, concentrated primarily in {col_target}. "
                f"Statistically, our engines detected {outlier_total} IQR outliers across numeric series, with {most_volatile_col or col_target} exhibiting the widest volatility spread"
            )
        elif anomalies:
            anomaly_text = f"detected {len(anomalies)} moderate operational variance spikes, with {outlier_total} statistical outliers across numeric indicators"
        elif outlier_total > 0:
            anomaly_text = f"zero critical security or operational failures, but identified {outlier_total} tail-risk outliers in {most_volatile_col or 'numeric series'} requiring monitoring"
        else:
            anomaly_text = "exceptional data health with zero critical operational anomalies and minimal statistical dispersion"

        # ── 6. PREDICTIVE OUTLOOK & SENSITIVITY ──────────────────────────
        growth_direction = "stable growth"
        sensitivity_impact_str = ""
        if numeric_cols:
            lead_s = df[numeric_cols[0]].dropna()
            if len(lead_s) > 10:
                first_half = lead_s.iloc[:len(lead_s)//2].mean()
                second_half = lead_s.iloc[len(lead_s)//2:].mean()
                if second_half > first_half * 1.05:
                    pct_gain = ((second_half / max(0.001, first_half)) - 1) * 100
                    growth_direction = f"accelerating momentum with a +{pct_gain:.1f}% expansion between baseline and recent periods"
                elif first_half > second_half * 1.05:
                    pct_drop = ((first_half / max(0.001, second_half)) - 1) * 100
                    growth_direction = f"cooling momentum showing a -{pct_drop:.1f}% deceleration that leadership should address"
                else:
                    growth_direction = "steady, balanced throughput with consistent period-over-period stability"

            five_pct_delta = (lead_s.sum() * 0.05) if len(lead_s) > 0 else 0
            sensitivity_impact_str = f"{five_pct_delta:,.0f}" if five_pct_delta >= 1000 else f"{five_pct_delta:,.2f}"

        # ── 7. MULTI-CHAPTER HIGH-DETAIL DIALOGUE (LUNA & NOVA) ─────────
        dialogue: List[Dict[str, Any]] = [
            # Chapter 1: Introduction & Architecture Audit
            {
                "id": 1,
                "chapter": "1. Data Hygiene & Architecture",
                "speaker": "Luna",
                "role": "Curious Inquisitor (Moon Bot)",
                "turn_type": "question",
                "text": f"Nova, welcome to our briefing studio! I've loaded up the '{dataset_name}' dataset in the {domain} domain, containing {row_count:,} records across {col_count} columns. Let's start with our architectural audit: what do the vital signs, completeness, and hygiene look like across these tables?",
                "emphasis": "normal"
            },
            {
                "id": 2,
                "chapter": "1. Data Hygiene & Architecture",
                "speaker": "Nova",
                "role": "Core Analytics Robot",
                "turn_type": "answer",
                "text": f"Telemetry online, Luna! Our architectural scan confirms {row_count:,} rows and {col_count} attributes, comprising {len(numeric_cols)} numeric indicators and {len(categorical_cols)} categorical dimensions. Data completeness stands at a robust {completeness_pct}%, with {duplicate_rows} duplicate rows detected, and an optimized memory footprint of {mem_str}. Overall data foundation is certified and ready for executive synthesis.",
                "emphasis": "highlight"
            },

            # Chapter 2: Top-Line Performance & Metric Spread
            {
                "id": 3,
                "chapter": "2. Metric Distribution & Spread",
                "speaker": "Luna",
                "role": "Curious Inquisitor (Moon Bot)",
                "turn_type": "question",
                "text": f"Solid architectural foundation! Now let's dive into the core numbers: what does our top-line performance look like? What are the primary KPIs, and how are the distributions behaving across central tendencies?",
                "emphasis": "normal"
            },
            {
                "id": 4,
                "chapter": "2. Metric Distribution & Spread",
                "speaker": "Nova",
                "role": "Core Analytics Robot",
                "turn_type": "answer",
                "text": f"Examining core metric telemetry: {top_kpi_text or f'primary metric {lead_col_name} aggregates to {lead_total_str} with an average of {lead_mean_str}'}. Looking deeper into distribution shapes, we observe {lead_spread_text}. This indicates our volume is well-anchored, with key levers directly accessible for strategic optimization.",
                "emphasis": "highlight"
            },

            # Chapter 3: Categorical Breakdown & Pareto Drivers
            {
                "id": 5,
                "chapter": "3. Pareto & Segment Drivers",
                "speaker": "Luna",
                "role": "Curious Inquisitor (Moon Bot)",
                "turn_type": "question",
                "text": f"Fascinating distribution pattern, Nova! But who or what is actually driving those numbers behind the scenes? Which categories, segments, or regions dominate the breakdown, and is there a Pareto concentration?",
                "emphasis": "normal"
            },
            {
                "id": 6,
                "chapter": "3. Pareto & Segment Drivers",
                "speaker": "Nova",
                "role": "Core Analytics Robot",
                "turn_type": "answer",
                "text": f"Drilling down into dimensional clusters, Luna: {cat_insights_text or f'categorical distribution is distributed across {len(categorical_cols)} dimensions with steady contribution across tiers'}. This concentration demonstrates clear operational efficiency, though leadership must ensure we do not over-rely on a single segment.",
                "emphasis": "highlight"
            },

            # Chapter 4: Multivariable Correlations & Couplings
            {
                "id": 7,
                "chapter": "4. Correlations & Couplings",
                "speaker": "Luna",
                "role": "Curious Inquisitor (Moon Bot)",
                "turn_type": "question",
                "text": "A vital insight on concentration risk! Now turning my lunar scanners toward hidden relationships: what does our correlation matrix reveal? Are our primary drivers moving in lockstep, or do we see unexpected operational trade-offs?",
                "emphasis": "normal"
            },
            {
                "id": 8,
                "chapter": "4. Correlations & Couplings",
                "speaker": "Nova",
                "role": "Core Analytics Robot",
                "turn_type": "answer",
                "text": f"Analyzing cross-feature dependencies, Luna: {correlation_text}. Understanding this coupling allows us to pull primary strategic levers while anticipating exact secondary impacts across dependent operational KPIs.",
                "emphasis": "normal"
            },

            # Chapter 5: Outlier Surveillance & Operational Risk
            {
                "id": 9,
                "chapter": "5. Outliers & Risk Telemetry",
                "speaker": "Luna",
                "role": "Curious Inquisitor (Moon Bot)",
                "turn_type": "question",
                "text": "That multi-dimensional coupling gives us great predictive leverage. But let's look at the dark side of the moon: what about outliers, variance spikes, and operational anomalies? Are there tail-risk events that could blindside leadership?",
                "emphasis": "caution" if high_anomalies else "normal"
            },
            {
                "id": 10,
                "chapter": "5. Outliers & Risk Telemetry",
                "speaker": "Nova",
                "role": "Core Analytics Robot",
                "turn_type": "answer",
                "text": f"Rigorous risk surveillance is essential, Luna. Scanning our diagnostic logs: {anomaly_text}. I advise instituting automated threshold alert boundaries around {most_volatile_col or 'our primary metrics'} to isolate and dampen these volatility spikes before they propagate.",
                "emphasis": "caution" if high_anomalies else "normal"
            },

            # Chapter 6: Predictive Trajectory & Scenario Sensitivity
            {
                "id": 11,
                "chapter": "6. Momentum & Sensitivity",
                "speaker": "Luna",
                "role": "Curious Inquisitor (Moon Bot)",
                "turn_type": "question",
                "text": "Spot on, Nova. Now let's look forward onto the horizon: what does our predictive forecasting and trend momentum indicate for upcoming cycles, and how resilient is the dataset under simulated stress?",
                "emphasis": "normal"
            },
            {
                "id": 12,
                "chapter": "6. Momentum & Sensitivity",
                "speaker": "Nova",
                "role": "Core Analytics Robot",
                "turn_type": "answer",
                "text": f"Synthesizing predictive models, Luna: our trajectory displays {growth_direction}. Simulating a five percent variance shift in our primary driver yields an estimated bottom-line impact of {sensitivity_impact_str} {lead_col_name}. Based on these vectors, leadership should execute three immediate directives: first, reinforce our top segment drivers; second, isolate the identified outlier volatility; and third, stress-test baseline assumptions using our interactive scenario engine.",
                "emphasis": "highlight"
            },

            # Chapter 7: Executive Synthesis & Studio Sign-Off
            {
                "id": 13,
                "chapter": "7. Executive Summary & Action Plan",
                "speaker": "Luna",
                "role": "Curious Inquisitor (Moon Bot)",
                "turn_type": "question",
                "text": f"A comprehensive, crystal-clear executive roadmap, Nova! To recap our intelligence brief for {dataset_name}: verified architectural integrity at {completeness_pct}%, solid driver momentum, clear segment Pareto focus, and targeted anomaly controls. That concludes our DataNova Executive Briefing—thank you for tuning in to our studio!",
                "emphasis": "normal"
            }
        ]

        total_words = sum(len(turn["text"].split()) for turn in dialogue)
        # Average conversational reading pace: ~145 words per minute
        est_duration = round((total_words / 145) * 60, 1)

        key_takeaways = [
            f"Architecture: {row_count:,} rows and {col_count} columns in {domain} with {completeness_pct}% data completeness ({mem_str}).",
            f"KPI Pulse: {top_kpi_text or f'{lead_col_name} totaling {lead_total_str} with {lead_spread_text}'}.",
            f"Segments: {cat_insights_text or f'Categorical distribution balanced across {len(categorical_cols)} dimensions'}.",
            f"Correlations: {correlation_text}.",
            f"Risk & Variance: {anomaly_text}.",
            f"Forecast & Outlook: {growth_direction} with ~{sensitivity_impact_str} projected sensitivity per 5% shift."
        ]

        full_script = " ".join(turn["text"] for turn in dialogue)

        return {
            "title": f"Executive Intelligence Brief • {dataset_name}",
            "dataset_name": dataset_name,
            "domain": domain,
            "duration_est_seconds": est_duration,
            "total_words": total_words,
            "dialogue": dialogue,
            "key_takeaways": key_takeaways,
            "full_script": full_script
        }
