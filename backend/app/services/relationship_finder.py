from typing import Dict, Any, List
import pandas as pd

class RelationshipFinder:

    @staticmethod
    def detect_relationships(dataframes: Dict[str, pd.DataFrame]) -> List[Dict[str, Any]]:
        """
        Detects foreign key candidate relationships across multiple dataframes.
        Supports normalized key matching, type coercion, and cross-dataset semantic key discovery.
        """
        table_names = list(dataframes.keys())
        relationships: List[Dict[str, Any]] = []

        if len(table_names) < 2:
            return relationships

        # Pre-process unique value sets for columns that look like keys
        col_data: Dict[str, Dict[str, Dict[str, Any]]] = {}
        for t_name, df in dataframes.items():
            col_data[t_name] = {}
            for col in df.columns:
                series = df[col].dropna()
                # Normalize values to clean string for robust cross-type matching (e.g., 1 == 1.0 == "1")
                norm_vals = set(
                    series.astype(str).str.strip().str.lower().str.replace(r'\.0$', '', regex=True).unique()
                )
                col_data[t_name][col] = {
                    "unique_values": norm_vals,
                    "unique_count": len(norm_vals),
                    "total_count": len(df),
                    "dtype": str(df[col].dtype),
                    "is_unique": len(norm_vals) == len(df) and len(df) > 0
                }

        # Compare pairs of tables
        for i in range(len(table_names)):
            t1 = table_names[i]
            for j in range(i + 1, len(table_names)):
                t2 = table_names[j]

                for c1, m1 in col_data[t1].items():
                    for c2, m2 in col_data[t2].items():
                        c1_clean = c1.lower().replace("_", "").replace("-", "").replace(" ", "")
                        c2_clean = c2.lower().replace("_", "").replace("-", "").replace(" ", "")

                        # Check name similarity & foreign key naming conventions (e.g. user_id == id, product_id == product_id)
                        is_exact_col = c1.lower() == c2.lower()
                        is_id_match = (
                            (c1_clean == c2_clean) or
                            (c1_clean.endswith("id") and c2_clean in ["id", c1_clean]) or
                            (c2_clean.endswith("id") and c1_clean in ["id", c2_clean]) or
                            (c1_clean.endswith("key") and c2_clean in ["key", c1_clean]) or
                            (c2_clean.endswith("key") and c1_clean in ["key", c2_clean])
                        )
                        name_match = is_exact_col or is_id_match or (len(c1_clean) > 3 and (c1_clean in c2_clean or c2_clean in c1_clean))
                        if not name_match:
                            continue

                        s1 = m1["unique_values"]
                        s2 = m2["unique_values"]
                        if not s1 or not s2:
                            continue

                        intersection = s1.intersection(s2)
                        overlap_ratio = len(intersection) / max(1, min(len(s1), len(s2)))

                        # If values overlap or if strong ID naming convention matches
                        if overlap_ratio >= 0.25 or (is_exact_col and (c1.lower().endswith("id") or c1.lower() == "id") and len(intersection) > 0):
                            # Determine source (primary key table) and target (foreign key table)
                            if m1["is_unique"] and not m2["is_unique"]:
                                src_tbl, src_col = t1, c1
                                tgt_tbl, tgt_col = t2, c2
                                rel_type = "one_to_many"
                            elif m2["is_unique"] and not m1["is_unique"]:
                                src_tbl, src_col = t2, c2
                                tgt_tbl, tgt_col = t1, c1
                                rel_type = "one_to_many"
                            elif m1["is_unique"] and m2["is_unique"]:
                                src_tbl, src_col = t1, c1
                                tgt_tbl, tgt_col = t2, c2
                                rel_type = "one_to_one"
                            else:
                                src_tbl, src_col = t1, c1
                                tgt_tbl, tgt_col = t2, c2
                                rel_type = "many_to_one"

                            conf_base = 0.7 if is_exact_col else 0.6
                            confidence = round(conf_base + (overlap_ratio * 0.25) + (0.05 if is_id_match else 0), 2)
                            confidence = min(0.99, max(0.65, confidence))

                            overlap_pct = int(overlap_ratio * 100)
                            reasoning = (
                                f"Matches column '{src_col}' in [{src_tbl}] with '{tgt_col}' in [{tgt_tbl}] ({overlap_pct}% key value overlap, "
                                f"{len(intersection)} shared identifiers). Suggests a {rel_type.replace('_', '-')} relationship."
                            )

                            relationships.append({
                                "source_table": src_tbl,
                                "source_column": src_col,
                                "target_table": tgt_tbl,
                                "target_column": tgt_col,
                                "confidence": confidence,
                                "relationship_type": rel_type,
                                "status": "detected",
                                "reasoning": reasoning
                            })

        # Deduplicate relationships
        unique_rels = []
        seen = set()
        for r in relationships:
            key = (r["source_table"], r["source_column"], r["target_table"], r["target_column"])
            rev_key = (r["target_table"], r["target_column"], r["source_table"], r["source_column"])
            if key not in seen and rev_key not in seen:
                seen.add(key)
                unique_rels.append(r)

        return unique_rels
