from typing import Dict, Any, List
import numpy as np
import pandas as pd

class AnomalyDetector:

    @staticmethod
    def detect_anomalies(dataframes: Dict[str, pd.DataFrame]) -> List[Dict[str, Any]]:
        """
        Detects statistical anomalies across tables using IQR and Z-Score methods.
        Returns itemized anomaly records with exact thresholds, counts, and explanations.
        """
        records: List[Dict[str, Any]] = []

        for table_name, df in dataframes.items():
            num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            
            for col in num_cols:
                col_lower = col.lower()
                # Skip identifier columns
                if col_lower.endswith("id") or col_lower.endswith("code") or col_lower.startswith("id_"):
                    continue

                series = pd.to_numeric(df[col], errors="coerce").dropna()
                if len(series) < 15:
                    continue

                # 1. IQR Method
                q25 = float(series.quantile(0.25))
                q75 = float(series.quantile(0.75))
                iqr = q75 - q25

                if iqr > 0:
                    lower_bound = q25 - (1.5 * iqr)
                    upper_bound = q75 + (1.5 * iqr)

                    outliers = series[(series < lower_bound) | (series > upper_bound)]
                    outlier_count = len(outliers)

                    if outlier_count > 0:
                        outlier_ratio = outlier_count / len(series)
                        severity = "critical" if outlier_ratio > 0.08 else ("high" if outlier_ratio > 0.03 else "medium")
                        
                        sample_extremes = [round(float(x), 2) for x in outliers.head(5).tolist()]
                        explanation = (
                            f"Detected {outlier_count} potential anomalies in '{col}' ({round(outlier_ratio * 100, 1)}% of rows) "
                            f"falling outside the expected IQR boundary [{round(lower_bound, 2)}, {round(upper_bound, 2)}]. "
                            f"Extreme sample values: {sample_extremes}."
                        )

                        records.append({
                            "table_name": table_name,
                            "column_name": col,
                            "method": "iqr",
                            "anomaly_count": outlier_count,
                            "severity": severity,
                            "details": {
                                "lower_bound": round(lower_bound, 2),
                                "upper_bound": round(upper_bound, 2),
                                "iqr": round(iqr, 2),
                                "sample_extremes": sample_extremes
                            },
                            "explanation": explanation
                        })

                # 2. Extreme Z-Score (> 3.5 std dev)
                std_dev = float(series.std(ddof=0))
                mean_val = float(series.mean())
                if std_dev > 0 and len(series) > 30:
                    z_scores = np.abs((series - mean_val) / std_dev)
                    extreme_z = series[z_scores > 3.5]
                    if len(extreme_z) > 0 and len(extreme_z) <= 10:
                        records.append({
                            "table_name": table_name,
                            "column_name": col,
                            "method": "z_score",
                            "anomaly_count": len(extreme_z),
                            "severity": "high",
                            "details": {
                                "mean": round(mean_val, 2),
                                "std": round(std_dev, 2),
                                "max_z_score": round(float(z_scores.max()), 2),
                                "extremes": [round(float(x), 2) for x in extreme_z.head(5).tolist()]
                            },
                            "explanation": f"{len(extreme_z)} value(s) deviate more than 3.5 standard deviations from the mean ({round(mean_val, 2)} ± {round(std_dev, 2)})."
                        })

        return records[:10]  # Return top 10 most prominent anomalies
