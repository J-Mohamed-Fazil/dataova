from typing import Dict, Any, List

class QualityScorer:

    @staticmethod
    def calculate_health_score(tables_profile: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculates a transparent 0-100 data health score and itemizes defects.
        Starting baseline: 100 points.
        Penalties:
        - Missing cell ratio (up to -35 points)
        - Duplicate row ratio (up to -25 points)
        - Extreme missing columns (>50% null) (-10 points each)
        - Constant columns (variance 0) (-5 points each)
        """
        total_rows = sum(t["row_count"] for t in tables_profile)
        total_cols = sum(t["column_count"] for t in tables_profile)
        total_cells = sum(t["row_count"] * t["column_count"] for t in tables_profile)
        total_missing = sum(t["missing_cells"] for t in tables_profile)
        total_duplicates = sum(t["duplicate_rows"] for t in tables_profile)

        if total_cells == 0:
            return {
                "score": 0.0,
                "rating": "Critical",
                "issues": [{"severity": "critical", "message": "Dataset is empty."}],
                "metrics": {"missing_pct": 0, "duplicate_pct": 0}
            }

        missing_ratio = total_missing / total_cells
        duplicate_ratio = total_duplicates / max(total_rows, 1)

        score = 100.0
        issues: List[Dict[str, Any]] = []

        # 1. Missing values penalty
        missing_penalty = min(35.0, missing_ratio * 70.0)
        score -= missing_penalty
        if missing_ratio > 0.05:
            severity = "critical" if missing_ratio > 0.25 else ("high" if missing_ratio > 0.1 else "medium")
            issues.append({
                "severity": severity,
                "category": "Missing Values",
                "title": f"High Missing Data ({round(missing_ratio * 100, 1)}%)",
                "description": f"A total of {total_missing:,} cells ({round(missing_ratio * 100, 1)}%) are null or missing across the dataset.",
                "affected_records": total_missing,
                "recommendation": "Impute missing numeric values with median/mean or filter incomplete records prior to deep statistical modeling."
            })

        # 2. Duplicate rows penalty
        duplicate_penalty = min(25.0, duplicate_ratio * 100.0)
        score -= duplicate_penalty
        if total_duplicates > 0:
            severity = "high" if duplicate_ratio > 0.1 else "medium"
            issues.append({
                "severity": severity,
                "category": "Duplicates",
                "title": f"Duplicate Records Detected ({total_duplicates:,} rows)",
                "description": f"{total_duplicates:,} rows ({round(duplicate_ratio * 100, 1)}%) are exact duplicates of other records.",
                "affected_records": total_duplicates,
                "recommendation": "De-duplicate records to prevent double-counting transaction volumes or inflating performance metrics."
            })

        # 3. Column-specific inspections
        for table in tables_profile:
            t_name = table["table_name"]
            for col in table["columns"]:
                c_name = col["column_name"]
                c_missing_pct = col["missing_percentage"]
                
                if c_missing_pct > 50.0:
                    score -= 3.0
                    issues.append({
                        "severity": "high",
                        "category": "High Null Column",
                        "title": f"Column '{c_name}' in {t_name} is mostly missing ({c_missing_pct}%)",
                        "description": f"More than half the records in column '{c_name}' lack data.",
                        "affected_records": col["missing_count"],
                        "recommendation": "Consider excluding this column from aggregate reporting or investigating upstream data collection."
                    })
                
                if col["unique_count"] <= 1 and table["row_count"] > 10:
                    score -= 2.0
                    issues.append({
                        "severity": "low",
                        "category": "Constant Column",
                        "title": f"Column '{c_name}' in {t_name} has zero variance",
                        "description": f"All values are identical ({col['sample_values'][:1]}). Provides no discriminatory information.",
                        "affected_records": table["row_count"],
                        "recommendation": "Safe to drop from comparative analytics."
                    })

        final_score = max(5.0, min(100.0, round(score, 1)))

        if final_score >= 85:
            rating = "Excellent"
        elif final_score >= 70:
            rating = "Good"
        elif final_score >= 50:
            rating = "Fair"
        else:
            rating = "Poor"

        return {
            "score": final_score,
            "rating": rating,
            "issues": issues,
            "metrics": {
                "total_rows": total_rows,
                "total_columns": total_cols,
                "total_cells": total_cells,
                "missing_cells": total_missing,
                "missing_pct": round(missing_ratio * 100, 2),
                "duplicate_rows": total_duplicates,
                "duplicate_pct": round(duplicate_ratio * 100, 2)
            }
        }
