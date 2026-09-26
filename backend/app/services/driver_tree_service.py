from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np

class DriverTreeService:
    """
    Hierarchical variance decomposition engine. Breaks down key operational metrics
    (volume counts, numeric aggregations, or unique segment distributions) across
    multi-level categorical dimensions, identifying root-cause operational drags
    and growth leaders.
    """

    @staticmethod
    def get_tree_config(df: pd.DataFrame, table_name: Optional[str] = None) -> Dict[str, Any]:
        if df.empty:
            return {
                "default_metric": None,
                "all_numeric_columns": [],
                "all_dimension_columns": [],
                "default_dimensions": [],
                "available_metrics": []
            }

        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        cat_cols = [
            c for c in df.select_dtypes(include=["object", "category", "string"]).columns
            if 2 <= df[c].nunique() <= 5000 and not c.lower().endswith("_id") and c.lower() != "id"
        ]
        # Sort categorical columns by cardinality ascending (lower cardinality first, e.g. State before City)
        cat_cols.sort(key=lambda c: df[c].nunique())

        # Fallback if no columns matched strict cardinality criteria
        if not cat_cols:
            cat_cols = [
                c for c in df.columns
                if c not in numeric_cols and df[c].nunique() >= 2
            ]

        # Rich candidates for the UI selector
        available_metrics = [
            {
                "id": "__count__",
                "label": "Total Record Volume / Transactions (Count)",
                "column": "__count__",
                "calculation_type": "count",
                "unit": "Count",
                "is_monetary": False
            }
        ]

        target_candidates = [c for c in numeric_cols if any(k in c.lower() for k in ["revenue", "sales", "profit", "spend", "cost", "amount", "price", "payment"])]
        default_metric = target_candidates[0] if target_candidates else (numeric_cols[0] if numeric_cols else "__count__")

        for c in numeric_cols:
            is_mon = any(k in c.lower() for k in ["revenue", "sales", "profit", "spend", "cost", "amount", "price", "fee", "payment", "salary", "gmv", "budget"])
            available_metrics.append({
                "id": c,
                "label": f"{c.replace('_', ' ').title()} (Sum)",
                "column": c,
                "calculation_type": "sum",
                "unit": "Currency" if is_mon else "Units",
                "is_monetary": is_mon
            })

        for c in cat_cols:
            if 2 <= df[c].nunique() <= 50:
                available_metrics.append({
                    "id": f"distinct_{c}",
                    "label": f"Active {c.replace('_', ' ').title()}s (Unique)",
                    "column": c,
                    "calculation_type": "unique",
                    "unit": "Count",
                    "is_monetary": False
                })

        return {
            "default_metric": default_metric,
            "all_numeric_columns": numeric_cols,
            "all_dimension_columns": cat_cols,
            "default_dimensions": cat_cols[:2] if len(cat_cols) >= 2 else (cat_cols if cat_cols else []),
            "available_metrics": available_metrics,
            "table_name": table_name
        }

    @staticmethod
    def build_tree(
        df: pd.DataFrame,
        metric_col: Optional[str] = None,
        dimension_cols: Optional[List[str]] = None,
        calculation_type: Optional[str] = None,
        kpi_name: Optional[str] = None,
        unit: Optional[str] = None,
        display_name: Optional[str] = None
    ) -> Dict[str, Any]:
        if df.empty:
            return {"error": "Dataset table is empty."}

        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        cat_cols = [
            c for c in df.select_dtypes(include=["object", "category", "string"]).columns
            if 2 <= df[c].nunique() <= 5000 and not c.lower().endswith("_id") and c.lower() != "id"
        ]
        cat_cols.sort(key=lambda c: df[c].nunique())
        if not cat_cols:
            cat_cols = [c for c in df.columns if c not in numeric_cols and df[c].nunique() >= 2]

        calc_mode = (calculation_type or "").lower().strip()
        metric_str = (metric_col or "").strip()
        kpi_str = (kpi_name or "").strip()

        # Detect calculation mode
        is_count_mode = (
            calc_mode in ["count", "row_count", "volume"]
            or metric_str in ["__count__", "count", "total_records", "*"]
            or kpi_str == "total_records"
        )

        is_unique_mode = (
            calc_mode in ["unique", "distinct", "distinct_count"]
            or metric_str.startswith("distinct_")
            or kpi_str.startswith("distinct_")
        )

        # Resolve metric column and target
        if is_count_mode:
            calc_type = "count"
            resolved_metric_col = "__count__"
            resolved_display_name = display_name or "Total Orders / Transactions"
            is_monetary = False
            resolved_unit = unit or "Orders"
        elif is_unique_mode:
            calc_type = "unique"
            target_col = None
            if metric_str.startswith("distinct_"):
                cand = metric_str.replace("distinct_", "")
                if cand in df.columns:
                    target_col = cand
            if not target_col and kpi_str.startswith("distinct_"):
                cand = kpi_str.replace("distinct_", "")
                if cand in df.columns:
                    target_col = cand
            if not target_col and metric_str in df.columns:
                target_col = metric_str
            if not target_col and cat_cols:
                target_col = cat_cols[0]
            if not target_col:
                target_col = df.columns[0]

            resolved_metric_col = target_col
            resolved_display_name = display_name or f"Active {target_col.replace('_', ' ').title()}s"
            is_monetary = False
            resolved_unit = unit or "Count"
        else:
            calc_type = "mean" if calc_mode == "mean" else "sum"
            target_col = metric_str
            if target_col and target_col not in df.columns and target_col.startswith("kpi_"):
                stripped = target_col[4:]
                if stripped in df.columns:
                    target_col = stripped
            if not target_col or target_col not in df.columns:
                target_candidates = [c for c in numeric_cols if any(k in c.lower() for k in ["revenue", "sales", "profit", "amount", "price", "spend"])]
                target_col = target_candidates[0] if target_candidates else (numeric_cols[0] if numeric_cols else None)

            if not target_col or target_col not in df.columns:
                calc_type = "count"
                resolved_metric_col = "__count__"
                resolved_display_name = display_name or "Total Records"
                is_monetary = False
                resolved_unit = unit or "Records"
            else:
                resolved_metric_col = target_col
                resolved_display_name = display_name or f"Total {target_col.replace('_', ' ').title()}"
                is_monetary = any(k in target_col.lower() for k in ["revenue", "sales", "profit", "price", "spend", "cost", "fee", "payment", "amount", "salary", "gmv", "budget"])
                if unit == "Currency":
                    is_monetary = True
                resolved_unit = unit or ("Currency" if is_monetary else "Units")

        # Discover and filter valid dimension columns
        valid_dims: List[str] = []
        if dimension_cols:
            for d in dimension_cols:
                if d and isinstance(d, str) and d.strip() in df.columns and d.strip() not in valid_dims:
                    if calc_type != "unique" and d.strip() == resolved_metric_col:
                        continue
                    valid_dims.append(d.strip())

        # For unique mode: if dimension_cols wasn't provided, ensure target_col is dim1
        if is_unique_mode and not valid_dims and resolved_metric_col in df.columns:
            valid_dims.append(resolved_metric_col)
            other_dims = [c for c in cat_cols if c != resolved_metric_col]
            if other_dims:
                valid_dims.append(other_dims[0])

        if not valid_dims:
            avail = [c for c in cat_cols if c != resolved_metric_col]
            valid_dims = avail[:2] if len(avail) >= 2 else avail

        if not valid_dims:
            avail = [c for c in df.columns if c != resolved_metric_col and df[c].nunique() >= 2]
            valid_dims = avail[:2] if len(avail) >= 2 else avail

        if not valid_dims:
            return {"error": "No categorical dimensions available for hierarchical driver decomposition."}

        dim1 = valid_dims[0]
        dim2 = valid_dims[1] if len(valid_dims) > 1 and valid_dims[1] != dim1 else None

        clean_df = df.copy()
        clean_df[dim1] = clean_df[dim1].fillna("Unspecified").astype(str).str.strip()
        if dim2 and dim2 in clean_df.columns:
            clean_df[dim2] = clean_df[dim2].fillna("Unspecified").astype(str).str.strip()

        # Level 1 Aggregation
        if calc_type == "count":
            total_metric_val = float(len(clean_df))
            denom_total = max(total_metric_val, 1.0)
            l1_grouped = clean_df.groupby(dim1, as_index=False).size()
            l1_grouped.rename(columns={"size": "__metric__"}, inplace=True)
            l1_grouped = l1_grouped.sort_values(by="__metric__", ascending=False)
            top_l1 = l1_grouped.head(6)

        elif calc_type == "unique":
            total_metric_val = float(clean_df[resolved_metric_col].nunique())
            denom_total = max(float(len(clean_df)), 1.0)
            if dim1 == resolved_metric_col and dim2 and dim2 in clean_df.columns:
                # Municipal reach / sub-distribution per active state
                l1_grouped = clean_df.groupby(dim1, as_index=False)[dim2].nunique()
                l1_grouped.rename(columns={dim2: "__metric__"}, inplace=True)
                l1_grouped = l1_grouped.sort_values(by="__metric__", ascending=False)
                top_l1 = l1_grouped.head(6)
            else:
                l1_grouped = clean_df.groupby(dim1, as_index=False).size()
                l1_grouped.rename(columns={"size": "__metric__"}, inplace=True)
                l1_grouped = l1_grouped.sort_values(by="__metric__", ascending=False)
                top_l1 = l1_grouped.head(6)

        elif calc_type == "mean":
            clean_df[resolved_metric_col] = pd.to_numeric(clean_df[resolved_metric_col], errors="coerce").fillna(0.0)
            total_metric_val = float(clean_df[resolved_metric_col].mean())
            denom_total = abs(total_metric_val) if abs(total_metric_val) > 1e-6 else 1.0
            l1_grouped = clean_df.groupby(dim1, as_index=False)[resolved_metric_col].mean()
            l1_grouped.rename(columns={resolved_metric_col: "__metric__"}, inplace=True)
            l1_grouped = l1_grouped.sort_values(by="__metric__", ascending=False)
            top_l1 = l1_grouped.head(6)

        else: # sum
            clean_df[resolved_metric_col] = pd.to_numeric(clean_df[resolved_metric_col], errors="coerce").fillna(0.0)
            total_metric_val = float(clean_df[resolved_metric_col].sum())
            denom_total = abs(total_metric_val) if abs(total_metric_val) > 1e-6 else 1.0
            l1_grouped = clean_df.groupby(dim1, as_index=False)[resolved_metric_col].sum()
            l1_grouped.rename(columns={resolved_metric_col: "__metric__"}, inplace=True)
            l1_grouped = l1_grouped.sort_values(by="__metric__", ascending=False)
            top_l1 = l1_grouped.head(6)

        if l1_grouped.empty:
            return {"error": f"No data could be aggregated for dimension '{dim1}'."}

        l1_leader_row = l1_grouped.iloc[0]
        l1_drag_row = l1_grouped.iloc[-1] if len(l1_grouped) > 1 else l1_leader_row
        l1_leader_name = str(l1_leader_row[dim1])
        l1_drag_name = str(l1_drag_row[dim1]) if len(l1_grouped) > 1 else ""

        # Display top 5 segments + the absolute drag segment if not already present
        top_candidates = l1_grouped.head(5)
        if len(l1_grouped) > 5 and l1_drag_name not in top_candidates[dim1].values:
            top_l1 = pd.concat([top_candidates, l1_grouped.tail(1)], ignore_index=True)
        else:
            top_l1 = l1_grouped.head(6)

        l1_nodes = []
        for idx, row in top_l1.iterrows():
            seg_name = str(row[dim1])
            val = float(row["__metric__"])
            share_pct = round((val / denom_total) * 100, 1)

            is_leader = (seg_name == l1_leader_name and len(top_l1) > 1)
            is_drag = (seg_name == l1_drag_name and len(top_l1) > 1)
            status = "growth_leader" if is_leader else ("primary_drag" if is_drag else "neutral")

            # Level 2 Sub-decomposition
            l2_nodes = []
            if dim2 and dim2 in clean_df.columns:
                sub_df = clean_df[clean_df[dim1] == seg_name]
                if not sub_df.empty:
                    if calc_type == "count":
                        l2_grouped = sub_df.groupby(dim2, as_index=False).size()
                        l2_grouped.rename(columns={"size": "__metric__"}, inplace=True)
                    elif calc_type == "unique":
                        if dim1 == resolved_metric_col:
                            l2_grouped = sub_df.groupby(dim2, as_index=False).size()
                            l2_grouped.rename(columns={"size": "__metric__"}, inplace=True)
                        else:
                            l2_grouped = sub_df.groupby(dim2, as_index=False)[resolved_metric_col].nunique()
                            l2_grouped.rename(columns={resolved_metric_col: "__metric__"}, inplace=True)
                    elif calc_type == "mean":
                        l2_grouped = sub_df.groupby(dim2, as_index=False)[resolved_metric_col].mean()
                        l2_grouped.rename(columns={resolved_metric_col: "__metric__"}, inplace=True)
                    else:
                        l2_grouped = sub_df.groupby(dim2, as_index=False)[resolved_metric_col].sum()
                        l2_grouped.rename(columns={resolved_metric_col: "__metric__"}, inplace=True)

                    l2_grouped = l2_grouped.sort_values(by="__metric__", ascending=False).head(4)
                    sub_leader = str(l2_grouped.iloc[0][dim2]) if not l2_grouped.empty else ""
                    sub_drag = str(l2_grouped.iloc[-1][dim2]) if len(l2_grouped) > 1 else ""

                    denom_val = abs(val) if abs(val) > 1e-6 else 1.0
                    for _, sub_row in l2_grouped.iterrows():
                        sub_name = str(sub_row[dim2])
                        sub_val = float(sub_row["__metric__"])
                        sub_share_parent = round((sub_val / denom_val) * 100, 1)
                        sub_share_total = round((sub_val / denom_total) * 100, 1)
                        sub_status = "growth_leader" if sub_name == sub_leader and len(l2_grouped) > 1 else (
                            "primary_drag" if sub_name == sub_drag and len(l2_grouped) > 1 else "neutral"
                        )
                        l2_nodes.append({
                            "id": f"l2_{idx}_{sub_name}",
                            "dimension": dim2,
                            "label": sub_name,
                            "value": round(sub_val, 2),
                            "share_of_parent_pct": sub_share_parent,
                            "share_of_total_pct": sub_share_total,
                            "status": sub_status
                        })

            l1_nodes.append({
                "id": f"l1_{seg_name}",
                "dimension": dim1,
                "label": seg_name,
                "value": round(val, 2),
                "share_of_parent_pct": share_pct,
                "share_of_total_pct": share_pct,
                "status": status,
                "children": l2_nodes
            })

        # Root node formatting & text
        if calc_type == "count":
            root_label = f"Total {resolved_display_name}"
            formatted_total = f"{int(total_metric_val):,}"
            recommendation_text = f"Segment '{l1_drag_name}' accounts for only {round((float(top_l1.iloc[-1]['__metric__']) / denom_total) * 100, 1)}% of total volume. Expand regional distribution or marketing reach in '{l1_drag_name}' to recover drag."
        elif calc_type == "unique":
            root_label = f"Active {resolved_display_name} ({int(total_metric_val)} Unique Segments across {len(clean_df):,} Records)"
            formatted_total = f"{int(total_metric_val)}"
            recommendation_text = f"Segment '{l1_drag_name}' exhibits the lowest concentration among active segments. Investigate growth and engagement opportunities in '{l1_drag_name}'."
        else:
            root_label = f"Total {resolved_display_name}"
            formatted_total = f"${total_metric_val:,.2f}" if is_monetary else f"{total_metric_val:,.2f}"
            recommendation_text = f"Investigate operational bottlenecks, conversion friction, or price sensitivity in '{l1_drag_name}' to recover margin drag."

        root_node = {
            "id": "root",
            "dimension": "Total",
            "label": root_label,
            "value": round(total_metric_val, 2),
            "share_of_parent_pct": 100.0,
            "share_of_total_pct": 100.0,
            "status": "neutral",
            "children": l1_nodes
        }

        # Root cause takeaways
        leader_info = {
            "dimension": dim1,
            "segment": l1_leader_name,
            "value": round(float(top_l1.iloc[0]["__metric__"]), 2) if not top_l1.empty else 0.0,
            "share_pct": round((float(top_l1.iloc[0]["__metric__"]) / denom_total) * 100, 1) if not top_l1.empty else 0.0
        }
        drag_info = {
            "dimension": dim1,
            "segment": l1_drag_name,
            "value": round(float(top_l1.iloc[-1]["__metric__"]), 2) if len(top_l1) > 1 else 0.0,
            "share_pct": round((float(top_l1.iloc[-1]["__metric__"]) / denom_total) * 100, 1) if len(top_l1) > 1 else 0.0,
            "recommendation": recommendation_text
        }

        return {
            "metric_col": resolved_metric_col,
            "metric_name": resolved_display_name,
            "calculation_type": calc_type,
            "is_monetary": is_monetary,
            "unit": resolved_unit,
            "dimensions_used": valid_dims[:2],
            "total_value": round(total_metric_val, 2),
            "formatted_total": formatted_total,
            "tree": root_node,
            "growth_leader": leader_info,
            "primary_drag": drag_info
        }
