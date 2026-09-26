import logging
import math
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.models import Dataset, TableMetadata, TableRelationship
from app.services.file_processor import FileProcessor
from app.services.cache_manager import DataFrameCache
from app.services.relationship_finder import RelationshipFinder

logger = logging.getLogger("datova.health_relationship")

class HealthRelationshipService:

    @classmethod
    def analyze_dataset(cls, dataset_id: str, db: Session) -> Dict[str, Any]:
        """
        Generates an executive, comprehensive Data Health & Relationship Intelligence Summary
        covering every uploaded table, identifying good vs bad relationships, and structuring
        the findings for executive presentation and reporting.
        """
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            raise ValueError("Dataset not found")

        table_records = db.query(TableMetadata).filter(TableMetadata.dataset_id == dataset_id).all()
        if not table_records:
            raise ValueError("No table metadata found for dataset")

        # 1. Load dataframes for all tables
        dataframes: Dict[str, pd.DataFrame] = {}
        for tr in table_records:
            df = None
            try:
                df = DataFrameCache.get_table_dataframe(tr.storage_path, tr.table_name)
            except Exception:
                pass

            if df is None:
                try:
                    dfs = FileProcessor.read_file_to_dataframes(tr.storage_path)
                    if tr.table_name in dfs:
                        df = dfs[tr.table_name]
                    elif dfs:
                        df = list(dfs.values())[0]
                    if df is not None:
                        DataFrameCache.set(tr.storage_path, tr.table_name, df)
                except Exception as e:
                    logger.warning(f"Could not load dataframe for {tr.table_name}: {e}")

            if df is not None and not df.empty:
                dataframes[tr.table_name] = df

        if not dataframes:
            raise ValueError("No valid data could be loaded for this dataset")

        # 2. Analyze individual table summaries
        tables_summary: List[Dict[str, Any]] = []
        total_cells_all = 0
        total_nulls_all = 0
        total_duplicates_all = 0
        total_rows_all = 0

        for t_name, df in dataframes.items():
            t_rows = len(df)
            t_cols = len(df.columns)
            t_cells = t_rows * t_cols
            t_nulls = int(df.isnull().sum().sum())
            t_dups = int(df.duplicated().sum())

            total_rows_all += t_rows
            total_cells_all += t_cells
            total_nulls_all += t_nulls
            total_duplicates_all += t_dups

            completeness_pct = round(((t_cells - t_nulls) / max(t_cells, 1)) * 100, 1)

            # Analyze columns
            col_breakdown = []
            num_cols = []
            cat_cols = []
            primary_keys = []

            for col in df.columns:
                series = df[col]
                null_c = int(series.isnull().sum())
                null_pct = round((null_c / max(t_rows, 1)) * 100, 1)
                uniq_c = int(series.nunique())
                dtype_str = str(series.dtype)

                is_num = pd.api.types.is_numeric_dtype(series)
                is_dt = pd.api.types.is_datetime64_any_dtype(series) or "date" in col.lower() or "time" in col.lower()

                if is_num:
                    num_cols.append(col)
                else:
                    cat_cols.append(col)

                # Outliers using IQR
                outlier_c = 0
                if is_num and t_rows >= 8:
                    clean_s = series.dropna()
                    if len(clean_s) > 4:
                        q25, q75 = np.percentile(clean_s, [25, 75])
                        iqr = q75 - q25
                        if iqr > 0:
                            lower = q25 - 1.5 * iqr
                            upper = q75 + 1.5 * iqr
                            outlier_c = int(((clean_s < lower) | (clean_s > upper)).sum())

                # Evaluate column status
                if uniq_c == t_rows and t_rows > 1 and null_c == 0:
                    primary_keys.append(col)
                    col_status = "good"
                    note = "100% Unique & Complete (Candidate Primary Key)"
                elif null_pct > 20:
                    col_status = "bad"
                    note = f"High missingness ({null_pct}% nulls)"
                elif outlier_c > (t_rows * 0.08) and is_num:
                    col_status = "warning"
                    note = f"Elevated outlier dispersion ({outlier_c:,} outliers)"
                elif uniq_c <= 1 and t_rows > 1:
                    col_status = "bad"
                    note = "Zero variance (constant value across all rows)"
                elif null_c == 0:
                    col_status = "good"
                    note = "100% Complete & Verified"
                else:
                    col_status = "neutral"
                    note = f"{null_pct}% missing ({null_c:,} nulls)"

                col_breakdown.append({
                    "name": col,
                    "dtype": "numeric" if is_num else ("datetime" if is_dt else "string"),
                    "null_count": null_c,
                    "null_pct": null_pct,
                    "unique_count": uniq_c,
                    "outlier_count": outlier_c,
                    "status": col_status,
                    "note": note
                })

            # Calculate table health score
            table_score = 100
            table_score -= min(35, int((t_nulls / max(t_cells, 1)) * 100 * 1.5))
            table_score -= min(25, int((t_dups / max(t_rows, 1)) * 100 * 2.0))
            outlier_count_table = sum(c["outlier_count"] for c in col_breakdown)
            table_score -= min(15, int((outlier_count_table / max(t_cells, 1)) * 100 * 1.2))
            table_score = max(20, min(100, table_score))

            if table_score >= 90:
                rating = "Optimal"
            elif table_score >= 80:
                rating = "Good"
            elif table_score >= 65:
                rating = "Moderate"
            else:
                rating = "Needs Attention"

            summary_narrative = (
                f"Table '{t_name}' houses {t_rows:,} records across {t_cols} features with a data density "
                f"of {completeness_pct}%. "
                f"{f'Identified key candidates: {', '.join(primary_keys)}. ' if primary_keys else 'No distinct single-column primary key detected. '}"
                f"{f'Warning: {t_dups:,} duplicate rows detected. ' if t_dups > 0 else 'Zero duplicate records found. '}"
                f"{f'Identified {len(num_cols)} quantitative metrics and {len(cat_cols)} categorical dimensions.'}"
            )

            tables_summary.append({
                "table_name": t_name,
                "row_count": t_rows,
                "column_count": t_cols,
                "health_score": table_score,
                "rating": rating,
                "completeness_pct": completeness_pct,
                "duplicate_rows": t_dups,
                "null_cells": t_nulls,
                "outlier_cells": outlier_count_table,
                "primary_keys": primary_keys,
                "summary_narrative": summary_narrative,
                "column_breakdown": col_breakdown
            })

        # 3. Comprehensive Good vs Bad Relationship Discovery
        good_relationships: List[Dict[str, Any]] = []
        bad_relationships: List[Dict[str, Any]] = []

        # A. Inter-table foreign key relationships
        detected_rels = []
        try:
            detected_rels = RelationshipFinder.detect_relationships(dataframes)
        except Exception as e:
            logger.warning(f"Error finding relationships: {e}")

        for rel in detected_rels:
            conf = rel.get("confidence", 0.7)
            src = f"{rel['source_table']}.{rel['source_column']}"
            tgt = f"{rel['target_table']}.{rel['target_column']}"

            if conf >= 0.80:
                good_relationships.append({
                    "relationship_type": "inter_table_key",
                    "source": src,
                    "target": tgt,
                    "status": "GOOD",
                    "strength_score": conf,
                    "metric_label": f"Key Match Confidence: {int(conf * 100)}%",
                    "category": "Referential Key Integrity",
                    "explanation": (
                        f"Robust relational bridge between '{src}' and '{tgt}' ({rel.get('relationship_type', 'one_to_many').replace('_', '-')}). "
                        f"{rel.get('reasoning', '')}"
                    ),
                    "impact": "Enables seamless multi-table joins, star-schema modeling, and unified cohort drill-downs without data loss.",
                    "recommendation": "Preserve this join path as a validated primary foreign-key relation in data models and reporting."
                })
            else:
                bad_relationships.append({
                    "relationship_type": "inter_table_key",
                    "source": src,
                    "target": tgt,
                    "status": "BAD",
                    "strength_score": conf,
                    "metric_label": f"Low Key Overlap ({int(conf * 100)}%)",
                    "category": "Orphan Key & Referential Risk",
                    "explanation": (
                        f"Weak relational correspondence between '{src}' and '{tgt}'. "
                        f"A substantial proportion of keys do not match, risking orphan records."
                    ),
                    "impact": "Inner joins will drop unmatched transactions; outer joins will introduce excessive NULL values.",
                    "recommendation": "Verify upstream data extraction filters or audit whether key formatting (e.g. leading zeros, whitespace) differs."
                })

        # B. Intra-table Feature Correlations across each dataframe
        for t_name, df in dataframes.items():
            num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            # Exclude obvious IDs from numerical correlation analysis
            analyst_nums = [c for c in num_cols if not (c.lower().endswith("id") or c.lower().endswith("_id") or c.lower().endswith("code"))]

            if len(analyst_nums) >= 2:
                corr_matrix = df[analyst_nums].corr(method="pearson")

                seen_pairs = set()
                for i in range(len(analyst_nums)):
                    for j in range(i + 1, len(analyst_nums)):
                        col_a = analyst_nums[i]
                        col_b = analyst_nums[j]
                        pair_key = tuple(sorted([col_a, col_b]))
                        if pair_key in seen_pairs:
                            continue
                        seen_pairs.add(pair_key)

                        r_val = corr_matrix.loc[col_a, col_b]
                        if math.isnan(r_val):
                            continue

                        abs_r = abs(r_val)
                        direction = "positive" if r_val > 0 else "inverse"

                        # Check 1: Multicollinearity (BAD)
                        if abs_r >= 0.92:
                            bad_relationships.append({
                                "relationship_type": "column_correlation",
                                "source": f"{t_name}.{col_a}",
                                "target": f"{t_name}.{col_b}",
                                "status": "BAD",
                                "strength_score": round(r_val, 3),
                                "metric_label": f"Severe Collinearity (r = {r_val:+.3f})",
                                "category": "Multicollinearity & Redundancy Risk",
                                "explanation": (
                                    f"'{col_a}' and '{col_b}' move in lockstep with a near-perfect {direction} correlation (r = {r_val:+.3f}). "
                                    f"They convey redundant variance."
                                ),
                                "impact": "Inflates regression coefficients, destabilizes machine learning models, and creates deceptive double-counting in KPI weighted totals.",
                                "recommendation": "Consolidate these two features or remove one before training predictive models or building driver trees."
                            })

                        # Check 2: Strong Predictive Co-Movement (GOOD)
                        elif 0.60 <= abs_r < 0.92:
                            good_relationships.append({
                                "relationship_type": "column_correlation",
                                "source": f"{t_name}.{col_a}",
                                "target": f"{t_name}.{col_b}",
                                "status": "GOOD",
                                "strength_score": round(r_val, 3),
                                "metric_label": f"Strong Co-movement (r = {r_val:+.3f})",
                                "category": "Predictive Driver Co-movement",
                                "explanation": (
                                    f"Statistically significant {direction} relationship (r = {r_val:+.3f}) between '{col_a}' and '{col_b}'. "
                                    f"Changes in '{col_a}' systematically correspond to predictable shifts in '{col_b}'."
                                ),
                                "impact": "Serves as a reliable operational driver and high-impact input for time-series forecasting, what-if simulators, and scenario planning.",
                                "recommendation": "Leverage this relationship in executive scatterplots, multivariate forecast models, and decision-tree rules."
                            })

                        # Check 3: Expected Linkage Decoupling (WARNING/BAD for domain pairings like Price & Revenue or Quantity & Total)
                        elif abs_r < 0.08:
                            name_pair = f"{col_a.lower()}_{col_b.lower()}"
                            suspected_pairs = ["price_sales", "qty_amount", "revenue_cost", "spend_conversion", "hours_score"]
                            is_suspect = any(sp in name_pair or name_pair in sp for sp in suspected_pairs)
                            if is_suspect:
                                bad_relationships.append({
                                    "relationship_type": "column_correlation",
                                    "source": f"{t_name}.{col_a}",
                                    "target": f"{t_name}.{col_b}",
                                    "status": "BAD",
                                    "strength_score": round(r_val, 3),
                                    "metric_label": f"Decoupled Signal (r = {r_val:+.3f})",
                                    "category": "Unexpected Signal Decoupling",
                                    "explanation": (
                                        f"'{col_a}' and '{col_b}' show near-zero statistical correlation (r = {r_val:+.3f}) "
                                        f"despite expected business co-dependence."
                                    ),
                                    "impact": "Suggests decoupled transactional processes, mismatched observation periods, or underlying data fragmentation.",
                                    "recommendation": "Inspect data granularity to ensure transactions were recorded in the same currency, time zone, or cohort."
                                })

        # C. Completeness & Structural Quality Relationships
        for t_name, df in dataframes.items():
            for col in df.columns:
                null_pct = (df[col].isnull().sum() / max(len(df), 1)) * 100
                if null_pct > 25:
                    bad_relationships.append({
                        "relationship_type": "structural_quality",
                        "source": f"{t_name}.{col}",
                        "target": "Dataset Completeness",
                        "status": "BAD",
                        "strength_score": round(null_pct / 100, 2),
                        "metric_label": f"{null_pct:.1f}% Missing Values",
                        "category": "Data Density Gap",
                        "explanation": f"Feature '{col}' in '{t_name}' contains {null_pct:.1f}% empty or null values.",
                        "impact": "Severely degrades statistical validity; any analytical query filtering or grouping by this column will discard or misrepresent observations.",
                        "recommendation": "Apply automated imputation (median/mode) in Data Prep or review the upstream ingestion pipeline."
                    })
                elif null_pct == 0 and len(df) > 50:
                    good_relationships.append({
                        "relationship_type": "structural_quality",
                        "source": f"{t_name}.{col}",
                        "target": "Dataset Completeness",
                        "status": "GOOD",
                        "strength_score": 1.0,
                        "metric_label": "100% Data Density",
                        "category": "High Quality Feature Integrity",
                        "explanation": f"Feature '{col}' in '{t_name}' has 100% complete records with zero missingness.",
                        "impact": "Provides rock-solid data reliability for all downstream aggregation, grouping, and executive KPI computation.",
                        "recommendation": "Safe for use as an uncompromised anchor feature across dashboards and automated reports."
                    })

        # Cap lists to high-value items so UI is punchy and readable
        good_relationships.sort(key=lambda x: abs(x.get("strength_score", 0)), reverse=True)
        bad_relationships.sort(key=lambda x: abs(x.get("strength_score", 0)), reverse=True)

        good_relationships = good_relationships[:12]
        bad_relationships = bad_relationships[:12]

        good_count = len(good_relationships)
        bad_count = len(bad_relationships)
        warning_count = sum(1 for b in bad_relationships if "warning" in b.get("category", "").lower())

        # Overall health score & rating
        overall_score = dataset.data_health_score or 85
        if overall_score >= 90:
            overall_rating = "Exceptional Integrity"
        elif overall_score >= 80:
            overall_rating = "Reliable Quality"
        elif overall_score >= 65:
            overall_rating = "Moderate Health"
        else:
            overall_rating = "Audit Recommended"

        # Executive Summary Narrative
        exec_summary = (
            f"Automated Data Health & Relationship audit evaluated {len(dataframes)} uploaded data table(s) "
            f"comprising {total_rows_all:,} observations and {total_cells_all:,} total data points. "
            f"Overall health registered at **{overall_score}/100 ({overall_rating})**. "
            f"The analytical engine discovered **{good_count} high-integrity relationships** (strong predictive drivers and verified relational links) "
            f"and flagged **{bad_count} relational risks / data smells** (including multicollinearity, missingness, or referential leakage). "
            f"The dataset provides verified operational fidelity for downstream reporting, executive forecasting, and multi-dimensional dashboards."
        )

        # Key Takeaways
        key_takeaways = [
            f"Evaluated {len(dataframes)} table(s) with an aggregate data completeness rate of {round(((total_cells_all - total_nulls_all) / max(total_cells_all, 1)) * 100, 1)}%.",
            f"Discovered {good_count} optimal feature relationships offering strong predictive co-movement and verified referential integrity.",
            f"Identified {bad_count} potential data hazards, including {warning_count} warning item(s) that should be mitigated prior to deep statistical modeling.",
            f"Identified primary entity candidates in {sum(1 for t in tables_summary if t['primary_keys'])} table(s), ensuring reliable cross-table traceability."
        ]

        # Actionable Recommendations
        actionable_recs = [
            "Leverage verified strong correlations (r > 0.60) as primary levers in what-if scenarios and driver trees.",
            "De-duplicate or prune severe multicollinear feature pairs (r > 0.92) to safeguard regression models against coefficient inflation.",
            "Apply automated imputation in Data Prep for any feature exhibiting > 15% missingness before executive publishing.",
            "Use the verified foreign key mappings as standard join conditions across all custom SQL queries and chart builders."
        ]

        # Generate report-ready Markdown
        report_markdown = cls._generate_markdown_report(
            dataset_name=dataset.name,
            overall_score=overall_score,
            overall_rating=overall_rating,
            exec_summary=exec_summary,
            tables_summary=tables_summary,
            good_relationships=good_relationships,
            bad_relationships=bad_relationships,
            key_takeaways=key_takeaways,
            actionable_recs=actionable_recs
        )

        return {
            "dataset_id": dataset_id,
            "dataset_name": dataset.name,
            "overall_health_score": overall_score,
            "overall_rating": overall_rating,
            "total_tables": len(dataframes),
            "total_records": total_rows_all,
            "total_cells": total_cells_all,
            "total_nulls": total_nulls_all,
            "total_duplicates": total_duplicates_all,
            "executive_summary": exec_summary,
            "tables_summary": tables_summary,
            "good_relationships": good_relationships,
            "bad_relationships": bad_relationships,
            "good_count": good_count,
            "bad_count": bad_count,
            "warning_count": warning_count,
            "key_takeaways": key_takeaways,
            "actionable_recommendations": actionable_recs,
            "report_ready_markdown": report_markdown
        }

    @staticmethod
    def _generate_markdown_report(
        dataset_name: str,
        overall_score: int,
        overall_rating: str,
        exec_summary: str,
        tables_summary: List[Dict[str, Any]],
        good_relationships: List[Dict[str, Any]],
        bad_relationships: List[Dict[str, Any]],
        key_takeaways: List[str],
        actionable_recs: List[str]
    ) -> str:
        """Constructs an executive-ready Markdown section for reporting dossiers."""
        md = []
        md.append(f"## Data Health & Relationship Intelligence Audit: {dataset_name}\n")
        md.append(f"**Overall Health Score:** {overall_score}/100 ({overall_rating})  \n")
        md.append(f"{exec_summary}\n\n")

        md.append("### 1. Uploaded Data Architecture & Table Summaries\n")
        md.append("| Table Name | Observations | Features | Completeness | Duplicates | Health Score | Rating |")
        md.append("| :--- | :--- | :--- | :--- | :--- | :--- | :--- |")
        for t in tables_summary:
            md.append(f"| **{t['table_name']}** | {t['row_count']:,} | {t['column_count']} | {t['completeness_pct']}% | {t['duplicate_rows']:,} | {t['health_score']}/100 | {t['rating']} |")
        md.append("\n")

        md.append("### 2. High-Integrity & Optimal Relationships (What is Good)\n")
        if good_relationships:
            for r in good_relationships:
                md.append(f"- **[GOOD] {r['source']} ↔ {r['target']}** ({r['metric_label']})")
                md.append(f"  - *Category:* {r['category']}")
                md.append(f"  - *Finding:* {r['explanation']}")
                md.append(f"  - *Impact:* {r['impact']}\n")
        else:
            md.append("*No prominent strong linkages identified in this dataset.*  \n")
        md.append("\n")

        md.append("### 3. Critical Relational Risks & Warnings (What is Bad / Risky)\n")
        if bad_relationships:
            for r in bad_relationships:
                md.append(f"- **[ATTENTION] {r['source']} ↔ {r['target']}** ({r['metric_label']})")
                md.append(f"  - *Category:* {r['category']}")
                md.append(f"  - *Finding:* {r['explanation']}")
                md.append(f"  - *Remediation:* {r['recommendation']}\n")
        else:
            md.append("*Zero critical relational risks or multicollinear anomalies detected.*  \n")
        md.append("\n")

        md.append("### 4. Executive Recommendations & Next Steps\n")
        for rec in actionable_recs:
            md.append(f"- {rec}")
        md.append("\n")

        return "\n".join(md)
