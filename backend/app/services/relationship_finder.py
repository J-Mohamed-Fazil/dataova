from typing import Dict, Any, List
import pandas as pd

class RelationshipFinder:

    @staticmethod
    def detect_relationships(dataframes: Dict[str, pd.DataFrame]) -> List[Dict[str, Any]]:
        """
        Detects foreign key candidate relationships across multiple dataframes.
        Returns list of relationship candidates with confidence scores and reasoning.
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
                u_vals = set(series.unique())
                col_data[t_name][col] = {
                    "unique_values": u_vals,
                    "unique_count": len(u_vals),
                    "total_count": len(df),
                    "dtype": str(df[col].dtype),
                    "is_unique": len(u_vals) == len(df) and len(df) > 0
                }

        # Compare pairs of tables
        for i in range(len(table_names)):
            t1 = table_names[i]
            for j in range(i + 1, len(table_names)):
                t2 = table_names[j]

                for c1, m1 in col_data[t1].items():
                    for c2, m2 in col_data[t2].items():
                        c1_clean = c1.lower().replace("_", "").replace("-", "")
                        c2_clean = c2.lower().replace("_", "").replace("-", "")

                        # Check name similarity
                        name_match = (c1_clean == c2_clean) or (c1_clean in c2_clean) or (c2_clean in c1_clean)
                        if not name_match:
                            continue

                        s1 = m1["unique_values"]
                        s2 = m2["unique_values"]
                        if not s1 or not s2:
                            continue

                        intersection = s1.intersection(s2)
                        overlap_ratio = len(intersection) / min(len(s1), len(s2))

                        if overlap_ratio >= 0.4:
                            # Candidate found!
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

                            confidence = round(0.6 + (overlap_ratio * 0.35) + (0.05 if c1.lower() == c2.lower() else 0), 2)
                            confidence = min(0.99, confidence)

                            reasoning = (
                                f"Matches column '{c1}' in {t1} with '{c2}' in {t2} with {int(overlap_ratio * 100)}% value overlap "
                                f"({len(intersection)} shared keys). Suggests a {rel_type.replace('_', '-')} relationship."
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
