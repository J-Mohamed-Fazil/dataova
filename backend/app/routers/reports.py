from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
import pandas as pd

from app.database import get_db
from app.models import ReportDocument, ReportSection, Dataset, TableMetadata, KpiMetric, Insight, AnomalyRecord
from app.schemas.report import (
    ReportDocumentSchema,
    ReportSectionSchema,
    ReportSectionCreateSchema,
    ReportSectionUpdateSchema,
    ReportUpdateSchema
)
from app.services.file_processor import FileProcessor
from app.services.report_service import ReportService
from app.services.llm_orchestrator import LLMOrchestrator
from app.services.executive_report_generator import ExecutiveReportGenerator

router = APIRouter(prefix="/reports", tags=["reports"])

class ExecutiveTemplateGenerateRequest(BaseModel):
    prompt: Optional[str] = None
    user_name: Optional[str] = "Mike Lock"
    user_role: Optional[str] = "UI Designer"

@router.get("/{dataset_id}", response_model=ReportDocumentSchema)
def get_report(dataset_id: str, db: Session = Depends(get_db)):
    doc = db.query(ReportDocument).filter(ReportDocument.dataset_id == dataset_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Report document not found")
    return doc

@router.post("/{dataset_id}/regenerate", response_model=ReportDocumentSchema)
def regenerate_report(dataset_id: str, db: Session = Depends(get_db)):
    doc = db.query(ReportDocument).filter(ReportDocument.dataset_id == dataset_id).first()
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Load dataframes
    tables = db.query(TableMetadata).filter(TableMetadata.dataset_id == dataset_id).all()
    dataframes: dict[str, pd.DataFrame] = {}
    for t in tables:
        try:
            dfs = FileProcessor.read_file_to_dataframes(t.storage_path)
            if t.table_name in dfs:
                dataframes[t.table_name] = dfs[t.table_name]
            elif dfs:
                dataframes[t.table_name] = list(dfs.values())[0]
        except Exception:
            pass

    # Load KPIs, insights, anomalies
    kpi_records = db.query(KpiMetric).filter(KpiMetric.dataset_id == dataset_id).order_by(KpiMetric.order_index).all()
    kpis = [{
        "name": k.name,
        "display_name": k.display_name,
        "value": k.value,
        "formatted_value": k.formatted_value,
        "unit": k.unit,
        "calculation_type": k.calculation_type,
        "source_table": k.source_table,
        "source_column": k.source_column,
        "formula_explanation": k.formula_explanation,
        "impact_summary": k.impact_summary
    } for k in kpi_records]

    ins_records = db.query(Insight).filter(Insight.dataset_id == dataset_id).all()
    insights = [{
        "title": i.title,
        "category": i.category,
        "statement_type": i.statement_type,
        "description": i.description,
        "calculation_details": i.calculation_details,
        "why_it_matters": i.why_it_matters,
        "recommendation": i.recommendation,
        "severity": i.severity
    } for i in ins_records]

    anom_records = db.query(AnomalyRecord).filter(AnomalyRecord.dataset_id == dataset_id).all()
    anomalies = [{
        "table_name": a.table_name,
        "column_name": a.column_name,
        "anomaly_count": a.anomaly_count,
        "severity": a.severity,
        "explanation": a.explanation
    } for a in anom_records]

    health_info = {
        "score": dataset.data_health_score,
        "rating": "Good" if dataset.data_health_score >= 80 else ("Moderate" if dataset.data_health_score >= 60 else "Attention Required"),
        "metrics": {
            "total_cells": dataset.row_count * max(dataset.column_count, 1),
            "missing_cells": 0,
            "missing_pct": 0,
            "duplicate_rows": 0,
            "duplicate_pct": 0
        },
        "issues": []
    }

    dynamic_sections = ReportService.generate_dynamic_sections(
        dataset_name=dataset.name,
        domain=dataset.detected_domain,
        health_info=health_info,
        kpis=kpis,
        insights=insights,
        anomalies=anomalies,
        dataframes=dataframes
    )

    if not doc:
        doc = ReportDocument(
            dataset_id=dataset_id,
            title=f"Executive Intelligence Report: {dataset.name}",
            subtitle=f"Automated Multi-Dimensional Analysis • {dataset.detected_domain}",
            summary=f"Analysis of {dataset.row_count:,} records with an overall Data Health Score of {dataset.data_health_score}/100."
        )
        db.add(doc)
        db.flush()
    else:
        # Delete existing sections
        db.query(ReportSection).filter(ReportSection.report_id == doc.id).delete()
        doc.title = f"Executive Intelligence Report: {dataset.name}"
        doc.subtitle = f"Automated Multi-Dimensional Analysis • {dataset.detected_domain}"
        doc.summary = f"Analysis of {dataset.row_count:,} records with an overall Data Health Score of {dataset.data_health_score}/100."

    # Insert fresh dynamic sections
    for s in dynamic_sections:
        sec_rec = ReportSection(
            report_id=doc.id,
            section_type=s["section_type"],
            title=s["title"],
            content=s["content"],
            order_index=s["order_index"],
            charts_included=s["charts_included"],
            tables_included=s["tables_included"]
        )
        db.add(sec_rec)

    db.commit()
    db.refresh(doc)
    return doc

@router.put("/{dataset_id}", response_model=ReportDocumentSchema)
def update_report_metadata(dataset_id: str, payload: ReportUpdateSchema, db: Session = Depends(get_db)):
    doc = db.query(ReportDocument).filter(ReportDocument.dataset_id == dataset_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Report document not found")

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(doc, field, val)

    db.commit()
    db.refresh(doc)
    return doc

@router.post("/{dataset_id}/sections", response_model=ReportSectionSchema)
def create_section(dataset_id: str, payload: ReportSectionCreateSchema, db: Session = Depends(get_db)):
    doc = db.query(ReportDocument).filter(ReportDocument.dataset_id == dataset_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Report document not found")

    order = payload.order_index
    if order is None or order == 0:
        order = db.query(ReportSection).filter(ReportSection.report_id == doc.id).count()

    new_sec = ReportSection(
        report_id=doc.id,
        section_type=payload.section_type,
        title=payload.title,
        content=payload.content,
        order_index=order
    )
    db.add(new_sec)
    db.commit()
    db.refresh(new_sec)
    return new_sec

@router.put("/sections/{section_id}", response_model=ReportSectionSchema)
def update_section(section_id: str, payload: ReportSectionUpdateSchema, db: Session = Depends(get_db)):
    sec = db.query(ReportSection).filter(ReportSection.id == section_id).first()
    if not sec:
        raise HTTPException(status_code=404, detail="Section not found")

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(sec, field, val)

    db.commit()
    db.refresh(sec)
    return sec

@router.delete("/sections/{section_id}")
def delete_section(section_id: str, db: Session = Depends(get_db)):
    sec = db.query(ReportSection).filter(ReportSection.id == section_id).first()
    if not sec:
        raise HTTPException(status_code=404, detail="Section not found")

    db.delete(sec)
    db.commit()
    return {"message": "Report section deleted successfully"}

@router.get("/{dataset_id}/export/pdf")
async def export_pdf(dataset_id: str, db: Session = Depends(get_db)):
    doc = db.query(ReportDocument).filter(ReportDocument.dataset_id == dataset_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")

    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()

    sections = db.query(ReportSection).filter(
        ReportSection.report_id == doc.id
    ).order_by(ReportSection.order_index).all()

    sec_dicts = [{
        "title": s.title,
        "content": s.content,
        "charts_included": s.charts_included or [],
        "tables_included": s.tables_included or []
    } for s in sections]

    # Load KPIs
    kpi_records = db.query(KpiMetric).filter(KpiMetric.dataset_id == dataset_id).order_by(KpiMetric.order_index).all()
    kpis = [{
        "name": k.name,
        "display_name": k.display_name,
        "value": k.value,
        "formatted_value": k.formatted_value,
        "unit": k.unit,
        "calculation_type": k.calculation_type,
        "source_table": k.source_table,
        "source_column": k.source_column,
        "formula_explanation": k.formula_explanation,
        "impact_summary": k.impact_summary
    } for k in kpi_records]

    # Load Insights
    ins_records = db.query(Insight).filter(Insight.dataset_id == dataset_id).all()
    insights = [{
        "title": i.title,
        "category": i.category,
        "statement_type": i.statement_type,
        "description": i.description,
        "calculation_details": i.calculation_details,
        "why_it_matters": i.why_it_matters,
        "recommendation": i.recommendation,
        "severity": i.severity
    } for i in ins_records]

    # Load Anomalies
    anom_records = db.query(AnomalyRecord).filter(AnomalyRecord.dataset_id == dataset_id).all()
    anomalies = [{
        "table_name": a.table_name,
        "column_name": a.column_name,
        "anomaly_count": a.anomaly_count,
        "severity": a.severity,
        "explanation": a.explanation
    } for a in anom_records]

    # Load Dataframes
    tables = db.query(TableMetadata).filter(TableMetadata.dataset_id == dataset_id).all()
    dataframes: dict[str, pd.DataFrame] = {}
    for t in tables:
        try:
            dfs = FileProcessor.read_file_to_dataframes(t.storage_path)
            if t.table_name in dfs:
                dataframes[t.table_name] = dfs[t.table_name]
            elif dfs:
                dataframes[t.table_name] = list(dfs.values())[0]
        except Exception:
            pass

    # Synthesize AI briefing using the active AI API key
    ai_briefing = None
    try:
        ai_briefing = await ReportService.synthesize_ai_pdf_briefing(
            dataset_name=dataset.name if dataset else doc.title,
            domain=dataset.detected_domain if dataset else "Business Intelligence",
            health_score=dataset.data_health_score if dataset else 100,
            kpis=kpis,
            insights=insights,
            anomalies=anomalies,
            dataframes=dataframes
        )
    except Exception:
        pass

    dataset_meta = {
        "name": dataset.name if dataset else doc.title,
        "domain": dataset.detected_domain if dataset else "Business Intelligence",
        "health_score": dataset.data_health_score if dataset else 100,
        "row_count": dataset.row_count if dataset else 0,
        "column_count": dataset.column_count if dataset else 0
    }

    pdf_bytes = ReportService.export_report_pdf(
        report_title=doc.title,
        subtitle=doc.subtitle or "",
        sections=sec_dicts,
        kpis=kpis,
        insights=insights,
        anomalies=anomalies,
        dataset_meta=dataset_meta,
        ai_briefing=ai_briefing
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Datova_Report_{dataset_id[:8]}.pdf"}
    )

@router.post("/{dataset_id}/ai-deepen", response_model=ReportDocumentSchema)
async def ai_deepen_report(dataset_id: str, db: Session = Depends(get_db)):
    doc = db.query(ReportDocument).filter(ReportDocument.dataset_id == dataset_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Report document not found")
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    kpi_records = db.query(KpiMetric).filter(KpiMetric.dataset_id == dataset_id).all()
    kpi_summary = ", ".join(f"{k.display_name}: {k.formatted_value}" for k in kpi_records[:5])

    prompt = (
        f"Synthesize an advanced executive deep-dive for dataset '{dataset.name}' in the '{dataset.detected_domain}' domain. "
        f"Key Indicators: {kpi_summary}. Health score: {dataset.data_health_score}/100. "
        f"Provide 3 critical strategic findings with risk hedging and 3 forward-looking operational directives."
    )
    system = "You are Datova's Principal Business Intelligence & Quantitative Strategy AI Analyst. Format in clean Markdown with bold metrics and bullet points."

    ai_response = await LLMOrchestrator.query_llm(system, prompt, response_format_json=False)

    # Check if section already exists or append
    existing_deepen = db.query(ReportSection).filter(
        ReportSection.report_id == doc.id,
        ReportSection.section_type == "ai_deepen"
    ).first()

    order = db.query(ReportSection).filter(ReportSection.report_id == doc.id).count()

    if existing_deepen:
        existing_deepen.content = ai_response
    else:
        new_sec = ReportSection(
            report_id=doc.id,
            section_type="ai_deepen",
            title=f"AI Deep-Dive & Predictive Scenarios • {dataset.detected_domain}",
            content=ai_response,
            order_index=order,
            charts_included=[],
            tables_included=[]
        )
        db.add(new_sec)

    db.commit()
    db.refresh(doc)
    return doc

@router.get("/{dataset_id}/export/excel")
def export_excel(dataset_id: str, db: Session = Depends(get_db)):
    doc = db.query(ReportDocument).filter(ReportDocument.dataset_id == dataset_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")

    sections = db.query(ReportSection).filter(
        ReportSection.report_id == doc.id
    ).order_by(ReportSection.order_index).all()

    sec_dicts = [{"title": s.title, "content": s.content} for s in sections]

    # Get dataframes
    tables = db.query(TableMetadata).filter(TableMetadata.dataset_id == dataset_id).all()
    dataframes: dict[str, pd.DataFrame] = {}
    for t in tables:
        try:
            dfs = FileProcessor.read_file_to_dataframes(t.storage_path)
            if t.table_name in dfs:
                dataframes[t.table_name] = dfs[t.table_name]
            elif dfs:
                dataframes[t.table_name] = list(dfs.values())[0]
        except Exception:
            pass

    excel_bytes = ReportService.export_report_excel(doc.title, sec_dicts, dataframes)

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=Datova_Report_{dataset_id[:8]}.xlsx"}
    )

@router.get("/{dataset_id}/executive-template")
async def get_executive_template(dataset_id: str, db: Session = Depends(get_db)):
    """
    Returns data structured for the modern Neumorphic / Lavender executive dashboard report template in 16:9 ratio.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset or not dataset.tables:
        raise HTTPException(status_code=404, detail="Dataset not found or has no tables")

    tables = dataset.tables
    dataframes: dict[str, pd.DataFrame] = {}
    for t in tables:
        try:
            dfs = FileProcessor.read_file_to_dataframes(t.storage_path)
            if t.table_name in dfs:
                dataframes[t.table_name] = dfs[t.table_name]
            elif dfs:
                dataframes[t.table_name] = list(dfs.values())[0]
        except Exception:
            pass

    return await ExecutiveReportGenerator.async_generate_template_data(
        dataset_id=dataset.id,
        dataset_name=dataset.name,
        df_dict=dataframes,
        user_name="Mike Lock",
        user_role="UI Designer"
    )

@router.post("/{dataset_id}/executive-template/generate")
async def generate_executive_template(dataset_id: str, payload: ExecutiveTemplateGenerateRequest, db: Session = Depends(get_db)):
    """
    Synthesizes and customizes the executive dashboard report template using AI reasoning or custom prompts with API Key.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset or not dataset.tables:
        raise HTTPException(status_code=404, detail="Dataset not found or has no tables")

    tables = dataset.tables
    dataframes: dict[str, pd.DataFrame] = {}
    for t in tables:
        try:
            dfs = FileProcessor.read_file_to_dataframes(t.storage_path)
            if t.table_name in dfs:
                dataframes[t.table_name] = dfs[t.table_name]
            elif dfs:
                dataframes[t.table_name] = list(dfs.values())[0]
        except Exception:
            pass

    return await ExecutiveReportGenerator.async_generate_template_data(
        dataset_id=dataset.id,
        dataset_name=dataset.name,
        df_dict=dataframes,
        user_name=payload.user_name or "Mike Lock",
        user_role=payload.user_role or "UI Designer",
        custom_prompt=payload.prompt
    )
