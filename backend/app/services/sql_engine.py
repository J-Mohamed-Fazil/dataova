import json
import re
import sqlite3
import time
import difflib
from typing import Dict, Any, List, Optional, Tuple, Set
from collections import deque
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
    - Full EER Relational Graph awareness with automated Foreign Key discovery & multi-table JOIN / Subquery synthesis
    - Automatic visualization suitability heuristics
    - Real-time plain English answer synthesis
    """

    FORBIDDEN_KEYWORDS = [
        "drop", "delete", "insert", "update", "alter", "create", "truncate", 
        "replace", "attach", "detach", "reindex", "vacuum", "pragma"
    ]

    # Domain synonyms for semantic mapping
    SYNONYMS = {
        "revenue": ["revenue", "sales", "turnover", "income", "amount", "total_sales", "spend", "spending", "paid", "bill", "billing", "total_amount", "subtotal"],
        "sales": ["sales", "revenue", "turnover", "amount", "sold", "total_sales", "volume_sales", "total_amount"],
        "profit": ["profit", "margin", "earnings", "net_income", "gain", "net_profit", "gross_profit", "income"],
        "quantity": ["quantity", "qty", "volume", "units", "items", "pieces", "count", "num_items"],
        "discount": ["discount", "rebate", "markdown", "discount_rate", "promo", "reduction"],
        "cost": ["cost", "expense", "spend", "expenditure", "unit_cost", "cogs", "expenses"],
        "price": ["price", "unit_price", "rate", "fare", "fee", "cost_per_unit", "amount"],
        "salary": ["salary", "wage", "pay", "compensation", "stipend", "remuneration"],
        "customer": ["customer", "client", "buyer", "user", "account", "consumer", "purchaser", "customer_name", "client_name", "customer_id"],
        "product": ["product", "item", "title", "goods", "sku", "merchandise", "model", "product_name", "item_name", "product_id"],
        "category": ["category", "department", "segment", "type", "class", "genre", "division", "sub_category", "subcategory", "category_id", "category_name"],
        "region": ["region", "territory", "area", "zone", "state", "city", "country", "location", "geography", "province"],
        "date": ["date", "time", "year", "month", "day", "period", "timestamp", "quarter", "order_date", "orderdate", "ship_date", "created_at"]
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
        c = col.lower().strip()
        return (
            c.endswith("_id") or 
            c.startswith("id_") or 
            c.endswith(" id") or
            c.startswith("id ") or
            c in ["id", "uuid", "guid", "row_id", "rowid", "key", "index"]
        )

    @classmethod
    def _build_relationship_graph(
        cls,
        all_dfs: Dict[str, pd.DataFrame],
        relationships: Optional[List[Any]] = None
    ) -> Dict[str, Dict[str, Tuple[str, str]]]:
        """
        Builds an undirected EER relational graph connecting tables along foreign key relationships.
        graph[table_a][table_b] = (col_a, col_b) where [table_a].[col_a] = [table_b].[col_b]
        """
        graph: Dict[str, Dict[str, Tuple[str, str]]] = {t: {} for t in all_dfs.keys()}

        # 1. Incorporate verified relationships from database metadata
        if relationships:
            for r in relationships:
                s_t = getattr(r, "source_table", "")
                s_c = getattr(r, "source_column", "")
                t_t = getattr(r, "target_table", "")
                t_c = getattr(r, "target_column", "")
                if s_t in graph and t_t in graph and s_c and t_c:
                    graph[s_t][t_t] = (s_c, t_c)
                    graph[t_t][s_t] = (t_c, s_c)

        # 2. Auto-infer relationships by matching column names across tables
        table_names = list(all_dfs.keys())
        for i in range(len(table_names)):
            t1 = table_names[i]
            cols1 = all_dfs[t1].columns
            for j in range(i + 1, len(table_names)):
                t2 = table_names[j]
                if t2 in graph.get(t1, {}):
                    continue  # Already connected

                cols2 = all_dfs[t2].columns
                
                # Check for shared ID/key columns (e.g. category_id, product_id, customer_id, order_id)
                common_cols = [c for c in cols1 if c in cols2]
                id_common = [c for c in common_cols if cls._is_id_col(c)]
                matched_pair = None

                if id_common:
                    matched_pair = (id_common[0], id_common[0])
                elif common_cols:
                    matched_pair = (common_cols[0], common_cols[0])
                else:
                    # Check if t1 has 'id' and t2 has 't1_id' or vice-versa
                    t1_clean = cls._clean_token(t1).rstrip("s")
                    t2_clean = cls._clean_token(t2).rstrip("s")
                    for c1 in cols1:
                        c1_clean = cls._clean_token(c1)
                        for c2 in cols2:
                            c2_clean = cls._clean_token(c2)
                            if (c1_clean == f"{t2_clean}_id" and c2_clean in ["id", f"{t2_clean}_id"]) or \
                               (c2_clean == f"{t1_clean}_id" and c1_clean in ["id", f"{t1_clean}_id"]):
                                matched_pair = (c1, c2)
                                break
                        if matched_pair:
                            break

                if matched_pair:
                    graph[t1][t2] = (matched_pair[0], matched_pair[1])
                    graph[t2][t1] = (matched_pair[1], matched_pair[0])

        return graph

    @classmethod
    def _find_join_path(
        cls,
        graph: Dict[str, Dict[str, Tuple[str, str]]],
        start_table: str,
        target_table: str
    ) -> Optional[List[Tuple[str, str, str, str]]]:
        """
        Uses Breadth-First Search (BFS) to find the shortest join path between start_table and target_table.
        Returns a list of join steps: [(left_tbl, left_col, right_tbl, right_col), ...]
        """
        if start_table == target_table:
            return []

        queue = deque([(start_table, [])])
        visited = {start_table}

        while queue:
            current_tbl, current_path = queue.popleft()
            if current_tbl == target_table:
                return current_path

            for neighbor_tbl, (col_curr, col_neigh) in graph.get(current_tbl, {}).items():
                if neighbor_tbl not in visited:
                    visited.add(neighbor_tbl)
                    step = (current_tbl, col_curr, neighbor_tbl, col_neigh)
                    queue.append((neighbor_tbl, current_path + [step]))

        return None

    @classmethod
    def _match_column(
        cls,
        query_words: List[str],
        df_cols: List[str],
        prefer_numeric: Optional[bool] = None,
        exclude_cols: Optional[List[str]] = None
    ) -> Optional[str]:
        """
        Intelligent multi-factor column matcher that scores candidates based on:
        - Exact name match
        - Cleaned & stemmed match
        - Multi-word token overlap
        - Synonym dictionary mapping
        - ID-column penalty (unless 'id' is explicitly in query)
        - Numeric vs Categorical type preference
        """
        if not df_cols or not query_words:
            return None

        exclude = set(exclude_cols or [])
        candidates = [c for c in df_cols if c not in exclude]
        if not candidates:
            return None

        clean_query = [cls._clean_token(w) for w in query_words if cls._clean_token(w)]
        stemmed_query = [cls._stem(w) for w in clean_query]
        query_joined = " ".join(clean_query)
        user_wants_id = any(
            w in ["id", "identifier", "uuid", "guid", "rowid", "key"] or 
            w.endswith("_id") or 
            w.endswith("id") or 
            w.startswith("id_") 
            for w in clean_query
        )

        best_col = None
        best_score = -1.0

        for c in candidates:
            score = 0.0
            c_lower = c.lower().strip()
            c_clean = cls._clean_token(c)
            c_stem = cls._stem(c_clean)
            c_parts = [cls._clean_token(p) for p in re.split(r"[_\s\-]+", c) if len(cls._clean_token(p)) >= 2]
            c_parts_stemmed = [cls._stem(p) for p in c_parts]

            # 1. Exact match with raw name or joined query
            exact_match = (c_lower == query_joined or c_clean == "".join(clean_query) or c_clean in clean_query or c_stem in stemmed_query)
            if c_lower == query_joined or c_clean == "".join(clean_query):
                score += 100.0
            elif c_clean in clean_query or c_stem in stemmed_query:
                score += 90.0
            
            # 2. Multi-word phrase matches
            if len(clean_query) >= 2 and query_joined in c_lower:
                score += 80.0
            elif len(c_parts) >= 2 and all(p in clean_query or cls._stem(p) in stemmed_query for p in c_parts):
                score += 75.0

            # 3. Individual token overlap
            part_matches = 0
            for p, p_stem in zip(c_parts, c_parts_stemmed):
                if p in clean_query or p_stem in stemmed_query:
                    part_matches += 1
            if part_matches > 0:
                score += 40.0 + (part_matches * 15.0)

            # 4. Synonym match
            for concept, syns in cls.SYNONYMS.items():
                concept_stem = cls._stem(concept)
                syns_stemmed = [cls._stem(s) for s in syns]
                query_has_syn = any(sq in syns_stemmed or sq == concept_stem for sq in stemmed_query)
                if query_has_syn:
                    if c_clean == concept or c_stem == concept_stem:
                        score += 50.0
                    elif any(s in c_clean or s == c_stem for s in syns_stemmed):
                        score += 45.0
                    elif any(p in syns_stemmed for p in c_parts_stemmed):
                        score += 35.0

            # 5. ID column penalty (only if user did NOT explicitly match this column or ask for ID)
            if cls._is_id_col(c) and not user_wants_id and not exact_match:
                score -= 30.0

            if score > best_score and score >= 30.0:
                best_score = score
                best_col = c

        return best_col

    @classmethod
    def _find_column_across_tables(
        cls,
        query_words: List[str],
        all_dfs: Dict[str, pd.DataFrame],
        primary_table: str,
        prefer_numeric: Optional[bool] = None
    ) -> Optional[Tuple[str, str]]:
        """
        Searches all tables in the dataset to find the best matching table and column.
        Returns: (table_name, column_name) or None
        """
        # Search primary table first
        if primary_table in all_dfs:
            df = all_dfs[primary_table]
            target_cols = df.select_dtypes(include=[np.number]).columns.tolist() if prefer_numeric is True else (
                df.select_dtypes(include=["object", "string", "category"]).columns.tolist() if prefer_numeric is False else list(df.columns)
            )
            col = cls._match_column(query_words, target_cols, prefer_numeric=prefer_numeric)
            if col:
                return (primary_table, col)

        # Search other tables
        for tname, df in all_dfs.items():
            if tname == primary_table:
                continue
            target_cols = df.select_dtypes(include=[np.number]).columns.tolist() if prefer_numeric is True else (
                df.select_dtypes(include=["object", "string", "category"]).columns.tolist() if prefer_numeric is False else list(df.columns)
            )
            col = cls._match_column(query_words, target_cols, prefer_numeric=prefer_numeric)
            if col:
                return (tname, col)

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
        Mounts tables with multiple aliases so queries can refer to tables by:
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
                        clean_bad = re.sub(r"[^a-zA-Z0-9]", "", bad_col).lower()
                        direct_match = next((c for c in all_valid_cols if re.sub(r"[^a-zA-Z0-9]", "", c).lower() == clean_bad), None)
                        best_col = direct_match or (difflib.get_close_matches(bad_col, all_valid_cols, n=1, cutoff=0.4) or [None])[0]
                        if best_col:
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

            raw_cols = [desc[0] for desc in cursor.description] if cursor.description else []
            col_names = []
            seen_clean = set()
            for raw_col in raw_cols:
                clean = re.sub(r'^[\["]?[\w\-]+[\]"]?\.', '', raw_col).strip("[]\"'")
                if clean and clean not in seen_clean:
                    col_names.append(clean)
                    seen_clean.add(clean)
                else:
                    col_names.append(raw_col)
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
        table_name: str = "data",
        all_dfs: Optional[Dict[str, pd.DataFrame]] = None,
        relationships: Optional[List[Any]] = None
    ) -> Dict[str, Any]:
        """
        Synchronous semantic deterministic compiler for natural language queries.
        Features multi-table EER graph discovery, automated JOIN synthesis, and cross-table column resolution.
        """
        p = nl_prompt.strip()
        p_lower = p.lower()
        raw_words = re.findall(r"\b[a-zA-Z0-9_]+\b", p_lower)
        tokens = [cls._clean_token(w) for w in raw_words]
        stemmed_tokens = [cls._stem(w) for w in tokens]

        safe_table = cls._sanitize_table_name(table_name)
        primary_table = safe_table if safe_table else "data"
        available_dfs = all_dfs if all_dfs else {primary_table: df}

        # Build EER relational graph
        rel_graph = cls._build_relationship_graph(available_dfs, relationships)

        # Classify columns across all tables
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

        # A. Date/Year filtering (e.g. "in 2023", "orders in 2024", "since 2022")
        year_match = re.search(r"\b(?:in|year|during|for)?\s*(19\d{2}|20\d{2})\b", p_lower)
        if year_match and date_cols:
            yr = year_match.group(1)
            d_col = date_cols[0]
            if "after" in p_lower or "since" in p_lower or "from" in p_lower:
                where_clauses.append(f"strftime('%Y', [{d_col}]) >= '{yr}'")
                pandas_filters.append(f"pd.to_datetime(df['{d_col}']).dt.year >= {yr}")
            elif "before" in p_lower or "prior to" in p_lower:
                where_clauses.append(f"strftime('%Y', [{d_col}]) <= '{yr}'")
                pandas_filters.append(f"pd.to_datetime(df['{d_col}']).dt.year <= {yr}")
            else:
                where_clauses.append(f"strftime('%Y', [{d_col}]) = '{yr}'")
                pandas_filters.append(f"pd.to_datetime(df['{d_col}']).dt.year == {yr}")

        # B. Range / BETWEEN conditions (e.g. "sales between 100 and 500")
        between_pattern = r"\b([a-zA-Z0-9_\s\-]+)\s+between\s+(-?\d+(?:\.\d+)?)\s+and\s+(-?\d+(?:\.\d+)?)\b"
        for col_cand, v1, v2 in re.findall(between_pattern, p_lower):
            cand_words = [cls._clean_token(w) for w in col_cand.split()]
            mc = cls._match_column(cand_words, num_cols) or cls._match_column(cand_words, df_cols)
            if mc:
                where_clauses.append(f"[{mc}] BETWEEN {v1} AND {v2}")
                pandas_filters.append(f"(df['{mc}'] >= {v1}) & (df['{mc}'] <= {v2})")

        # C. Categorical values mentioned in prompt
        stopwords = {
            "the", "all", "and", "for", "out", "new", "top", "per", "are", "from",
            "with", "show", "list", "find", "get", "data", "rows", "records", "most",
            "best", "lowest", "least", "by", "is", "in", "of", "to", "or", "what",
            "give", "tell", "which", "where", "having", "total", "sum", "avg", "average"
        }
        for col in str_cols:
            try:
                unique_vals = df[col].dropna().unique()
                if len(unique_vals) <= 500:
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
        comp_pattern = r"\b([a-zA-Z0-9_\s\-]+)\s*(>=|<=|!=|<>|>|<|=|==|greater than|less than|more than|at least|at most|equal to|over|above|under|below|exceeds|exceeding)\s*(-?\d+(?:\.\d+)?)\b"
        matches = re.findall(comp_pattern, p_lower)
        for col_cand, op_text, num_val in matches:
            op_text_clean = op_text.strip().lower()
            if op_text_clean in ["==", "equal to"]:
                op = "="
            elif op_text_clean in [">", "greater than", "more than", "over", "above", "exceeds", "exceeding"]:
                op = ">"
            elif op_text_clean in ["<", "less than", "under", "below"]:
                op = "<"
            elif op_text_clean in [">=", "at least"]:
                op = ">="
            elif op_text_clean in ["<=", "at most"]:
                op = "<="
            else:
                op = "="

            cand_words = [cls._clean_token(w) for w in col_cand.split()]
            matched_col = cls._match_column(cand_words, num_cols) or cls._match_column(cand_words, df_cols)
            if matched_col:
                where_clauses.append(f"[{matched_col}] {op} {num_val}")
                pandas_filters.append(f"df['{matched_col}'] {op} {num_val}")

        # Negative profit / loss filter heuristic
        if any(k in p_lower for k in ["negative profit", "loss making", "unprofitable", "where profit < 0"]):
            profit_col = cls._match_column(["profit"], num_cols)
            if profit_col:
                where_clauses.append(f"[{profit_col}] < 0")
                pandas_filters.append(f"df['{profit_col}'] < 0")

        # Deduplicate where clauses
        where_clauses = list(dict.fromkeys(where_clauses))
        pandas_filters = list(dict.fromkeys(pandas_filters))

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
        elif any(k in p_lower for k in ["maximum", "highest", "peak", "greatest", "max", "top performing", "most"]):
            agg = "MAX"
        elif any(k in p_lower for k in ["minimum", "lowest", "smallest", "min", "worst"]):
            agg = "MIN"

        # Check for DISTINCT query
        if any(k in p_lower for k in ["distinct", "unique", "different", "list of"]):
            distinct_res = cls._find_column_across_tables(tokens, available_dfs, primary_table, prefer_numeric=False)
            if distinct_res:
                t_name, distinct_col = distinct_res
                w_str = f"\nWHERE {' AND '.join(where_clauses)}" if where_clauses else ""
                lim_str = f"\nLIMIT {limit or 50}"
                sql = f"SELECT DISTINCT [{distinct_col}]\nFROM [{t_name}]{w_str}\nORDER BY [{distinct_col}] ASC{lim_str};"
                p_filter = f"[{' & '.join(pandas_filters)}]" if pandas_filters else ""
                pandas_code = f"df_{t_name}{p_filter}['{distinct_col}'].drop_duplicates().sort_values().head({limit or 50})"
                return {
                    "sql_query": sql,
                    "pandas_code": pandas_code,
                    "detected_dimension": distinct_col,
                    "detected_metric": None,
                    "intent": "DISTINCT",
                    "explanation": f"Returns unique values of [{distinct_col}] from table [{t_name}]."
                }

        # Multi-table column resolution (EER Awareness)
        dim_table = None
        dim_col = None
        metric_table = None
        metric_col = None

        # 1. Periodic time breakdown
        if any(k in p_lower for k in ["monthly", "by month", "per month", "each month"]) and date_cols:
            dim_col = f"strftime('%Y-%m', [{date_cols[0]}])"
            dim_table = primary_table
        elif any(k in p_lower for k in ["yearly", "by year", "annual", "each year"]) and date_cols:
            dim_col = f"strftime('%Y', [{date_cols[0]}])"
            dim_table = primary_table
        elif any(k in p_lower for k in ["quarterly", "by quarter", "each quarter"]) and date_cols:
            dim_col = f"strftime('%Y', [{date_cols[0]}]) || '-Q' || ((CAST(strftime('%m', [{date_cols[0]}]) AS INTEGER) + 2) / 3)"
            dim_table = primary_table
        elif any(k in p_lower for k in ["daily", "by day", "by date", "per day"]) and date_cols:
            dim_col = f"strftime('%Y-%m-%d', [{date_cols[0]}])"
            dim_table = primary_table

        # 2. Multi-word Group By match
        group_match = re.search(r"\b(?:by|per|for each|across|grouped by|in each)\s+([a-zA-Z0-9_\s\-]+)", p_lower)
        if group_match and not dim_col:
            group_target = group_match.group(1).strip()
            group_target_clean = re.split(r"\b(?:order|sort|limit|where|with|having|top|bottom)\b", group_target)[0].strip()
            group_words = [cls._clean_token(w) for w in group_target_clean.split()]

            res_metric_by = cls._find_column_across_tables(group_words, available_dfs, primary_table, prefer_numeric=True)
            if res_metric_by:
                metric_table, metric_col = res_metric_by
                pre_words = tokens[:tokens.index(group_words[0])] if group_words and group_words[0] in tokens else tokens
                res_dim = cls._find_column_across_tables(pre_words, available_dfs, primary_table, prefer_numeric=False)
                if res_dim:
                    dim_table, dim_col = res_dim
            else:
                res_dim = cls._find_column_across_tables(group_words, available_dfs, primary_table, prefer_numeric=False)
                if res_dim:
                    dim_table, dim_col = res_dim

        # If not resolved via 'by', search tokens across all tables
        if not dim_col:
            res_dim = cls._find_column_across_tables(tokens, available_dfs, primary_table, prefer_numeric=False)
            if res_dim:
                dim_table, dim_col = res_dim

        if not metric_col:
            res_met = cls._find_column_across_tables(tokens, available_dfs, primary_table, prefer_numeric=True)
            if res_met:
                metric_table, metric_col = res_met

        # Construct FROM / JOIN clause if tables differ (EER JOIN Synthesis)
        def build_from_and_merge_clause(
            t_dim: Optional[str],
            t_met: Optional[str]
        ) -> Tuple[str, str]:
            t1 = t_dim or primary_table
            t2 = t_met or primary_table
            if t1 == t2 or not t_dim or not t_met:
                base = t1 if t1 else primary_table
                return (f"FROM [{base}]", f"df_{base}")

            # Find join path between t1 and t2
            join_path = cls._find_join_path(rel_graph, t1, t2)
            if not join_path:
                # Fallback: direct table reference
                return (f"FROM [{t1}], [{t2}]", f"df_{t1}.merge(df_{t2})")

            sql_from = f"FROM [{t1}]"
            pandas_merge = f"df_{t1}"
            for left_t, left_c, right_t, right_c in join_path:
                sql_from += f"\nJOIN [{right_t}] ON [{left_t}].[{left_c}] = [{right_t}].[{right_c}]"
                pandas_merge += f".merge(df_{right_t}, left_on='{left_c}', right_on='{right_c}')"

            return (sql_from, pandas_merge)

        # Multi-table Grouped Aggregation (with or without limit)
        if dim_col and metric_col:
            effective_agg = "AVG" if agg == "AVG" else ("COUNT" if agg == "COUNT" else (agg or "SUM"))
            alias = f"{effective_agg.lower()}_{cls._clean_token(metric_col)}"
            lim = limit or 10

            from_clause, merge_pandas = build_from_and_merge_clause(dim_table, metric_table)
            dim_expr = f"[{dim_table}].[{dim_col}]" if dim_table and dim_table != metric_table and not dim_col.startswith("strftime") else (f"[{dim_col}]" if not dim_col.startswith("strftime") else dim_col)
            dim_alias = f" as [{dim_col}]" if not dim_col.startswith("strftime") and dim_table and dim_table != metric_table else ""
            met_expr = f"[{metric_table}].[{metric_col}]" if metric_table and dim_table != metric_table else f"[{metric_col}]"
            w_str = f"\nWHERE {' AND '.join(where_clauses)}" if where_clauses else ""

            sql = f"SELECT {dim_expr}{dim_alias}, ROUND({effective_agg}({met_expr}), 2) as [{alias}]\n{from_clause}{w_str}\nGROUP BY {dim_expr}\nORDER BY [{alias}] {sort_dir}\nLIMIT {lim};"
            p_filter = f"[{' & '.join(pandas_filters)}]" if pandas_filters else ""
            pandas_code = f"{merge_pandas}{p_filter}.groupby('{dim_col}')['{metric_col}'].{effective_agg.lower()}().round(2).reset_index(name='{alias}').sort_values('{alias}', ascending={sort_dir == 'ASC'}).head({lim})"
            
            join_note = f" with relational JOIN across [{dim_table}] and [{metric_table}]" if dim_table and metric_table and dim_table != metric_table else ""
            return {
                "sql_query": sql,
                "pandas_code": pandas_code,
                "detected_dimension": dim_col,
                "detected_metric": metric_col,
                "intent": "RELATIONAL_GROUPED_AGG",
                "explanation": f"Groups by {dim_expr}, calculates {effective_agg}({met_expr}), and returns top {lim} records ordered {sort_dir.lower()}ending{join_note}."
            }

        # Check if the user is asking to "count" something grouped by dimension
        is_count_by_dim = (agg == "COUNT" or any(k in p_lower for k in ["count", "number of", "volume"])) and dim_col and (not metric_col or group_match)
        if is_count_by_dim:
            lim = limit or 10
            from_table = dim_table or primary_table
            w_str = f"\nWHERE {' AND '.join(where_clauses)}" if where_clauses else ""
            sql = f"SELECT [{dim_col}], COUNT(*) as [record_count]\nFROM [{from_table}]{w_str}\nGROUP BY [{dim_col}]\nORDER BY [record_count] {sort_dir}\nLIMIT {lim};"
            p_filter = f"[{' & '.join(pandas_filters)}]" if pandas_filters else ""
            pandas_code = f"df_{from_table}{p_filter}.groupby('{dim_col}').size().reset_index(name='record_count').sort_values('record_count', ascending={sort_dir == 'ASC'}).head({lim})"
            return {
                "sql_query": sql,
                "pandas_code": pandas_code,
                "detected_dimension": dim_col,
                "detected_metric": None,
                "intent": "COUNT_GROUPED",
                "explanation": f"Aggregates total record count grouped by [{dim_col}] from [{from_table}] sorted {sort_dir.lower()}ending."
            }

        # Pure COUNT without dimension
        if agg == "COUNT" and not dim_col and not metric_col:
            from_table = primary_table
            w_str = f"\nWHERE {' AND '.join(where_clauses)}" if where_clauses else ""
            sql = f"SELECT COUNT(*) as [record_count]\nFROM [{from_table}]{w_str};"
            p_filter = f"[{' & '.join(pandas_filters)}]" if pandas_filters else ""
            pandas_code = f"pd.DataFrame([{{'record_count': len(df_{from_table}{p_filter})}}])"
            return {
                "sql_query": sql,
                "pandas_code": pandas_code,
                "detected_dimension": None,
                "detected_metric": None,
                "intent": "COUNT_SCALAR",
                "explanation": f"Calculates total record count in [{from_table}]."
            }

        # Single scalar aggregate (NO grouping mentioned)
        is_scalar_agg = (
            (agg in ["SUM", "AVG", "MIN", "MAX"] or (metric_col and any(k in p_lower for k in ["what is", "calculate", "find the", "give me the", "overall", "total"])))
            and not dim_col
            and not group_match
        )
        if is_scalar_agg and metric_col:
            effective_agg = agg or "SUM"
            alias = f"{effective_agg.lower()}_{cls._clean_token(metric_col)}"
            from_table = metric_table or primary_table
            w_str = f"\nWHERE {' AND '.join(where_clauses)}" if where_clauses else ""
            round_expr = f"ROUND({effective_agg}([{metric_col}]), 2)" if effective_agg in ["SUM", "AVG"] else f"{effective_agg}([{metric_col}])"
            sql = f"SELECT {round_expr} as [{alias}]\nFROM [{from_table}]{w_str};"
            p_filter = f"[{' & '.join(pandas_filters)}]" if pandas_filters else ""
            pandas_code = f"pd.DataFrame([{{'{alias}': round(df_{from_table}{p_filter}['{metric_col}'].{effective_agg.lower()}(), 2)}}])"
            return {
                "sql_query": sql,
                "pandas_code": pandas_code,
                "detected_dimension": None,
                "detected_metric": metric_col,
                "intent": "SCALAR_AGG",
                "explanation": f"Computes overall {effective_agg} of [{metric_col}] from [{from_table}]."
            }

        # Filtered or sorted raw records / projections
        target_table = dim_table or metric_table or primary_table
        active_df = available_dfs.get(target_table, df)
        active_df_cols = list(active_df.columns)
        mentioned_cols = [c for c in active_df_cols if cls._clean_token(c) in tokens or cls._stem(cls._clean_token(c)) in stemmed_tokens]
        proj_str = ", ".join([f"[{c}]" for c in mentioned_cols]) if len(mentioned_cols) >= 2 else "*"
        w_str = f"\nWHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        order_str = ""
        sort_code_part = ""
        if metric_col:
            order_str = f"\nORDER BY [{metric_col}] {sort_dir}"
            sort_code_part = f".sort_values('{metric_col}', ascending={sort_dir == 'ASC'})"
        elif dim_col:
            order_str = f"\nORDER BY [{dim_col}] ASC"
            sort_code_part = f".sort_values('{dim_col}', ascending=True)"

        lim = limit or (15 if not where_clauses and not order_str else 50)
        sql = f"SELECT {proj_str}\nFROM [{target_table}]{w_str}{order_str}\nLIMIT {lim};"
        p_filter = f"[{' & '.join(pandas_filters)}]" if pandas_filters else ""
        cols_arg = f"[{mentioned_cols}]" if len(mentioned_cols) >= 2 else ""
        pandas_code = f"df_{target_table}{p_filter}{cols_arg}{sort_code_part}.head({lim})"
        return {
            "sql_query": sql,
            "pandas_code": pandas_code,
            "detected_dimension": dim_col,
            "detected_metric": metric_col,
            "intent": "PROJECTION",
            "explanation": f"Selects records from [{target_table}] matching conditions: {' AND '.join(where_clauses) if where_clauses else 'all'}"
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
        1. Contextual LLM reasoning with full multi-table EER diagram, schemas, and Foreign Key relationships.
        2. Automatic multi-table JOIN synthesis, Subqueries, CTEs, and Window Functions.
        3. Automatic dry-run validation against live in-memory SQLite sandbox.
        4. Automated self-correction retry loop if SQLite returns any syntax or execution errors.
        5. Deterministic relational EER compiler fallback on any network or timeout failure.
        """
        active_provider = LLMOrchestrator.get_active_provider()
        tables_to_describe = all_dfs if all_dfs else {table_name: df}
        
        # Fast path to deterministic compiler if offline engine is configured
        if active_provider == "deterministic_engine":
            return cls.generate_sql_from_nl(df, nl_prompt, table_name, all_dfs=all_dfs, relationships=relationships)

        # Build comprehensive EER Relational Schema context for LLM
        schema_context = []
        rel_graph = cls._build_relationship_graph(tables_to_describe, relationships)

        for tname, tdf in tables_to_describe.items():
            cols_info = []
            for col in tdf.columns:
                dtype = str(tdf[col].dtype)
                sample_vals = [str(v) for v in tdf[col].dropna().head(3).tolist()]
                is_key = " (Key/ID)" if cls._is_id_col(col) else ""
                cols_info.append(f"  - [{col}] ({dtype}){is_key}, sample values: {sample_vals}")
            schema_context.append(f"Table [{tname}] ({len(tdf):,} rows):\n" + "\n".join(cols_info))

        # Verified & Inferred EER Relational Foreign Keys
        rel_lines = []
        visited_pairs: Set[Tuple[str, str]] = set()
        for t1, neighbors in rel_graph.items():
            for t2, (c1, c2) in neighbors.items():
                pair_key = tuple(sorted([f"{t1}.{c1}", f"{t2}.{c2}"]))
                if pair_key not in visited_pairs:
                    visited_pairs.add(pair_key)
                    rel_lines.append(f"- [{t1}].[{c1}] = [{t2}].[{c2}] (JOIN condition between [{t1}] and [{t2}])")

        rel_context = ""
        if rel_lines:
            rel_context = "\n\n=== EER RELATIONAL RELATIONSHIPS (FOR JOINS & SUBQUERIES) ===\n" + "\n".join(rel_lines)

        system_prompt = (
            "You are a principal SQL Architect and relational database expert. Translate the user's analytical question "
            "into clean, optimal ANSI SQLite query and matching Python Pandas code.\n\n"
            "Strict Relational & ANSI SQLite Rules:\n"
            "1. MULTI-TABLE RELATIONAL JOINS: If the question requires metrics, dimensions, or filters that reside in different tables, "
            "you MUST write an ANSI JOIN (`INNER JOIN` or `LEFT JOIN`) connecting the tables along their foreign key relationships.\n"
            "2. Enclose EVERY table and column name in square brackets, e.g. `SELECT [categories].[category_name], SUM([orders].[revenue]) FROM [categories] JOIN [orders] ON [categories].[category_id] = [orders].[category_id]`.\n"
            "3. SUBQUERIES & CTEs: You are fully empowered to use Common Table Expressions (`WITH ... AS (...)`), subqueries (`WHERE [col] IN (SELECT ...)`), or window functions (`RANK() OVER (...)`) for complex analytics.\n"
            "4. Only use SELECT/WITH queries (no DDL/DML, no CREATE, DROP, INSERT, UPDATE).\n"
            "5. For date filtering/formatting, use SQLite `strftime('%Y', [Date])`, `strftime('%Y-%m', [Date])`, etc.\n"
            "6. Prevent division by zero using `NULLIF([denominator], 0)`.\n"
            "7. Output format: You MUST return a single valid JSON object with EXACT keys:\n"
            '   "sql_query": "...", "pandas_code": "...", "explanation": "...", "detected_dimension": "..." or null, "detected_metric": "..." or null\n'
            "8. Do NOT include any markdown code fencing or conversational text outside the JSON."
        )

        user_prompt = (
            f"=== DATABASE EER RELATIONAL SCHEMA ===\n" + "\n\n".join(schema_context) +
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
                # Dry run against in-memory SQLite to verify query validity across all mounted tables
                test_res = cls.execute_sql(tables_to_describe, sql_candidate, max_rows=1)
                if "error" not in test_res:
                    return {
                        "sql_query": test_res.get("sql_query", sql_candidate),
                        "pandas_code": parsed.get("pandas_code", "df.head()"),
                        "detected_dimension": parsed.get("detected_dimension"),
                        "detected_metric": parsed.get("detected_metric"),
                        "explanation": parsed.get("explanation", f"Synthesized with multi-table relational schema by {active_provider.upper()}.")
                    }
                else:
                    # Self-Correction Loop: Provide exact error to LLM to self-heal
                    heal_prompt = (
                        f"Database Relational Schema:\n" + "\n\n".join(schema_context) +
                        rel_context +
                        f"\n\nThe candidate SQL query:\n{sql_candidate}\n"
                        f"failed in SQLite with error:\n{test_res['error']}\n\n"
                        f"Fix the SQL query so it runs successfully on SQLite with proper JOINs/table qualifiers. Return JSON with the corrected sql_query."
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
                                "explanation": healed_parsed.get("explanation", parsed.get("explanation", "Relational query validated."))
                            }
        except Exception:
            # Fall through to deterministic relational compiler
            pass

        # Robust deterministic relational compiler fallback
        return cls.generate_sql_from_nl(df, nl_prompt, table_name, all_dfs=all_dfs, relationships=relationships)
