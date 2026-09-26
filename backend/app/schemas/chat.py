from datetime import datetime
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, ConfigDict

class ChatMessageSchema(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    action_type: Optional[str] = None
    action_payload: Dict[str, Any] = {}
    citations: List[Dict[str, Any]] = []
    calculation_steps: List[Dict[str, Any]] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ChatQueryRequest(BaseModel):
    query: str
    session_id: Optional[str] = None
    active_sheet_id: Optional[str] = None
    dashboard_context: Optional[Union[Dict[str, Any], str]] = None

class PinChartRequest(BaseModel):
    chart: Dict[str, Any]
    sheet_id: Optional[str] = None

class ChatSessionSchema(BaseModel):
    id: str
    dataset_id: str
    title: str
    created_at: datetime
    updated_at: datetime
    messages: List[ChatMessageSchema] = []

    model_config = ConfigDict(from_attributes=True)
