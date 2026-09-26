import os
import uuid
import math
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session

from app.models.dataset import Dataset, TableMetadata, ColumnMetadata, FileRecord
from app.models.relationship import TableRelationship
from app.models.analysis import KpiMetric, Insight, AnalysisRun
from app.services.cache_manager import DataFrameCache
from app.services.file_processor import FileProcessor
from app.services.profiler import DataProfiler
from app.services.quality_scorer import QualityScorer
from app.services.domain_detector import DomainDetector
from app.services.kpi_engine import KpiEngine
from app.services.insight_engine import InsightEngine
from app.services.anomaly_detector import AnomalyDetector
from app.services.relationship_finder import RelationshipFinder
from app.config import settings

class FusionEngine:
    """
    Enterprise-grade Multi-Dataset Fusion & Semantic Join Engine.
    Enables cross-dataset table pairing, semantic join quality evaluation,
    cross-table correlation matrix computation, and fused dataset materialization.
    """

    @staticmethod
    def get_candidates(db: Session) -> List[Dict[str, Any]]:
        """
        Discovers all tables across all ingested datasets in the system.
        """
        datasets = db.query(Dataset).filter(Dataset.status == "ready").all()
        candidates: List[Dict[str, Any]] = []

        for ds in datasets:
            for tbl in ds.tables:
                columns = [
                    {
                        "column_name": c.column_name,
                        "data_type": c.data_type,
                        "is_identifier": c.is_identifier,
                        "unique_count": c.unique_count,
                        "missing_count": c.missing_count,
                        "sample_values": c.sample_values[:5] if c.sample_values else []
                    }
                    for c in tbl.columns
                ]

                candidates.append({
                    "table_key": f"{ds.id}::{tbl.table_name}",
                    "dataset_id": ds.id,
                    "dataset_name": ds.name,
                    "table_name": tbl.table_name,
                    "row_count": tbl.row_count,
                    "column_count": tbl.column_count,
                    "detected_domain": ds.detected_domain,
                    "columns": columns,
                    "storage_path": tbl.storage_path
                })

        return candidates

    @staticmethod
    def load_table_df(db: Session, dataset_id: str, table_name: str) -> Optional[pd.DataFrame]:
        tbl_meta = db.query(TableMetadata).filter(
            TableMetadata.dataset_id == dataset_id,
            TableMetadata.table_name == table_name
        ).first()

        if not tbl_meta:
            return None

        return DataFrameCache.get_table_dataframe(tbl_meta.storage_path, tbl_meta.table_name)

    @staticmethod
    def evaluate_semantic_join(
        df1: pd.DataFrame,
        df2: pd.DataFrame,
        key1: str,
        key2: str,
        join_type: str = "inner"
    ) -> Dict[str, Any]:
        """
        Evaluates join key overlap, key collision, match rate %, and cartesian risk.
        """
        if key1 not in df1.columns or key2 not in df2.columns:
            raise ValueError(f"Join key missing: '{key1}' in Table 1 or '{key2}' in Table 2")

        series1 = df1[key1].dropna().astype(str).str.strip()
        series2 = df2[key2].dropna().astype(str).str.strip()

        keys1 = set(series1.unique())
        keys2 = set(series2.unique())

        intersection = keys1.intersection(keys2)
        total_unique_keys = len(keys1.union(keys2))

        overlap_count = len(intersection)
        match_rate_pct = round((overlap_count / max(1, len(keys1))) * 100, 1)
        reverse_match_rate_pct = round((overlap_count / max(1, len(keys2))) * 100, 1)

        t1_orphan_keys = len(keys1 - keys2)
        t2_orphan_keys = len(keys2 - keys1)

        t1_nulls = int(df1[key1].isna().sum())
        t2_nulls = int(df2[key2].isna().sum())

        is_t1_unique = len(keys1) == len(df1) and len(df1) > 0
        is_t2_unique = len(keys2) == len(df2) and len(df2) > 0

        if is_t1_unique and is_t2_unique:
            cardinality = "one_to_one"
        elif is_t1_unique and not is_t2_unique:
            cardinality = "one_to_many"
        elif not is_t1_unique and is_t2_unique:
            cardinality = "many_to_one"
        else:
            cardinality = "many_to_many"

        cartesian_risk = cardinality == "many_to_many" and (len(df1) * len(df2) > 200000)

        # Estimate projected rows based on join_type
        norm_join = join_type.lower()
        if norm_join == "inner":
            projected_rows = sum(df1[key1].astype(str).isin(intersection))
        elif norm_join == "left":
            projected_rows = len(df1)
        elif norm_join == "right":
            projected_rows = len(df2)
        else:  # outer
            projected_rows = len(df1) + t2_orphan_keys

        # Composite join health score (0-100)
        penalty = 0
        if match_rate_pct < 50:
            penalty += (50 - match_rate_pct) * 0.7
        if t1_nulls > 0:
            penalty += min(15, (t1_nulls / len(df1)) * 30)
        if cartesian_risk:
            penalty += 25

        join_health_score = max(5, min(100, round(100 - penalty)))

        # Recommended strategy
        if match_rate_pct > 85:
            rec_strategy = "inner"
            strategy_reason = f"High key overlap ({match_rate_pct}%) makes INNER JOIN optimal for clean intersection."
        elif match_rate_pct >= 40:
            rec_strategy = "left"
            strategy_reason = f"Moderate match ({match_rate_pct}%). LEFT JOIN preserves all primary entities while augmenting attributes."
        else:
            rec_strategy = "full"
            strategy_reason = f"Low direct overlap ({match_rate_pct}%). FULL OUTER JOIN preserves all records across both datasets."

        return {
            "key1": key1,
            "key2": key2,
            "join_type": join_type,
            "cardinality": cardinality,
            "match_rate_pct": match_rate_pct,
            "reverse_match_rate_pct": reverse_match_rate_pct,
            "overlap_count": overlap_count,
            "total_distinct_keys": total_unique_keys,
            "table1_orphan_keys": t1_orphan_keys,
            "table2_orphan_keys": t2_orphan_keys,
            "table1_nulls": t1_nulls,
            "table2_nulls": t2_nulls,
            "cartesian_risk": cartesian_risk,
            "projected_rows": projected_rows,
            "join_health_score": join_health_score,
            "recommended_strategy": rec_strategy,
            "strategy_reason": strategy_reason
        }

    @staticmethod
    def execute_fusion(
        df1: pd.DataFrame,
        df2: pd.DataFrame,
        key1: str,
        key2: str,
        join_type: str = "inner",
        name1: str = "TableA",
        name2: str = "TableB"
    ) -> Tuple[pd.DataFrame, Dict[str, Dict[str, str]]]:
        """
        Executes merge and produces provenance metadata for every resulting column.
        """
        clean_name1 = name1.replace(" ", "_")
        clean_name2 = name2.replace(" ", "_")

        # Copy dataframes to avoid mutating originals
        sub_df1 = df1.copy()
        sub_df2 = df2.copy()

        # Normalize keys as strings for robust matching
        sub_df1[f"_join_key_1"] = sub_df1[key1].astype(str).str.strip()
        sub_df2[f"_join_key_2"] = sub_df2[key2].astype(str).str.strip()

        # Track column provenance
        provenance: Dict[str, Dict[str, str]] = {}
        for c in df1.columns:
            provenance[c] = {"source_table": name1, "original_name": c}

        # Handle overlapping column names
        rename_map2 = {}
        for c in df2.columns:
            if c in df1.columns and c != key1:
                new_name = f"{c}_{clean_name2}"
                rename_map2[c] = new_name
                provenance[new_name] = {"source_table": name2, "original_name": c}
            elif c == key2 and c == key1:
                # Same key name, keep primary
                provenance[c] = {"source_table": f"{name1} & {name2}", "original_name": c}
            else:
                provenance[c] = {"source_table": name2, "original_name": c}

        if rename_map2:
            sub_df2 = sub_df2.rename(columns=rename_map2)

        merged = pd.merge(
            sub_df1,
            sub_df2,
            left_on="_join_key_1",
            right_on="_join_key_2",
            how=join_type.lower()
        )

        # Drop temporary join key columns
        merged = merged.drop(columns=["_join_key_1", "_join_key_2"], errors="ignore")

        # Replace NaN with clean representations
        return merged, provenance

    @staticmethod
    def compute_cross_correlations(
        fused_df: pd.DataFrame,
        t1_cols: List[str],
        t2_cols: List[str]
    ) -> Dict[str, Any]:
        """
        Computes Pearson correlation coefficient matrix between numeric columns of Table 1 and Table 2.
        Identifies top cross-table synergies and extracts scatter sample coordinates.
        """
        # Find numeric columns in fused_df that belong to t1 and t2
        numeric_cols = fused_df.select_dtypes(include=[np.number]).columns.tolist()

        t1_num = [c for c in t1_cols if c in numeric_cols and fused_df[c].nunique() > 1]
        t2_num = [c for c in t2_cols if c in numeric_cols and fused_df[c].nunique() > 1]

        if not t1_num or not t2_num:
            return {
                "matrix": [],
                "t1_columns": t1_num,
                "t2_columns": t2_num,
                "top_synergies": [],
                "scatter_pairs": []
            }

        matrix: List[Dict[str, Any]] = []
        synergies: List[Dict[str, Any]] = []

        for c1 in t1_num:
            row: Dict[str, Any] = {"feature_a": c1, "correlations": {}}
            for c2 in t2_num:
                if c1 == c2:
                    continue
                valid_mask = fused_df[[c1, c2]].dropna()
                if len(valid_mask) >= 5:
                    r_val = float(np.corrcoef(valid_mask[c1], valid_mask[c2])[0, 1])
                    if not math.isnan(r_val) and not math.isinf(r_val):
                        r_rounded = round(r_val, 3)
                        row["correlations"][c2] = r_rounded

                        # Determine strength category
                        abs_r = abs(r_rounded)
                        if abs_r >= 0.7:
                            strength = "Strong Positive" if r_rounded > 0 else "Strong Inverse"
                        elif abs_r >= 0.4:
                            strength = "Moderate Positive" if r_rounded > 0 else "Moderate Inverse"
                        else:
                            strength = "Weak / Neutral"

                        synergies.append({
                            "feature_a": c1,
                            "feature_b": c2,
                            "correlation": r_rounded,
                            "abs_correlation": abs_r,
                            "strength": strength,
                            "sample_count": len(valid_mask)
                        })
                else:
                    row["correlations"][c2] = 0.0
            matrix.append(row)

        # Sort synergies by absolute correlation magnitude
        synergies.sort(key=lambda x: x["abs_correlation"], reverse=True)
        top_synergies = synergies[:6]

        # Generate scatter plot data for top 3 synergies
        scatter_pairs: List[Dict[str, Any]] = []
        for syn in top_synergies[:3]:
            feat_a = syn["feature_a"]
            feat_b = syn["feature_b"]
            valid = fused_df[[feat_a, feat_b]].dropna()

            # Downsample to 60 points max for high-speed rendering
            if len(valid) > 60:
                sampled = valid.sample(n=60, random_state=42)
            else:
                sampled = valid

            # Calculate linear regression slope & intercept for trendline
            x_vals = sampled[feat_a].astype(float).values
            y_vals = sampled[feat_b].astype(float).values

            points = [{"x": round(float(x), 2), "y": round(float(y), 2)} for x, y in zip(x_vals, y_vals)]

            if len(x_vals) > 1 and np.var(x_vals) > 0:
                slope, intercept = np.polyfit(x_vals, y_vals, 1)
                trendline = {
                    "slope": round(float(slope), 4),
                    "intercept": round(float(intercept), 2),
                    "x_min": round(float(min(x_vals)), 2),
                    "x_max": round(float(max(x_vals)), 2),
                    "y_min": round(float(slope * min(x_vals) + intercept), 2),
                    "y_max": round(float(slope * max(x_vals) + intercept), 2)
                }
            else:
                trendline = None

            scatter_pairs.append({
                "feature_a": feat_a,
                "feature_b": feat_b,
                "correlation": syn["correlation"],
                "strength": syn["strength"],
                "points": points,
                "trendline": trendline
            })

        return {
            "matrix": matrix,
            "t1_columns": t1_num,
            "t2_columns": t2_num,
            "top_synergies": top_synergies,
            "scatter_pairs": scatter_pairs
        }

    @staticmethod
    def materialize_dataset(
        name: str,
        fused_df: pd.DataFrame,
        db: Session,
        provenance_meta: Optional[Dict[str, Any]] = None
    ) -> Dataset:
        """
        Persists the fused DataFrame as a permanent, first-class Dataset in DATOVA,
        complete with autonomous domain detection, quality scoring, KPI generation,
        and insight profiling.
        """
        dataset_id = str(uuid.uuid4())
        clean_name = name.strip() or f"Fused Intelligence {datetime.now(timezone.utc).strftime('%b %d %H:%M')}"

        dataset = Dataset(
            id=dataset_id,
            name=clean_name,
            description=f"Autonomous multi-dataset fusion synthesized on {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}.",
            status="processing",
            row_count=len(fused_df),
            column_count=len(fused_df.columns)
        )
        db.add(dataset)
        db.commit()

        # Save to disk
        dataset_dir = settings.UPLOAD_DIR / dataset_id
        dataset_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{clean_name.lower().replace(' ', '_')}.csv"
        file_path = dataset_dir / filename

        fused_df.to_csv(file_path, index=False)
        file_size = os.path.getsize(file_path)

        file_rec = FileRecord(
            id=str(uuid.uuid4()),
            dataset_id=dataset_id,
            filename=filename,
            original_name=filename,
            file_path=str(file_path),
            file_size_bytes=file_size,
            file_type="csv"
        )
        db.add(file_rec)
        db.flush()

        # Profile Table
        table_name = "fused_master"
        tbl_prof = DataProfiler.profile_table(fused_df, table_name)

        tbl_meta = TableMetadata(
            id=str(uuid.uuid4()),
            dataset_id=dataset_id,
            file_id=file_rec.id,
            table_name=table_name,
            row_count=tbl_prof["row_count"],
            column_count=tbl_prof["column_count"],
            storage_path=str(file_path),
            sample_data=tbl_prof["sample_data"]
        )
        db.add(tbl_meta)
        db.flush()

        # Store Columns Metadata
        for c in tbl_prof["columns"]:
            col_meta = ColumnMetadata(
                id=str(uuid.uuid4()),
                table_id=tbl_meta.id,
                column_name=c["column_name"],
                data_type=c["data_type"],
                original_type=c["original_type"],
                missing_count=c["missing_count"],
                missing_percentage=c["missing_percentage"],
                unique_count=c["unique_count"],
                cardinality_ratio=c["cardinality_ratio"],
                is_identifier=c["is_identifier"],
                is_potential_kpi=c["is_potential_kpi"],
                statistics=c["statistics"],
                sample_values=c["sample_values"]
            )
            db.add(col_meta)

        # Autonomous Intelligence Pipeline
        tables_profile = [tbl_prof]
        all_dfs = {table_name: fused_df}

        # 1. Quality Scoring
        quality_res = QualityScorer.calculate_health_score(tables_profile)
        dataset.data_health_score = quality_res["score"]

        # 2. Domain Detection
        domain, dom_conf, dom_reason = DomainDetector.detect_domain(tables_profile)
        dataset.detected_domain = domain
        dataset.domain_confidence = dom_conf
        dataset.domain_reasoning = dom_reason

        # 3. KPIs
        discovered_kpis = KpiEngine.discover_kpis(all_dfs, domain)
        for idx, k in enumerate(discovered_kpis):
            kpi_rec = KpiMetric(
                id=str(uuid.uuid4()),
                dataset_id=dataset_id,
                name=k["name"],
                display_name=k["display_name"],
                value=k["value"],
                formatted_value=k["formatted_value"],
                unit=k.get("unit", ""),
                calculation_type=k["calculation_type"],
                source_table=k.get("source_table", table_name),
                source_column=k.get("source_column"),
                formula_explanation=k["formula_explanation"],
                impact_summary=k.get("impact_summary"),
                confidence=k["confidence"],
                order_index=idx
            )
            db.add(kpi_rec)

        # 4. Insights & Anomalies
        anomalies = AnomalyDetector.detect_anomalies(all_dfs)
        discovered_insights = InsightEngine.generate_insights(
            all_dfs, domain, discovered_kpis, anomalies, quality_res
        )
        for ins in discovered_insights:
            ins_rec = Insight(
                id=str(uuid.uuid4()),
                dataset_id=dataset_id,
                title=ins["title"],
                category=ins["category"],
                statement_type=ins["statement_type"],
                description=ins["description"],
                calculation_details=ins.get("calculation_details", {}),
                why_it_matters=ins["why_it_matters"],
                recommendation=ins.get("recommendation"),
                severity=ins["severity"],
                confidence=ins["confidence"],
                source_table=ins.get("source_table", table_name),
                source_columns=ins.get("source_columns", [])
            )
            db.add(ins_rec)

        dataset.status = "ready"
        db.commit()
        db.refresh(dataset)
        return dataset
