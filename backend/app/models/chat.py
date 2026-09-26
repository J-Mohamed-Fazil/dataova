import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.database import Base, utc_now

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), default="New Analysis Conversation")
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    dataset = relationship("Dataset", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    action_type = Column(String(100), nullable=True)  # CREATE_CHART, EDIT_CHART, DELETE_CHART, ADD_FILTER, CREATE_SHEET, ADD_TO_REPORT
    action_payload = Column(JSON, default=dict)
    citations = Column(JSON, default=list)            # Source tables/columns referenced
    calculation_steps = Column(JSON, default=list)    # Deterministic calculation proof
    created_at = Column(DateTime, default=utc_now)

    session = relationship("ChatSession", back_populates="messages")
