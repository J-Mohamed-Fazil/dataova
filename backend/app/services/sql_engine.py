import json
import re
import sqlite3
import time
import difflib
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd

from app.services.llm_orchestrator import LLMOrchestrator


class SQLEngine:
    """
    High-performance in-memory SQLite sandbox engine for analytical querying.
    Supports:
    - Zero-setup in-memory database loading of dataset DataFrames
    - Multi-table aliases, automatic bracket/quote sanitization, and view mounting
    - Read-only safe execution guarding against schema alterations
    - Intelligent Natural Language to SQL & Pandas translation (LLM-powered with automated self-healing & deterministic semantic fallback)
    - Multi-table foreign key relationships awareness & JOIN synthesis
    - Automatic visualization suitability heuristics
    - Real-time plain English answer synthesis
    """

    FORBIDDEN_KEYWORDS = [
        "drop", "delete", "insert", "update", "alter", "create", "truncate", 
        "replace", "attach", "detach", "reindex", "vacuum", "pragma"
    ]

    # Domain synonyms for semantic mapping
    SYNONYMS = {
        "revenue": ["revenue", "sales", "turnover", "income", "amount", "total_sales", "spend", "spending", "paid"],
        "sales": ["sales", "revenue", "turnover", "amount", "sold"],
        "profit": ["profit", "margin", "earnings", "net_income", "gain"],
        "quantity": ["quantity", "qty", "volume", "units", "items", "pieces", "count"],
        "discount": ["discount", "rebate", "markdown", "discount_rate"],
        "cost": ["cost", "expense", "spend", "expenditure"],
        "price": ["price", "unit_price", "rate", "fare", "fee"],
        "salary": ["salary", "wage", "pay", "compensation", "stipend"],
        "customer": ["customer", "client", "buyer", "user", "account", "consumer", "purchaser"],
        "product": ["product", "item", "title", "goods", "sku", "merchandise", "model"],
        "category": ["category", "department", "segment", "type", "class", "genre", "division"],
        "region": ["region", "territory", "area", "zone", "state", "city", "country", "location", "geography"],
        "date": ["date", "time", "year", "month", "day", "period", "timestamp", "quarter", "order_date", "orderdate"]
    }

    @staticmethod
    def _sanitize_table_name(name: str) -> str:
        """Cleans table name to valid SQL identifier."""
        clean = re.sub(r"[^a-zA-Z0-9_]", "_", name.strip())
        return clean if clean else "data"

    @staticmethod
    def _stem(word: str) -> str:
        """Basic English word stemmer to unify plurals and endings."""
        w = word.lower().strip()
        if w.endswith("ies") and len(w) > 4:
            return w[:-3] + "y"
        if w.endswith("es") and len(w) > 3 and not w.endswith("sales"):
            return w[:-2]
        if w.endswith("s") and len(w) > 3 and not w.endswith("ss") and w not in ["sales", "status", "gross", "across", "business"]:
            return w[:-1]
        return w

    @staticmethod
    def _clean_token(t: str) -> str:
        return re.sub(r"[^a-zA-Z0-9_]", "", t).lower()

    @staticmethod
    def _is_id_col(col: str) -> bool:
        c = col.lower()
        return c.endswith("_id") or c.startswith("id_") or c in ["id", "uuid", "guid", "row_id", "rowid"]

    @classmethod
    def _match_column(
        cls,
        query_words: List[str],
        df_cols: List[str],
        prefer_numeric: Optional[bool] = None,
        exclude_cols: Optional[List[str]] = None
    ) -> Optional[str]:
        exclude = set(exclude_cols or [])
        candidates = [c for c in df_cols if c not in exclude]
        stemmed_query = [cls._stem(w) for w in query_words]

        # 1. Exact or stemmed match
        for c in candidates:
            c_clean = cls._clean_token(c)
            c_stem = cls._stem(c_clean)
            for idx, w in enumerate(query_words):
                w_clean = cls._clean_token(w)
                if w_clean == c_clean or stemmed_query[idx] == c_stem:
                    return c

        # 2. Part match in multi-word column names (e.g. "Customer_Name" matches "customer" or "name")
        for c in candidates:
            parts = [cls._clean_token(p) for p in re.split(r"[_\s\-]+", c) if len(p) > 2]
            parts_stemmed = [cls._stem(p) for p in parts]
            for p_stem in parts_stemmed:
                if p_stem in stemmed_query:
                    return c

        # 3. Synonym dictionary match
        for concept, syns in cls.SYNONYMS.items():
            concept_stem = cls._stem(concept)
            syns_stemmed = [cls._stem(s) for s in syns]
            if any(sq in syns_stemmed or sq == concept_stem for sq in stemmed_query):
                for c in candidates:
                    c_clean = cls._clean_token(c)
                    c_stem = cls._stem(c_clean)
                    if any(s in c_clean or s == c_stem for s in syns_stemmed):
                        return c

        return None

    @classmethod
    def generate_result_summary(
        cls,
        nl_prompt: str,
        sql_query: str,
        columns: List[str],
        rows: List[Dict[str, Any]]
    ) -> str:
        """Synthesizes a plain English, direct factual answer to the user's question based on query rows."""
        if not rows:
            return "Query executed successfully, but returned 0 matching records."

        p_lower = nl_prompt.lower().strip() if nl_prompt else ""
        num_rows = len(rows)

        # 1. Single scalar result (e.g. SELECT SUM(sales), COUNT(*))
        if len(columns) == 1 and num_rows == 1:
            val = rows[0][columns[0]]
            col_name = columns[0]
            clean_name = col_name.replace("_", " ").title()
            if isinstance(val, (int, float, np.number)):
                fmt_val = f"{val:,.2f}".rstrip("0").rstrip(".") if isinstance(val, float) else f"{val:,}"
                c_low = col_name.lower()
                is_count_col = c_low.startswith("count") or c_low.endswith("_count") or c_low in ["count", "record_count", "total_records", "rows", "total_rows"]
                if is_count_col and "discount" not in c_low:
                    return f"Found a total of **{fmt_val}** records."
                return f"The **{clean_name}** is **{fmt_val}**."
            return f"Result: **{val}**."

        # 2. Grouped Ranking result (1 dimension + 1 metric)
        if len(columns) == 2 and num_rows >= 1:
            dim_col, met_col = columns[0], columns[1]
            first_val = rows[0][met_col]
            second_val = rows[0][dim_col]
            # Determine which column is the numeric metric
            if isinstance(first_val, (int, float, np.number)):
                val_col, label_col = met_col, dim_col
            elif isinstance(second_val, (int, float, np.number)):
                val_col, label_col = dim_col, met_col
            else:
                val_col, label_col = None, None

            if val_col and label_col:
                top_items = []
                for r in rows[:3]:
                    v = r[val_col]
                    fmt = f"{v:,.2f}".rstrip("0").rstrip(".") if isinstance(v, float) else f"{v:,}"
                    top_items.append(f"**{r[label_col]}** ({fmt})")
                
                is_bottom = any(k in p_lower for k in ["lowest", "bottom", "least", "smallest", "cheapest"])
                descriptor = "Lowest contributor" if is_bottom else "Top performer"
                if len(top_items) == 1:
                    return f"{descriptor} is {top_items[0]}."
                elif len(top_items) == 2:
                    return f"{descriptor} is {top_items[0]}, followed by {top_items[1]}."
                else:
                    return f"{descriptor} is {top_items[0]}, followed by {top_items[1]} and {top_items[2]} (returning {num_rows} records total)."

        # 3. Single distinct list
        if len(columns) == 1 and num_rows > 1:
            items = [str(r[columns[0]]) for r in rows[:5] if r[columns[0]] is not None]
            extra = f" and {num_rows - 5} more" if num_rows > 5 else ""
            return f"Found **{num_rows}** unique {columns[0]} values: {', '.join(items)}{extra}."

        # 4. Multi-column filtered rows / Projections
        return f"Returned **{num_rows}** matching records across **{len(columns)}** columns."

    @staticmethod
    def execute_sql(
        dataframes: Dict[str, pd.DataFrame],
        sql_query: str,
        max_rows: int = 200,
        question: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes a read-only SQL query against the dataset tables in an in-memory SQLite database.
        Mounts tables with multiple aliases so users and queries can refer to tables by:
        - raw table name (e.g. [orders.csv] or "orders.csv")
        - sanitized table name (e.g. orders_csv)
        - base name without extension (e.g. orders)
        - alias 'data' (always points to the primary table)
        Also features automated self-healing for typos in column names, table aliases, and space-wrapping.
        """
        start_time = time.perf_counter()
        q_clean = sql_query.strip().rstrip(";")

        # Security check
        tokens = [t.lower() for t in re.findall(r"\b[a-zA-Z]+\b", q_clean)]
        for kw in SQLEngine.FORBIDDEN_KEYWORDS:
            if kw in tokens:
                return {
                    "error": f"Security restriction: '{kw.upper()}' is not permitted in the read-only analytical sandbox.",
                    "execution_time_ms": 0.0
                }

        if not q_clean.lower().startswith("select") and not q_clean.lower().startswith("with"):
            return {
                "error": "Query must begin with 'SELECT' or 'WITH' (Common Table Expression).",
                "execution_time_ms": 0.0
            }

        conn = sqlite3.connect(":memory:")
        try:
            first_tbl_name = list(dataframes.keys())[0] if dataframes else None
            # Collect all column names across all mounted tables for self-healing
            all_valid_cols: List[str] = []
            
            # Mount DataFrames as tables
            for tbl_name, df in dataframes.items():
                safe_name = SQLEngine._sanitize_table_name(tbl_name)
                df.to_sql(safe_name, conn, if_exists="replace", index=False)
                all_valid_cols.extend(list(df.columns))
                
                # Mount raw table name view if different (e.g. "sales.csv")
                clean_raw = re.sub(r'["\[\]]', '', tbl_name.strip())
                if clean_raw != safe_name:
                    try:
                        conn.execute(f'CREATE VIEW IF NOT EXISTS "{clean_raw}" AS SELECT * FROM "{safe_name}"')
                    except Exception:
                        pass
                
                # Strip file extensions like .csv, .tsv, .xlsx, .json
                base_name = re.sub(r'\.(csv|tsv|parquet|xlsx|xls|json)$', '', clean_raw, flags=re.IGNORECASE)
                if base_name != safe_name and base_name != clean_raw:
                    try:
                        conn.execute(f'CREATE VIEW IF NOT EXISTS "{base_name}" AS SELECT * FROM "{safe_name}"')
                    except Exception:
                        pass

            # Always mount 'data' alias pointing to the first/primary table
            if first_tbl_name:
                first_safe = SQLEngine._sanitize_table_name(first_tbl_name)
                try:
                    conn.execute(f'CREATE VIEW IF NOT EXISTS "data" AS SELECT * FROM "{first_safe}"')
                except Exception:
                    pass

            all_valid_cols = list(dict.fromkeys(all_valid_cols))
            cursor = conn.cursor()

            # Attempt query execution with automated self-healing
            try:
                cursor.execute(q_clean)
            except Exception as initial_exc:
                err_str = str(initial_exc)
                recovered = False

                # Self-healing Phase 1: Unknown table error
                if "no such table" in err_str.lower() and first_tbl_name:
                    first_safe = SQLEngine._sanitize_table_name(first_tbl_name)
                    alt_query = re.sub(r'\bFROM\s+([\["]?[\w\.\-]+[\]"]?)', f'FROM "{first_safe}"', q_clean, flags=re.IGNORECASE)
                    try:
                        cursor.execute(alt_query)
                        recovered = True
                        q_clean = alt_query
                    except Exception:
                        pass

                # Self-healing Phase 2: Unknown column error (fuzzy match to closest real column)
                if not recovered:
                    col_err = re.search(r"no such column:\s*([^\s,;]+)", err_str, re.IGNORECASE)
                    if col_err and all_valid_cols:
                        bad_col = col_err.group(1).strip("[]\"'")
                        matches = difflib.get_close_matches(bad_col, all_valid_cols, n=1, cutoff=0.4)
                        if matches:
                            best_col = matches[0]
                            # Replace occurrences of bad_col in the query
                            fixed_query = re.sub(rf"\[?{re.escape(bad_col)}\]?", f"[{best_col}]", q_clean, flags=re.IGNORECASE)
                            try:
                                cursor.execute(fixed_query)
                                recovered = True
                                q_clean = fixed_query
                            except Exception:
                                pass

                # Self-healing Phase 3: Unbracketed column names with spaces
                if not recovered:
                    fixed_query = q_clean
                    for c in all_valid_cols:
                        if " " in c and f"[{c}]" not in fixed_query and f'"{c}"' not in fixed_query:
                            fixed_query = re.sub(rf"\b{re.escape(c)}\b", f"[{c}]", fixed_query)
                    if fixed_query != q_clean:
                        try:
                            cursor.execute(fixed_query)
                            recovered = True
                            q_clean = fixed_query
                        except Exception:
                            pass

                if not recovered:
                    raise initial_exc

            col_names = [desc[0] for desc in cursor.description] if cursor.description else []
            raw_rows = cursor.fetchmany(max_rows)

            exec_time = round((time.perf_counter() - start_time) * 1000, 2)

            # Convert to dictionary records
            rows = []
            for r in raw_rows:
                row_dict = {}
                for idx, col in enumerate(col_names):
                    val = r[idx]
                    if isinstance(val, (float, np.floating)) and np.isnan(val):
                        row_dict[col] = None
                    else:
                        row_dict[col] = val
                rows.append(row_dict)

            # Determine chart suggestion
            chart_suggestion = None
            if len(col_names) == 2 and len(rows) >= 1:
                first_row = rows[0]
                vals = [first_row[col_names[0]], first_row[col_names[1]]]
                if isinstance(vals[0], (int, float)) and not isinstance(vals[1], (int, float)):
                    chart_suggestion = {"x_col": col_names[1], "y_col": col_names[0], "type": "bar"}
                elif isinstance(vals[1], (int, float)) and not isinstance(vals[0], (int, float)):
                    chart_suggestion = {"x_col": col_names[0], "y_col": col_names[1], "type": "bar"}

            # Plain English Answer Summary
            summary = SQLEngine.generate_result_summary(
                nl_prompt=question or "",
                sql_query=q_clean,
                columns=col_names,
                rows=rows
            )

            return {
                "columns": col_names,
                "rows": rows,
                "total_returned": len(rows),
                "execution_time_ms": exec_time,
                "chart_suggestion": chart_suggestion,
                "sql_query": q_clean,
                "summary": summary
            }

        except Exception as exc:
            exec_time = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "error": f"SQL Execution Error: {str(exc)}",
                "execution_time_ms": exec_time
            }
        finally:
            conn.close()

    @classmethod
    def generate_sql_from_nl(
        cls,
        df: pd.DataFrame,
        nl_prompt: str,
        table_name: str = "data"
    ) -> Dict[str, Any]:
        """
        Synchronous semantic deterministic compiler for natural language queries.
        Extracts filters, grouping, projections, sort order, dates, ranges, and aggregations with high precision.
        """
        p = nl_prompt.strip()
        p_lower = p.lower()
        raw_words = re.findall(r"\b[a-zA-Z0-9_]+\b", p_lower)
        tokens = [cls._clean_token(w) for w in raw_words]
        stemmed_tokens = [cls._stem(w) for w in tokens]

        safe_table = cls._sanitize_table_name(table_name)
        effective_table = safe_table if safe_table else "data"

        df_cols = list(df.columns)
        num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        str_cols = df.select_dtypes(include=["object", "string", "category"]).columns.tolist()
        date_cols = [
            c for c in df_cols
            if "date" in c.lower() or "time" in c.lower() or "year" in c.lower() or pd.api.types.is_datetime64_any_dtype(df[c])
        ]

        # Extract WHERE conditions
        where_clauses: List[str] = []
        pandas_filters: List[str] = []

        # A. Date/Year filtering (e.g. "in 2023", "orders in 2024")
        year_match = re.search(r"\b(19\d{2}|20\d{2})\b", p_lower)
        if year_match and date_cols:
            yr = year_match.group(1)
            d_col = date_cols[0]
            where_clauses.append(f"strftime('%Y', [{d_col}]) = '{yr}'")
            pandas_filters.append(f"pd.to_datetime(df['{d_col}']).dt.year == {yr}")

        # B. Range / BETWEEN conditions (e.g. "sales between 100 and 500")
        between_pattern = r"\b([a-zA-Z0-9_]+)\s+between\s+(-?\d+(?:\.\d+)?)\s+and\s+(-?\d+(?:\.\d+)?)\b"
        for col_cand, v1, v2 in re.findall(between_pattern, p_lower):
            mc = cls._match_column([col_cand], num_cols) or cls._match_column([col_cand], df_cols)
            if mc:
                where_clauses.append(f"[{mc}] BETWEEN {v1} AND {v2}")
                pandas_filters.append(f"(df['{mc}'] >= {v1}) & (df['{mc}'] <= {v2})")

        # C. Categorical values mentioned in prompt (with word boundaries)
        stopwords = {
            "the", "all", "and", "for", "out", "new", "top", "per", "are", "from",
            "with", "show", "list", "find", "get", "data", "rows", "records", "most",
            "best", "lowest", "least", "by", "is", "in", "of", "to", "or", "what"
        }
        for col in str_cols:
            try:
                unique_vals = df[col].dropna().unique()
                if len(unique_vals) <= 300:
                    for uval in unique_vals:
                        uval_str = str(uval).strip()
                        if len(uval_str) >= 2 and uval_str.lower() not in stopwords:
                            pattern = r"\b" + re.escape(uval_str.lower()) + r"\b"
                            if re.search(pattern, p_lower):
                                safe_val = uval_str.replace("'", "''")
                                where_clauses.append(f"LOWER([{col}]) = '{safe_val.lower()}'")
                                pandas_filters.append(f"df['{col}'].astype(str).str.lower() == '{safe_val.lower()}'")
                                break
            except Exception:
                pass

        # D. Numeric comparison conditions
        comp_pattern = r"\b([a-zA-Z0-9_]+)\s*(>=|<=|!=|<>|>|<|=|==|greater than|less than|more than|at least|at most|equal to)\s*(-?\d+(?:\.\d+)?)\b"
        matches = re.findall(comp_pattern, p_lower)
        for col_cand, op_text, num_val in matches:
            op = op_text
            if op in ["==", "equal to"]:
                op = "="
            elif op in ["greater than", "more than"]:
                op = ">"
            elif op == "less than":
                op = "<"
            elif op == "at least":
                op = ">="
            elif op == "at most":
                op = "<="

            matched_col = cls._match_column([col_cand], num_cols) or cls._match_column([col_cand], df_cols)
            if matched_col:
                where_clauses.append(f"[{matched_col}] {op} {num_val}")
                pandas_filters.append(f"df['{matched_col}'] {op} {num_val}")

        # E. Check for NULL / NOT NULL
        if any(k in p_lower for k in ["not null", "without null", "non-null", "not empty"]):
            cand = cls._match_column(tokens, df_cols)
            if cand:
                where_clauses.append(f"[{cand}] IS NOT NULL")
                pandas_filters.append(f"df['{cand}'].notna()")
        elif any(k in p_lower for k in ["is null", "are null", "where empty"]):
            cand = cls._match_column(tokens, df_cols)
            if cand:
                where_clauses.append(f"[{cand}] IS NULL")
                pandas_filters.append(f"df['{cand}'].isna()")

        # Determine Limit
        limit_match = (
            re.search(r"\btop\s+(\d+)\b", p_lower) or
            re.search(r"\blimit\s+(\d+)\b", p_lower) or
            re.search(r"\bfirst\s+(\d+)\b", p_lower) or
            re.search(r"\bbottom\s+(\d+)\b", p_lower)
        )
        limit = int(limit_match.group(1)) if limit_match else None

        # Determine Sort Direction
        is_bottom = any(k in p_lower for k in ["lowest", "bottom", "least", "smallest", "cheapest", "worst", "minimum"])
        sort_dir = "ASC" if is_bottom else "DESC"

        # Determine Aggregation
        agg = None
        if (
            any(k in p_lower for k in ["how many", "count of", "number of", "count all", "count records", "count total", "count rows", "count"]) or
            p_lower.startswith("count")
        ):
            agg = "COUNT"
        elif any(k in p_lower for k in ["average", "avg", "mean"]):
            agg = "AVG"
        elif any(k in p_lower for k in ["sum", "total", "overall", "aggregate"]):
            agg = "SUM"
        elif any(k in p_lower for k in ["maximum", "highest", "peak", "greatest", "max"]):
            agg = "MAX"
        elif any(k in p_lower for k in ["minimum", "lowest", "smallest", "min"]):
            agg = "MIN"

        # Check for DISTINCT query
        if any(k in p_lower for k in ["distinct", "unique", "different"]):
            distinct_col = cls._match_column(tokens, str_cols) or cls._match_column(tokens, df_cols)
            if distinct_col:
                w_str = f"\nWHERE {' AND '.join(where_clauses)}" if where_clauses else ""
                lim_str = f"\nLIMIT {limit or 50}"
                sql = f"SELECT DISTINCT [{distinct_col}]\nFROM [{effective_table}]{w_str}\nORDER BY [{distinct_col}] ASC{lim_str};"
                p_filter = f"[{' & '.join(pandas_filters)}]" if pandas_filters else ""
                pandas_code = f"df{p_filter}['{distinct_col}'].drop_duplicates().sort_values().head({limit or 50})"
                return {
                    "sql_query": sql,
                    "pandas_code": pandas_code,
                    "detected_dimension": distinct_col,
                    "detected_metric": None,
                    "intent": "DISTINCT",
                    "explanation": f"Returns unique values of {distinct_col} ordered alphabetically."
                }

        # Check for GROUP BY dimension or date periodicity
        dim_col = None
        metric_col = None

        # Periodic time breakdown (e.g. "monthly sales", "sales by year")
        if any(k in p_lower for k in ["monthly", "by month", "per month"]) and date_cols:
            dim_col = f"strftime('%Y-%m', [{date_cols[0]}])"
        elif any(k in p_lower for k in ["yearly", "by year", "annual"]) and date_cols:
            dim_col = f"strftime('%Y', [{date_cols[0]}])"

        group_match = re.search(r"\b(?:by|per|for each|across|grouped by)\s+([a-zA-Z0-9_]+)", p_lower)
        if group_match and not dim_col:
            by_word = cls._clean_token(group_match.group(1))
            matched_metric_by = cls._match_column([by_word], num_cols)
            if matched_metric_by:
                metric_col = matched_metric_by
                pre_words = tokens[:tokens.index(by_word)] if by_word in tokens else tokens
                dim_col = cls._match_column(pre_words, str_cols)
            else:
                dim_col = cls._match_column([by_word], str_cols) or cls._match_column([by_word], df_cols)

        # If not captured via "by", check remaining tokens
        if not dim_col:
            dim_col = cls._match_column(tokens, str_cols)
        if not metric_col:
            metric_col = cls._match_column(tokens, num_cols)

        # Ranking query with dimension and metric
        if limit and dim_col and metric_col:
            effective_agg = "AVG" if agg == "AVG" else ("COUNT" if agg == "COUNT" else (agg or "SUM"))
            alias = f"{effective_agg.lower()}_{cls._clean_token(metric_col)}"
            w_str = f"\nWHERE {' AND '.join(where_clauses)}" if where_clauses else ""
            sql = f"SELECT [{dim_col}], ROUND({effective_agg}([{metric_col}]), 2) as [{alias}]\nFROM [{effective_table}]{w_str}\nGROUP BY [{dim_col}]\nORDER BY [{alias}] {sort_dir}\nLIMIT {limit};"
            p_filter = f"[{' & '.join(pandas_filters)}]" if pandas_filters else ""
            pandas_code = f"df{p_filter}.groupby('{dim_col}')['{metric_col}'].{effective_agg.lower()}().round(2).reset_index(name='{alias}').sort_values('{alias}', ascending={sort_dir == 'ASC'}).head({limit})"
            return {
                "sql_query": sql,
                "pandas_code": pandas_code,
                "detected_dimension": dim_col,
                "detected_metric": metric_col,
                "intent": "GROUPED_AGG",
                "explanation": f"Groups data by {dim_col}, aggregates {effective_agg}({metric_col}), and returns {limit} rows ordered {sort_dir.lower()}ending."
            }

        # Check if the user is asking to "count" something grouped by dimension
        is_count_by_dim = (agg == "COUNT" or any(k in p_lower for k in ["count", "number of", "volume"])) and dim_col and (not metric_col or group_match)
        if is_count_by_dim:
            lim = limit or 10
            w_str = f"\nWHERE {' AND '.join(where_clauses)}" if where_clauses else ""
            sql = f"SELECT [{dim_col}], COUNT(*) as [record_count]\nFROM [{effective_table}]{w_str}\nGROUP BY [{dim_col}]\nORDER BY [record_count] {sort_dir}\nLIMIT {lim};"
            p_filter = f"[{' & '.join(pandas_filters)}]" if pandas_filters else ""
            pandas_code = f"df{p_filter}.groupby('{dim_col}').size().reset_index(name='record_count').sort_values('record_count', ascending={sort_dir == 'ASC'}).head({lim})"
            return {
                "sql_query": sql,
                "pandas_code": pandas_code,
                "detected_dimension": dim_col,
                "detected_metric": None,
                "intent": "COUNT_GROUPED",
                "explanation": f"Aggregates total record count grouped by {dim_col} sorted {sort_dir.lower()}ending."
            }

        # Pure COUNT without dimension
        if agg == "COUNT" and not dim_col and not metric_col:
            w_str = f"\nWHERE {' AND '.join(where_clauses)}" if where_clauses else ""
            sql = f"SELECT COUNT(*) as [record_count]\nFROM [{effective_table}]{w_str};"
            p_filter = f"[{' & '.join(pandas_filters)}]" if pandas_filters else ""
            pandas_code = f"pd.DataFrame([{{'record_count': len(df{p_filter})}}])"
            return {
                "sql_query": sql,
                "pandas_code": pandas_code,
                "detected_dimension": None,
                "detected_metric": None,
                "intent": "COUNT_SCALAR",
                "explanation": "Calculates the total record count matching the specified criteria."
            }

        # Single scalar aggregate (NO grouping mentioned)
        is_scalar_agg = (
            (agg in ["SUM", "AVG", "MIN", "MAX"] or (metric_col and any(k in p_lower for k in ["what is", "calculate", "find the", "give me the", "overall"])))
            and not dim_col
            and not group_match
        )
        if is_scalar_agg and metric_col:
            effective_agg = agg or "SUM"
            alias = f"{effective_agg.lower()}_{cls._clean_token(metric_col)}"
            w_str = f"\nWHERE {' AND '.join(where_clauses)}" if where_clauses else ""
            round_expr = f"ROUND({effective_agg}([{metric_col}]), 2)" if effective_agg in ["SUM", "AVG"] else f"{effective_agg}([{metric_col}])"
            sql = f"SELECT {round_expr} as [{alias}]\nFROM [{effective_table}]{w_str};"
            p_filter = f"[{' & '.join(pandas_filters)}]" if pandas_filters else ""
            pandas_code = f"pd.DataFrame([{{'{alias}': round(df{p_filter}['{metric_col}'].{effective_agg.lower()}(), 2)}}])"
            return {
                "sql_query": sql,
                "pandas_code": pandas_code,
                "detected_dimension": None,
                "detected_metric": metric_col,
                "intent": "SCALAR_AGG",
                "explanation": f"Computes overall {effective_agg} of {metric_col}."
            }

        # Grouped Aggregation
        if dim_col and metric_col:
            effective_agg = agg or "SUM"
            alias = f"{effective_agg.lower()}_{cls._clean_token(metric_col)}"
            lim = limit or 10
            w_str = f"\nWHERE {' AND '.join(where_clauses)}" if where_clauses else ""
            sql = f"SELECT [{dim_col}], ROUND({effective_agg}([{metric_col}]), 2) as [{alias}]\nFROM [{effective_table}]{w_str}\nGROUP BY [{dim_col}]\nORDER BY [{alias}] {sort_dir}\nLIMIT {lim};"
            p_filter = f"[{' & '.join(pandas_filters)}]" if pandas_filters else ""
            pandas_code = f"df{p_filter}.groupby('{dim_col}')['{metric_col}'].{effective_agg.lower()}().round(2).reset_index(name='{alias}').sort_values('{alias}', ascending={sort_dir == 'ASC'}).head({lim})"
            return {
                "sql_query": sql,
                "pandas_code": pandas_code,
                "detected_dimension": dim_col,
                "detected_metric": metric_col,
                "intent": "GROUPED_AGG",
                "explanation": f"Groups data by {dim_col}, aggregates {effective_agg}({metric_col}), and returns {lim} rows ordered {sort_dir.lower()}ending."
            }

        # Filtered or sorted raw records / projections
        mentioned_cols = [c for c in df_cols if cls._clean_token(c) in tokens or cls._stem(cls._clean_token(c)) in stemmed_tokens]
        proj_str = ", ".join([f"[{c}]" for c in mentioned_cols]) if len(mentioned_cols) >= 2 else "*"
        w_str = f"\nWHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        order_str = ""
        if metric_col:
            order_str = f"\nORDER BY [{metric_col}] {sort_dir}"
        elif dim_col:
            order_str = f"\nORDER BY [{dim_col}] ASC"

        lim = limit or (15 if not where_clauses and not order_str else 50)
        sql = f"SELECT {proj_str}\nFROM [{effective_table}]{w_str}{order_str}\nLIMIT {lim};"
        p_filter = f"[{' & '.join(pandas_filters)}]" if pandas_filters else ""
        cols_arg = f"[{[c for c in mentioned_cols]}]" if len(mentioned_cols) >= 2 else ""
        pandas_code = f"df{p_filter}{cols_arg}.head({lim})"
        return {
            "sql_query": sql,
            "pandas_code": pandas_code,
            "detected_dimension": dim_col,
            "detected_metric": metric_col,
            "intent": "PROJECTION",
            "explanation": f"Selects records matching conditions: {' AND '.join(where_clauses) if where_clauses else 'all'}"
        }

    @classmethod
    async def generate_sql_from_nl_async(
        cls,
        df: pd.DataFrame,
        nl_prompt: str,
        table_name: str = "data",
        all_dfs: Optional[Dict[str, pd.DataFrame]] = None,
        relationships: Optional[List[Any]] = None
    ) -> Dict[str, Any]:
        """
        Asynchronously translates natural language into ANSI SQLite query and Pandas code.
        Features:
        1. Contextual LLM reasoning with schema descriptions, samples, and relationships.
        2. Automatic dry-run validation against live in-memory SQLite sandbox.
        3. Automated self-correction retry loop if SQLite returns any syntax or execution errors.
        4. Deterministic semantic compiler fallback on any network or timeout failure.
        """
        active_provider = LLMOrchestrator.get_active_provider()
        
        # Fast path to deterministic compiler if offline engine is configured
        if active_provider == "deterministic_engine":
            return cls.generate_sql_from_nl(df, nl_prompt, table_name)

        # Build schema context for LLM
        schema_context = []
        tables_to_describe = all_dfs if all_dfs else {table_name: df}
        for tname, tdf in tables_to_describe.items():
            cols_info = []
            for col in tdf.columns:
                dtype = str(tdf[col].dtype)
                sample_vals = [str(v) for v in tdf[col].dropna().head(3).tolist()]
                cols_info.append(f"- [{col}] ({dtype}), sample values: {sample_vals}")
            schema_context.append(f"Table [{tname}] (or [data]):\n" + "\n".join(cols_info))

        # Add relationships context if provided
        rel_context = ""
        if relationships:
            rel_lines = []
            for r in relationships:
                s_t = getattr(r, "source_table", "")
                s_c = getattr(r, "source_column", "")
                t_t = getattr(r, "target_table", "")
                t_c = getattr(r, "target_column", "")
                if s_t and s_c and t_t and t_c:
                    rel_lines.append(f"- [{s_t}].[{s_c}] joins with [{t_t}].[{t_c}]")
            if rel_lines:
                rel_context = "\n\nVerified Foreign Key Relationships for JOINs:\n" + "\n".join(rel_lines)

        system_prompt = (
            "You are a world-class SQL and analytical data scientist. Translate the user's analytical question "
            "into a clean, optimized ANSI SQLite query and matching Python Pandas code.\n\n"
            "Strict SQLite Rules:\n"
            "1. Enclose EVERY column name in square brackets: [Column Name].\n"
            "2. Table names: Use available table names enclosed in brackets, or [data].\n"
            "3. Only use SELECT statements (no DDL/DML, no CREATE, DROP, INSERT, UPDATE).\n"
            "4. For date filtering/formatting, use SQLite strftime('%Y', [Date]), strftime('%Y-%m', [Date]), etc.\n"
            "5. For case-insensitive string matching, use LOWER([Column]) = 'value' or [Column] LIKE '%value%'.\n"
            "6. For ratio/percentage calculations, prevent division by zero using NULLIF([denominator], 0).\n"
            "7. Output format: You MUST return a single valid JSON object with EXACT keys:\n"
            '   "sql_query": "...", "pandas_code": "...", "explanation": "...", "detected_dimension": "..." or null, "detected_metric": "..." or null\n'
            "8. Do NOT include any markdown code fencing or conversational text outside the JSON."
        )

        user_prompt = (
            f"Database Schema:\n" + "\n\n".join(schema_context) +
            rel_context +
            f"\n\nUser Question: {nl_prompt}"
        )

        try:
            raw_response = await LLMOrchestrator.query_llm(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                response_format_json=True
            )

            # Clean JSON response
            clean_json = raw_response.strip()
            if clean_json.startswith("```"):
                clean_json = re.sub(r"^```(?:json)?\s*", "", clean_json)
                clean_json = re.sub(r"\s*```$", "", clean_json)

            parsed = json.loads(clean_json)
            sql_candidate = parsed.get("sql_query", "").strip()

            if sql_candidate:
                # Dry run against in-memory SQLite to verify query validity
                test_res = cls.execute_sql(tables_to_describe, sql_candidate, max_rows=1)
                if "error" not in test_res:
                    return {
                        "sql_query": test_res.get("sql_query", sql_candidate),
                        "pandas_code": parsed.get("pandas_code", "df.head()"),
                        "detected_dimension": parsed.get("detected_dimension"),
                        "detected_metric": parsed.get("detected_metric"),
                        "explanation": parsed.get("explanation", f"Query synthesized by {active_provider.upper()}.")
                    }
                else:
                    # Self-Correction Loop: Provide exact error to LLM to self-heal
                    heal_prompt = (
                        f"Database Schema:\n" + "\n\n".join(schema_context) +
                        f"\n\nThe candidate SQL query:\n{sql_candidate}\n"
                        f"failed in SQLite with error:\n{test_res['error']}\n\n"
                        f"Fix the SQL query so it runs successfully on SQLite. Return JSON with the corrected sql_query."
                    )
                    heal_resp = await LLMOrchestrator.query_llm(
                        system_prompt=system_prompt,
                        user_prompt=heal_prompt,
                        response_format_json=True
                    )
                    clean_heal = heal_resp.strip()
                    if clean_heal.startswith("```"):
                        clean_heal = re.sub(r"^```(?:json)?\s*", "", clean_heal)
                        clean_heal = re.sub(r"\s*```$", "", clean_heal)
                    healed_parsed = json.loads(clean_heal)
                    healed_sql = healed_parsed.get("sql_query", "").strip()
                    
                    if healed_sql:
                        test_heal = cls.execute_sql(tables_to_describe, healed_sql, max_rows=1)
                        if "error" not in test_heal:
                            return {
                                "sql_query": test_heal.get("sql_query", healed_sql),
                                "pandas_code": healed_parsed.get("pandas_code", parsed.get("pandas_code", "df.head()")),
                                "detected_dimension": healed_parsed.get("detected_dimension", parsed.get("detected_dimension")),
                                "detected_metric": healed_parsed.get("detected_metric", parsed.get("detected_metric")),
                                "explanation": healed_parsed.get("explanation", parsed.get("explanation", "Query validated."))
                            }
        except Exception:
            # Fall through to deterministic compiler
            pass

        # Robust deterministic fallback
        return cls.generate_sql_from_nl(df, nl_prompt, table_name)
