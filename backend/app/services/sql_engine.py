import re
import sqlite3
import time
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd

class SQLEngine:
    """
    High-performance in-memory SQLite sandbox engine for analytical querying.
    Supports:
    - Zero-setup in-memory database loading of dataset DataFrames
    - Read-only safe execution guarding against schema alterations
    - Natural Language to SQL query translation
    - Automatic visualization suitability heuristics
    - Equivalent Pandas / Python code generator
    """

    FORBIDDEN_KEYWORDS = [
        "drop", "delete", "insert", "update", "alter", "create", "truncate", 
        "replace", "attach", "detach", "reindex", "vacuum", "pragma"
    ]

    @staticmethod
    def _sanitize_table_name(name: str) -> str:
        """Cleans table name to valid SQL identifier."""
        clean = re.sub(r"[^a-zA-Z0-9_]", "_", name.strip())
        return clean if clean else "data"

    @staticmethod
    def execute_sql(
        dataframes: Dict[str, pd.DataFrame],
        sql_query: str,
        max_rows: int = 200
    ) -> Dict[str, Any]:
        """
        Executes a read-only SQL query against the dataset tables in an in-memory SQLite database.
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
            # Mount DataFrames as tables
            for tbl_name, df in dataframes.items():
                safe_name = SQLEngine._sanitize_table_name(tbl_name)
                # Also mount default 'data' alias if single table
                df.to_sql(safe_name, conn, if_exists="replace", index=False)
                if len(dataframes) == 1 and safe_name != "data":
                    df.to_sql("data", conn, if_exists="replace", index=False)

            # Enforce max rows via subquery or cursor fetch
            cursor = conn.cursor()
            cursor.execute(q_clean)
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
                # 1 dimension + 1 metric
                first_row = rows[0]
                vals = [first_row[col_names[0]], first_row[col_names[1]]]
                if isinstance(vals[0], (int, float)) and not isinstance(vals[1], (int, float)):
                    chart_suggestion = {"x_col": col_names[1], "y_col": col_names[0], "type": "bar"}
                elif isinstance(vals[1], (int, float)) and not isinstance(vals[0], (int, float)):
                    chart_suggestion = {"x_col": col_names[0], "y_col": col_names[1], "type": "bar"}

            return {
                "columns": col_names,
                "rows": rows,
                "total_returned": len(rows),
                "execution_time_ms": exec_time,
                "chart_suggestion": chart_suggestion,
                "sql_query": q_clean
            }

        except Exception as exc:
            exec_time = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "error": f"SQL Execution Error: {str(exc)}",
                "execution_time_ms": exec_time
            }
        finally:
            conn.close()

    @staticmethod
    def generate_sql_from_nl(df: pd.DataFrame, nl_prompt: str, table_name: str = "data") -> Dict[str, Any]:
        """
        Translates a natural language analytical query into ANSI SQL syntax.
        """
        p_lower = nl_prompt.lower().strip()
        cols = list(df.columns)
        num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        str_cols = df.select_dtypes(include=["object", "string", "category"]).columns.tolist()

        # Find candidate dimension
        dim_col = None
        for c in str_cols:
            if c.lower() in p_lower or any(part in p_lower for part in c.lower().split("_")):
                dim_col = c
                break
        if not dim_col and str_cols:
            dim_col = str_cols[0]

        # Find candidate metric
        metric_col = None
        for c in num_cols:
            if not c.lower().endswith("id") and (c.lower() in p_lower or any(part in p_lower for part in c.lower().split("_"))):
                metric_col = c
                break
        if not metric_col and num_cols:
            clean = [c for c in num_cols if not c.lower().endswith("id")]
            metric_col = clean[0] if clean else num_cols[0]

        # Determine aggregation
        agg = "SUM"
        if "average" in p_lower or "avg" in p_lower or "mean" in p_lower:
            agg = "AVG"
        elif "count" in p_lower or "number of" in p_lower or "how many" in p_lower:
            agg = "COUNT"
        elif "max" in p_lower or "highest" in p_lower:
            agg = "MAX"
        elif "min" in p_lower or "lowest" in p_lower:
            agg = "MIN"

        # Determine limit
        limit_match = re.search(r"\btop\s+(\d+)\b", p_lower) or re.search(r"\blimit\s+(\d+)\b", p_lower)
        limit = int(limit_match.group(1)) if limit_match else 10

        # Construct SQL
        if agg == "COUNT" and not metric_col:
            if dim_col:
                sql = f"SELECT [{dim_col}], COUNT(*) as record_count\nFROM [{table_name}]\nGROUP BY [{dim_col}]\nORDER BY record_count DESC\nLIMIT {limit};"
                pandas_code = f"df.groupby('{dim_col}').size().reset_index(name='record_count').sort_values('record_count', ascending=False).head({limit})"
            else:
                sql = f"SELECT COUNT(*) as record_count\nFROM [{table_name}];"
                pandas_code = f"pd.DataFrame([{{'record_count': len(df)}}])"
        elif dim_col and metric_col:
            alias = f"{agg.lower()}_{metric_col.lower()}"
            sql = f"SELECT [{dim_col}], ROUND({agg}([{metric_col}]), 2) as [{alias}]\nFROM [{table_name}]\nGROUP BY [{dim_col}]\nORDER BY [{alias}] DESC\nLIMIT {limit};"
            pandas_code = f"df.groupby('{dim_col}')['{metric_col}'].{agg.lower()}().round(2).reset_index(name='{alias}').sort_values('{alias}', ascending=False).head({limit})"
        elif metric_col:
            alias = f"{agg.lower()}_{metric_col.lower()}"
            sql = f"SELECT ROUND({agg}([{metric_col}]), 2) as [{alias}]\nFROM [{table_name}];"
            pandas_code = f"pd.DataFrame([{{'{alias}': round(df['{metric_col}'].{agg.lower()}(), 2)}}])"
        else:
            sql = f"SELECT * FROM [{table_name}] LIMIT {limit};"
            pandas_code = f"df.head({limit})"

        return {
            "sql_query": sql,
            "pandas_code": pandas_code,
            "detected_dimension": dim_col,
            "detected_metric": metric_col
        }
