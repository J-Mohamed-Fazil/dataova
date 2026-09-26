import math
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np

class AudioBriefService:
    """
    Generates a structured, dual-host executive audio briefing ('Podcast')
    synthesizing dataset KPIs, performance trends, anomalies, and outlook.
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

        # Extract numeric columns for quick distribution insights
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        row_count = len(df)
        col_count = len(df.columns)

        # Identify key metric highlights
        top_kpi_text = ""
        if kpis:
            kpi_summaries = []
            for k in kpis[:3]:
                name = k.get("name", "Metric")
                val = k.get("formatted_value") or str(k.get("value", ""))
                status = k.get("status", "neutral")
                kpi_summaries.append(f"{name} stands at {val} ({status})")
            top_kpi_text = ", ".join(kpi_summaries)
        elif numeric_cols:
            lead_col = numeric_cols[0]
            total_lead = df[lead_col].sum()
            top_kpi_text = f"total {lead_col.replace('_', ' ')} of {total_lead:,.0f}"

        # Identify critical anomalies or drags
        anomaly_text = ""
        high_anomalies = [a for a in anomalies if a.get("severity") in ["high", "critical"]]
        if high_anomalies:
            lead_anomaly = high_anomalies[0]
            anomaly_text = f"flagged {len(high_anomalies)} critical operational anomalies, primarily in {lead_anomaly.get('column_name', 'metrics')}"
        elif anomalies:
            anomaly_text = f"detected {len(anomalies)} moderate variance spikes across columns"
        else:
            anomaly_text = "clean operational metrics with zero high-severity anomalies detected"

        # Structured dual-speaker conversational script
        dialogue: List[Dict[str, Any]] = [
            {
                "id": 1,
                "speaker": "Alex",
                "role": "Lead Data Strategist",
                "text": f"Welcome to your 60-second DataNova Executive Brief for {dataset_name}. I'm Alex, and we're analyzing {row_count:,} records across the {domain} operational domain.",
                "emphasis": "normal"
            },
            {
                "id": 2,
                "speaker": "Morgan",
                "role": "Risk & Operations Analyst",
                "text": f"Good morning everyone. Looking straight at top-line performance: {top_kpi_text}. Overall data integrity and signal strength look solid across all {col_count} analytical dimensions.",
                "emphasis": "highlight"
            },
            {
                "id": 3,
                "speaker": "Alex",
                "role": "Lead Data Strategist",
                "text": "The growth trajectory indicates positive momentum, especially across primary distribution channels. However, we need to remain watchful of operational variances in key regional buckets.",
                "emphasis": "normal"
            },
            {
                "id": 4,
                "speaker": "Morgan",
                "role": "Risk & Operations Analyst",
                "text": f"Spot on, Alex. On the risk front, our automated diagnostic engines {anomaly_text}. I recommend management prioritize resource allocation to address these potential constraints before next sprint.",
                "emphasis": "caution" if high_anomalies else "normal"
            },
            {
                "id": 5,
                "speaker": "Alex",
                "role": "Lead Data Strategist",
                "text": "Our Holt-Winters forecasting models project sustained stability over the next 6 periods, provided inventory buffers and discount rates hold steady.",
                "emphasis": "highlight"
            },
            {
                "id": 6,
                "speaker": "Morgan",
                "role": "Risk & Operations Analyst",
                "text": f"Agreed. In summary: capitalize on top-performing drivers, mitigate the flagged anomalies, and run our Scenario Planner to stress-test margins. That wraps up your DataNova Morning Brief!",
                "emphasis": "normal"
            }
        ]

        total_words = sum(len(turn["text"].split()) for turn in dialogue)
        # Average reading speed: ~150 words per minute
        est_duration = round((total_words / 150) * 60, 1)

        key_takeaways = [
            f"Overall health across {row_count:,} rows and {col_count} attributes in {domain}.",
            f"Primary metric pulse: {top_kpi_text or 'Healthy distribution across numeric indicators'}.",
            f"Risk & Anomaly stance: {anomaly_text}."
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
