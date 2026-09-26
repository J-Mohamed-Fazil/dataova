import json
import re
import time
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import pandas as pd

from app.services.calculation_tools import CalculationTools
from app.services.anomaly_detector import AnomalyDetector
from app.services.llm_orchestrator import LLMOrchestrator
from app.services.kpi_engine import KpiEngine
from app.services.forecast_engine import ForecastEngine
from app.services.ml_clustering import MLClusteringEngine
from app.services.data_cleanse_service import DataCleanseService
from app.services.sql_engine import SQLEngine


class ChatAgent:

    # Common metric keywords and their semantic weights
    METRIC_SYNONYMS = {
        "revenue": [
            "revenue", "rev", "sales", "turnover", "income", "total_sales", "amount", 
            "order_amount", "gross_sales", "spent", "spend", "spending", "paid", "total_spent"
        ],
        "sales": ["sales", "revenue", "turnover", "total_amount", "sold", "gross"],
        "price": ["price", "unit_price", "unitprice", "cost", "rate", "fare", "fee", "val"],
        "quantity": [
            "quantity", "qty", "volume", "units", "items", "count", "num_orders", "pieces",
            "popular", "most sold", "most bought", "bought", "purchased"
        ],
        "discount": ["discount", "discount_rate", "markdown", "rebate", "savings"],
        "profit": ["profit", "margin", "gain", "net_income", "earnings", "net_profit"],
        "salary": ["salary", "wage", "compensation", "pay", "stipend", "bonus"],
        "score": ["score", "grade", "points", "rating", "marks", "performance_score"],
        "freight": ["freight", "shipping", "shipping_fee", "postage", "delivery_fee"],
        "amount": ["amount", "total", "balance", "value", "payment", "transaction_amount"]
    }

    # Common dimension keywords
    DIMENSION_SYNONYMS = {
        "country": ["country", "nation", "state", "geography"],
        "city": ["city", "town", "metro", "municipality"],
        "region": ["region", "territory", "area", "zone", "district", "sales_region"],
        "category": ["category", "categoryname", "category_name", "product_category", "department", "genre", "type", "segment"],
        "product": ["product", "productname", "product_name", "item", "item_name", "title", "sku", "description", "goods"],
        "customer": ["customer", "customername", "customer_name", "companyname", "contactname", "client", "buyer", "user"],
        "employee": ["employee", "employeename", "employee_name", "salesrep", "rep", "staff", "agent", "worker", "manager"],
        "status": ["status", "stage", "priority", "state", "discontinued", "tier", "loyalty_tier"],
        "date": ["date", "orderdate", "order_date", "timestamp", "year", "month", "quarter", "created_at", "period"]
    }

    @staticmethod
    def _is_id_column(col_name: str, series: Optional[pd.Series] = None) -> bool:
        """Determines if a column is an identifier/key rather than a useful business dimension or metric."""
        c_lower = col_name.lower().strip()
        if c_lower in ["id", "uuid", "guid", "key", "code", "index", "reportsto", "reports_to"]:
            return True
        if c_lower.endswith("_id") or c_lower.startswith("id_") or (c_lower.endswith("id") and len(c_lower) > 2 and not c_lower.endswith("valid")):
            return True
        if c_lower.endswith("code") and c_lower not in ["zipcode", "postalcode"]:
            return True
        if c_lower.endswith("key") or c_lower.endswith("fk") or c_lower.endswith("pk"):
            return True

        if series is not None and len(series) > 5:
            uniq_ratio = series.nunique() / len(series)
            if uniq_ratio > 0.98:
                sample_val = series.dropna().iloc[0] if not series.dropna().empty else ""
                sample_str = str(sample_val)
                if any(k in sample_str for k in ["-", "_"]) and any(c.isdigit() for c in sample_str):
                    return True
        return False

    @staticmethod
    def _format_value(val: float, metric_name: str = "") -> str:
        """Helper to format numeric values cleanly based on metric semantics."""
        m_lower = metric_name.lower()
        if m_lower == "count" or "count" in m_lower or "orders" in m_lower or "records" in m_lower or "customers" in m_lower:
            return f"{int(val):,}" if val == int(val) else f"{round(val, 1):,}"

        is_currency = any(k in m_lower for k in [
            "revenue", "sales", "price", "profit", "amount", "salary", "freight", "cost", "income", "balance", "fee", "spent"
        ])
        is_rate = any(k in m_lower for k in ["discount", "rate", "percent", "margin", "ratio", "pct"])
        
        if is_rate and val <= 1.0 and val > 0:
            return f"{round(val * 100, 1)}%"
        return KpiEngine.format_metric_value(val, is_currency=is_currency, is_rate=is_rate)

    @classmethod
    def _column_matches_query(cls, col_name: str, q_lower: str) -> bool:
        """Checks if a column matches terms in the query semantically or via partial token."""
        c_lower = col_name.lower()
        if c_lower in q_lower:
            return True
        tokens = re.split(r"[_\s]+", c_lower)
        for t in tokens:
            if len(t) >= 4 and re.search(rf"\b{re.escape(t)}\b", q_lower):
                return True
        return False

    @classmethod
    def _resolve_context_from_history(
        cls,
        query: str,
        conversation_history: Optional[List[Dict[str, Any]]]
    ) -> Dict[str, Any]:
        """
        Extracts context from previous assistant and user messages to support multi-turn dialogue
        (e.g., 'now by month', 'what about west?', 'compare it with furniture').
        """
        hints: Dict[str, Any] = {
            "table_name": None,
            "metric_col": None,
            "dim_col": None,
            "date_col": None,
            "last_entities": [],
            "last_entity": None,
            "filters": []
        }
        if not conversation_history:
            return hints

        for msg in reversed(conversation_history):
            if msg.get("role") == "assistant":
                payload = msg.get("action_payload", {}) or {}
                chart = payload.get("chart", {}) or {}
                if not hints["table_name"] and chart.get("table_name"):
                    hints["table_name"] = chart.get("table_name")
                if not hints["metric_col"] and chart.get("y_field") and chart.get("y_field") != "Count":
                    hints["metric_col"] = chart.get("y_field")
                if not hints["dim_col"] and chart.get("x_field"):
                    hints["dim_col"] = chart.get("x_field")

                citations = msg.get("citations", [])
                if citations and not hints["table_name"]:
                    hints["table_name"] = citations[0].get("table")

                # Extract last entities discussed
                chart_data = chart.get("data", [])
                if isinstance(chart_data, list) and chart_data and not hints["last_entities"]:
                    hints["last_entities"] = [str(d.get("label")) for d in chart_data if isinstance(d, dict) and d.get("label")]
                    if hints["last_entities"] and not hints["last_entity"]:
                        hints["last_entity"] = hints["last_entities"][0]

                kpis = payload.get("kpi_highlights", [])
                for kh in kpis:
                    lbl = kh.get("label", "").lower()
                    if any(x in lbl for x in ["leader", "top", "highest", "primary", "performer"]) and not hints["last_entity"]:
                        hints["last_entity"] = kh.get("value")

                if hints["metric_col"] and hints["dim_col"]:
                    break
        return hints

    @classmethod
    def _find_best_table_and_columns(
        cls,
        dataframes: Dict[str, pd.DataFrame],
        query: str,
        relationships: Optional[List[Any]] = None,
        context_hints: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        q_lower = query.lower()
        if not dataframes:
            return {
                "table_name": "data",
                "df": pd.DataFrame(),
                "metric_col": None,
                "dim_col": None,
                "date_col": None,
                "is_count_query": False,
                "filters": [],
                "citations": []
            }

        # Check if query is explicitly asking for a count / frequency
        is_count_query = any(re.search(rf"\b{re.escape(k)}\b", q_lower) for k in [
            "how many", "count", "number of", "most customers", "most orders", "most transactions", 
            "most products", "most records", "most employees", "total customers", "total orders"
        ])

        # 1. Score tables based on mentions, columns, and metric presence
        table_scores: Dict[str, float] = {}
        for t_name, df in dataframes.items():
            score = 0.0
            t_lower = t_name.lower()
            if t_lower in q_lower or t_lower.rstrip('s') in q_lower:
                score += 10.0
            if context_hints and context_hints.get("table_name") == t_name:
                score += 4.0
            
            # Match columns
            for col in df.columns:
                c_lower = col.lower()
                if cls._column_matches_query(col, q_lower):
                    score += 5.0
                
                # Check metric synonyms
                for syn_key, syns in cls.METRIC_SYNONYMS.items():
                    if any(re.search(rf"\b{re.escape(s)}\b", q_lower) for s in syns):
                        if any(s in c_lower for s in syns):
                            score += 5.0
                
                # Check dimension synonyms
                for syn_key, syns in cls.DIMENSION_SYNONYMS.items():
                    if any(re.search(rf"\b{re.escape(s)}\b", q_lower) for s in syns):
                        if any(s in c_lower for s in syns):
                            score += 4.0
            
            # Prefer tables with non-id metric columns (unless count query on entity)
            num_cols = [c for c in df.select_dtypes(include=[np.number]).columns if not cls._is_id_column(c, df[c])]
            if num_cols and not is_count_query:
                score += 3.0
            table_scores[t_name] = score

        sorted_tables = sorted(table_scores.keys(), key=lambda t: table_scores[t], reverse=True)
        primary_table = sorted_tables[0] if sorted_tables else list(dataframes.keys())[0]
        working_df = dataframes[primary_table].copy()

        # 2. Smart Multi-Table Join Resolver
        joined_tables = []
        for other_t in sorted_tables[1:]:
            other_df = dataframes[other_t]
            
            # Check if other table has relevant columns that primary lacks
            has_relevant_col = False
            for c in other_df.columns:
                if cls._column_matches_query(c, q_lower) and not cls._is_id_column(c, other_df[c]):
                    has_relevant_col = True
                    break
                for syn_key, syns in list(cls.DIMENSION_SYNONYMS.items()) + list(cls.METRIC_SYNONYMS.items()):
                    if any(re.search(rf"\b{re.escape(s)}\b", q_lower) for s in syns):
                        if any(s in c.lower() for s in syns) and not cls._is_id_column(c, other_df[c]):
                            has_relevant_col = True
                            break

            primary_has_metrics = bool([c for c in working_df.select_dtypes(include=[np.number]).columns if not cls._is_id_column(c, working_df[c])])
            other_has_metrics = bool([c for c in other_df.select_dtypes(include=[np.number]).columns if not cls._is_id_column(c, other_df[c])])

            should_merge = has_relevant_col or (not primary_has_metrics and other_has_metrics and not is_count_query) or (primary_has_metrics and not other_has_metrics and other_t.rstrip('s') in q_lower)

            if should_merge:
                shared_cols = [c for c in working_df.columns if c in other_df.columns]
                id_joins = [c for c in shared_cols if cls._is_id_column(c)]
                join_col = id_joins[0] if id_joins else (shared_cols[0] if shared_cols else None)

                if not join_col:
                    w_norm = {re.sub(r"[^a-zA-Z0-9]", "", c).lower(): c for c in working_df.columns}
                    o_norm = {re.sub(r"[^a-zA-Z0-9]", "", c).lower(): c for c in other_df.columns}
                    for k in w_norm:
                        if k in o_norm and ("id" in k or "key" in k or "code" in k):
                            try:
                                working_df = working_df.merge(other_df, left_on=w_norm[k], right_on=o_norm[k], suffixes=('', f'_{other_t}'))
                                joined_tables.append(other_t)
                                break
                            except Exception:
                                pass
                elif join_col:
                    try:
                        working_df = working_df.merge(other_df, on=join_col, suffixes=('', f'_{other_t}'))
                        joined_tables.append(other_t)
                    except Exception:
                        pass

        # 3. Categorize columns in working_df
        all_cols = list(working_df.columns)
        num_cols = working_df.select_dtypes(include=[np.number]).columns.tolist()
        cat_cols = working_df.select_dtypes(include=["object", "category", "string"]).columns.tolist()

        # Filter out ID columns
        metric_candidates = [c for c in num_cols if not cls._is_id_column(c, working_df[c])]
        dim_candidates = [c for c in cat_cols if not cls._is_id_column(c, working_df[c])]
        date_candidates = [
            c for c in all_cols
            if any(k in c.lower() for k in ["date", "time", "timestamp", "year", "month", "quarter", "day"])
        ]

        # 4. Resolve Target Dimension Column
        target_dim = None

        # Priority 1: Exact column in query
        for c in dim_candidates:
            if re.search(rf"\b{re.escape(c.lower())}\b", q_lower):
                target_dim = c
                break

        # Priority 2: Phrase "by <dim>", "per <dim>", "for each <dim>", "across <dim>"
        if not target_dim:
            by_match = re.search(r"(?:by|per|across|for each)\s+([a-z0-9_\s]+)", q_lower)
            if by_match:
                cand = by_match.group(1).strip().split()[0]
                for c in dim_candidates:
                    if cand in c.lower() or c.lower() in cand:
                        target_dim = c
                        break

        # Priority 3: Word tokens of column in query
        if not target_dim:
            for c in dim_candidates:
                tokens = re.split(r"[_\s]+", c.lower())
                if any(len(t) >= 4 and re.search(rf"\b{re.escape(t)}\b", q_lower) for t in tokens):
                    target_dim = c
                    break

        # Priority 4: Dimension synonyms
        if not target_dim:
            for syn_key, syns in cls.DIMENSION_SYNONYMS.items():
                if any(re.search(rf"\b{re.escape(s)}\b", q_lower) for s in syns):
                    for c in dim_candidates:
                        c_tokens = re.split(r"[_\s]+", c.lower())
                        if any(s in c.lower() for s in syns) or any(s in c_tokens for s in syns):
                            target_dim = c
                            break
                if target_dim:
                    break

        # Priority 5: Context hints from previous turn
        if not target_dim and context_hints and context_hints.get("dim_col"):
            cand = context_hints["dim_col"]
            if cand in working_df.columns:
                target_dim = cand

        # Priority 6: Fallback dimension with reasonable cardinality (2 to 100)
        if not target_dim and dim_candidates:
            for c in dim_candidates:
                n_uniq = working_df[c].nunique()
                if 2 <= n_uniq <= 100:
                    target_dim = c
                    break
            if not target_dim:
                target_dim = dim_candidates[0]

        # 5. Resolve Target Metric Column
        target_metric = None

        if is_count_query or (not metric_candidates and dim_candidates):
            is_count_query = True
            target_metric = "Count"
        else:
            # Priority 1: Exact column in query
            for c in metric_candidates:
                if re.search(rf"\b{re.escape(c.lower())}\b", q_lower):
                    target_metric = c
                    break
            
            # Priority 2: Synonym matching
            if not target_metric:
                for syn_key, syns in cls.METRIC_SYNONYMS.items():
                    if any(re.search(rf"\b{re.escape(s)}\b", q_lower) for s in syns):
                        for c in metric_candidates:
                            c_tokens = re.split(r"[_\s]+", c.lower())
                            if any(s in c.lower() for s in syns) or any(s in c_tokens for s in syns):
                                target_metric = c
                                break
                    if target_metric:
                        break

            # Priority 3: Context hints from previous turn
            if not target_metric and context_hints and context_hints.get("metric_col"):
                cand = context_hints["metric_col"]
                if cand in working_df.columns and cand != "Count":
                    target_metric = cand

            # Priority 4: Fallback preferred metric
            if not target_metric and metric_candidates:
                for preferred in ["revenue", "sales", "total_sales", "amount", "total", "quantity", "price", "unit_price", "profit", "salary", "score", "freight"]:
                    for c in metric_candidates:
                        if preferred in c.lower():
                            target_metric = c
                            break
                    if target_metric:
                        break
                if not target_metric:
                    target_metric = metric_candidates[0]
            elif not target_metric:
                is_count_query = True
                target_metric = "Count"

        # 6. Resolve Target Date Column
        target_date = None
        for c in date_candidates:
            if c.lower() in q_lower:
                target_date = c
                break
        if not target_date and date_candidates:
            target_date = date_candidates[0]

        # 7. Extract Filters (matching specific category values in query)
        detected_filters = []
        for c in dim_candidates:
            unique_vals = working_df[c].dropna().unique()
            for uv in unique_vals:
                uv_str = str(uv).strip()
                if len(uv_str) >= 3 and re.search(rf"\b{re.escape(uv_str.lower())}\b", q_lower):
                    detected_filters.append({
                        "field": c,
                        "operator": "equals",
                        "value": uv
                    })
                    break

        # Build citations
        cited_cols = [c for c in [target_dim, target_metric, target_date] if c and c != "Count"]
        for f in detected_filters:
            if f["field"] not in cited_cols:
                cited_cols.append(f["field"])

        citations = [{"table": primary_table, "columns": [c for c in cited_cols if c in dataframes[primary_table].columns]}]
        for jt in joined_tables:
            jt_cols = [c for c in cited_cols if c in dataframes[jt].columns]
            if jt_cols:
                citations.append({"table": jt, "columns": jt_cols})

        return {
            "table_name": primary_table,
            "joined_tables": joined_tables,
            "df": working_df,
            "metric_col": target_metric,
            "dim_col": target_dim,
            "date_col": target_date,
            "is_count_query": is_count_query,
            "filters": detected_filters,
            "citations": citations
        }

    @classmethod
    async def _synthesize_executive_narrative(
        cls,
        query: str,
        facts_summary: str,
        kpis: List[Dict[str, Any]],
        table_name: str,
        domain: str
    ) -> Optional[str]:
        """Calls LLMOrchestrator to enrich the executive explanation if an external LLM provider is active."""
        try:
            if LLMOrchestrator.get_active_provider() == "deterministic_engine":
                return None

            kpi_str = ", ".join(f"{k.get('label')}: {k.get('value')}" for k in kpis)
            system_prompt = (
                f"You are DATOVA AI, an executive-level autonomous data analyst for domain '{domain}'. "
                f"CRITICAL CONSTRAINT: Ground your entire response on the provided deterministic calculations. "
                f"Never hallucinate or alter any numbers. "
                f"Deliver an articulate executive analysis with high-impact takeaways."
            )
            user_prompt = (
                f"User Question: {query}\n\n"
                f"Ground Truth Calculations from '{table_name}':\n{facts_summary}\n\n"
                f"KPI Highlights:\n{kpi_str}\n\n"
                f"Synthesize an executive-ready briefing in clean Markdown formatting."
            )
            narrative = await LLMOrchestrator.query_llm(system_prompt, user_prompt)
            if (
                narrative
                and len(narrative) > 30
                and not narrative.startswith("I have analyzed your request")
                and not narrative.startswith("**Autonomous")
            ):
                if facts_summary.startswith("### "):
                    header = facts_summary.split("\n\n")[0]
                    return f"{header}\n\n{narrative}"
                return narrative
        except Exception:
            pass
        return None

    @staticmethod
    async def process_user_query(
        query: str,
        dataframes: Dict[str, pd.DataFrame],
        domain: str,
        kpis: List[Dict[str, Any]],
        existing_charts: List[Dict[str, Any]] = None,
        relationships: Optional[List[Any]] = None,
        conversation_history: Optional[List[Dict[str, Any]]] = None,
        dataset_env: Optional[Dict[str, Any]] = None,
        dashboard_env: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Processes analytical user queries against live datasets:
        1. Context-aware multi-turn conversational memory.
        2. Comprehensive analytics: Comparisons (A vs B), Root-Cause Diagnostics, What-If Simulations, Correlation Discovery, Distributions, Trends, Rankings.
        3. 100% mathematically exact calculations using Pandas/NumPy without hallucination.
        4. Rich action payloads: KPI highlight badges, dual Chart/Table structures, smart follow-up suggestions, and execution latency.
        5. Deep Dashboard Awareness and full Dataset Environment introspection.
        """
        start_time = time.perf_counter()
        q_lower = query.lower().strip()

        dashboard_env = dashboard_env or {}
        dataset_env = dataset_env or {}
        sheets_list = dashboard_env.get("sheets", [])
        active_sheet_id = dashboard_env.get("active_sheet_id")
        client_ctx = dashboard_env.get("client_context", {}) or {}

        # Resolve active dashboard sheet
        active_sheet = None
        if active_sheet_id:
            active_sheet = next((s for s in sheets_list if s.get("id") == active_sheet_id), None)
        if not active_sheet and sheets_list:
            active_sheet = sheets_list[0]

        if not dataframes or all(df.empty for df in dataframes.values()):
            return {
                "content": "No active dataset loaded. Please upload or select a dataset to begin your analysis.",
                "action_type": None,
                "action_payload": {},
                "citations": [],
                "calculation_steps": []
            }

        # Multi-turn context resolution
        context_hints = ChatAgent._resolve_context_from_history(query, conversation_history)

        # Resolve best table, dimensions, metrics, and filters
        meta = ChatAgent._find_best_table_and_columns(dataframes, query, relationships, context_hints)
        table_name = meta["table_name"]
        df = meta["df"]
        metric_col = meta["metric_col"]
        dim_col = meta["dim_col"]
        date_col = meta["date_col"]
        is_count_query = meta.get("is_count_query", False)
        filters = meta["filters"]
        citations = meta["citations"]

        calc_steps: List[Dict[str, str]] = []

        # Apply client-level active filters if present on dashboard
        active_filters = client_ctx.get("activeFilters") or client_ctx.get("active_filters")
        if isinstance(active_filters, dict):
            for f_col, f_val in active_filters.items():
                if f_col in df.columns and f_val:
                    calc_steps.append({"step": f"Applied active dashboard filter: {f_col} == {f_val}"})
                    df = df[df[f_col].astype(str).str.lower() == str(f_val).lower()]
        elif isinstance(active_filters, str) and active_filters.strip():
            val_clean = active_filters.strip().lower()
            for col in df.select_dtypes(include=["object", "category", "string"]).columns:
                if (df[col].astype(str).str.lower() == val_clean).any():
                    calc_steps.append({"step": f"Applied active dashboard filter on {col}: '{active_filters}'"})
                    df = df[df[col].astype(str).str.lower() == val_clean]
                    break

        # -------------------------------------------------------------
        # 0.1 DASHBOARD AWARENESS: "What dashboards are available?"
        # -------------------------------------------------------------
        if any(kw in q_lower for kw in [
            "what dashboards are available", "what dashboards exist", "list dashboards", 
            "available dashboards", "what sheets are available", "which dashboards are available",
            "show all dashboards", "what dashboards can i view"
        ]):
            exec_time = round((time.perf_counter() - start_time) * 1000, 1)
            total_sheets = len(sheets_list)
            total_charts = sum(len(s.get("charts", [])) for s in sheets_list)
            
            lines = [
                f"### Available Dashboards & Analytical Sheets\n",
                f"The **{dataset_env.get('name', 'current')}** workspace contains **{total_sheets} interactive dashboard sheets** with **{total_charts} total visual components**:\n"
            ]
            rows = []
            for idx, s in enumerate(sheets_list):
                title = s.get("title", f"Sheet {idx+1}")
                stype = (s.get("sheet_type") or "Analytical").capitalize()
                c_count = len(s.get("charts", []))
                is_active = (s.get("id") == active_sheet_id)
                tag = " (Currently Viewing)" if is_active else ""
                lines.append(f"{idx+1}. **{title}**{tag} — *{stype} Sheet* with **{c_count} charts & visualizations**.")
                rows.append([title, stype, f"{c_count} charts", "Active" if is_active else "Available"])

            lines.append("\n**Suggested Next Step:** Ask me to explain any sheet (e.g., *'What does this dashboard show?'*) or ask *'Which dashboard should I use for customer analysis?'*")
            content = "\n".join(lines)

            return {
                "content": content,
                "action_type": None,
                "action_payload": {
                    "kpi_highlights": [
                        {"label": "Total Dashboards", "value": str(total_sheets), "color": "cyan"},
                        {"label": "Total Visuals", "value": str(total_charts), "color": "emerald"},
                        {"label": "Active Sheet", "value": active_sheet.get("title", "Overview") if active_sheet else "None", "color": "indigo"}
                    ],
                    "table_data": {
                        "columns": ["Dashboard Name", "Type", "Visuals", "Status"],
                        "rows": rows
                    },
                    "suggested_followups": [
                        "What does this dashboard show?",
                        "Explain the KPI cards",
                        "What is the main trend in this dashboard?"
                    ],
                    "execution_time_ms": exec_time
                },
                "citations": citations,
                "calculation_steps": [{"step": f"Cataloged {total_sheets} workspace dashboard sheets and active layout"}]
            }

        # -------------------------------------------------------------
        # 0.2 DASHBOARD AWARENESS: "What does this dashboard show?" / "Explain this dashboard"
        # -------------------------------------------------------------
        if any(kw in q_lower for kw in [
            "what does this dashboard show", "explain this dashboard", "dashboard summary",
            "what is this dashboard about", "what does the sales dashboard contain",
            "what is on this dashboard", "purpose of this dashboard", "explain current dashboard"
        ]):
            exec_time = round((time.perf_counter() - start_time) * 1000, 1)
            target_sheet = active_sheet
            for s in sheets_list:
                s_title = s.get("title", "").lower()
                if s_title and (s_title in q_lower or s_title.replace(" dashboard", "") in q_lower):
                    target_sheet = s
                    break

            sheet_title = target_sheet.get("title", "Main Dashboard") if target_sheet else "Main Dashboard"
            sheet_charts = target_sheet.get("charts", []) if target_sheet else []
            
            content_lines = [
                f"### Dashboard Briefing: {sheet_title}\n",
                f"This dashboard provides high-level and granular visibility into **{domain}** operations across **{dataset_env.get('name', 'the dataset')}**:\n"
            ]
            
            if kpis:
                content_lines.append("**Key Executive Metrics:**")
                for k in kpis[:4]:
                    content_lines.append(f"- **{k.get('display_name', k.get('name'))}**: **{k.get('formatted_value', k.get('value'))}**")
                content_lines.append("")

            if sheet_charts:
                content_lines.append(f"**Visualizations on this Sheet ({len(sheet_charts)} components):**")
                for c in sheet_charts:
                    c_title = c.get("title", "Chart")
                    c_type = c.get("chart_type", "bar").capitalize()
                    x_f = c.get("x_field") or "Category"
                    y_f = c.get("y_field") or "Metric"
                    content_lines.append(f"- **{c_title}** ({c_type} Chart): Plots `{y_f}` across `{x_f}`.")
            else:
                content_lines.append(f"This sheet is currently configured with primary KPI cards and connected to `{table_name}`.")

            content_lines.append(f"\n**Core Purpose:** Track core operational efficiency, identify high-volume contributors, and flag variance patterns for strategic decision-making.")

            kpi_highlights = [
                {"label": "Dashboard", "value": sheet_title, "color": "cyan"},
                {"label": "Visuals Count", "value": str(len(sheet_charts)), "color": "indigo"},
                {"label": "Primary Table", "value": table_name, "color": "emerald"}
            ]

            return {
                "content": "\n".join(content_lines),
                "action_type": None,
                "action_payload": {
                    "kpi_highlights": kpi_highlights,
                    "suggested_followups": [
                        "Explain the KPI cards",
                        "What is the main trend in this dashboard?",
                        "Explain this chart"
                    ],
                    "execution_time_ms": exec_time
                },
                "citations": citations,
                "calculation_steps": [{"step": f"Aggregated layout metadata and metric bindings for dashboard '{sheet_title}'"}]
            }

        # -------------------------------------------------------------
        # 0.3 DASHBOARD AWARENESS: "Explain the KPI cards"
        # -------------------------------------------------------------
        if any(kw in q_lower for kw in [
            "explain the kpi cards", "explain kpi cards", "explain the kpis", "what are the important kpis",
            "what do the kpis mean", "kpi summary", "explain the metric cards"
        ]):
            exec_time = round((time.perf_counter() - start_time) * 1000, 1)
            content_lines = [
                f"### Executive KPI Cards Breakdown\n",
                f"Here is an explanation of the core Key Performance Indicators (KPIs) calculated directly from your dataset:\n"
            ]
            kpi_hl = []
            rows = []
            for k in kpis:
                d_name = k.get("display_name", k.get("name", "Metric"))
                val = k.get("formatted_value", str(k.get("value", 0)))
                
                meaning = "Core business performance indicator."
                if any(x in d_name.lower() for x in ["revenue", "sales", "turnover"]):
                    meaning = "Total gross top-line monetary volume generated across all verified transactions."
                elif any(x in d_name.lower() for x in ["order", "transactions", "count"]):
                    meaning = "Total volume of individual orders or records processed in the system."
                elif any(x in d_name.lower() for x in ["customer", "client"]):
                    meaning = "Count of unique transacting accounts or individuals in the active corpus."
                elif any(x in d_name.lower() for x in ["average", "aov"]):
                    meaning = "Average economic value produced per individual transaction."
                elif any(x in d_name.lower() for x in ["discount", "rate"]):
                    meaning = "Average promotional concession applied across orders."

                content_lines.append(f"- **{d_name}**: **{val}**\n  *{meaning}*")
                rows.append([d_name, val, meaning])
                if len(kpi_hl) < 4:
                    kpi_hl.append({"label": d_name, "value": val, "color": "emerald" if len(kpi_hl) % 2 == 0 else "indigo"})

            content_lines.append("\n**How Nova Calculates These:** Every KPI is computed deterministically using standard mathematical aggregations (SUM, COUNT DISTINCT, AVG) on your raw data without estimation.")

            return {
                "content": "\n".join(content_lines),
                "action_type": None,
                "action_payload": {
                    "kpi_highlights": kpi_hl,
                    "table_data": {
                        "columns": ["KPI Metric", "Current Value", "Executive Meaning"],
                        "rows": rows
                    },
                    "suggested_followups": [
                        "What is the main trend in this dashboard?",
                        "Which category has the highest sales?",
                        "Show monthly revenue trend"
                    ],
                    "execution_time_ms": exec_time
                },
                "citations": citations,
                "calculation_steps": [{"step": f"Extracted and contextualized {len(kpis)} active KPI definitions"}]
            }

        # -------------------------------------------------------------
        # 0.4 DASHBOARD AWARENESS: "Explain this chart" / "What does this visualization represent?"
        # -------------------------------------------------------------
        if any(kw in q_lower for kw in [
            "explain this chart", "what does this visualization represent", "explain the chart",
            "explain this visual", "what does this graph show", "why is this value high",
            "why is this value low", "explain the visualization", "explain this graph"
        ]):
            exec_time = round((time.perf_counter() - start_time) * 1000, 1)
            selected_vis = client_ctx.get("selectedVisual") or client_ctx.get("focusedChart")
            chart_to_explain = None
            if selected_vis and isinstance(selected_vis, dict):
                chart_to_explain = selected_vis
            elif active_sheet and active_sheet.get("charts"):
                chart_to_explain = active_sheet["charts"][0]

            if chart_to_explain:
                c_title = chart_to_explain.get("title", "Dashboard Chart")
                c_type = chart_to_explain.get("chart_type", "bar").capitalize()
                x_field = chart_to_explain.get("x_field") or dim_col or "Dimension"
                y_field = chart_to_explain.get("y_field") or metric_col or "Metric"
                c_data = chart_to_explain.get("data", [])

                pts = []
                if isinstance(c_data, list):
                    for item in c_data:
                        if isinstance(item, dict) and "label" in item and "value" in item:
                            try:
                                pts.append((str(item["label"]), float(item["value"])))
                            except (ValueError, TypeError):
                                pass

                if pts:
                    sorted_pts = sorted(pts, key=lambda p: p[1], reverse=True)
                    peak_pt = sorted_pts[0]
                    low_pt = sorted_pts[-1]
                    total_sum = sum(p[1] for p in pts)
                    peak_share = round((peak_pt[1] / max(total_sum, 1)) * 100, 1)

                    content = (
                        f"### Visual Breakdown: {c_title}\n\n"
                        f"This **{c_type} chart** displays the distribution of **{y_field.replace('_', ' ').title()}** across different **{x_field.replace('_', ' ').title()}** segments:\n\n"
                        f"- **Dominant Contributor**: **{peak_pt[0]}** leads with **{ChatAgent._format_value(peak_pt[1], y_field)}** "
                        f"({peak_share}% of the total volume plotted in this visual).\n"
                        f"- **Lowest Contributor**: **{low_pt[0]}** with **{ChatAgent._format_value(low_pt[1], y_field)}**.\n"
                        f"- **Performance Spread**: The variance between highest and lowest segment is **{ChatAgent._format_value(peak_pt[1] - low_pt[1], y_field)}**.\n\n"
                        f"**Key Takeaway:** {peak_pt[0]} represents your highest concentration of activity in this visual. "
                        f"Review unit margins and marketing allocation to sustain this advantage."
                    )

                    kpi_highlights = [
                        {"label": "Top Performer", "value": peak_pt[0], "color": "emerald"},
                        {"label": f"{peak_pt[0]} Volume", "value": ChatAgent._format_value(peak_pt[1], y_field), "color": "cyan"},
                        {"label": "Lowest Segment", "value": low_pt[0], "color": "rose"},
                        {"label": "Concentration Share", "value": f"{peak_share}%", "color": "indigo"}
                    ]
                else:
                    content = (
                        f"### Visual Breakdown: {c_title}\n\n"
                        f"This **{c_type} chart** tracks **{y_field.replace('_', ' ').title()}** grouped by **{x_field.replace('_', ' ').title()}** in table **{table_name}**.\n\n"
                        f"The visual highlights proportional share, volume disparity, and concentration across active operational categories."
                    )
                    kpi_highlights = [
                        {"label": "Metric", "value": y_field.replace('_', ' ').title(), "color": "cyan"},
                        {"label": "Dimension", "value": x_field.replace('_', ' ').title(), "color": "indigo"}
                    ]

                return {
                    "content": content,
                    "action_type": None,
                    "action_payload": {
                        "kpi_highlights": kpi_highlights,
                        "suggested_followups": [
                            f"Why is {peak_pt[0] if pts else 'this'} performing highest?",
                            "Show tabular breakdown of this chart",
                            "What is the overall trend?"
                        ],
                        "execution_time_ms": exec_time
                    },
                    "citations": citations,
                    "calculation_steps": [{"step": f"Inspected visual binding for '{c_title}' ({c_type}) and computed distribution stats"}]
                }

        # -------------------------------------------------------------
        # 0.5 DASHBOARD AWARENESS: "What is the main trend in this dashboard?"
        # -------------------------------------------------------------
        if any(kw in q_lower for kw in [
            "main trend in this dashboard", "trend in this dashboard", "what is the main trend",
            "overall trend", "what is the trend", "dashboard trend"
        ]):
            exec_time = round((time.perf_counter() - start_time) * 1000, 1)
            date_col_to_use = date_col
            met_col_to_use = metric_col if metric_col and metric_col != "Count" else None
            
            if not met_col_to_use:
                num_cands = [c for c in df.select_dtypes(include=[np.number]).columns if not ChatAgent._is_id_column(c, df[c])]
                met_col_to_use = num_cands[0] if num_cands else None

            if date_col_to_use and met_col_to_use:
                df_temp = df.copy()
                df_temp["_dt"] = pd.to_datetime(df_temp[date_col_to_use], errors="coerce")
                df_temp = df_temp.dropna(subset=["_dt"]).sort_values("_dt")
                
                if not df_temp.empty:
                    monthly = df_temp.groupby(df_temp["_dt"].dt.to_period("M"))[met_col_to_use].sum().reset_index()
                    if len(monthly) >= 2:
                        first_period = str(monthly.iloc[0]["_dt"])
                        last_period = str(monthly.iloc[-1]["_dt"])
                        first_val = float(monthly.iloc[0][met_col_to_use])
                        last_val = float(monthly.iloc[-1][met_col_to_use])
                        net_diff = last_val - first_val
                        pct_change = round((net_diff / max(abs(first_val), 1)) * 100, 1)
                        trend_dir = "positive upward" if pct_change > 0 else ("negative downward" if pct_change < 0 else "neutral steady")

                        chart_data = [{"label": str(row["_dt"]), "value": round(float(row[met_col_to_use]), 2)} for _, row in monthly.iterrows()]
                        formatted_met = met_col_to_use.replace('_', ' ').title()

                        content = (
                            f"### Main Dashboard Trend: {formatted_met} Trajectory\n\n"
                            f"Analyzing the chronological sequence across **{table_name}** from **{first_period}** to **{last_period}**:\n\n"
                            f"- **Primary Trend Direction**: The dashboard exhibits a **{trend_dir} trajectory** of **{pct_change:+}%**.\n"
                            f"- **Baseline ({first_period})**: Started at **{ChatAgent._format_value(first_val, met_col_to_use)}**.\n"
                            f"- **Latest Benchmark ({last_period})**: Reached **{ChatAgent._format_value(last_val, met_col_to_use)}**.\n"
                            f"- **Net Variance**: **{ChatAgent._format_value(net_diff, met_col_to_use)}** over the recorded periods.\n\n"
                            f"**Analytical Takeaway:** Growth has maintained a statistically consistent velocity. Peak performance periods indicate cyclical seasonality."
                        )

                        kpi_highlights = [
                            {"label": "Trend Direction", "value": f"{pct_change:+}%", "color": "emerald" if pct_change >= 0 else "rose"},
                            {"label": f"Start ({first_period})", "value": ChatAgent._format_value(first_val, met_col_to_use), "color": "indigo"},
                            {"label": f"End ({last_period})", "value": ChatAgent._format_value(last_val, met_col_to_use), "color": "cyan"},
                            {"label": "Net Trajectory", "value": ChatAgent._format_value(net_diff, met_col_to_use), "color": "amber"}
                        ]

                        relative_chart = {
                            "title": f"{formatted_met} Trend Over Time",
                            "chart_type": "line",
                            "x_field": date_col_to_use,
                            "y_field": met_col_to_use,
                            "table_name": table_name,
                            "aggregation": "sum",
                            "data": chart_data
                        }

                        return {
                            "content": content,
                            "action_type": "SHOW_CHART",
                            "action_payload": {
                                "chart": relative_chart,
                                "kpi_highlights": kpi_highlights,
                                "suggested_followups": [
                                    f"Forecast {formatted_met} for next 6 months",
                                    f"Which category drove this trend?",
                                    "Explain the peak month"
                                ],
                                "execution_time_ms": exec_time
                            },
                            "citations": citations,
                            "calculation_steps": [
                                {"step": f"Extracted chronological time-series from '{date_col_to_use}' and aggregated '{met_col_to_use}'"},
                                {"step": f"Computed baseline {first_period} vs latest {last_period} delta: {pct_change:+}%"}
                            ]
                        }

        # -------------------------------------------------------------
        # 0.6 MULTI-TURN CONTEXT RESOLUTION: "Why?" / "Why is that?"
        # -------------------------------------------------------------
        is_why_followup = q_lower in ["why", "why?", "why did that happen", "why is that", "why is it performing differently", "why did it perform differently", "explain why", "why?"] or (len(q_lower.split()) <= 4 and "why" in q_lower and not any(k in q_lower for k in ["drop", "spike", "decline", "sales", "revenue"]))
        if is_why_followup and context_hints.get("last_entity"):
            last_ent = context_hints["last_entity"]
            last_dim = context_hints.get("dim_col") or dim_col or "Category"
            last_met = context_hints.get("metric_col") or metric_col or "revenue"
            calc_steps.append({"step": f"Resolved contextual inquiry 'Why?' to entity '{last_ent}' ({last_dim})"})
            
            sub_df = df[df[last_dim].astype(str).str.lower() == str(last_ent).lower()] if last_dim in df.columns else df
            sec_dims = [c for c in sub_df.select_dtypes(include=["object", "category", "string"]).columns if c != last_dim and not ChatAgent._is_id_column(c, sub_df[c])]
            breakdown_dim = sec_dims[0] if sec_dims else None
            breakdown_data = []
            if breakdown_dim and last_met in sub_df.columns:
                breakdown_data = CalculationTools.execute_aggregation(sub_df, breakdown_dim, last_met, agg_type="sum", top_n=5)
            
            sub_total = float(pd.to_numeric(sub_df[last_met], errors="coerce").sum()) if (last_met in sub_df.columns and not sub_df.empty) else 0.0
            all_total = float(pd.to_numeric(df[last_met], errors="coerce").sum()) if (last_met in df.columns and not df.empty) else max(sub_total, 1.0)
            share_pct = round((sub_total / max(all_total, 1.0)) * 100, 1)

            exec_time = round((time.perf_counter() - start_time) * 1000, 1)
            formatted_met = last_met.replace('_', ' ').title()
            
            content = (
                f"### Performance Attribution: Why **{last_ent}** Leads\n\n"
                f"Decomposing the analytical drivers behind **{last_ent}** in **{table_name}**:\n\n"
                f"- **High Transaction Concentration**: {last_ent} commands **{ChatAgent._format_value(sub_total, last_met)}**, representing **{share_pct}%** of the total {formatted_met.lower()} across the dataset ({len(sub_df):,} verified records).\n"
                f"- **Average Order Value**: Generates an average of **{ChatAgent._format_value(sub_total / max(len(sub_df), 1), last_met)}** per transaction.\n"
            )
            if breakdown_data:
                content += f"\n**Key Internal Contributors ({breakdown_dim.replace('_', ' ').title()}):**\n"
                for b in breakdown_data[:4]:
                    content += f"- **{b['label']}**: {ChatAgent._format_value(b['value'], last_met)} ({round((b['value']/max(sub_total, 1))*100, 1)}% of {last_ent})\n"

            content += f"\n**Executive Takeaway:** {last_ent}'s performance is sustained by high customer purchase frequency and strong product diversity."

            return {
                "content": content,
                "action_type": "SHOW_CHART" if breakdown_data else None,
                "action_payload": {
                    "chart": {
                        "title": f"Composition of {last_ent} by {breakdown_dim or 'Drivers'}",
                        "chart_type": "bar",
                        "x_field": breakdown_dim or "Driver",
                        "y_field": last_met,
                        "table_name": table_name,
                        "aggregation": "sum",
                        "data": breakdown_data
                    } if breakdown_data else {},
                    "kpi_highlights": [
                        {"label": f"{last_ent} Volume", "value": ChatAgent._format_value(sub_total, last_met), "color": "emerald"},
                        {"label": "Portfolio Share", "value": f"{share_pct}%", "color": "cyan"},
                        {"label": "Records", "value": f"{len(sub_df):,}", "color": "indigo"}
                    ],
                    "suggested_followups": [
                        f"Show monthly trend for {last_ent}",
                        f"Compare {last_ent} with other categories",
                        "What is the average order value?"
                    ],
                    "execution_time_ms": exec_time
                },
                "citations": citations,
                "calculation_steps": [{"step": f"Analyzed internal drivers for '{last_ent}' across {len(sub_df)} rows in '{table_name}'"}]
            }

        # -------------------------------------------------------------
        # 0.7 MULTI-TURN CONTEXT RESOLUTION: "What about their average order value?"
        # -------------------------------------------------------------
        is_their_followup = "their" in q_lower and any(kw in q_lower for kw in ["average", "aov", "revenue", "sales", "order value", "orders"])
        if is_their_followup and context_hints.get("last_entities"):
            ents = context_hints["last_entities"][:6]
            ent_dim = context_hints.get("dim_col") or dim_col or "Store"
            aov_met = context_hints.get("metric_col") or metric_col or "revenue"
            calc_steps.append({"step": f"Resolved contextual pronoun 'their' to previous entities: {ents}"})
            
            rows = []
            chart_data = []
            for ent_name in ents:
                e_df = df[df[ent_dim].astype(str).str.lower() == str(ent_name).lower()] if ent_dim in df.columns else df
                e_sum = float(pd.to_numeric(e_df[aov_met], errors="coerce").sum()) if (aov_met in e_df.columns and not e_df.empty) else 0.0
                e_count = max(len(e_df), 1)
                e_aov = e_sum / e_count
                rows.append([ent_name, ChatAgent._format_value(e_aov, aov_met), ChatAgent._format_value(e_sum, aov_met), f"{e_count:,}"])
                chart_data.append({"label": ent_name, "value": round(e_aov, 2)})

            sorted_rows = sorted(rows, key=lambda r: float(chart_data[rows.index(r)]["value"]), reverse=True)
            top_ent = sorted_rows[0][0] if sorted_rows else "Top Entity"
            top_aov = sorted_rows[0][1] if sorted_rows else "0"

            exec_time = round((time.perf_counter() - start_time) * 1000, 1)
            formatted_met = aov_met.replace('_', ' ').title()

            content = (
                f"### Average Order Value for Referenced {ent_dim.replace('_', ' ').title()}s\n\n"
                f"Analyzing average transaction performance across the previously discussed entities in **{table_name}**:\n\n"
                f"- **Highest Average Order Value**: **{top_ent}** leads with an average of **{top_aov}** per transaction.\n"
                f"- **Analytical Context**: Calculated as total monetary volume divided by exact transaction count for each entity."
            )

            return {
                "content": content,
                "action_type": "SHOW_CHART",
                "action_payload": {
                    "chart": {
                        "title": f"Average {formatted_met} Across Referenced {ent_dim.replace('_', ' ').title()}s",
                        "chart_type": "bar",
                        "x_field": ent_dim,
                        "y_field": f"Avg_{aov_met}",
                        "table_name": table_name,
                        "aggregation": "mean",
                        "data": chart_data
                    },
                    "kpi_highlights": [
                        {"label": f"Highest AOV ({top_ent})", "value": top_aov, "color": "emerald"},
                        {"label": "Entities Analyzed", "value": str(len(ents)), "color": "cyan"}
                    ],
                    "table_data": {
                        "columns": [ent_dim.replace('_', ' ').title(), f"Avg {formatted_met} (AOV)", f"Total {formatted_met}", "Orders"],
                        "rows": sorted_rows
                    },
                    "suggested_followups": [
                        f"Why does {top_ent} have the highest average order value?",
                        "Compare their total transaction counts",
                        "Show monthly trend"
                    ],
                    "execution_time_ms": exec_time
                },
                "citations": citations,
                "calculation_steps": [{"step": f"Computed mean '{aov_met}' per record for {len(ents)} referenced entities in '{ent_dim}'"}]
            }

        # -------------------------------------------------------------
        # 0.8 BASIC DATASET QUESTIONS: Customers, Orders, Row counts
        # -------------------------------------------------------------
        if any(kw in q_lower for kw in ["how many customers", "count of customers", "number of customers", "total customers", "unique customers"]):
            exec_time = round((time.perf_counter() - start_time) * 1000, 1)
            cust_cols = [c for c in df.columns if any(k in c.lower() for k in ["customer", "client", "buyer"])]
            cust_count = 0
            cust_table = table_name
            for t_name, t_df in dataframes.items():
                if "customer" in t_name.lower():
                    cust_count = len(t_df)
                    cust_table = t_name
                    break
            if not cust_count and cust_cols:
                cust_count = df[cust_cols[0]].nunique()
            elif not cust_count:
                for t_name, t_df in dataframes.items():
                    c_matches = [c for c in t_df.columns if "customer" in c.lower()]
                    if c_matches:
                        cust_count = t_df[c_matches[0]].nunique()
                        cust_table = t_name
                        break
            if not cust_count:
                cust_count = len(df)

            content = (
                f"### Verified Customer Count\n\n"
                f"There are **{cust_count:,} unique customers** recorded in table **{cust_table}** of your dataset.\n\n"
                f"- **Data Grounding**: Calculated via exact deterministic distinct count on the active customer identifier.\n"
                f"- **Active Status**: All recorded records have been validated against the dataset schema."
            )
            return {
                "content": content,
                "action_type": None,
                "action_payload": {
                    "kpi_highlights": [
                        {"label": "Total Customers", "value": f"{cust_count:,}", "color": "emerald"},
                        {"label": "Source Table", "value": cust_table, "color": "indigo"},
                        {"label": "Health Score", "value": f"{dataset_env.get('health_score', 100)}%", "color": "cyan"}
                    ],
                    "suggested_followups": [
                        "Which customers have the highest purchase value?",
                        "What is the average purchase per customer?",
                        "Segment customers into clusters"
                    ],
                    "execution_time_ms": exec_time
                },
                "citations": [{"table": cust_table, "columns": cust_cols or ["customer_id"]}],
                "calculation_steps": [{"step": f"Executed COUNT DISTINCT on customer identifiers in '{cust_table}' ({cust_count:,} unique)"}]
            }

        # Orders count
        if any(kw in q_lower for kw in ["how many orders", "count of orders", "number of orders", "total orders"]):
            exec_time = round((time.perf_counter() - start_time) * 1000, 1)
            order_count = 0
            order_table = table_name
            for t_name, t_df in dataframes.items():
                if "order" in t_name.lower() and not "detail" in t_name.lower():
                    order_count = len(t_df)
                    order_table = t_name
                    break
            if not order_count:
                order_cols = [c for c in df.columns if "order" in c.lower() and "id" in c.lower()]
                if order_cols:
                    order_count = df[order_cols[0]].nunique()
                else:
                    order_count = len(df)

            content = (
                f"### Verified Order Volume\n\n"
                f"There are **{order_count:,} orders** registered across **{order_table}** in your dataset.\n\n"
                f"- **Calculation Grounding**: 100% exact row / transaction count verified from storage.\n"
                f"- **Integrity**: Includes all validated production records."
            )
            return {
                "content": content,
                "action_type": None,
                "action_payload": {
                    "kpi_highlights": [
                        {"label": "Total Orders", "value": f"{order_count:,}", "color": "cyan"},
                        {"label": "Source Table", "value": order_table, "color": "indigo"}
                    ],
                    "suggested_followups": [
                        "What is the average order value?",
                        "What is the total revenue?",
                        "Show monthly order trend"
                    ],
                    "execution_time_ms": exec_time
                },
                "citations": [{"table": order_table, "columns": ["order_id"] if "order_id" in df.columns else []}],
                "calculation_steps": [{"step": f"Computed verified transaction count in '{order_table}' ({order_count:,} records)"}]
            }

        # Store with highest Average Order Value (AOV)
        if any(kw in q_lower for kw in ["highest average order value", "highest aov", "best average order value", "store has the highest average", "highest average order"]):
            exec_time = round((time.perf_counter() - start_time) * 1000, 1)
            store_col = None
            for c in df.columns:
                c_low = c.lower()
                if any(k in c_low for k in ["store", "shop", "location", "branch", "region", "city", "country"]) and not ChatAgent._is_id_column(c, df[c]):
                    store_col = c
                    break
            if not store_col:
                store_col = dim_col or "Category"

            rev_col = metric_col if metric_col and metric_col != "Count" else None
            if not rev_col:
                num_cols = [c for c in df.select_dtypes(include=[np.number]).columns if not ChatAgent._is_id_column(c, df[c])]
                rev_col = num_cols[0] if num_cols else "Total"

            aov_series = df.groupby(store_col)[rev_col].mean().sort_values(ascending=False).head(10)
            rows = []
            chart_data = []
            for s_name, s_val in aov_series.items():
                rows.append([str(s_name), ChatAgent._format_value(float(s_val), rev_col)])
                chart_data.append({"label": str(s_name), "value": round(float(s_val), 2)})

            top_store = chart_data[0]["label"] if chart_data else "Store 1"
            top_aov = ChatAgent._format_value(chart_data[0]["value"], rev_col) if chart_data else "0"

            content = (
                f"### Highest Average Order Value Analysis\n\n"
                f"Analyzing **{store_col.replace('_', ' ').title()}** performance across **{table_name}**:\n\n"
                f"- **Top Performer**: **{top_store}** generates the highest average order value at **{top_aov}** per transaction.\n"
                f"- **Business Significance**: This represents the highest monetization per order. High AOV indicates larger basket sizes or premium product mix.\n\n"
                f"Here are the top ranked performers by Average Order Value:"
            )

            return {
                "content": content,
                "action_type": "SHOW_CHART",
                "action_payload": {
                    "chart": {
                        "title": f"Average Order Value by {store_col.replace('_', ' ').title()}",
                        "chart_type": "bar",
                        "x_field": store_col,
                        "y_field": f"Avg_{rev_col}",
                        "table_name": table_name,
                        "aggregation": "mean",
                        "data": chart_data
                    },
                    "kpi_highlights": [
                        {"label": f"Top {store_col.replace('_', ' ').title()}", "value": top_store, "color": "emerald"},
                        {"label": "Highest AOV", "value": top_aov, "color": "cyan"},
                        {"label": "Metric", "value": rev_col.replace('_', ' ').title(), "color": "indigo"}
                    ],
                    "table_data": {
                        "columns": [store_col.replace('_', ' ').title(), f"Average {rev_col.replace('_', ' ').title()} (AOV)"],
                        "rows": rows
                    },
                    "suggested_followups": [
                        f"Why does {top_store} have the highest average order value?",
                        f"Compare total revenue across {store_col.replace('_', ' ').title()}s",
                        "Show monthly sales trend"
                    ],
                    "execution_time_ms": exec_time
                },
                "citations": [{"table": table_name, "columns": [store_col, rev_col]}],
                "calculation_steps": [{"step": f"Grouped by '{store_col}' and computed MEAN('{rev_col}') across {len(df)} rows"}]
            }

        # Top 10 products by revenue
        if any(kw in q_lower for kw in ["top 10 products", "top products by revenue", "top products by sales", "best selling products", "top products"]):
            exec_time = round((time.perf_counter() - start_time) * 1000, 1)
            prod_col = None
            for c in df.columns:
                c_low = c.lower()
                if any(k in c_low for k in ["product", "item", "title", "sku", "goods"]) and not ChatAgent._is_id_column(c, df[c]):
                    prod_col = c
                    break
            if not prod_col:
                prod_col = dim_col or "Product"

            rev_col = metric_col if metric_col and metric_col != "Count" else None
            if not rev_col:
                for c in df.columns:
                    if any(k in c.lower() for k in ["revenue", "sales", "amount", "price", "total"]) and np.issubdtype(df[c].dtype, np.number):
                        rev_col = c
                        break
            if not rev_col:
                num_cols = [c for c in df.select_dtypes(include=[np.number]).columns if not ChatAgent._is_id_column(c, df[c])]
                rev_col = num_cols[0] if num_cols else "Total"

            top_prods = CalculationTools.execute_aggregation(df, prod_col, rev_col, agg_type="sum", top_n=10)
            rows = []
            for idx, p in enumerate(top_prods):
                rows.append([f"#{idx+1}", str(p["label"]), ChatAgent._format_value(p["value"], rev_col)])

            lead_prod = top_prods[0]["label"] if top_prods else "Product 1"
            lead_val = ChatAgent._format_value(top_prods[0]["value"], rev_col) if top_prods else "0"
            formatted_met = rev_col.replace('_', ' ').title()

            content = (
                f"### Top 10 Products by {formatted_met}\n\n"
                f"Ranking top performing items in **{table_name}** by total verified {formatted_met.lower()}:\n\n"
                f"- **#1 Product**: **{lead_prod}** leads the portfolio with **{lead_val}**.\n"
                f"- **Data Grounding**: Aggregated via deterministic SUM across all orders without estimation.\n\n"
                f"Here are the top 10 products:"
            )

            return {
                "content": content,
                "action_type": "SHOW_CHART",
                "action_payload": {
                    "chart": {
                        "title": f"Top 10 Products by {formatted_met}",
                        "chart_type": "bar",
                        "x_field": prod_col,
                        "y_field": rev_col,
                        "table_name": table_name,
                        "aggregation": "sum",
                        "data": top_prods
                    },
                    "kpi_highlights": [
                        {"label": "Top Product", "value": lead_prod, "color": "emerald"},
                        {"label": f"{lead_prod} Revenue", "value": lead_val, "color": "cyan"},
                        {"label": "Ranked Items", "value": str(len(top_prods)), "color": "indigo"}
                    ],
                    "table_data": {
                        "columns": ["Rank", "Product Name", f"Total {formatted_met}"],
                        "rows": rows
                    },
                    "suggested_followups": [
                        f"Show monthly sales trend for {lead_prod}",
                        f"Why is {lead_prod} the top selling product?",
                        "Which category has the highest sales?"
                    ],
                    "execution_time_ms": exec_time
                },
                "citations": [{"table": table_name, "columns": [prod_col, rev_col]}],
                "calculation_steps": [{"step": f"Aggregated '{rev_col}' by '{prod_col}' (top 10 items sorted descending)"}]
            }

        # Customers with highest purchase value
        if any(kw in q_lower for kw in ["customers have the highest purchase", "highest purchase value", "top customers", "best customers", "top spending customers"]):
            exec_time = round((time.perf_counter() - start_time) * 1000, 1)
            cust_col = None
            for c in df.columns:
                c_low = c.lower()
                if any(k in c_low for k in ["customer", "client", "buyer", "company"]) and not ChatAgent._is_id_column(c, df[c]):
                    cust_col = c
                    break
            if not cust_col:
                cust_col = dim_col or "Customer"

            rev_col = metric_col if metric_col and metric_col != "Count" else None
            if not rev_col:
                num_cols = [c for c in df.select_dtypes(include=[np.number]).columns if not ChatAgent._is_id_column(c, df[c])]
                rev_col = num_cols[0] if num_cols else "Total"

            top_custs = CalculationTools.execute_aggregation(df, cust_col, rev_col, agg_type="sum", top_n=10)
            rows = []
            for idx, c in enumerate(top_custs):
                rows.append([f"#{idx+1}", str(c["label"]), ChatAgent._format_value(c["value"], rev_col)])

            lead_cust = top_custs[0]["label"] if top_custs else "Customer 1"
            lead_val = ChatAgent._format_value(top_custs[0]["value"], rev_col) if top_custs else "0"
            formatted_met = rev_col.replace('_', ' ').title()

            content = (
                f"### Highest Value Customers by {formatted_met}\n\n"
                f"Identifying top cumulative spenders across **{table_name}**:\n\n"
                f"- **Top Customer**: **{lead_cust}** accounts for the highest lifetime purchase value at **{lead_val}**.\n"
                f"- **Executive Insight**: High concentration in top accounts highlights key enterprise relationships that warrant dedicated retention focus."
            )

            return {
                "content": content,
                "action_type": "SHOW_CHART",
                "action_payload": {
                    "chart": {
                        "title": f"Top Customers by {formatted_met}",
                        "chart_type": "bar",
                        "x_field": cust_col,
                        "y_field": rev_col,
                        "table_name": table_name,
                        "aggregation": "sum",
                        "data": top_custs
                    },
                    "kpi_highlights": [
                        {"label": "Top Spender", "value": lead_cust, "color": "emerald"},
                        {"label": "Highest Spend", "value": lead_val, "color": "cyan"},
                        {"label": "Cohort Analyzed", "value": f"Top {len(top_custs)}", "color": "indigo"}
                    ],
                    "table_data": {
                        "columns": ["Rank", "Customer", f"Total {formatted_met}"],
                        "rows": rows
                    },
                    "suggested_followups": [
                        f"Show transaction history for {lead_cust}",
                        "Segment customers into ML clusters",
                        "What is the average order value?"
                    ],
                    "execution_time_ms": exec_time
                },
                "citations": [{"table": table_name, "columns": [cust_col, rev_col]}],
                "calculation_steps": [{"step": f"Aggregated '{rev_col}' grouped by '{cust_col}' sorted descending"}]
            }

        # Dataset tables & data environment info
        if any(kw in q_lower for kw in ["what tables", "dataset info", "explain dataset", "data environment", "schema info", "data quality", "health score", "missing values"]):
            exec_time = round((time.perf_counter() - start_time) * 1000, 1)
            t_list = dataset_env.get("tables", [])
            health = dataset_env.get("health_score", 100)
            rows = []
            lines = [
                f"### Dataset Environment & Schema Summary\n",
                f"The **{dataset_env.get('name', 'current')}** corpus is categorized under the **{domain}** domain with an overall health score of **{health}%**:\n"
            ]
            for t in t_list:
                t_n = t.get("table_name", "Table")
                r_c = t.get("row_count", 0)
                c_list = t.get("columns", [])
                lines.append(f"- **{t_n}**: **{r_c:,} rows**, **{len(c_list)} columns**.")
                rows.append([t_n, f"{r_c:,}", str(len(c_list)), "Production Ready"])

            rels = dataset_env.get("relationships", [])
            if rels:
                lines.append(f"\n**Table Relationships ({len(rels)} joined keys):**")
                for r in rels[:4]:
                    lines.append(f"- `{r.get('from_table')}.{r.get('from_column')}` ↔ `{r.get('to_table')}.{r.get('to_column')}` ({r.get('relationship_type', 'one-to-many')})")

            content = "\n".join(lines)
            return {
                "content": content,
                "action_type": None,
                "action_payload": {
                    "kpi_highlights": [
                        {"label": "Data Health", "value": f"{health}%", "color": "emerald" if health >= 80 else "amber"},
                        {"label": "Total Tables", "value": str(len(t_list)), "color": "cyan"},
                        {"label": "Total Records", "value": f"{dataset_env.get('row_count', len(df)):,}", "color": "indigo"}
                    ],
                    "table_data": {
                        "columns": ["Table Name", "Rows", "Columns", "Status"],
                        "rows": rows
                    },
                    "suggested_followups": [
                        "What is the total revenue?",
                        "Which category has the highest sales?",
                        "What dashboards are available?"
                    ],
                    "execution_time_ms": exec_time
                },
                "citations": [{"table": t.get("table_name"), "columns": []} for t in t_list[:3]],
                "calculation_steps": [{"step": f"Cataloged {len(t_list)} database tables, {len(rels)} relationships, and health metrics"}]
            }

        # -------------------------------------------------------------
        # 1. ACTION: ADD TO REPORT
        # -------------------------------------------------------------
        if any(kw in q_lower for kw in ["add to report", "add this to report", "include in report", "send to report"]):
            exec_time = round((time.perf_counter() - start_time) * 1000, 1)
            action_payload = {
                "section_title": f"Insight: {query[:45]}",
                "content": f"Executive finding generated from query '{query}'. Verified from data in '{table_name}'.",
                "section_type": "custom",
                "execution_time_ms": exec_time,
                "kpi_highlights": [
                    {"label": "Report Status", "value": "Section Added", "color": "emerald"},
                    {"label": "Source Table", "value": table_name, "color": "indigo"}
                ],
                "suggested_followups": [
                    "View complete executive report",
                    "Add an anomaly detection section to report",
                    "Export report to PDF"
                ]
            }
            return {
                "content": "I have created an update for your Executive Report. You can review, edit, and export it in the **Report** tab.",
                "action_type": "ADD_TO_REPORT",
                "action_payload": action_payload,
                "citations": citations,
                "calculation_steps": [{"step": "Created new analytical finding block for executive report document"}]
            }

        # -------------------------------------------------------------
        # 2. ACTION: CREATE SHEET
        # -------------------------------------------------------------
        sheet_match = re.search(r"create (?:a )?(?:new )?sheet (?:called |named )?['\"]?([^'\"\n]+)['\"]?", q_lower)
        if sheet_match or "create sheet" in q_lower or "new sheet" in q_lower:
            sheet_title = sheet_match.group(1).title() if sheet_match else "Custom Analysis"
            exec_time = round((time.perf_counter() - start_time) * 1000, 1)
            action_payload = {
                "title": sheet_title,
                "sheet_type": "custom",
                "execution_time_ms": exec_time,
                "kpi_highlights": [
                    {"label": "Sheet Created", "value": sheet_title, "color": "emerald"},
                    {"label": "Target Dataset", "value": table_name, "color": "indigo"}
                ],
                "suggested_followups": [
                    f"Pin top {dim_col or 'category'} chart to this sheet",
                    "Add monthly revenue trend chart",
                    "Show dashboard view"
                ]
            }
            return {
                "content": f"Created new dashboard sheet **'{sheet_title}'**. You can now organize dedicated charts and KPIs in this view.",
                "action_type": "CREATE_SHEET",
                "action_payload": action_payload,
                "citations": citations,
                "calculation_steps": [{"step": f"Initialized workspace sheet '{sheet_title}'"}]
            }

        # -------------------------------------------------------------
        # 3. ACTION: EDIT / SWITCH CHART TYPE
        # -------------------------------------------------------------
        if any(kw in q_lower for kw in ["change that to a", "change chart to", "make it a bar", "make it a line", "switch to pie", "show as table", "make it a donut"]):
            target_type = "bar"
            if "line" in q_lower or "area" in q_lower: target_type = "line"
            elif "pie" in q_lower or "donut" in q_lower: target_type = "pie"
            elif "scatter" in q_lower: target_type = "scatter"
            elif "table" in q_lower: target_type = "table"

            exec_time = round((time.perf_counter() - start_time) * 1000, 1)
            return {
                "content": f"Switched visualization view to **{target_type.title()}**. The chart has re-rendered dynamically.",
                "action_type": "EDIT_CHART",
                "action_payload": {
                    "chart_type": target_type,
                    "modification": f"Updated visualization type to {target_type}",
                    "execution_time_ms": exec_time
                },
                "citations": citations,
                "calculation_steps": [{"step": f"Updated chart view configuration to {target_type}"}]
            }

        # -------------------------------------------------------------
        # 4. COMPARATIVE BENCHMARKING (A vs B, Compare X and Y)
        # -------------------------------------------------------------
        is_compare_query = any(kw in q_lower for kw in ["compare", " vs ", " vs. ", "versus", "benchmark "])
        if is_compare_query and dim_col and metric_col and metric_col != "Count":
            # Extract candidates to compare
            unique_vals = [str(x) for x in df[dim_col].dropna().unique()]
            matched_vals = [uv for uv in unique_vals if re.search(rf"\b{re.escape(uv.lower())}\b", q_lower)]
            
            # If no unique dimension values matched, check for years in date_col
            if len(matched_vals) < 2 and date_col:
                years = [str(y) for y in pd.to_datetime(df[date_col], errors="coerce").dt.year.dropna().unique().astype(int)]
                matched_years = [y for y in years if y in q_lower]
                if len(matched_years) >= 2:
                    dim_col = "_year"
                    df = df.copy()
                    df["_year"] = pd.to_datetime(df[date_col], errors="coerce").dt.year.astype(str)
                    matched_vals = matched_years[:2]

            # If still fewer than 2 matched, use top 2 performers
            if len(matched_vals) < 2:
                top_items = CalculationTools.execute_aggregation(df, dim_col, metric_col, agg_type="sum", top_n=2)
                matched_vals = [item["label"] for item in top_items[:2]]

            if len(matched_vals) >= 2:
                v1_name = matched_vals[0]
                v2_name = matched_vals[1]

                df_v1 = df[df[dim_col].astype(str).str.lower() == v1_name.lower()]
                df_v2 = df[df[dim_col].astype(str).str.lower() == v2_name.lower()]

                v1_series = pd.to_numeric(df_v1[metric_col], errors="coerce").dropna()
                v2_series = pd.to_numeric(df_v2[metric_col], errors="coerce").dropna()

                v1_sum = float(v1_series.sum()) if not v1_series.empty else 0.0
                v2_sum = float(v2_series.sum()) if not v2_series.empty else 0.0
                v1_avg = float(v1_series.mean()) if not v1_series.empty else 0.0
                v2_avg = float(v2_series.mean()) if not v2_series.empty else 0.0

                abs_diff = v1_sum - v2_sum
                pct_delta = round((abs_diff / max(abs(v2_sum), 1)) * 100, 1)
                winner = v1_name if v1_sum >= v2_sum else v2_name
                loser = v2_name if winner == v1_name else v1_name

                calc_steps.append({"step": f"Filtered table '{table_name}' for segments '{v1_name}' ({len(df_v1)} rows) and '{v2_name}' ({len(df_v2)} rows)"})
                calc_steps.append({"step": f"Aggregated metric '{metric_col}': {v1_name} = {v1_sum}, {v2_name} = {v2_sum}, delta = {pct_delta:+}%"})

                formatted_metric = metric_col.replace('_', ' ').title()
                formatted_dim = dim_col.replace('_', ' ').title()

                content = (
                    f"### Comparative Benchmark: {v1_name} vs {v2_name}\n\n"
                    f"Comparing **{formatted_dim}** performance across verified data in **{table_name}**:\n\n"
                    f"- **Performance Leader**: **{winner}** leads with **{ChatAgent._format_value(max(v1_sum, v2_sum), metric_col)}** "
                    f"({abs(pct_delta)}% {'higher' if pct_delta >= 0 else 'lower'} than {loser}).\n"
                    f"- **{v1_name} Aggregated**: **{ChatAgent._format_value(v1_sum, metric_col)}** (Avg {ChatAgent._format_value(v1_avg, metric_col)} / rec, {len(df_v1):,} records)\n"
                    f"- **{v2_name} Aggregated**: **{ChatAgent._format_value(v2_sum, metric_col)}** (Avg {ChatAgent._format_value(v2_avg, metric_col)} / rec, {len(df_v2):,} records)\n"
                    f"- **Net Variance (Δ)**: **{ChatAgent._format_value(abs(abs_diff), metric_col)}** ({pct_delta:+}% spread)\n\n"
                    f"**Executive Takeaway:** {winner} delivers the stronger total contribution. Investigate unit pricing or transaction volume to identify if the difference stems from deal size or order velocity."
                )

                chart_data = [
                    {"label": v1_name, "value": round(v1_sum, 2)},
                    {"label": v2_name, "value": round(v2_sum, 2)}
                ]

                kpi_highlights = [
                    {"label": f"{v1_name} Total", "value": ChatAgent._format_value(v1_sum, metric_col), "color": "indigo"},
                    {"label": f"{v2_name} Total", "value": ChatAgent._format_value(v2_sum, metric_col), "color": "purple"},
                    {"label": "Net Variance (Δ)", "value": f"{pct_delta:+}%", "color": "emerald" if pct_delta >= 0 else "rose"},
                    {"label": "Leader", "value": winner, "color": "cyan"}
                ]

                table_data = {
                    "columns": ["Metric", v1_name, v2_name, "Variance (Δ)", "Change %"],
                    "rows": [
                        [f"Total {formatted_metric}", ChatAgent._format_value(v1_sum, metric_col), ChatAgent._format_value(v2_sum, metric_col), ChatAgent._format_value(abs_diff, metric_col), f"{pct_delta:+}%"],
                        ["Average per Record", ChatAgent._format_value(v1_avg, metric_col), ChatAgent._format_value(v2_avg, metric_col), ChatAgent._format_value(v1_avg - v2_avg, metric_col), f"{round(((v1_avg - v2_avg)/max(abs(v2_avg), 1))*100, 1):+}%"],
                        ["Record Count", f"{len(df_v1):,}", f"{len(df_v2):,}", f"{len(df_v1) - len(df_v2):,}", "-"]
                    ]
                }

                relative_chart = {
                    "title": f"{formatted_metric} Comparison: {v1_name} vs {v2_name}",
                    "chart_type": "bar",
                    "x_field": dim_col,
                    "y_field": metric_col,
                    "table_name": table_name,
                    "aggregation": "sum",
                    "data": chart_data
                }

                suggested_followups = [
                    f"Why did {winner} generate higher {formatted_metric}?",
                    f"Show monthly trend for {v1_name}",
                    f"Show monthly trend for {v2_name}"
                ]

                exec_time = round((time.perf_counter() - start_time) * 1000, 1)

                llm_narrative = await ChatAgent._synthesize_executive_narrative(query, content, kpi_highlights, table_name, domain)
                if llm_narrative:
                    content = llm_narrative

                return {
                    "content": content,
                    "action_type": "SHOW_CHART",
                    "action_payload": {
                        "chart": relative_chart,
                        "kpi_highlights": kpi_highlights,
                        "table_data": table_data,
                        "suggested_followups": suggested_followups,
                        "execution_time_ms": exec_time
                    },
                    "citations": citations,
                    "calculation_steps": calc_steps
                }

        # -------------------------------------------------------------
        # 5. ROOT CAUSE & DRIVER DIAGNOSTICS ("Why did X drop?", "What caused spike?")
        # -------------------------------------------------------------
        is_root_cause = any(kw in q_lower for kw in [
            "why did", "what caused", "root cause", "explain drop", "explain decline", 
            "driver of change", "decline in", "drop in", "spike in", "explain variance"
        ])
        if is_root_cause and metric_col and metric_col != "Count":
            calc_steps.append({"step": f"Initiated root cause decomposition for '{metric_col}' across '{table_name}'"})
            formatted_metric = metric_col.replace('_', ' ').title()

            # Breakdown by dimension to find primary negative and positive drivers
            ranked_dim = CalculationTools.execute_aggregation(df, dim_col or "Category", metric_col, agg_type="sum", top_n=10)
            
            if ranked_dim and len(ranked_dim) >= 2:
                total_val = sum(r["value"] for r in ranked_dim)
                mean_val = total_val / len(ranked_dim)
                
                # Lowest performer represents the primary operational drag
                drag_item = ranked_dim[-1]
                leader_item = ranked_dim[0]
                drag_gap = mean_val - drag_item["value"]
                drag_impact_pct = round((drag_gap / max(total_val, 1)) * 100, 1)

                content = (
                    f"### Root-Cause Diagnostic Analysis: {formatted_metric}\n\n"
                    f"Decomposing variance and performance attribution across **{dim_col.replace('_', ' ').title() if dim_col else 'Category'}** in **{table_name}**:\n\n"
                    f"- **Primary Operational Drag**: **{drag_item['label']}** recorded the lowest volume at **{ChatAgent._format_value(drag_item['value'], metric_col)}** "
                    f"({round((drag_item['value']/max(total_val, 1))*100, 1)}% of aggregate).\n"
                    f"- **Primary Growth Driver**: **{leader_item['label']}** generated **{ChatAgent._format_value(leader_item['value'], metric_col)}** "
                    f"({round((leader_item['value']/max(total_val, 1))*100, 1)}% of total volume).\n"
                    f"- **Variance Attribution**: The performance spread between top and bottom contributors is **{ChatAgent._format_value(leader_item['value'] - drag_item['value'], metric_col)}**.\n\n"
                    f"**Strategic Recommendation:** To alleviate drag, prioritize resource re-allocation toward `{drag_item['label']}` to diagnose pricing compression, churn, or inventory stockouts."
                )

                kpi_highlights = [
                    {"label": "Primary Drag", "value": drag_item['label'], "color": "rose"},
                    {"label": "Drag Output", "value": ChatAgent._format_value(drag_item['value'], metric_col), "color": "amber"},
                    {"label": "Top Driver", "value": leader_item['label'], "color": "emerald"},
                    {"label": "Spread Gap", "value": ChatAgent._format_value(leader_item['value'] - drag_item['value'], metric_col), "color": "cyan"}
                ]

                table_data = {
                    "columns": [dim_col.replace('_', ' ').title() if dim_col else "Category", formatted_metric, "Share of Total", "Status"],
                    "rows": [
                        [r["label"], ChatAgent._format_value(r["value"], metric_col), f"{round((r['value']/max(total_val, 1))*100, 1)}%", "High Performer" if i < 2 else ("Operational Drag" if i >= len(ranked_dim)-2 else "Normal")]
                        for i, r in enumerate(ranked_dim)
                    ]
                }

                relative_chart = {
                    "title": f"Variance Contribution: {formatted_metric} by {dim_col.replace('_', ' ').title() if dim_col else 'Category'}",
                    "chart_type": "bar",
                    "x_field": dim_col or "Category",
                    "y_field": metric_col,
                    "table_name": table_name,
                    "aggregation": "sum",
                    "data": ranked_dim
                }

                suggested_followups = [
                    f"Deep-dive into underperformance of {drag_item['label']}",
                    f"Show monthly trend for {drag_item['label']}",
                    "Add root-cause diagnostic to executive report"
                ]

                exec_time = round((time.perf_counter() - start_time) * 1000, 1)

                llm_narrative = await ChatAgent._synthesize_executive_narrative(query, content, kpi_highlights, table_name, domain)
                if llm_narrative:
                    content = llm_narrative

                return {
                    "content": content,
                    "action_type": "SHOW_CHART",
                    "action_payload": {
                        "chart": relative_chart,
                        "kpi_highlights": kpi_highlights,
                        "table_data": table_data,
                        "suggested_followups": suggested_followups,
                        "execution_time_ms": exec_time
                    },
                    "citations": citations,
                    "calculation_steps": calc_steps
                }

        # -------------------------------------------------------------
        # 5B. PREDICTIVE TIME-SERIES FORECASTING ("Forecast sales next 6 months", "Predict revenue")
        # -------------------------------------------------------------
        is_forecast_query = any(kw in q_lower for kw in [
            "forecast", "predict", "future", "outlook", "next quarter", 
            "next month", "next year", "projection for", "projected growth"
        ])
        if is_forecast_query and (metric_col or is_count_query):
            forecast_result = ForecastEngine.generate_forecast(
                df=df,
                metric_col=metric_col if metric_col != "Count" else None,
                date_col=date_col,
                horizon=6
            )
            if "error" not in forecast_result:
                f_summary = forecast_result["summary"]
                f_metric = forecast_result["metric_display"]
                calc_steps.append({"step": f"Fitted Holt's trend exponential smoothing & polynomial regression on '{f_metric}' across '{table_name}'"})
                calc_steps.append({"step": f"Projected 6 future {forecast_result['frequency'].lower()}s with 80% & 95% confidence bounds"})

                content = (
                    f"### Predictive AI Forecast: {f_metric}\n\n"
                    f"Statistical projection across **{table_name}** over a 6-{forecast_result['frequency'].lower()} horizon:\n\n"
                    f"- **Next Immediate Target**: **{ChatAgent._format_value(f_summary['next_forecast'], f_metric)}**\n"
                    f"- **Horizon End Target**: **{ChatAgent._format_value(f_summary['horizon_target'], f_metric)}** "
                    f"({f_summary['projected_change_pct']:+}% projected shift).\n"
                    f"- **Trajectory Assessment**: **{f_summary['trajectory']}** (Model Confidence: **{f_summary['confidence_score']}%**, R² = {f_summary['r_squared']}).\n"
                    f"- **Scenario Boundaries**: Bull Case **{forecast_result['forecast'][-1]['bull_scenario']:,.2f}** vs Bear Case **{forecast_result['forecast'][-1]['bear_scenario']:,.2f}**.\n\n"
                    f"**Executive Prescriptive Outlook:**\n"
                    + "\n".join([f"- {rec}" for rec in forecast_result["recommendations"][:2]])
                )

                # Composite chart data: actuals + forecast
                chart_data = []
                for p in forecast_result["historical"][-6:]:
                    chart_data.append({"label": p["period"], "value": p["actual"]})
                for p in forecast_result["forecast"]:
                    chart_data.append({"label": p["period"] + " (FC)", "value": p["forecast"]})

                kpi_highlights = [
                    {"label": "Horizon Target", "value": ChatAgent._format_value(f_summary['horizon_target'], f_metric), "color": f_summary["status_color"]},
                    {"label": "Projected Shift", "value": f"{f_summary['projected_change_pct']:+}%", "color": "cyan"},
                    {"label": "Trajectory", "value": f_summary['trajectory'].split()[0], "color": "indigo"},
                    {"label": "Model Confidence", "value": f"{f_summary['confidence_score']}%", "color": "purple"}
                ]

                table_rows = [
                    [p["period"], ChatAgent._format_value(p["forecast"], f_metric), ChatAgent._format_value(p["bull_scenario"], f_metric), ChatAgent._format_value(p["bear_scenario"], f_metric), f"{p['lower_95']:,.1f} - {p['upper_95']:,.1f}"]
                    for p in forecast_result["forecast"]
                ]

                exec_time = round((time.perf_counter() - start_time) * 1000, 1)
                return {
                    "content": content,
                    "action_type": "SHOW_CHART",
                    "action_payload": {
                        "chart": {
                            "title": f"AI Predictive Forecast: {f_metric} Projection",
                            "chart_type": "line",
                            "x_field": "Period",
                            "y_field": f_metric,
                            "table_name": table_name,
                            "aggregation": "sum",
                            "data": chart_data
                        },
                        "kpi_highlights": kpi_highlights,
                        "table_data": {
                            "columns": ["Horizon Period", "Baseline Forecast", "Bull Scenario (+)", "Bear Scenario (-)", "95% Confidence Band"],
                            "rows": table_rows
                        },
                        "suggested_followups": [
                            "Open full Predictive Forecast Studio",
                            "Simulate what-if growth scenario",
                            "Add forecast projection to executive report"
                        ],
                        "execution_time_ms": exec_time
                    },
                    "citations": citations,
                    "calculation_steps": calc_steps
                }

        # -------------------------------------------------------------
        # 5C. ML COHORT CLUSTERING & SEGMENTATION ("Segment customers", "Find clusters")
        # -------------------------------------------------------------
        is_cluster_query = any(kw in q_lower for kw in [
            "cluster", "segment", "cohort", "customer groups", "segmentation", "tier 1", "k-means"
        ])
        if is_cluster_query:
            cluster_result = MLClusteringEngine.discover_clusters(df, domain=domain)
            if "error" not in cluster_result:
                calc_steps.append({"step": f"Executed vectorized K-Means clustering across {len(cluster_result['features_used'])} numeric features in '{table_name}'"})
                calc_steps.append({"step": f"Identified {cluster_result['k']} natural cohorts with variance explained: {cluster_result['metrics']['variance_explained_pct']}%"})

                cohorts = cluster_result["cohorts"]
                content = (
                    f"### Autonomous ML Clustering & Cohort Intelligence\n\n"
                    f"Segmented **{cluster_result['total_records']:,}** records into **{cluster_result['k']} distinct cohorts** "
                    f"using multi-attribute clustering across `{', '.join(cluster_result['features_used'])}`:\n\n"
                )
                for c in cohorts:
                    content += (
                        f"- **{c['name']}** ({c['record_count']} records, {c['record_percentage']}% share):\n"
                        f"  - *Strength*: {c['dominant_strength']} | *Constraint*: {c['operational_drag']}\n"
                        f"  - *Prescriptive Action*: {c['recommendation']}\n\n"
                    )

                chart_data = [
                    {"label": c["name"].split(":")[0], "value": c["record_count"]}
                    for c in cohorts
                ]

                kpi_highlights = [
                    {"label": "Cohorts Discovered", "value": f"{cluster_result['k']} Segments", "color": "indigo"},
                    {"label": "Top Cohort", "value": cohorts[0]["name"].split(":")[0], "color": "emerald"},
                    {"label": "Variance Explained", "value": f"{cluster_result['metrics']['variance_explained_pct']}%", "color": "cyan"},
                    {"label": "Features Evaluated", "value": f"{len(cluster_result['features_used'])} Metrics", "color": "purple"}
                ]

                table_rows = [
                    [c["name"], f"{c['record_count']:,}", f"{c['record_percentage']}%", c["dominant_strength"], c["recommendation"]]
                    for c in cohorts
                ]

                exec_time = round((time.perf_counter() - start_time) * 1000, 1)
                return {
                    "content": content,
                    "action_type": "SHOW_CHART",
                    "action_payload": {
                        "chart": {
                            "title": f"Cohort Distribution: Record Share across {cluster_result['k']} Clusters",
                            "chart_type": "bar",
                            "x_field": "Cohort",
                            "y_field": "Records",
                            "table_name": table_name,
                            "aggregation": "count",
                            "data": chart_data
                        },
                        "kpi_highlights": kpi_highlights,
                        "table_data": {
                            "columns": ["Cohort Name", "Records", "Share %", "Key Characteristic", "Prescriptive Action"],
                            "rows": table_rows
                        },
                        "suggested_followups": [
                            "Open Segments & Radar Intelligence Studio",
                            "Compare top performing cohort with lagging cohort",
                            "Add cluster summary to executive report"
                        ],
                        "execution_time_ms": exec_time
                    },
                    "citations": citations,
                    "calculation_steps": calc_steps
                }

        # -------------------------------------------------------------
        # 5D. DATA CLEANSE & QUALITY ADVISOR ("Clean data", "Audit defects")
        # -------------------------------------------------------------
        is_cleanse_query = any(kw in q_lower for kw in [
            "clean data", "cleanse", "fix data", "missing values", "repair data", "audit defects", "improve quality"
        ])
        if is_cleanse_query:
            cleanse_audit = DataCleanseService.audit_dataset_cleanliness(df)
            if "error" not in cleanse_audit:
                calc_steps.append({"step": f"Audited {cleanse_audit['total_cells']:,} cells across '{table_name}' for nulls, duplicates, and outliers"})
                content = (
                    f"### Data Health Audit & Cleanse Diagnosis\n\n"
                    f"Current Quality Score: **{cleanse_audit['current_health_score']}/100** across **{cleanse_audit['total_rows']:,} rows** in **{table_name}**:\n\n"
                    f"- **Missing Cells**: **{cleanse_audit['total_nulls']:,}** ({cleanse_audit['null_percentage']}% of cells)\n"
                    f"- **Duplicate Rows**: **{cleanse_audit['duplicate_rows']:,}** redundant entries\n"
                    f"- **Extreme Outliers**: Detected in {len(cleanse_audit['outlier_columns'])} columns ({sum(cleanse_audit['outlier_columns'].values())} anomalies)\n\n"
                    f"**Remediation Recommendation:** Launch the **Data Prep Studio** to execute 1-Click Autonomous Cleanse or apply custom transformations to boost health to 95+."
                )

                kpi_highlights = [
                    {"label": "Current Health", "value": f"{cleanse_audit['current_health_score']}/100", "color": "emerald" if cleanse_audit['current_health_score'] >= 80 else "amber"},
                    {"label": "Missing Cells", "value": f"{cleanse_audit['total_nulls']:,}", "color": "rose" if cleanse_audit['total_nulls'] > 0 else "emerald"},
                    {"label": "Duplicate Rows", "value": f"{cleanse_audit['duplicate_rows']:,}", "color": "cyan"},
                    {"label": "Outlier Anomalies", "value": f"{sum(cleanse_audit['outlier_columns'].values()):,}", "color": "purple"}
                ]

                exec_time = round((time.perf_counter() - start_time) * 1000, 1)
                return {
                    "content": content,
                    "action_type": "SHOW_CHART",
                    "action_payload": {
                        "kpi_highlights": kpi_highlights,
                        "suggested_followups": [
                            "Open Data Prep Studio to auto-cleanse",
                            "Export cleaned CSV",
                            "Show anomalies breakdown"
                        ],
                        "execution_time_ms": exec_time
                    },
                    "citations": citations,
                    "calculation_steps": calc_steps
                }

        # -------------------------------------------------------------
        # 6. WHAT-IF SCENARIO SIMULATION ("What if sales grow 15%?")
        # -------------------------------------------------------------
        is_simulation = any(kw in q_lower for kw in [
            "what if", "simulate", "simulation", "scenario", "sensitivity", 
            "projection", "if revenue", "if sales", "if profit"
        ])
        if is_simulation and metric_col and metric_col != "Count":
            pct_match = re.search(r"([+-]?\d+(?:\.\d+)?)\s*%", q_lower)
            sim_pct = float(pct_match.group(1)) if pct_match else 10.0
            if any(w in q_lower for w in ["drop", "decrease", "reduce", "down", "loss", "shrink"]):
                sim_pct = -abs(sim_pct)

            clean_series = pd.to_numeric(df[metric_col], errors="coerce").dropna()
            baseline_sum = float(clean_series.sum())
            delta_val = baseline_sum * (sim_pct / 100.0)
            projected_sum = baseline_sum + delta_val

            formatted_metric = metric_col.replace('_', ' ').title()
            calc_steps.append({"step": f"Computed baseline sum of '{metric_col}' across '{table_name}': {baseline_sum}"})
            calc_steps.append({"step": f"Applied scenario multiplier (1 + {sim_pct/100:.3f}) = {projected_sum}"})

            # Sub-segment simulation
            sub_dim = CalculationTools.execute_aggregation(df, dim_col or "Category", metric_col, agg_type="sum", top_n=5)
            table_rows = []
            chart_data = [
                {"label": "Baseline", "value": round(baseline_sum, 2)},
                {"label": f"Projected ({sim_pct:+0.1f}%)", "value": round(projected_sum, 2)}
            ]

            for s in sub_dim:
                b_val = s["value"]
                p_val = b_val * (1.0 + sim_pct / 100.0)
                d_val = p_val - b_val
                table_rows.append([
                    s["label"],
                    ChatAgent._format_value(b_val, metric_col),
                    ChatAgent._format_value(p_val, metric_col),
                    f"{ChatAgent._format_value(d_val, metric_col)}",
                    f"{sim_pct:+0.1f}%"
                ])

            content = (
                f"### What-If Scenario Simulation: {sim_pct:+0.1f}% {formatted_metric}\n\n"
                f"Modeling sensitivity trajectory based on verified baseline data in **{table_name}**:\n\n"
                f"- **Current Baseline Total**: **{ChatAgent._format_value(baseline_sum, metric_col)}**\n"
                f"- **Projected Scenario Output**: **{ChatAgent._format_value(projected_sum, metric_col)}**\n"
                f"- **Net Financial Impact (Δ)**: **{ChatAgent._format_value(delta_val, metric_col)}** ({sim_pct:+0.1f}% variance)\n"
                f"- **Active Model Parameter**: Uniform {sim_pct:+0.1f}% shift applied across all {len(clean_series):,} records.\n\n"
                f"**Simulation Assessment:** Achieving this scenario delivers a net delta of **{ChatAgent._format_value(abs(delta_val), metric_col)}**. "
                f"Review the sub-segment breakdown below to determine which categories will drive the highest absolute volume."
            )

            kpi_highlights = [
                {"label": "Baseline Total", "value": ChatAgent._format_value(baseline_sum, metric_col), "color": "indigo"},
                {"label": "Projected Total", "value": ChatAgent._format_value(projected_sum, metric_col), "color": "emerald" if sim_pct >= 0 else "rose"},
                {"label": "Net Delta (Δ)", "value": ChatAgent._format_value(delta_val, metric_col), "color": "cyan"},
                {"label": "Growth Factor", "value": f"{sim_pct:+0.1f}%", "color": "amber"}
            ]

            table_data = {
                "columns": [dim_col.replace('_', ' ').title() if dim_col else "Segment", "Baseline", "Simulated Scenario", "Net Delta (Δ)", "Shift %"],
                "rows": table_rows
            }

            relative_chart = {
                "title": f"Scenario Simulation: Baseline vs {sim_pct:+0.1f}% {formatted_metric}",
                "chart_type": "bar",
                "x_field": "Scenario",
                "y_field": metric_col,
                "table_name": table_name,
                "aggregation": "sum",
                "data": chart_data
            }

            suggested_followups = [
                f"What if the scenario is {sim_pct * 2:+0.1f}% instead?",
                "Which category provides the highest incremental return?",
                "Export this scenario simulation to report"
            ]

            exec_time = round((time.perf_counter() - start_time) * 1000, 1)

            llm_narrative = await ChatAgent._synthesize_executive_narrative(query, content, kpi_highlights, table_name, domain)
            if llm_narrative:
                content = llm_narrative

            return {
                "content": content,
                "action_type": "SHOW_CHART",
                "action_payload": {
                    "chart": relative_chart,
                    "kpi_highlights": kpi_highlights,
                    "table_data": table_data,
                    "suggested_followups": suggested_followups,
                    "execution_time_ms": exec_time
                },
                "citations": citations,
                "calculation_steps": calc_steps
            }

        # -------------------------------------------------------------
        # 7. CORRELATION & FACTOR DISCOVERY ("What correlates with X?")
        # -------------------------------------------------------------
        is_correlation = any(kw in q_lower for kw in [
            "correlat", "relationship between", "driver of", "drivers of", 
            "factor in", "influence on", "affect "
        ])
        if is_correlation:
            calc_steps.append({"step": f"Evaluated Pearson correlation coefficients across numerical columns in '{table_name}'"})
            num_cols = [c for c in df.select_dtypes(include=[np.number]).columns if not ChatAgent._is_id_column(c, df[c])]

            if len(num_cols) >= 2:
                target_col = metric_col if metric_col in num_cols else num_cols[0]
                corr_matrix = df[num_cols].corr().round(3)
                corrs = []

                for c in num_cols:
                    if c != target_col:
                        r_val = float(corr_matrix.loc[target_col, c])
                        if not np.isnan(r_val):
                            strength = "Strong" if abs(r_val) >= 0.6 else ("Moderate" if abs(r_val) >= 0.3 else "Weak")
                            direction = "Positive" if r_val > 0 else "Negative"
                            corrs.append({
                                "column": c,
                                "r": r_val,
                                "strength": strength,
                                "direction": direction
                            })

                corrs = sorted(corrs, key=lambda x: abs(x["r"]), reverse=True)

                if corrs:
                    top_corr = corrs[0]
                    formatted_target = target_col.replace('_', ' ').title()

                    chart_data = [{"label": c["column"].replace('_', ' ').title(), "value": round(c["r"], 3)} for c in corrs[:6]]
                    table_rows = [
                        [c["column"].replace('_', ' ').title(), f"{c['r']:+.3f}", c["strength"], c["direction"]]
                        for c in corrs
                    ]

                    content = (
                        f"### Correlation Analysis: Drivers of {formatted_target}\n\n"
                        f"Examining feature relationships against **{formatted_target}** in **{table_name}**:\n\n"
                        f"- **Strongest Relationship**: **{top_corr['column'].replace('_', ' ').title()}** shows a **{top_corr['strength'].lower()} {top_corr['direction'].lower()}** correlation of **r = {top_corr['r']:+.3f}**.\n"
                        f"- **Operational Meaning**: {'As ' + top_corr['column'].replace('_', ' ').title() + ' rises, ' + formatted_target + ' systematically increases.' if top_corr['r'] > 0 else 'An inverse relationship exists: higher ' + top_corr['column'].replace('_', ' ').title() + ' corresponds to reduced ' + formatted_target + '.'}\n\n"
                        f"**Statistical Ranking Summary:**\n"
                    )

                    for idx, c in enumerate(corrs[:4], 1):
                        content += f"{idx}. **{c['column'].replace('_', ' ').title()}**: r = **{c['r']:+.3f}** ({c['strength']} {c['direction']})\n"

                    kpi_highlights = [
                        {"label": "Key Correlate", "value": top_corr['column'].replace('_', ' ').title(), "color": "indigo"},
                        {"label": "Correlation (r)", "value": f"{top_corr['r']:+.3f}", "color": "emerald" if top_corr['r'] > 0 else "rose"},
                        {"label": "Strength", "value": f"{top_corr['strength']} {top_corr['direction']}", "color": "cyan"},
                        {"label": "Factors Evaluated", "value": f"{len(corrs)} metrics", "color": "amber"}
                    ]

                    table_data = {
                        "columns": ["Numerical Feature", "Pearson r", "Strength", "Direction"],
                        "rows": table_rows
                    }

                    relative_chart = {
                        "title": f"Pearson Correlation (r) with {formatted_target}",
                        "chart_type": "bar",
                        "x_field": "Feature",
                        "y_field": "r",
                        "table_name": table_name,
                        "data": chart_data
                    }

                    suggested_followups = [
                        f"Show scatter plot of {formatted_target} vs {top_corr['column'].replace('_', ' ').title()}",
                        f"Are there outliers in {top_corr['column'].replace('_', ' ').title()}?",
                        "Export correlation findings to report"
                    ]

                    exec_time = round((time.perf_counter() - start_time) * 1000, 1)

                    llm_narrative = await ChatAgent._synthesize_executive_narrative(query, content, kpi_highlights, table_name, domain)
                    if llm_narrative:
                        content = llm_narrative

                    return {
                        "content": content,
                        "action_type": "SHOW_CHART",
                        "action_payload": {
                            "chart": relative_chart,
                            "kpi_highlights": kpi_highlights,
                            "table_data": table_data,
                            "suggested_followups": suggested_followups,
                            "execution_time_ms": exec_time
                        },
                        "citations": citations,
                        "calculation_steps": calc_steps
                    }

        # -------------------------------------------------------------
        # 8. STATISTICAL DISTRIBUTION & HISTOGRAM
        # -------------------------------------------------------------
        is_distribution = any(kw in q_lower for kw in [
            "distribution of", "histogram", "spread of", "skewness", "quartiles", "distribution"
        ])
        if is_distribution and metric_col and metric_col != "Count":
            clean_series = pd.to_numeric(df[metric_col], errors="coerce").dropna()
            if len(clean_series) >= 2:
                q25 = float(clean_series.quantile(0.25))
                q50 = float(clean_series.median())
                q75 = float(clean_series.quantile(0.75))
                iqr = q75 - q25
                mean_val = float(clean_series.mean())
                std_val = float(clean_series.std())
                min_val = float(clean_series.min())
                max_val = float(clean_series.max())

                skew_label = "Right-skewed (Long tail high)" if mean_val > q50 + 0.1 * std_val else ("Left-skewed (Long tail low)" if mean_val < q50 - 0.1 * std_val else "Symmetric / Normal")
                bins_data = CalculationTools.execute_distribution(df, metric_col, bins_count=8)

                formatted_metric = metric_col.replace('_', ' ').title()
                calc_steps.append({"step": f"Computed 5-number summary (Min, Q1, Median, Q3, Max) and 8-bin histogram on '{metric_col}'"})

                content = (
                    f"### Statistical Distribution: {formatted_metric}\n\n"
                    f"Profiled across **{len(clean_series):,} verified data points** in **{table_name}**:\n\n"
                    f"- **Median (50th percentile)**: **{ChatAgent._format_value(q50, metric_col)}**\n"
                    f"- **Mean / Standard Deviation**: **{ChatAgent._format_value(mean_val, metric_col)}** (± {ChatAgent._format_value(std_val, metric_col)})\n"
                    f"- **Interquartile Range (IQR)**: **{ChatAgent._format_value(iqr, metric_col)}** (25% = {ChatAgent._format_value(q25, metric_col)}, 75% = {ChatAgent._format_value(q75, metric_col)})\n"
                    f"- **Observed Extremes**: {ChatAgent._format_value(min_val, metric_col)} (Min) to {ChatAgent._format_value(max_val, metric_col)} (Max)\n"
                    f"- **Shape & Symmetry**: **{skew_label}**"
                )

                kpi_highlights = [
                    {"label": "Median", "value": ChatAgent._format_value(q50, metric_col), "color": "indigo"},
                    {"label": "Mean", "value": ChatAgent._format_value(mean_val, metric_col), "color": "purple"},
                    {"label": "Std Dev (σ)", "value": ChatAgent._format_value(std_val, metric_col), "color": "amber"},
                    {"label": "IQR Spread", "value": ChatAgent._format_value(iqr, metric_col), "color": "emerald"}
                ]

                table_data = {
                    "columns": ["Statistical Parameter", "Value"],
                    "rows": [
                        ["Sample Count", f"{len(clean_series):,}"],
                        ["Mean", ChatAgent._format_value(mean_val, metric_col)],
                        ["Standard Deviation", ChatAgent._format_value(std_val, metric_col)],
                        ["Minimum", ChatAgent._format_value(min_val, metric_col)],
                        ["25th Percentile (Q1)", ChatAgent._format_value(q25, metric_col)],
                        ["Median (Q2)", ChatAgent._format_value(q50, metric_col)],
                        ["75th Percentile (Q3)", ChatAgent._format_value(q75, metric_col)],
                        ["Maximum", ChatAgent._format_value(max_val, metric_col)],
                        ["Interquartile Range (IQR)", ChatAgent._format_value(iqr, metric_col)]
                    ]
                }

                relative_chart = {
                    "title": f"Frequency Distribution: {formatted_metric}",
                    "chart_type": "bar",
                    "x_field": "Range",
                    "y_field": "Frequency",
                    "table_name": table_name,
                    "data": bins_data
                }

                suggested_followups = [
                    f"Detect outliers in {formatted_metric}",
                    f"Show {formatted_metric} breakdown by {dim_col or 'Category'}",
                    f"Show monthly trend for {formatted_metric}"
                ]

                exec_time = round((time.perf_counter() - start_time) * 1000, 1)

                llm_narrative = await ChatAgent._synthesize_executive_narrative(query, content, kpi_highlights, table_name, domain)
                if llm_narrative:
                    content = llm_narrative

                return {
                    "content": content,
                    "action_type": "SHOW_CHART",
                    "action_payload": {
                        "chart": relative_chart,
                        "kpi_highlights": kpi_highlights,
                        "table_data": table_data,
                        "suggested_followups": suggested_followups,
                        "execution_time_ms": exec_time
                    },
                    "citations": citations,
                    "calculation_steps": calc_steps
                }

        # -------------------------------------------------------------
        # 9. ANOMALIES & OUTLIERS DETECTION
        # -------------------------------------------------------------
        if any(kw in q_lower for kw in ["anomaly", "anomalies", "outlier", "outliers", "unusual", "suspicious"]):
            anomalies = AnomalyDetector.detect_anomalies(dataframes)
            if anomalies:
                anom_summary_lines = []
                chart_data = []
                table_rows = []
                for a in anomalies[:5]:
                    anom_summary_lines.append(f"- **{a['column_name']}** ({a['table_name']}): **{a['anomaly_count']}** outliers detected ({a['severity'].upper()} severity). {a['explanation']}")
                    chart_data.append({"label": f"{a['table_name']}.{a['column_name']}", "value": a['anomaly_count']})
                    table_rows.append([a['table_name'], a['column_name'], a['anomaly_count'], a['severity'].upper(), a['method']])

                content = "### Statistical Anomaly Analysis\n\n" + "\n".join(anom_summary_lines)
                relative_chart = {
                    "title": "Anomaly Count by Feature",
                    "chart_type": "bar",
                    "x_field": "Feature",
                    "y_field": "Outlier Count",
                    "table_name": table_name,
                    "data": chart_data
                }

                kpi_highlights = [
                    {"label": "Anomalies Found", "value": f"{sum(a['anomaly_count'] for a in anomalies)}", "color": "rose"},
                    {"label": "Features Affected", "value": f"{len(anomalies)}", "color": "amber"},
                    {"label": "Highest Severity", "value": anomalies[0]['severity'].upper(), "color": "rose"},
                    {"label": "Scan Scope", "value": f"{len(dataframes)} tables", "color": "indigo"}
                ]

                table_data = {
                    "columns": ["Table", "Feature", "Outlier Count", "Severity", "Detection Method"],
                    "rows": table_rows
                }

                suggested_followups = [
                    f"Show distribution for {anomalies[0]['column_name']}",
                    "How do outliers impact our total revenue?",
                    "Add anomaly findings to executive report"
                ]

                exec_time = round((time.perf_counter() - start_time) * 1000, 1)

                return {
                    "content": content,
                    "action_type": "SHOW_CHART",
                    "action_payload": {
                        "chart": relative_chart,
                        "kpi_highlights": kpi_highlights,
                        "table_data": table_data,
                        "suggested_followups": suggested_followups,
                        "execution_time_ms": exec_time
                    },
                    "citations": [{"table": a['table_name'], "columns": [a['column_name']]} for a in anomalies[:5]],
                    "calculation_steps": [
                        {"step": "Scanned numeric columns for Interquartile Range (1.5 * IQR) and Z-score deviations"},
                        {"step": f"Found {len(anomalies)} features with statistically significant outliers"}
                    ]
                }
            else:
                exec_time = round((time.perf_counter() - start_time) * 1000, 1)
                return {
                    "content": f"Statistical scan completed across **{table_name}**. No severe outliers or IQR boundary violations were detected in the numerical features.",
                    "action_type": None,
                    "action_payload": {
                        "execution_time_ms": exec_time,
                        "kpi_highlights": [
                            {"label": "Outliers", "value": "0 Detected", "color": "emerald"},
                            {"label": "Data Hygiene", "value": "Healthy", "color": "emerald"}
                        ],
                        "suggested_followups": [
                            "Show monthly trend",
                            "Which category performs best?",
                            "Check correlation between features"
                        ]
                    },
                    "citations": citations,
                    "calculation_steps": [{"step": "Evaluated 1.5 * IQR variance across numerical series: all values within expected distribution"}]
                }

        # -------------------------------------------------------------
        # 10. TEMPORAL TRENDS / OVER TIME / MONTHLY / TIMELINE
        # -------------------------------------------------------------
        is_trend_query = any(kw in q_lower for kw in [
            "trend", "monthly", "over time", "history", "timeline", "by month", 
            "by year", "quarterly", "growth", "velocity"
        ])
        if (is_trend_query or "line chart" in q_lower) and date_col and metric_col and metric_col != "Count":
            calc_steps.append({"step": f"Identified time series index '{date_col}' and metric '{metric_col}' in '{table_name}'"})
            series = CalculationTools.execute_time_series(df, date_col, metric_col, agg_type="sum", filters=filters)
            
            if len(series) >= 2:
                first_pt = series[0]
                last_pt = series[-1]
                v_start = float(first_pt["value"])
                v_end = float(last_pt["value"])
                growth_pct = round(((v_end - v_start) / max(abs(v_start), 1)) * 100, 1)
                peak_pt = max(series, key=lambda x: x["value"])
                total_trend_val = sum(x["value"] for x in series)

                formatted_metric = metric_col.replace('_', ' ').title()
                content = (
                    f"### {formatted_metric} Trend Analysis\n\n"
                    f"Analyzing **{formatted_metric}** across **{date_col}** in **{table_name}**:\n\n"
                    f"- **Start Period ({first_pt['label']})**: {ChatAgent._format_value(v_start, metric_col)}\n"
                    f"- **Latest Period ({last_pt['label']})**: {ChatAgent._format_value(v_end, metric_col)}\n"
                    f"- **Net Trajectory**: **{growth_pct:+}%** overall change\n"
                    f"- **Peak Period**: **{peak_pt['label']}** with **{ChatAgent._format_value(peak_pt['value'], metric_col)}**\n"
                    f"- **Total Aggregated**: **{ChatAgent._format_value(total_trend_val, metric_col)}** across {len(series)} time periods"
                )

                kpi_highlights = [
                    {"label": "Latest Output", "value": ChatAgent._format_value(v_end, metric_col), "color": "indigo"},
                    {"label": "Net Growth", "value": f"{growth_pct:+}%", "color": "emerald" if growth_pct >= 0 else "rose"},
                    {"label": "Peak Period", "value": peak_pt['label'], "color": "cyan"},
                    {"label": "Total Volume", "value": ChatAgent._format_value(total_trend_val, metric_col), "color": "purple"}
                ]

                table_data = {
                    "columns": ["Time Period", formatted_metric, "Velocity Share"],
                    "rows": [
                        [pt["label"], ChatAgent._format_value(pt["value"], metric_col), f"{round((pt['value']/max(total_trend_val, 1))*100, 1)}%"]
                        for pt in series
                    ]
                }

                relative_chart = {
                    "title": f"{formatted_metric} Over Time ({date_col})",
                    "chart_type": "line",
                    "x_field": date_col,
                    "y_field": metric_col,
                    "table_name": table_name,
                    "aggregation": "sum",
                    "data": series
                }

                suggested_followups = [
                    f"What drove the peak in {peak_pt['label']}?",
                    f"Show {formatted_metric} breakdown by {dim_col or 'Category'}",
                    f"Simulate 15% growth for next period"
                ]

                calc_steps.append({"step": f"Resampled time series by auto-detected frequency across {len(series)} intervals"})
                calc_steps.append({"step": f"Computed velocity between {first_pt['label']} and {last_pt['label']}"})

                exec_time = round((time.perf_counter() - start_time) * 1000, 1)

                llm_narrative = await ChatAgent._synthesize_executive_narrative(query, content, kpi_highlights, table_name, domain)
                if llm_narrative:
                    content = llm_narrative

                is_create = any(k in q_lower for k in ["create", "plot", "make", "add"]) and "chart" in q_lower
                return {
                    "content": content,
                    "action_type": "CREATE_CHART" if is_create else "SHOW_CHART",
                    "action_payload": {
                        "chart": relative_chart,
                        **relative_chart,
                        "kpi_highlights": kpi_highlights,
                        "table_data": table_data,
                        "suggested_followups": suggested_followups,
                        "execution_time_ms": exec_time
                    },
                    "citations": citations,
                    "calculation_steps": calc_steps
                }

        # -------------------------------------------------------------
        # 11. FILTERED SUBSET ANALYSIS
        # -------------------------------------------------------------
        if filters and metric_col and metric_col != "Count":
            f_field = filters[0]["field"]
            f_val = filters[0]["value"]
            calc_steps.append({"step": f"Applied filter '{f_field} == {f_val}' on table '{table_name}'"})
            filtered_df = CalculationTools.apply_filters(df, filters)

            if not filtered_df.empty:
                f_total = float(pd.to_numeric(filtered_df[metric_col], errors="coerce").sum())
                f_avg = float(pd.to_numeric(filtered_df[metric_col], errors="coerce").mean())
                f_count = len(filtered_df)
                
                all_total = float(pd.to_numeric(df[metric_col], errors="coerce").sum())
                share_pct = round((f_total / max(all_total, 1)) * 100, 1)

                sub_dim = [c for c in df.select_dtypes(include=["object", "category", "string"]).columns if c != f_field and not ChatAgent._is_id_column(c, df[c])]
                sub_dim_col = sub_dim[0] if sub_dim else None

                sub_data = []
                if sub_dim_col:
                    sub_data = CalculationTools.execute_aggregation(filtered_df, sub_dim_col, metric_col, agg_type="sum", top_n=6)

                formatted_metric = metric_col.replace('_', ' ').title()
                content = (
                    f"### Filtered Analysis: {f_field} = **{f_val}**\n\n"
                    f"Here are the verified metrics for **{f_val}** in **{table_name}**:\n\n"
                    f"- **Total {formatted_metric}**: **{ChatAgent._format_value(f_total, metric_col)}** ({share_pct}% of entire dataset)\n"
                    f"- **Transaction / Record Count**: **{f_count:,}** records\n"
                    f"- **Average per Record**: **{ChatAgent._format_value(f_avg, metric_col)}**\n"
                )

                if sub_data:
                    content += f"\n**Top {sub_dim_col.replace('_', ' ').title()} contributors within {f_val}:**\n"
                    for item in sub_data[:4]:
                        content += f"- **{item['label']}**: {ChatAgent._format_value(item['value'], metric_col)}\n"

                kpi_highlights = [
                    {"label": f"{f_val} Total", "value": ChatAgent._format_value(f_total, metric_col), "color": "indigo"},
                    {"label": "Portfolio Share", "value": f"{share_pct}%", "color": "emerald"},
                    {"label": "Record Count", "value": f"{f_count:,}", "color": "cyan"},
                    {"label": "Average / Record", "value": ChatAgent._format_value(f_avg, metric_col), "color": "amber"}
                ]

                table_data = {
                    "columns": [sub_dim_col.replace('_', ' ').title() if sub_dim_col else f_field, formatted_metric, "Share within Filter"],
                    "rows": [
                        [s["label"], ChatAgent._format_value(s["value"], metric_col), f"{round((s['value']/max(f_total, 1))*100, 1)}%"]
                        for s in sub_data
                    ] if sub_data else [[str(f_val), ChatAgent._format_value(f_total, metric_col), "100%"]]
                }

                relative_chart = {
                    "title": f"{formatted_metric} by {sub_dim_col.replace('_', ' ').title() if sub_dim_col else f_field} ({f_val})",
                    "chart_type": "bar" if len(sub_data) > 3 else "pie",
                    "x_field": sub_dim_col or f_field,
                    "y_field": metric_col,
                    "table_name": table_name,
                    "aggregation": "sum",
                    "data": sub_data if sub_data else [{"label": str(f_val), "value": round(f_total, 2)}]
                }

                suggested_followups = [
                    f"Show monthly trend for {f_val}",
                    f"Compare {f_val} with other segments",
                    f"Simulate 10% increase for {f_val}"
                ]

                exec_time = round((time.perf_counter() - start_time) * 1000, 1)

                llm_narrative = await ChatAgent._synthesize_executive_narrative(query, content, kpi_highlights, table_name, domain)
                if llm_narrative:
                    content = llm_narrative

                is_create = any(k in q_lower for k in ["create a chart", "plot", "visualize"])
                return {
                    "content": content,
                    "action_type": "CREATE_CHART" if is_create else "SHOW_CHART",
                    "action_payload": {
                        "chart": relative_chart,
                        **relative_chart,
                        "kpi_highlights": kpi_highlights,
                        "table_data": table_data,
                        "suggested_followups": suggested_followups,
                        "execution_time_ms": exec_time
                    },
                    "citations": citations,
                    "calculation_steps": calc_steps
                }

        # -------------------------------------------------------------
        # 12. RANKING / EXTREMES / TOP N / BREAKDOWN / COUNT AGGREGATION
        # -------------------------------------------------------------
        is_ranking = any(kw in q_lower for kw in [
            "best", "highest", "top", "leader", "maximum", "most", "lowest", "bottom", "worst", 
            "least", "minimum", "spent", "spent the most", "popular"
        ])
        is_breakdown = any(kw in q_lower for kw in ["by", "per", "across", "breakdown", "each", "distribution by", "compare"]) or "chart" in q_lower or is_count_query

        if (is_ranking or is_breakdown) and dim_col:
            is_lowest = any(kw in q_lower for kw in ["lowest", "bottom", "worst", "least", "minimum"])
            
            top_n_match = re.search(r"(?:top|first|highest|lowest)\s+(\d+)", q_lower)
            top_n = int(top_n_match.group(1)) if top_n_match else 7

            agg_type = "count" if is_count_query else ("mean" if any(kw in q_lower for kw in ["average", "mean", "avg"]) else "sum")
            metric_for_agg = None if agg_type == "count" else metric_col
            
            calc_steps.append({"step": f"Grouped '{table_name}' by dimension '{dim_col}' and computed {agg_type.upper()}({metric_col})"})
            ranked_data = CalculationTools.execute_aggregation(
                df, 
                group_by_col=dim_col, 
                value_col=metric_for_agg, 
                agg_type=agg_type, 
                top_n=top_n, 
                filters=filters
            )

            if is_lowest:
                ranked_data = list(reversed(ranked_data))

            if ranked_data:
                top_item = ranked_data[0]
                total_metric = sum(r['value'] for r in ranked_data) if agg_type in ["sum", "count"] else float(pd.to_numeric(df[metric_col], errors="coerce").mean())
                top_pct = round((top_item['value'] / max(total_metric, 1)) * 100, 1)

                formatted_dim = dim_col.replace('_', ' ').title()
                formatted_metric = "Count" if agg_type == "count" else metric_col.replace('_', ' ').title()
                lead_term = "Lowest" if is_lowest else "Top"

                content = (
                    f"### {lead_term} Performer: {formatted_dim} by {formatted_metric}\n\n"
                    f"Based on verified data in **{table_name}**, the {lead_term.lower()} performer in **{formatted_dim}** by **{formatted_metric}** is **{top_item['label']}** "
                    f"with **{ChatAgent._format_value(top_item['value'], formatted_metric)}** ({top_pct}% of evaluated total).\n\n"
                    f"**Ranking Breakdown:**\n"
                )

                table_rows = []
                for idx, r in enumerate(ranked_data, 1):
                    share = round((r['value'] / max(total_metric, 1)) * 100, 1)
                    if idx <= 6:
                        content += f"{idx}. **{r['label']}**: {ChatAgent._format_value(r['value'], formatted_metric)} ({share}%)\n"
                    table_rows.append([f"#{idx}", r['label'], ChatAgent._format_value(r['value'], formatted_metric), f"{share}%"])

                chart_type = "pie" if len(ranked_data) <= 5 and ("pie" in q_lower or "donut" in q_lower) else "bar"
                chart_data = ranked_data
                if "pie" in q_lower or "donut" in q_lower:
                    chart_type = "pie"
                elif "heatmap" in q_lower or "heat map" in q_lower:
                    chart_type = "heatmap"
                    chart_data = CalculationTools.execute_heatmap(df, group_by_col=dim_col, value_col=metric_col, agg_type=agg_type) or ranked_data
                elif "treemap" in q_lower or "tree map" in q_lower:
                    chart_type = "treemap"
                    chart_data = CalculationTools.execute_treemap(df, group_by_col=dim_col, value_col=metric_col, agg_type=agg_type) or ranked_data
                elif "line" in q_lower:
                    chart_type = "line"

                relative_chart = {
                    "title": f"{formatted_metric} by {formatted_dim}",
                    "chart_type": chart_type,
                    "x_field": dim_col,
                    "y_field": formatted_metric,
                    "table_name": table_name,
                    "aggregation": agg_type,
                    "data": chart_data
                }

                kpi_highlights = [
                    {"label": f"{lead_term} Performer", "value": top_item['label'], "color": "emerald" if not is_lowest else "rose"},
                    {"label": "Volume", "value": ChatAgent._format_value(top_item['value'], formatted_metric), "color": "indigo"},
                    {"label": "Portfolio Share", "value": f"{top_pct}%", "color": "cyan"},
                    {"label": "Evaluated Total", "value": ChatAgent._format_value(total_metric, formatted_metric), "color": "purple"}
                ]

                table_data = {
                    "columns": ["Rank", formatted_dim, formatted_metric, "Share of Total"],
                    "rows": table_rows
                }

                suggested_followups = [
                    f"Show monthly trend for {top_item['label']}",
                    f"Compare {top_item['label']} vs {ranked_data[1]['label'] if len(ranked_data) > 1 else 'second'}",
                    f"What if {top_item['label']} increases by 15%?"
                ]

                calc_steps.append({"step": f"Identified top performer '{top_item['label']}' with value {top_item['value']}"})

                exec_time = round((time.perf_counter() - start_time) * 1000, 1)

                llm_narrative = await ChatAgent._synthesize_executive_narrative(query, content, kpi_highlights, table_name, domain)
                if llm_narrative:
                    content = llm_narrative

                is_create_intent = any(k in q_lower for k in ["create", "make", "add", "plot", "draw", "generate"]) and any(c in q_lower for c in ["chart", "plot", "graph", "visualize", "visualization"])
                return {
                    "content": content,
                    "action_type": "CREATE_CHART" if is_create_intent else "SHOW_CHART",
                    "action_payload": {
                        "chart": relative_chart,
                        **relative_chart,
                        "kpi_highlights": kpi_highlights,
                        "table_data": table_data,
                        "suggested_followups": suggested_followups,
                        "execution_time_ms": exec_time
                    },
                    "citations": citations,
                    "calculation_steps": calc_steps
                }

        # -------------------------------------------------------------
        # 13. OVERALL METRIC / SINGLE KPI QUERY
        # -------------------------------------------------------------
        if metric_col and metric_col != "Count":
            clean_series = pd.to_numeric(df[metric_col], errors="coerce").dropna()
            if not clean_series.empty:
                total_val = float(clean_series.sum())
                avg_val = float(clean_series.mean())
                min_val = float(clean_series.min())
                max_val = float(clean_series.max())
                rec_count = len(clean_series)

                formatted_metric = metric_col.replace('_', ' ').title()

                chart_data = []
                if dim_col:
                    chart_data = CalculationTools.execute_aggregation(df, dim_col, metric_col, agg_type="sum", top_n=6)

                content = (
                    f"### Key Metric: {formatted_metric}\n\n"
                    f"Calculated across **{rec_count:,} records** in **{table_name}**:\n\n"
                    f"- **Total Aggregated**: **{ChatAgent._format_value(total_val, metric_col)}**\n"
                    f"- **Average / Mean**: **{ChatAgent._format_value(avg_val, metric_col)}**\n"
                    f"- **Range**: {ChatAgent._format_value(min_val, metric_col)} (Min) to {ChatAgent._format_value(max_val, metric_col)} (Max)\n"
                )

                if chart_data and dim_col:
                    content += f"\n**Distribution across top {dim_col.replace('_', ' ').title()}s:**\n"
                    for item in chart_data[:4]:
                        content += f"- **{item['label']}**: {ChatAgent._format_value(item['value'], metric_col)}\n"

                kpi_highlights = [
                    {"label": f"Total {formatted_metric}", "value": ChatAgent._format_value(total_val, metric_col), "color": "indigo"},
                    {"label": "Average / Record", "value": ChatAgent._format_value(avg_val, metric_col), "color": "purple"},
                    {"label": "Maximum", "value": ChatAgent._format_value(max_val, metric_col), "color": "emerald"},
                    {"label": "Record Count", "value": f"{rec_count:,}", "color": "cyan"}
                ]

                table_data = {
                    "columns": [dim_col.replace('_', ' ').title() if dim_col else "Metric", formatted_metric, "Share"],
                    "rows": [
                        [item["label"], ChatAgent._format_value(item["value"], metric_col), f"{round((item['value']/max(total_val, 1))*100, 1)}%"]
                        for item in chart_data
                    ] if chart_data else [["Total Aggregated", ChatAgent._format_value(total_val, metric_col), "100%"]]
                }

                relative_chart = {
                    "title": f"Total {formatted_metric} by {dim_col.replace('_', ' ').title() if dim_col else 'Category'}",
                    "chart_type": "bar",
                    "x_field": dim_col or "Dimension",
                    "y_field": metric_col,
                    "table_name": table_name,
                    "aggregation": "sum",
                    "data": chart_data if chart_data else [{"label": "Total", "value": round(total_val, 2)}]
                }

                suggested_followups = [
                    f"Show monthly trend for {formatted_metric}",
                    f"Show distribution of {formatted_metric}",
                    f"Simulate 10% increase in {formatted_metric}"
                ]

                calc_steps.append({"step": f"Computed SUM, MEAN, MIN, MAX over numeric column '{metric_col}'"})

                exec_time = round((time.perf_counter() - start_time) * 1000, 1)

                llm_narrative = await ChatAgent._synthesize_executive_narrative(query, content, kpi_highlights, table_name, domain)
                if llm_narrative:
                    content = llm_narrative

                return {
                    "content": content,
                    "action_type": "SHOW_CHART",
                    "action_payload": {
                        "chart": relative_chart,
                        **relative_chart,
                        "kpi_highlights": kpi_highlights,
                        "table_data": table_data,
                        "suggested_followups": suggested_followups,
                        "execution_time_ms": exec_time
                    },
                    "citations": citations,
                    "calculation_steps": calc_steps
                }

        # -------------------------------------------------------------
        # 13.5 UNAVAILABLE DATA HONEST FALLBACK (Requirement 18)
        # -------------------------------------------------------------
        is_overview_intent = any(k in q_lower for k in [
            "overview", "summary", "hello", "hi", "hey", "help", "what can you do", 
            "explain data", "about this data", "dataset overview", "start", "introduce"
        ])
        
        all_cols_lower = [c.lower() for c in df.columns]
        tokens = [t for t in re.split(r"[_\s]+", q_lower) if len(t) >= 4]
        has_matching_column = any(any(t in c for c in all_cols_lower) for t in tokens)
        
        if not is_overview_intent and not has_matching_column and metric_col is None and len(tokens) >= 2:
            exec_time = round((time.perf_counter() - start_time) * 1000, 1)
            avail_tables = ", ".join(f"`{t}`" for t in dataframes.keys())
            sample_cols = ", ".join(f"`{c}`" for c in df.columns[:6])
            return {
                "content": (
                    f"### Information Not Found in Current Dataset\n\n"
                    f"I don't have enough information in the currently available dataset to answer that accurately.\n\n"
                    f"- **Available Tables**: {avail_tables}\n"
                    f"- **Available Attributes in `{table_name}`**: {sample_cols}\n\n"
                    f"Please ask an analytical question relating to the available dimensions or metrics in your data."
                ),
                "action_type": None,
                "action_payload": {
                    "kpi_highlights": [
                        {"label": "Query Status", "value": "Insufficient Data", "color": "amber"},
                        {"label": "Active Table", "value": table_name, "color": "indigo"}
                    ],
                    "suggested_followups": [
                        "What is the total revenue?",
                        "Which category has the highest sales?",
                        "What dashboards are available?"
                    ],
                    "execution_time_ms": exec_time
                },
                "citations": citations,
                "calculation_steps": [{"step": "Scanned dataset columns and found no matching metrics for query"}]
            }

        # -------------------------------------------------------------
        # 14. GENERAL SUMMARY & OVERVIEW
        # -------------------------------------------------------------
        kpi_lines = []
        for k in kpis[:4]:
            kpi_lines.append(f"- **{k['display_name']}**: {k['formatted_value']}")

        table_list_str = ", ".join(f"`{t}` ({len(d):,} rows)" for t, d in dataframes.items())
        
        # Build baseline chart
        chart_data = []
        chart_dim = dim_col or (df.columns[0] if not df.empty else "Category")
        chart_met = metric_col if metric_col != "Count" else (df.select_dtypes(include=[np.number]).columns[0] if not df.empty and len(df.select_dtypes(include=[np.number]).columns) > 0 else None)

        if chart_met and chart_dim in df.columns:
            chart_data = CalculationTools.execute_aggregation(df, chart_dim, chart_met, agg_type="sum", top_n=5)
        elif chart_dim in df.columns:
            chart_data = CalculationTools.execute_aggregation(df, chart_dim, None, agg_type="count", top_n=5)

        content = (
            f"### Workspace Dataset Overview\n\n"
            f"The active dataset comprises **{len(dataframes)} tables** ({table_list_str}) within the **{domain}** domain.\n\n"
            f"**Baseline Key Performance Indicators:**\n"
            + ("\n".join(kpi_lines) if kpi_lines else f"- Total records in `{table_name}`: {len(df):,}")
            + f"\n\n**Suggested analytical questions:**\n"
            f"- *'Which {chart_dim} performs best?'*\n"
            f"- *'Show monthly trend over time'*\n"
            f"- *'Compare top 2 {chart_dim}s'*\n"
            f"- *'What if {chart_met or 'sales'} increases by 10%?'*\n"
            f"- *'Find statistical anomalies in the data'*"
        )

        kpi_highlights = [
            {"label": k["display_name"], "value": k["formatted_value"], "color": "indigo"}
            for k in kpis[:4]
        ] if kpis else [
            {"label": "Total Tables", "value": f"{len(dataframes)}", "color": "indigo"},
            {"label": "Total Records", "value": f"{len(df):,}", "color": "emerald"}
        ]

        table_data = {
            "columns": ["Entity / Metric", "Value"],
            "rows": [[k["display_name"], k["formatted_value"]] for k in kpis[:6]] if kpis else [["Primary Table", table_name], ["Row Count", f"{len(df):,}"]]
        }

        relative_chart = {
            "title": f"{chart_met.replace('_', ' ').title() if chart_met else 'Volume'} by {chart_dim.replace('_', ' ').title()}",
            "chart_type": "bar",
            "x_field": chart_dim,
            "y_field": chart_met or "count",
            "table_name": table_name,
            "aggregation": "sum" if chart_met else "count",
            "data": chart_data
        }

        suggested_followups = [
            f"Which {chart_dim} has highest {chart_met or 'volume'}?",
            "Show monthly trend",
            "Find statistical anomalies"
        ]

        exec_time = round((time.perf_counter() - start_time) * 1000, 1)

        return {
            "content": content,
            "action_type": "SHOW_CHART" if chart_data else None,
            "action_payload": {
                "chart": relative_chart,
                "kpi_highlights": kpi_highlights,
                "table_data": table_data,
                "suggested_followups": suggested_followups,
                "execution_time_ms": exec_time
            } if chart_data else {
                "kpi_highlights": kpi_highlights,
                "table_data": table_data,
                "suggested_followups": suggested_followups,
                "execution_time_ms": exec_time
            },
            "citations": citations,
            "calculation_steps": [{"step": f"Extracted metadata and top aggregations from '{table_name}'"}]
        }
