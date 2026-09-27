import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.dataset import Dataset, TableMetadata, ColumnMetadata
from app.models.relationship import TableRelationship
from app.services.cache_manager import DataFrameCache
from app.services.relationship_finder import RelationshipFinder

from app.models.user import User
from app.routers.auth import get_optional_user

router = APIRouter(prefix="/model", tags=["model-studio"])

class SimulateRelationshipRequest(BaseModel):
    source_dataset_id: str
    source_table: str
    source_column: str
    target_dataset_id: str
    target_table: str
    target_column: str
    relationship_type: str = "many_to_one"  # one_to_one, one_to_many, many_to_one, many_to_many
    join_strategy: str = "left"  # inner, left, right, full

class CreateRelationshipRequest(BaseModel):
    dataset_id: str
    source_table: str
    source_column: str
    target_table: str
    target_column: str
    relationship_type: str = "many_to_one"
    confidence: float = 1.0
    reasoning: Optional[str] = "User-defined relationship"

def load_df(db: Session, dataset_id: Optional[str], table_name: str) -> Optional[pd.DataFrame]:
    query = db.query(TableMetadata).filter(TableMetadata.table_name == table_name)
    if dataset_id:
        query = query.filter(TableMetadata.dataset_id == dataset_id)
    tbl_meta = query.first()
    if not tbl_meta:
        # Fallback without dataset_id filter if table name matches uniquely
        tbl_meta = db.query(TableMetadata).filter(TableMetadata.table_name == table_name).first()
    if not tbl_meta:
        return None
    return DataFrameCache.get_table_dataframe(tbl_meta.storage_path, tbl_meta.table_name)

@router.get("/schema-graph")
def get_schema_graph(
    dataset_id: Optional[str] = Query(None, description="Specific dataset ID or None/'all' for enterprise multi-dataset graph"),
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    Returns the E-ER schema graph containing table nodes, primary/foreign key flags,
    and relationship edges with exact cardinalities (1:1, 1:M, M:1, M:M).
    Supports both single-dataset scope and enterprise multi-dataset relational graphs.
    """
    query = db.query(Dataset).filter(Dataset.status != "failed")
    if user:
        query = query.filter((Dataset.user_id == user.id) | (Dataset.user_id.is_(None)))

    if dataset_id and dataset_id != "all":
        datasets = query.filter(Dataset.id == dataset_id).all()
        # Fallback if user filter was strict
        if not datasets:
            datasets = db.query(Dataset).filter(Dataset.id == dataset_id).all()
    else:
        datasets = query.all()
        if not datasets:
            datasets = db.query(Dataset).filter(Dataset.status != "failed").all()

    if not datasets:
        return {"tables": [], "relationships": [], "total_tables": 0, "total_relationships": 0}

    tables_output: List[Dict[str, Any]] = []
    dataset_ids = [d.id for d in datasets]

    # Load stored relationships
    stored_rels = db.query(TableRelationship).filter(TableRelationship.dataset_id.in_(dataset_ids)).all()
    
    # Map of FK and PK columns for quick lookup: (table_name, col_name) -> True
    fk_map = set()
    pk_map = set()
    for r in stored_rels:
        if r.relationship_type in ("one_to_many", "one_to_one"):
            pk_map.add((r.source_table, r.source_column))
            fk_map.add((r.target_table, r.target_column))
        else:
            fk_map.add((r.source_table, r.source_column))
            pk_map.add((r.target_table, r.target_column))

    # Build Table Nodes
    for ds in datasets:
        for tbl in ds.tables:
            columns_data = []
            pk_candidate_found = False

            for c in tbl.columns:
                is_pk = (tbl.table_name, c.column_name) in pk_map
                is_fk = (tbl.table_name, c.column_name) in fk_map
                
                # Heuristic PK detection if not explicitly marked
                if not is_pk and not pk_candidate_found and c.missing_count == 0:
                    c_lower = c.column_name.lower()
                    if (c_lower.endswith("id") or c_lower == "id" or c_lower.endswith("_key")) and c.unique_count == tbl.row_count:
                        is_pk = True
                        pk_candidate_found = True

                sample_vals = c.sample_values[:4] if c.sample_values else []

                columns_data.append({
                    "id": c.id,
                    "column_name": c.column_name,
                    "data_type": c.data_type,
                    "original_type": c.original_type,
                    "is_primary_key": is_pk,
                    "is_foreign_key": is_fk,
                    "is_identifier": c.is_identifier,
                    "missing_count": c.missing_count,
                    "unique_count": c.unique_count,
                    "sample_values": sample_vals
                })

            tables_output.append({
                "id": tbl.id,
                "table_name": tbl.table_name,
                "dataset_id": ds.id,
                "dataset_name": ds.name,
                "row_count": tbl.row_count,
                "column_count": tbl.column_count,
                "detected_domain": ds.detected_domain,
                "columns": columns_data
            })

    # Relationships formatting & deduplication
    relationships_output: List[Dict[str, Any]] = []
    seen_rel_keys = set()
    
    # 1. Format stored relationships
    if stored_rels:
        for r in stored_rels:
            rel_type = r.relationship_type.lower()
            if rel_type == "one_to_one":
                card_label = "1:1"
            elif rel_type == "one_to_many":
                card_label = "1:M"
            elif rel_type == "many_to_one":
                card_label = "M:1"
            else:
                card_label = "M:M"

            pair_key = (r.source_table, r.source_column, r.target_table, r.target_column)
            seen_rel_keys.add(pair_key)
            seen_rel_keys.add((r.target_table, r.target_column, r.source_table, r.source_column))

            relationships_output.append({
                "id": r.id,
                "dataset_id": r.dataset_id,
                "source_table": r.source_table,
                "source_column": r.source_column,
                "target_table": r.target_table,
                "target_column": r.target_column,
                "relationship_type": rel_type,
                "cardinality_label": card_label,
                "confidence": round(r.confidence, 2) if r.confidence else 1.0,
                "status": r.status or "detected",
                "reasoning": r.reasoning or f"{card_label} relationship connecting {r.source_table}.{r.source_column} to {r.target_table}.{r.target_column}"
            })

    # 2. Discover cross-dataset & multi-table candidate relationships across all loaded tables
    if len(tables_output) >= 2:
        dfs_dict = {}
        for ds in datasets:
            for tbl in ds.tables:
                df = load_df(db, ds.id, tbl.table_name)
                if df is not None:
                    dfs_dict[tbl.table_name] = df

        if len(dfs_dict) >= 2:
            detected = RelationshipFinder.detect_relationships(dfs_dict)
            for d in detected:
                pair_key = (d["source_table"], d["source_column"], d["target_table"], d["target_column"])
                if pair_key in seen_rel_keys:
                    continue

                seen_rel_keys.add(pair_key)
                seen_rel_keys.add((d["target_table"], d["target_column"], d["source_table"], d["source_column"]))

                rel_type = d.get("relationship_type", "many_to_one")
                if rel_type == "one_to_one":
                    card_label = "1:1"
                elif rel_type == "one_to_many":
                    card_label = "1:M"
                elif rel_type == "many_to_one":
                    card_label = "M:1"
                else:
                    card_label = "M:M"

                relationships_output.append({
                    "id": str(uuid.uuid4()),
                    "dataset_id": datasets[0].id,
                    "source_table": d["source_table"],
                    "source_column": d["source_column"],
                    "target_table": d["target_table"],
                    "target_column": d["target_column"],
                    "relationship_type": rel_type,
                    "cardinality_label": card_label,
                    "confidence": d.get("confidence", 0.85),
                    "status": "detected",
                    "reasoning": d.get("reasoning", "")
                })

    return {
        "tables": tables_output,
        "relationships": relationships_output,
        "total_tables": len(tables_output),
        "total_relationships": len(relationships_output)
    }

@router.post("/simulate")
def simulate_relationship(payload: SimulateRelationshipRequest, db: Session = Depends(get_db)):
    """
    Simulates applying an E-ER relationship and explains in plain English and numbers
    exactly what happens to the dataset under 1:1, 1:M, M:1, or M:M cardinality.
    """
    df1 = load_df(db, payload.source_dataset_id, payload.source_table)
    if df1 is None:
        raise HTTPException(status_code=404, detail=f"Source table '{payload.source_table}' not found.")

    df2 = load_df(db, payload.target_dataset_id, payload.target_table)
    if df2 is None:
        raise HTTPException(status_code=404, detail=f"Target table '{payload.target_table}' not found.")

    if payload.source_column not in df1.columns:
        raise HTTPException(status_code=400, detail=f"Column '{payload.source_column}' not found in {payload.source_table}")
    if payload.target_column not in df2.columns:
        raise HTTPException(status_code=400, detail=f"Column '{payload.target_column}' not found in {payload.target_table}")

    # Normalize key values for clean matching
    s1 = df1[payload.source_column].dropna().astype(str).str.strip()
    s2 = df2[payload.target_column].dropna().astype(str).str.strip()

    keys1 = set(s1.unique())
    keys2 = set(s2.unique())

    intersection = keys1.intersection(keys2)
    match_rate_pct = round((len(intersection) / max(1, len(keys1))) * 100, 1)

    orphan_source_count = len(keys1 - keys2)
    orphan_target_count = len(keys2 - keys1)

    # Determine empirical cardinality
    is_t1_unique = len(keys1) == len(df1) and len(df1) > 0
    is_t2_unique = len(keys2) == len(df2) and len(df2) > 0

    if is_t1_unique and is_t2_unique:
        empirical_cardinality = "one_to_one"
        cardinality_badge = "1:1"
    elif is_t1_unique and not is_t2_unique:
        empirical_cardinality = "one_to_many"
        cardinality_badge = "1:M"
    elif not is_t1_unique and is_t2_unique:
        empirical_cardinality = "many_to_one"
        cardinality_badge = "M:1"
    else:
        empirical_cardinality = "many_to_many"
        cardinality_badge = "M:M"

    # Merge execution with copy to avoid mutation
    sub1 = df1.copy()
    sub2 = df2.copy()

    sub1["_merge_key_1"] = sub1[payload.source_column].astype(str).str.strip()
    sub2["_merge_key_2"] = sub2[payload.target_column].astype(str).str.strip()

    # Column provenance & rename collisions
    columns_lineage: List[Dict[str, Any]] = []
    for c in df1.columns:
        dtype = str(df1[c].dtype)
        columns_lineage.append({
            "column_name": c,
            "original_name": c,
            "source_table": payload.source_table,
            "data_type": "numeric" if ("int" in dtype or "float" in dtype) else "string",
            "is_key": c == payload.source_column
        })

    rename_map = {}
    for c in df2.columns:
        if c in df1.columns and c != payload.source_column:
            new_name = f"{c}_{payload.target_table}"
            rename_map[c] = new_name
            dtype = str(df2[c].dtype)
            columns_lineage.append({
                "column_name": new_name,
                "original_name": c,
                "source_table": payload.target_table,
                "data_type": "numeric" if ("int" in dtype or "float" in dtype) else "string",
                "is_key": c == payload.target_column
            })
        elif c != payload.target_column or payload.source_column != payload.target_column:
            dtype = str(df2[c].dtype)
            columns_lineage.append({
                "column_name": c,
                "original_name": c,
                "source_table": payload.target_table,
                "data_type": "numeric" if ("int" in dtype or "float" in dtype) else "string",
                "is_key": c == payload.target_column
            })

    if rename_map:
        sub2 = sub2.rename(columns=rename_map)

    how_strategy = payload.join_strategy.lower()
    if how_strategy not in ("inner", "left", "right", "full"):
        how_strategy = "left"

    merged = pd.merge(
        sub1,
        sub2,
        left_on="_merge_key_1",
        right_on="_merge_key_2",
        how=how_strategy
    )

    merged = merged.drop(columns=["_merge_key_1", "_merge_key_2"], errors="ignore")

    src_rows = len(df1)
    tgt_rows = len(df2)
    unified_rows = len(merged)
    unified_cols = len(merged.columns)
    multiplication_factor = round(unified_rows / max(1, src_rows), 2)

    # Plain-English Cardinality Explanations
    requested_card = payload.relationship_type.lower()
    
    card_descriptions = {
        "one_to_one": {
            "name": "One-to-One (1:1)",
            "meaning": "Each entity in the source table connects to exactly one entity in the target table.",
            "what_happens": (
                f"When 1:1 is applied, the dataset grows horizontally with new columns but preserves the exact row count "
                f"({src_rows} rows). No duplicate records are created. If an entity has no matching pair, "
                f"target columns will show NULL in a LEFT JOIN."
            ),
            "business_example": "E.g., User ↔ User Profile or Employee ↔ Security Badge."
        },
        "one_to_many": {
            "name": "One-to-Many (1:M)",
            "meaning": "A single master/parent record can match multiple detail/child transaction records.",
            "what_happens": (
                f"When 1:M is applied, each record from {payload.source_table} replicates for every matching record in {payload.target_table}. "
                f"The unified output has {unified_rows} rows (multiplication factor: {multiplication_factor}x). "
                f"Master attributes ({payload.source_table}) are duplicated alongside each child record."
            ),
            "business_example": "E.g., Customer ↔ Orders (one customer has many orders) or Department ↔ Employees."
        },
        "many_to_one": {
            "name": "Many-to-One (M:1)",
            "meaning": "Multiple transaction records reference a single lookup or dimension record.",
            "what_happens": (
                f"When M:1 is applied (Dimension Lookup), the base grain of {payload.source_table} ({src_rows} rows) is preserved. "
                f"Each row is enriched with dimension attributes from {payload.target_table} (e.g. Category, Region) "
                f"without expanding the row count."
            ),
            "business_example": "E.g., Orders ↔ Product (many order lines reference one product catalog item)."
        },
        "many_to_many": {
            "name": "Many-to-Many (M:M)",
            "meaning": "Entities on both sides can match multiple entities on the opposing side.",
            "what_happens": (
                f"When M:M is applied without a junction table, a Cartesian explosion risk occurs. "
                f"Every match creates cross-products, resulting in {unified_rows} rows. "
                f"In relational databases, M:M is typically decomposed into two 1:M relationships via an associative table."
            ),
            "business_example": "E.g., Students ↔ Courses or Tags ↔ Articles."
        }
    }

    card_info = card_descriptions.get(requested_card, card_descriptions["many_to_one"])

    # Sample rows for UI
    sample_df = merged.head(25).copy()
    sample_records = sample_df.replace({float("nan"): None, float("inf"): None, float("-inf"): None}).to_dict(orient="records")

    return {
        "summary": {
            "source_table": payload.source_table,
            "target_table": payload.target_table,
            "source_column": payload.source_column,
            "target_column": payload.target_column,
            "cardinality": requested_card,
            "cardinality_name": card_info["name"],
            "empirical_cardinality": empirical_cardinality,
            "empirical_badge": cardinality_badge,
            "join_strategy": how_strategy,
            "source_rows": src_rows,
            "target_rows": tgt_rows,
            "unified_rows": unified_rows,
            "unified_columns": unified_cols,
            "row_multiplication_factor": multiplication_factor,
            "match_rate_pct": match_rate_pct,
            "orphan_source_count": orphan_source_count,
            "orphan_target_count": orphan_target_count,
            "cardinality_meaning": card_info["meaning"],
            "what_happens": card_info["what_happens"],
            "business_example": card_info["business_example"]
        },
        "columns": columns_lineage,
        "sample_rows": sample_records
    }

@router.post("/relationships")
def create_relationship(payload: CreateRelationshipRequest, db: Session = Depends(get_db)):
    """
    Creates or updates a user-defined relationship between two tables in the E-ER model.
    """
    # Check if duplicate exists
    existing = db.query(TableRelationship).filter(
        TableRelationship.dataset_id == payload.dataset_id,
        TableRelationship.source_table == payload.source_table,
        TableRelationship.source_column == payload.source_column,
        TableRelationship.target_table == payload.target_table,
        TableRelationship.target_column == payload.target_column
    ).first()

    if existing:
        existing.relationship_type = payload.relationship_type
        existing.reasoning = payload.reasoning
        existing.status = "user_defined"
        db.commit()
        db.refresh(existing)
        return {"success": True, "relationship_id": existing.id, "action": "updated"}

    new_rel = TableRelationship(
        id=str(uuid.uuid4()),
        dataset_id=payload.dataset_id,
        source_table=payload.source_table,
        source_column=payload.source_column,
        target_table=payload.target_table,
        target_column=payload.target_column,
        relationship_type=payload.relationship_type,
        confidence=payload.confidence,
        status="user_defined",
        reasoning=payload.reasoning
    )
    db.add(new_rel)
    db.commit()
    db.refresh(new_rel)
    return {"success": True, "relationship_id": new_rel.id, "action": "created"}

@router.delete("/relationships/{relationship_id}")
def delete_relationship(relationship_id: str, db: Session = Depends(get_db)):
    """
    Deletes a relationship from the E-ER model.
    """
    rel = db.query(TableRelationship).filter(TableRelationship.id == relationship_id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")
    db.delete(rel)
    db.commit()
    return {"success": True, "message": "Relationship removed from model"}
