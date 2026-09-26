import json
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import pandas as pd

from app.database import get_db
from app.models import (
    Dataset,
    ChatSession,
    ChatMessage,
    KpiMetric,
    TableMetadata,
    DashboardSheet,
    DashboardChart,
    ReportDocument,
    ReportSection,
    TableRelationship,
    User
)
from app.schemas.chat import (
    ChatMessageSchema,
    ChatQueryRequest,
    PinChartRequest,
    ChatSessionSchema
)
from app.routers.auth import get_optional_user
from app.services.file_processor import FileProcessor
from app.services.chat_agent import ChatAgent

router = APIRouter(prefix="/chat", tags=["chat"])

@router.get("/{dataset_id}/history", response_model=List[ChatMessageSchema])
def get_chat_history(
    dataset_id: str,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if ds.user_id and (not user or ds.user_id != user.id):
        raise HTTPException(status_code=404, detail="Dataset not found or access denied")

    session = db.query(ChatSession).filter(ChatSession.dataset_id == dataset_id).first()
    if not session:
        return []
    return db.query(ChatMessage).filter(ChatMessage.session_id == session.id).order_by(ChatMessage.created_at).all()

@router.delete("/{dataset_id}/history")
def clear_chat_history(
    dataset_id: str,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if ds.user_id and (not user or ds.user_id != user.id):
        raise HTTPException(status_code=404, detail="Dataset not found or access denied")

    session = db.query(ChatSession).filter(ChatSession.dataset_id == dataset_id).first()
    if session:
        db.query(ChatMessage).filter(ChatMessage.session_id == session.id).delete()
        db.commit()
    return {"status": "success", "message": "Chat history cleared"}

@router.post("/{dataset_id}/query", response_model=ChatMessageSchema)
async def ask_datova(
    dataset_id: str,
    payload: ChatQueryRequest,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if ds.user_id and (not user or ds.user_id != user.id):
        raise HTTPException(status_code=404, detail="Dataset not found or access denied")

    # Ensure chat session exists
    session = db.query(ChatSession).filter(ChatSession.dataset_id == dataset_id).first()
    if not session:
        session = ChatSession(
            dataset_id=dataset_id,
            user_id=user.id if user else None,
            title="DATOVA Analyst Session"
        )
        db.add(session)
        db.flush()

    # Load recent conversation history (last 6 messages) for multi-turn context
    recent_msgs = db.query(ChatMessage).filter(ChatMessage.session_id == session.id).order_by(ChatMessage.created_at.desc()).limit(6).all()
    history_dicts = [{
        "role": m.role,
        "content": m.content,
        "action_type": m.action_type,
        "action_payload": m.action_payload or {},
        "citations": m.citations or []
    } for m in reversed(recent_msgs)]

    # Record User Message
    user_msg = ChatMessage(
        session_id=session.id,
        role="user",
        content=payload.query
    )
    db.add(user_msg)
    db.flush()

    # Load dataframes and schemas for analysis
    tables = db.query(TableMetadata).filter(TableMetadata.dataset_id == dataset_id).all()
    dataframes: dict[str, pd.DataFrame] = {}
    table_schemas: List[Dict[str, Any]] = []
    for t in tables:
        try:
            dfs = FileProcessor.read_file_to_dataframes(t.storage_path)
            if t.table_name in dfs:
                dataframes[t.table_name] = dfs[t.table_name]
            elif dfs:
                dataframes[t.table_name] = list(dfs.values())[0]
        except Exception:
            pass

        t_cols = []
        for c in (t.columns or []):
            t_cols.append({
                "name": c.column_name,
                "data_type": c.data_type,
                "missing_count": c.missing_count,
                "missing_pct": c.missing_percentage,
                "unique_count": c.unique_count,
                "is_identifier": c.is_identifier,
                "statistics": c.statistics or {},
                "sample_values": c.sample_values or []
            })
        table_schemas.append({
            "table_name": t.table_name,
            "row_count": t.row_count,
            "columns": t_cols
        })

    # Load KPIs for context
    kpis = db.query(KpiMetric).filter(KpiMetric.dataset_id == dataset_id).all()
    kpi_dicts = [{"name": k.name, "display_name": k.display_name, "formatted_value": k.formatted_value, "value": k.value} for k in kpis]

    # Load relationships for multi-table queries
    relationships = db.query(TableRelationship).filter(TableRelationship.dataset_id == dataset_id).all()
    rel_dicts = [{
        "from_table": r.source_table,
        "from_column": r.source_column,
        "to_table": r.target_table,
        "to_column": r.target_column,
        "relationship_type": r.relationship_type
    } for r in relationships]

    # Load dashboard sheets and charts from database
    dashboard_sheets = db.query(DashboardSheet).filter(DashboardSheet.dataset_id == dataset_id).order_by(DashboardSheet.order_index).all()
    sheets_info = []
    for s in dashboard_sheets:
        charts_info = []
        for c in (s.charts or []):
            chart_data = getattr(c, "data", None) or (c.config.get("data") if isinstance(getattr(c, "config", None), dict) else [])
            charts_info.append({
                "id": c.id,
                "title": c.title,
                "chart_type": c.chart_type,
                "x_field": c.x_field,
                "y_field": c.y_field,
                "aggregation": c.aggregation,
                "data": chart_data[:15] if isinstance(chart_data, list) else []
            })
        sheets_info.append({
            "id": s.id,
            "title": s.title,
            "sheet_type": s.sheet_type,
            "is_default": s.is_default,
            "chart_count": len(s.charts or []),
            "charts": charts_info
        })

    # Parse client dashboard context
    client_ctx = payload.dashboard_context
    if isinstance(client_ctx, str):
        try:
            client_ctx = json.loads(client_ctx)
        except Exception:
            client_ctx = {"raw": client_ctx}
    elif not isinstance(client_ctx, dict):
        client_ctx = {}

    dataset_env = {
        "id": ds.id,
        "name": ds.name,
        "domain": ds.detected_domain,
        "row_count": ds.row_count,
        "health_score": ds.data_health_score,
        "tables": table_schemas,
        "relationships": rel_dicts,
        "kpis": kpi_dicts
    }

    dashboard_env = {
        "sheets": sheets_info,
        "active_sheet_id": payload.active_sheet_id or client_ctx.get("activeSheetId"),
        "client_context": client_ctx
    }

    # Process query with ChatAgent
    result = await ChatAgent.process_user_query(
        query=payload.query,
        dataframes=dataframes,
        domain=ds.detected_domain,
        kpis=kpi_dicts,
        relationships=relationships,
        conversation_history=history_dicts,
        dataset_env=dataset_env,
        dashboard_env=dashboard_env
    )

    # If action execution is needed on server-side:
    action_type = result.get("action_type")
    action_payload = result.get("action_payload", {})

    if action_type == "CREATE_CHART":
        # Find active sheet or default sheet
        sheet_id = payload.active_sheet_id
        if not sheet_id:
            first_sheet = db.query(DashboardSheet).filter(DashboardSheet.dataset_id == dataset_id).order_by(DashboardSheet.order_index).first()
            if first_sheet:
                sheet_id = first_sheet.id

        if sheet_id:
            count = db.query(DashboardChart).filter(DashboardChart.sheet_id == sheet_id).count()
            new_chart = DashboardChart(
                sheet_id=sheet_id,
                title=action_payload.get("title", "Generated Chart"),
                chart_type=action_payload.get("chart_type", "bar"),
                table_name=action_payload.get("table_name", list(dataframes.keys())[0] if dataframes else "data"),
                x_field=action_payload.get("x_field"),
                y_field=action_payload.get("y_field"),
                aggregation=action_payload.get("aggregation", "sum"),
                grid_w=action_payload.get("grid_w", 6),
                grid_h=action_payload.get("grid_h", 4),
                order_index=count
            )
            db.add(new_chart)
            db.flush()
            action_payload["chart_id"] = new_chart.id

    elif action_type == "CREATE_SHEET":
        count = db.query(DashboardSheet).filter(DashboardSheet.dataset_id == dataset_id).count()
        new_sheet = DashboardSheet(
            dataset_id=dataset_id,
            title=action_payload.get("title", "New Analysis"),
            sheet_type=action_payload.get("sheet_type", "custom"),
            order_index=count,
            is_default=False
        )
        db.add(new_sheet)
        db.flush()
        action_payload["sheet_id"] = new_sheet.id

    elif action_type == "ADD_TO_REPORT":
        report_doc = db.query(ReportDocument).filter(ReportDocument.dataset_id == dataset_id).first()
        if report_doc:
            order = db.query(ReportSection).filter(ReportSection.report_id == report_doc.id).count()
            sec = ReportSection(
                report_id=report_doc.id,
                section_type=action_payload.get("section_type", "custom"),
                title=action_payload.get("section_title", "Analytical Finding"),
                content=action_payload.get("content", ""),
                order_index=order
            )
            db.add(sec)
            db.flush()
            action_payload["section_id"] = sec.id

    # Record Assistant Message
    asst_msg = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=result["content"],
        action_type=action_type,
        action_payload=action_payload,
        citations=result.get("citations", []),
        calculation_steps=result.get("calculation_steps", [])
    )
    db.add(asst_msg)
    db.commit()
    db.refresh(asst_msg)

    return asst_msg


@router.post("/{dataset_id}/pin-chart")
def pin_chart_to_dashboard(
    dataset_id: str,
    payload: PinChartRequest,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if ds.user_id and (not user or ds.user_id != user.id):
        raise HTTPException(status_code=404, detail="Dataset not found or access denied")

    sheet_id = payload.sheet_id
    if not sheet_id:
        first_sheet = db.query(DashboardSheet).filter(DashboardSheet.dataset_id == dataset_id).order_by(DashboardSheet.order_index).first()
        if first_sheet:
            sheet_id = first_sheet.id
        else:
            first_sheet = DashboardSheet(
                dataset_id=dataset_id,
                title="Main Analysis",
                sheet_type="executive",
                order_index=0,
                is_default=True
            )
            db.add(first_sheet)
            db.flush()
            sheet_id = first_sheet.id

    chart_info = payload.chart or {}
    count = db.query(DashboardChart).filter(DashboardChart.sheet_id == sheet_id).count()
    new_chart = DashboardChart(
        sheet_id=sheet_id,
        title=chart_info.get("title", "Pinned Chart"),
        chart_type=chart_info.get("chart_type", "bar"),
        table_name=chart_info.get("table_name", "data"),
        x_field=chart_info.get("x_field"),
        y_field=chart_info.get("y_field"),
        aggregation=chart_info.get("aggregation", "sum"),
        grid_w=chart_info.get("grid_w", 6),
        grid_h=chart_info.get("grid_h", 4),
        order_index=count
    )
    db.add(new_chart)
    db.commit()
    db.refresh(new_chart)

    return {
        "status": "success",
        "chart_id": new_chart.id,
        "sheet_id": sheet_id,
        "title": new_chart.title
    }
