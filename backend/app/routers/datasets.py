import os
import uuid
import math
from io import StringIO
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response
from sqlalchemy.orm import Session
import numpy as np
import pandas as pd

from app.database import get_db
from app.models import (
    Dataset,
    FileRecord,
    TableMetadata,
    ColumnMetadata,
    TableRelationship,
    AnalysisRun,
    KpiMetric,
    Insight,
    AnomalyRecord,
    DashboardSheet,
    DashboardChart,
    ChatSession,
    ReportDocument,
    ReportSection,
    User
)
from app.schemas.dataset import DatasetSchema, DatasetSummarySchema, TableRelationshipSchema
from app.routers.auth import get_optional_user
from app.services.file_processor import FileProcessor
from app.services.cache_manager import DataFrameCache
from app.services.profiler import DataProfiler
from app.services.quality_scorer import QualityScorer
from app.services.domain_detector import DomainDetector
from app.services.relationship_finder import RelationshipFinder
from app.services.anomaly_detector import AnomalyDetector
from app.services.kpi_engine import KpiEngine
from app.services.insight_engine import InsightEngine
from app.services.report_service import ReportService
from app.services.dashboard_generator import DashboardGenerator
from app.services.data_cleanse_service import DataCleanseService

router = APIRouter(prefix="/datasets", tags=["datasets"])

def verify_dataset_access(
    dataset_id: str,
    db: Session,
    user: Optional[User],
    for_write: bool = False
) -> Dataset:
    """Helper to verify dataset existence and strict user ownership."""
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if ds.user_id and (not user or ds.user_id != user.id):
        if for_write:
            raise HTTPException(status_code=403, detail="Permission denied. You can only modify your own datasets.")
        raise HTTPException(status_code=404, detail="Dataset not found or access denied")
    return ds

def sort_dataframe_column(df: pd.DataFrame, sort_by: Optional[str], sort_dir: str = "asc") -> pd.DataFrame:
    """Safely sorts a DataFrame by column with intelligent numeric or natural string sorting."""
    if not sort_by or sort_by not in df.columns or df.empty:
        return df

    ascending = (sort_dir.lower() != "desc")
    col_series = df[sort_by]

    try:
        # If already numeric type, standard sort
        if pd.api.types.is_numeric_dtype(col_series):
            return df.sort_values(by=sort_by, ascending=ascending, na_position="last")

        # Check non-null values for numeric conversion
        non_null = col_series.dropna()
        if len(non_null) > 0:
            numeric_attempt = pd.to_numeric(non_null, errors="coerce")
            # If at least 80% of non-null entries are numeric, sort as numeric
            if numeric_attempt.notna().mean() >= 0.8:
                return df.sort_values(
                    by=sort_by,
                    ascending=ascending,
                    na_position="last",
                    key=lambda s: pd.to_numeric(s, errors="coerce")
                )

            # Otherwise, perform case-insensitive natural string sorting
            return df.sort_values(
                by=sort_by,
                ascending=ascending,
                na_position="last",
                key=lambda s: s.astype(str).str.lower()
            )

        return df.sort_values(by=sort_by, ascending=ascending, na_position="last")
    except Exception:
        # Fallback to standard sort_values if key function encounters an edge case
        return df.sort_values(by=sort_by, ascending=ascending, na_position="last")

@router.get("", response_model=List[DatasetSummarySchema])
def list_datasets(
    search: Optional[str] = None,
    domain: Optional[str] = None,
    sort_by: Optional[str] = "created_at",
    sort_dir: Optional[str] = "desc",
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """List datasets owned exclusively by the current user with flexible search, domain filter, and sorting."""
    if not user:
        return []

    query = db.query(Dataset).filter(Dataset.user_id == user.id)

    # Domain filter
    if domain and domain.strip() and domain.strip().lower() != "all":
        query = query.filter(Dataset.detected_domain == domain.strip())

    # Search filter across dataset name, domain, and description
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (Dataset.name.ilike(term)) | 
            (Dataset.detected_domain.ilike(term)) |
            (Dataset.description.ilike(term))
        )

    # Sorting
    sort_col = getattr(Dataset, sort_by or "created_at", Dataset.created_at)
    if sort_dir and sort_dir.lower() == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    return query.all()

@router.get("/{dataset_id}", response_model=DatasetSchema)
def get_dataset(
    dataset_id: str,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Retrieve dataset ensuring user isolation."""
    return verify_dataset_access(dataset_id, db, user)

@router.delete("/{dataset_id}")
def delete_dataset(
    dataset_id: str,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Delete dataset ensuring only the owner can delete, cleaning up memory caches and disk files."""
    ds = verify_dataset_access(dataset_id, db, user, for_write=True)

    # Invalidate dataframe cache and delete storage files from disk
    for tbl in ds.tables:
        DataFrameCache.invalidate(tbl.storage_path)
        try:
            if tbl.storage_path and os.path.exists(tbl.storage_path):
                os.remove(tbl.storage_path)
        except Exception:
            pass

    for f_rec in ds.files:
        try:
            if f_rec.file_path and os.path.exists(f_rec.file_path):
                os.remove(f_rec.file_path)
        except Exception:
            pass

    db.delete(ds)
    db.commit()
    return {"message": "Dataset and associated assets deleted successfully"}

@router.post("/upload", response_model=DatasetSchema)
async def upload_dataset(
    files: List[UploadFile] = File(...),
    dataset_name: Optional[str] = Form(None),
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")

    dataset_id = str(uuid.uuid4())
    display_name = dataset_name or (files[0].filename.rsplit(".", 1)[0].replace("_", " ").title() if files[0].filename else "Uploaded Dataset")

    # Create Dataset Record tagged with current user
    dataset = Dataset(
        id=dataset_id,
        user_id=user.id if user else None,
        name=display_name,
        status="processing"
    )
    db.add(dataset)
    db.commit()

    all_dataframes: dict[str, pd.DataFrame] = {}
    tables_profile: list[dict] = []
    total_row_count = 0

    try:
        # Process each uploaded file
        for upload in files:
            orig_name = upload.filename or "data.csv"
            # Read file stream
            content = await upload.read()
            valid, err_msg = FileProcessor.validate_file(orig_name, len(content))
            if not valid:
                raise HTTPException(status_code=400, detail=err_msg)

            # Save locally
            import io
            file_path = FileProcessor.save_upload(io.BytesIO(content), dataset_id, orig_name)

            file_rec = FileRecord(
                dataset_id=dataset_id,
                filename=upload.filename,
                original_name=orig_name,
                file_path=file_path,
                file_size_bytes=len(content),
                file_type=orig_name.rsplit(".", 1)[-1].lower()
            )
            db.add(file_rec)
            db.flush()

            # Parse to dataframes
            dfs = FileProcessor.read_file_to_dataframes(file_path)
            for t_name, df in dfs.items():
                all_dataframes[t_name] = df
                total_row_count += len(df)

                # Profile Table
                tbl_prof = DataProfiler.profile_table(df, t_name)
                tables_profile.append(tbl_prof)

                # Store Table Metadata
                tbl_meta = TableMetadata(
                    dataset_id=dataset_id,
                    file_id=file_rec.id,
                    table_name=t_name,
                    row_count=tbl_prof["row_count"],
                    column_count=tbl_prof["column_count"],
                    storage_path=file_path,
                    sample_data=tbl_prof["sample_data"]
                )
                db.add(tbl_meta)
                db.flush()

                # Store Columns Metadata
                for c in tbl_prof["columns"]:
                    col_meta = ColumnMetadata(
                        table_id=tbl_meta.id,
                        column_name=c["column_name"],
                        data_type=c["data_type"],
                        original_type=c["original_type"],
                        missing_count=c["missing_count"],
                        missing_percentage=c["missing_percentage"],
                        unique_count=c["unique_count"],
                        cardinality_ratio=c["cardinality_ratio"],
                        is_identifier=c["is_identifier"],
                        is_potential_kpi=c["is_potential_kpi"],
                        statistics=c["statistics"],
                        sample_values=c["sample_values"]
                    )
                    db.add(col_meta)

        # 1. Quality & Health Scoring
        quality_res = QualityScorer.calculate_health_score(tables_profile)
        dataset.data_health_score = quality_res["score"]
        dataset.row_count = total_row_count
        dataset.column_count = sum(t["column_count"] for t in tables_profile)

        # 2. Domain Detection
        domain, dom_conf, dom_reason = DomainDetector.detect_domain(tables_profile)
        dataset.detected_domain = domain
        dataset.domain_confidence = dom_conf
        dataset.domain_reasoning = dom_reason

        # 3. Relationship Detection (Multi-table)
        detected_rels = RelationshipFinder.detect_relationships(all_dataframes)
        for r in detected_rels:
            rel_rec = TableRelationship(
                dataset_id=dataset_id,
                source_table=r["source_table"],
                source_column=r["source_column"],
                target_table=r["target_table"],
                target_column=r["target_column"],
                confidence=r["confidence"],
                relationship_type=r["relationship_type"],
                status=r["status"],
                reasoning=r["reasoning"]
            )
            db.add(rel_rec)

        # 4. Anomaly Detection
        anomalies = AnomalyDetector.detect_anomalies(all_dataframes)
        for a in anomalies:
            anom_rec = AnomalyRecord(
                dataset_id=dataset_id,
                table_name=a["table_name"],
                column_name=a["column_name"],
                method=a["method"],
                anomaly_count=a["anomaly_count"],
                severity=a["severity"],
                details=a["details"],
                explanation=a["explanation"]
            )
            db.add(anom_rec)

        # 5. Dynamic KPI Discovery
        discovered_kpis = KpiEngine.discover_kpis(all_dataframes, domain)
        for k in discovered_kpis:
            kpi_rec = KpiMetric(
                dataset_id=dataset_id,
                name=k["name"],
                display_name=k["display_name"],
                value=k["value"],
                formatted_value=k["formatted_value"],
                unit=k["unit"],
                calculation_type=k["calculation_type"],
                source_table=k["source_table"],
                source_column=k["source_column"],
                formula_explanation=k["formula_explanation"],
                impact_summary=k["impact_summary"],
                confidence=k["confidence"],
                order_index=k["order_index"],
                min_value=k.get("min_value"),
                max_value=k.get("max_value"),
                sum_value=k.get("sum_value"),
                avg_value=k.get("avg_value"),
                count_value=k.get("count_value"),
                formatted_min=k.get("formatted_min"),
                formatted_max=k.get("formatted_max"),
                formatted_sum=k.get("formatted_sum"),
                formatted_avg=k.get("formatted_avg"),
                formatted_count=k.get("formatted_count"),
                ai_insight=k.get("ai_insight"),
                statistical_summary=k.get("statistical_summary", {})
            )
            db.add(kpi_rec)

        # 6. Structured Insight Generation
        generated_insights = InsightEngine.generate_insights(
            all_dataframes, domain, discovered_kpis, anomalies, quality_res
        )
        for ins in generated_insights:
            ins_rec = Insight(
                dataset_id=dataset_id,
                title=ins["title"],
                category=ins["category"],
                statement_type=ins["statement_type"],
                description=ins["description"],
                calculation_details=ins["calculation_details"],
                why_it_matters=ins["why_it_matters"],
                recommendation=ins.get("recommendation"),
                severity=ins["severity"],
                confidence=ins["confidence"],
                source_table=ins.get("source_table"),
                source_columns=ins.get("source_columns", [])
            )
            db.add(ins_rec)

        # 7. Dashboard Generation Engine
        if len(all_dataframes) > 1:
            DashboardGenerator.generate_all_sheets_and_charts(
                dataset_id=dataset_id,
                all_dataframes=all_dataframes,
                detected_rels=detected_rels,
                db=db
            )
        else:
            try:
                DashboardGenerator.generate_ai_themed_dashboard(
                    dataset_id=dataset_id,
                    all_dataframes=all_dataframes,
                    detected_rels=detected_rels,
                    db=db,
                    preset="executive",
                    palette="cyberpunk",
                    mode="replace_all"
                )
            except Exception as e:
                logger.warning(f"AI Agent initial dashboard generation fallback: {e}")
                db.rollback()
                DashboardGenerator.generate_all_sheets_and_charts(
                    dataset_id=dataset_id,
                    all_dataframes=all_dataframes,
                    detected_rels=detected_rels,
                    db=db
                )

        # 8. Chat Session
        chat_sess = ChatSession(
            dataset_id=dataset_id,
            title="DATOVA Analyst Session"
        )
        db.add(chat_sess)

        # 9. Default Report Document
        report_doc = ReportDocument(
            dataset_id=dataset_id,
            title=f"Executive Intelligence Report: {dataset.name}",
            subtitle=f"Automated Multi-Dimensional Analysis • {domain}",
            summary=f"Analysis of {total_row_count:,} records with an overall Data Health Score of {dataset.data_health_score}/100."
        )
        db.add(report_doc)
        db.flush()

        default_sections = ReportService.generate_dynamic_sections(
            dataset_name=dataset.name,
            domain=domain,
            health_info=quality_res,
            kpis=discovered_kpis,
            insights=generated_insights,
            anomalies=anomalies,
            dataframes=all_dataframes
        )
        for s in default_sections:
            sec_rec = ReportSection(
                report_id=report_doc.id,
                section_type=s["section_type"],
                title=s["title"],
                content=s["content"],
                order_index=s["order_index"],
                charts_included=s["charts_included"],
                tables_included=s["tables_included"]
            )
            db.add(sec_rec)

        dataset.status = "ready"
        db.commit()
        db.refresh(dataset)
        return dataset

    except Exception as e:
        db.rollback()
        dataset.status = "failed"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to process dataset: {str(e)}")

@router.get("/{dataset_id}/relationships", response_model=List[TableRelationshipSchema])
def get_relationships(
    dataset_id: str,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    verify_dataset_access(dataset_id, db, user)
    return db.query(TableRelationship).filter(TableRelationship.dataset_id == dataset_id).all()

@router.put("/{dataset_id}/relationships/{relationship_id}")
def update_relationship(
    dataset_id: str,
    relationship_id: str,
    status: str,  # accepted, rejected
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    verify_dataset_access(dataset_id, db, user, for_write=True)
    rel = db.query(TableRelationship).filter(
        TableRelationship.id == relationship_id,
        TableRelationship.dataset_id == dataset_id
    ).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")
    rel.status = status
    db.commit()
    return {"message": f"Relationship status updated to {status}"}

@router.get("/{dataset_id}/tables/{table_name}/rows")
def get_table_rows(
    dataset_id: str,
    table_name: str,
    page: int = 1,
    page_size: int = 25,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_dir: str = "asc",
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    verify_dataset_access(dataset_id, db, user)
    table = db.query(TableMetadata).filter(
        TableMetadata.dataset_id == dataset_id,
        TableMetadata.table_name == table_name
    ).first()
    if not table:
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found for dataset")

    df = DataFrameCache.get_table_dataframe(table.storage_path, table.table_name)
    if df is None:
        raise HTTPException(status_code=400, detail="Table data could not be loaded")

    working_df = df.copy()

    # Search filter across all columns
    if search and search.strip():
        term = search.strip().lower()
        mask = working_df.astype(str).apply(lambda col: col.str.lower().str.contains(term, na=False, regex=False)).any(axis=1)
        working_df = working_df[mask]

    # Column sorting
    working_df = sort_dataframe_column(working_df, sort_by=sort_by, sort_dir=sort_dir)

    total_rows = len(working_df)
    page_size = max(1, min(page_size, 200))
    page = max(1, page)
    total_pages = max(1, math.ceil(total_rows / page_size))

    start = (page - 1) * page_size
    end = start + page_size
    sliced_df = working_df.iloc[start:end].replace({np.nan: None})

    records = []
    for _, row in sliced_df.iterrows():
        row_dict = {}
        for k, v in row.items():
            if isinstance(v, (pd.Timestamp, np.datetime64)):
                row_dict[str(k)] = str(v)
            elif isinstance(v, (np.integer, int)):
                row_dict[str(k)] = int(v)
            elif isinstance(v, (np.floating, float)):
                row_dict[str(k)] = None if (v is None or math.isnan(v)) else round(float(v), 4)
            else:
                row_dict[str(k)] = v
        records.append(row_dict)

    return {
        "table_name": table_name,
        "total_rows": total_rows,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "columns": list(df.columns),
        "rows": records
    }

@router.get("/{dataset_id}/tables/{table_name}/kpis")
def get_table_kpis(
    dataset_id: str,
    table_name: str,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    verify_dataset_access(dataset_id, db, user)
    table = db.query(TableMetadata).filter(
        TableMetadata.dataset_id == dataset_id,
        TableMetadata.table_name == table_name
    ).first()
    if not table:
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found for dataset")

    df = DataFrameCache.get_table_dataframe(table.storage_path, table.table_name)
    if df is None:
        raise HTTPException(status_code=400, detail="Table data could not be loaded")

    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    domain = dataset.detected_domain if dataset else "General"

    kpis = KpiEngine.compute_all_table_kpis(df, table_name, domain)
    return {
        "dataset_id": dataset_id,
        "table_name": table_name,
        "total_rows": len(df),
        "total_columns": len(df.columns),
        "kpis": kpis
    }

@router.get("/{dataset_id}/tables/{table_name}/export-csv")
def export_table_csv(
    dataset_id: str,
    table_name: str,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_dir: str = "asc",
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    verify_dataset_access(dataset_id, db, user)
    table = db.query(TableMetadata).filter(
        TableMetadata.dataset_id == dataset_id,
        TableMetadata.table_name == table_name
    ).first()
    if not table:
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found for dataset")

    df = DataFrameCache.get_table_dataframe(table.storage_path, table.table_name)
    if df is None:
        raise HTTPException(status_code=400, detail="Table data could not be loaded")

    working_df = df.copy()

    if search and search.strip():
        term = search.strip().lower()
        mask = working_df.astype(str).apply(lambda col: col.str.lower().str.contains(term, na=False, regex=False)).any(axis=1)
        working_df = working_df[mask]

    working_df = sort_dataframe_column(working_df, sort_by=sort_by, sort_dir=sort_dir)

    csv_buffer = StringIO()
    working_df.to_csv(csv_buffer, index=False)

    return Response(
        content=csv_buffer.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{table_name}.csv"'
        }
    )

@router.get("/{dataset_id}/cleanse/audit")
def audit_dataset_cleanse(
    dataset_id: str,
    table_name: Optional[str] = None,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Audits defects, nulls, duplicates, and outliers across the target table."""
    verify_dataset_access(dataset_id, db, user)
    tables = db.query(TableMetadata).filter(TableMetadata.dataset_id == dataset_id).all()
    if not tables:
        raise HTTPException(status_code=404, detail="No tables found for this dataset")

    target_table = tables[0]
    if table_name:
        found = next((t for t in tables if t.table_name == table_name), None)
        if found:
            target_table = found

    df = DataFrameCache.get_table_dataframe(target_table.storage_path, target_table.table_name)
    if df is None:
        raise HTTPException(status_code=400, detail="Data could not be loaded")

    audit = DataCleanseService.audit_dataset_cleanliness(df)
    audit["table_name"] = target_table.table_name
    return audit

@router.post("/{dataset_id}/cleanse/auto-preview")
def preview_auto_cleanse(
    dataset_id: str,
    table_name: Optional[str] = None,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Generates a dry-run preview of the autonomous data repair pipeline."""
    verify_dataset_access(dataset_id, db, user)
    tables = db.query(TableMetadata).filter(TableMetadata.dataset_id == dataset_id).all()
    if not tables:
        raise HTTPException(status_code=404, detail="No tables found for this dataset")

    target_table = tables[0]
    if table_name:
        found = next((t for t in tables if t.table_name == table_name), None)
        if found:
            target_table = found

    df = DataFrameCache.get_table_dataframe(target_table.storage_path, target_table.table_name)
    if df is None:
        raise HTTPException(status_code=400, detail="Data could not be loaded")

    result = DataCleanseService.auto_cleanse(df)
    # Exclude non-serializable DataFrame from response
    result.pop("cleansed_df", None)
    result["table_name"] = target_table.table_name
    return result

@router.post("/{dataset_id}/cleanse/auto-apply")
def apply_auto_cleanse(
    dataset_id: str,
    table_name: Optional[str] = None,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Applies autonomous data repairs permanently to the dataset and updates health score."""
    ds = verify_dataset_access(dataset_id, db, user, for_write=True)

    tables = db.query(TableMetadata).filter(TableMetadata.dataset_id == dataset_id).all()
    if not tables:
        raise HTTPException(status_code=404, detail="No tables found for this dataset")

    target_table = tables[0]
    if table_name:
        found = next((t for t in tables if t.table_name == table_name), None)
        if found:
            target_table = found

    df = DataFrameCache.get_table_dataframe(target_table.storage_path, target_table.table_name)
    if df is None:
        raise HTTPException(status_code=400, detail="Data could not be loaded")

    result = DataCleanseService.auto_cleanse(df)
    cleansed_df = result.pop("cleansed_df", None)

    if cleansed_df is not None:
        # Save back to CSV storage path
        cleansed_df.to_csv(target_table.storage_path, index=False)
        DataFrameCache.invalidate(target_table.storage_path)

        # Update metadata records
        target_table.row_count = len(cleansed_df)
        target_table.column_count = len(cleansed_df.columns)
        ds.row_count = len(cleansed_df)
        ds.column_count = len(cleansed_df.columns)
        ds.data_health_score = result["cleaned_health_score"]
        db.commit()

    result["table_name"] = target_table.table_name
    return result

@router.get("/{dataset_id}/cleanse/export-cleaned")
def export_cleaned_csv(
    dataset_id: str,
    table_name: Optional[str] = None,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Directly streams the auto-cleaned dataset as a downloadable CSV."""
    verify_dataset_access(dataset_id, db, user)
    tables = db.query(TableMetadata).filter(TableMetadata.dataset_id == dataset_id).all()
    if not tables:
        raise HTTPException(status_code=404, detail="No tables found for this dataset")

    target_table = tables[0]
    if table_name:
        found = next((t for t in tables if t.table_name == table_name), None)
        if found:
            target_table = found

    df = DataFrameCache.get_table_dataframe(target_table.storage_path, target_table.table_name)
    if df is None:
        raise HTTPException(status_code=400, detail="Data could not be loaded")

    result = DataCleanseService.auto_cleanse(df)
    cleansed_df = result.get("cleansed_df", df)

    csv_str = DataCleanseService.df_to_csv_string(cleansed_df)

    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{target_table.table_name}_cleansed.csv"'
        }
    )

class CustomPipelineRequest(BaseModel):
    table_name: Optional[str] = None
    steps: List[Dict[str, Any]]

@router.post("/{dataset_id}/cleanse/pipeline-preview")
def preview_custom_pipeline(
    dataset_id: str,
    payload: CustomPipelineRequest,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Executes a dry-run preview of a customized data prep pipeline."""
    verify_dataset_access(dataset_id, db, user)
    tables = db.query(TableMetadata).filter(TableMetadata.dataset_id == dataset_id).all()
    if not tables:
        raise HTTPException(status_code=404, detail="No tables found for this dataset")

    target_table = tables[0]
    if payload.table_name:
        found = next((t for t in tables if t.table_name == payload.table_name), None)
        if found:
            target_table = found

    df = DataFrameCache.get_table_dataframe(target_table.storage_path, target_table.table_name)
    if df is None:
        raise HTTPException(status_code=400, detail="Data could not be loaded")

    result = DataCleanseService.apply_custom_pipeline(df, payload.steps)
    result.pop("cleansed_df", None)
    result["table_name"] = target_table.table_name
    return result

@router.post("/{dataset_id}/cleanse/pipeline-apply")
def apply_custom_pipeline(
    dataset_id: str,
    payload: CustomPipelineRequest,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Applies a customized data prep pipeline permanently and updates health score."""
    ds = verify_dataset_access(dataset_id, db, user, for_write=True)

    tables = db.query(TableMetadata).filter(TableMetadata.dataset_id == dataset_id).all()
    if not tables:
        raise HTTPException(status_code=404, detail="No tables found for this dataset")

    target_table = tables[0]
    if payload.table_name:
        found = next((t for t in tables if t.table_name == payload.table_name), None)
        if found:
            target_table = found

    df = DataFrameCache.get_table_dataframe(target_table.storage_path, target_table.table_name)
    if df is None:
        raise HTTPException(status_code=400, detail="Data could not be loaded")

    result = DataCleanseService.apply_custom_pipeline(df, payload.steps)
    cleansed_df = result.pop("cleansed_df", None)

    if cleansed_df is not None:
        cleansed_df.to_csv(target_table.storage_path, index=False)
        DataFrameCache.invalidate(target_table.storage_path)

        target_table.row_count = len(cleansed_df)
        target_table.column_count = len(cleansed_df.columns)
        ds.row_count = len(cleansed_df)
        ds.column_count = len(cleansed_df.columns)
        ds.data_health_score = result["cleaned_health_score"]
        db.commit()

    result["table_name"] = target_table.table_name
    return result

