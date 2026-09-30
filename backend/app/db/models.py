"""Persistent entities for Live Mode missions.

Status-like columns are plain strings validated in the application (see
`app.domain`), which keeps migrations identical on SQLite and PostgreSQL.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def new_id() -> str:
    return uuid.uuid4().hex


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "user"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Integration(Base):
    """A connected app. The token is encrypted and never serialised to clients."""

    __tablename__ = "integration"
    __table_args__ = (UniqueConstraint("user_id", "provider"),)
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(40))
    scopes: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(20), default="connected")
    account_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    encrypted_token: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class AppPermission(Base):
    """What the agent may do for one action in one app, per user: allowed | ask | off."""

    __tablename__ = "app_permission"
    __table_args__ = (UniqueConstraint("user_id", "app_id", "action_id"),)
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"), index=True)
    app_id: Mapped[str] = mapped_column(String(40))
    action_id: Mapped[str] = mapped_column(String(60))
    mode: Mapped[str] = mapped_column(String(10))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class UserPreference(Base):
    """How a user likes things done (#18). One row per user; defaults apply when absent."""

    __tablename__ = "user_preference"
    user_id: Mapped[str] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"), primary_key=True)
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    working_days: Mapped[list] = mapped_column(JSON, default=list)
    work_start: Mapped[str] = mapped_column(String(5), default="09:00")
    work_end: Mapped[str] = mapped_column(String(5), default="18:00")
    display_name: Mapped[str] = mapped_column(String(80), default="")
    signature: Mapped[str] = mapped_column(Text, default="")
    tone: Mapped[str] = mapped_column(String(10), default="Friendly")
    meeting_length: Mapped[int] = mapped_column(Integer, default=30)
    groups: Mapped[list] = mapped_column(JSON, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Agent(Base):
    __tablename__ = "agent"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    role: Mapped[str] = mapped_column(String(200))


class Tool(Base):
    """Registry metadata for a tool. Implementations live in code (Phase 4)."""

    __tablename__ = "tool"
    name: Mapped[str] = mapped_column(String(80), primary_key=True)
    capability: Mapped[str] = mapped_column(String(40), index=True)
    risk: Mapped[str] = mapped_column(String(10))
    description: Mapped[str] = mapped_column(Text, default="")
    integration: Mapped[str | None] = mapped_column(String(40), nullable=True)


class Mission(Base):
    __tablename__ = "mission"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"), index=True)
    goal: Mapped[str] = mapped_column(String(500))
    mode: Mapped[str] = mapped_column(String(10), default="live")
    status: Mapped[str] = mapped_column(String(20), default="planned")
    # How the mission was requested: typed, voice or template (see #17).
    source: Mapped[str] = mapped_column(String(10), default="typed", server_default="typed")
    template_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    plan_json: Mapped[dict] = mapped_column(JSON)
    metric_label: Mapped[str] = mapped_column(String(120))
    metric_current: Mapped[int] = mapped_column(Integer, default=0)
    metric_target: Mapped[int] = mapped_column(Integer)
    budget_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    intent: Mapped["MissionIntent"] = relationship(back_populates="mission", uselist=False, cascade="all, delete-orphan")
    tasks: Mapped[list["Task"]] = relationship(back_populates="mission", cascade="all, delete-orphan", order_by="Task.position")
    events: Mapped[list["MissionEvent"]] = relationship(back_populates="mission", cascade="all, delete-orphan", order_by="MissionEvent.seq")
    approvals: Mapped[list["Approval"]] = relationship(back_populates="mission", cascade="all, delete-orphan")


class MissionIntent(Base):
    __tablename__ = "mission_intent"
    mission_id: Mapped[str] = mapped_column(ForeignKey("mission.id", ondelete="CASCADE"), primary_key=True)
    objective: Mapped[str] = mapped_column(String(500))
    domain: Mapped[str] = mapped_column(String(40))
    desired_outcome: Mapped[str] = mapped_column(String(300))
    intent_json: Mapped[dict] = mapped_column(JSON)

    mission: Mapped[Mission] = relationship(back_populates="intent")


class Task(Base):
    __tablename__ = "task"
    __table_args__ = (UniqueConstraint("mission_id", "key"),)
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    mission_id: Mapped[str] = mapped_column(ForeignKey("mission.id", ondelete="CASCADE"), index=True)
    key: Mapped[str] = mapped_column(String(40))  # the plan's task id, e.g. "p3"
    position: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(300))
    type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    capability: Mapped[str | None] = mapped_column(String(40), nullable=True)
    agent: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    gated: Mapped[bool] = mapped_column(Boolean, default=False)
    criterion: Mapped[str | None] = mapped_column(String(300), nullable=True)
    replaced_by_key: Mapped[str | None] = mapped_column(String(40), nullable=True)
    inputs: Mapped[dict] = mapped_column(JSON, default=dict)
    output: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    mission: Mapped[Mission] = relationship(back_populates="tasks")
    dependencies: Mapped[list["TaskDependency"]] = relationship(
        foreign_keys="TaskDependency.task_id", cascade="all, delete-orphan", back_populates="task"
    )


class TaskDependency(Base):
    __tablename__ = "task_dependency"
    task_id: Mapped[str] = mapped_column(ForeignKey("task.id", ondelete="CASCADE"), primary_key=True)
    depends_on_id: Mapped[str] = mapped_column(ForeignKey("task.id", ondelete="CASCADE"), primary_key=True)

    task: Mapped[Task] = relationship(foreign_keys=[task_id], back_populates="dependencies")
    depends_on: Mapped[Task] = relationship(foreign_keys=[depends_on_id])


class AgentExecution(Base):
    __tablename__ = "agent_execution"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    mission_id: Mapped[str] = mapped_column(ForeignKey("mission.id", ondelete="CASCADE"), index=True)
    task_id: Mapped[str | None] = mapped_column(ForeignKey("task.id", ondelete="SET NULL"), nullable=True)
    agent_id: Mapped[str] = mapped_column(ForeignKey("agent.id"))
    status: Mapped[str] = mapped_column(String(20), default="running")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ToolExecution(Base):
    __tablename__ = "tool_execution"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    mission_id: Mapped[str] = mapped_column(ForeignKey("mission.id", ondelete="CASCADE"), index=True)
    task_id: Mapped[str | None] = mapped_column(ForeignKey("task.id", ondelete="SET NULL"), nullable=True)
    tool_name: Mapped[str] = mapped_column(ForeignKey("tool.name"))
    risk: Mapped[str] = mapped_column(String(10))
    input_json: Mapped[dict] = mapped_column(JSON, default=dict)  # redacted before storage
    output_json: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="running")
    error_class: Mapped[str | None] = mapped_column(String(40), nullable=True)
    attempt: Mapped[int] = mapped_column(Integer, default=1)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Approval(Base):
    __tablename__ = "approval"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    mission_id: Mapped[str] = mapped_column(ForeignKey("mission.id", ondelete="CASCADE"), index=True)
    task_id: Mapped[str | None] = mapped_column(ForeignKey("task.id", ondelete="SET NULL"), nullable=True)
    tool_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    risk: Mapped[str] = mapped_column(String(10))
    category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    reason: Mapped[str] = mapped_column(Text)
    payload_json: Mapped[dict] = mapped_column(JSON)
    original_payload_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_by: Mapped[str | None] = mapped_column(String(32), nullable=True)

    mission: Mapped[Mission] = relationship(back_populates="approvals")


class Evidence(Base):
    __tablename__ = "evidence"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    mission_id: Mapped[str] = mapped_column(ForeignKey("mission.id", ondelete="CASCADE"), index=True)
    task_id: Mapped[str | None] = mapped_column(ForeignKey("task.id", ondelete="SET NULL"), nullable=True)
    tool_execution_id: Mapped[str | None] = mapped_column(ForeignKey("tool_execution.id", ondelete="SET NULL"), nullable=True)
    type: Mapped[str] = mapped_column(String(40))
    source: Mapped[str] = mapped_column(String(80))
    reference_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    label: Mapped[str] = mapped_column(String(300))
    url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="unverified", server_default="unverified")
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    method: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class MissionEvent(Base):
    """Append-only mission log. `seq` is monotonic per mission so clients can resume."""

    __tablename__ = "mission_event"
    __table_args__ = (UniqueConstraint("mission_id", "seq"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mission_id: Mapped[str] = mapped_column(ForeignKey("mission.id", ondelete="CASCADE"), index=True)
    seq: Mapped[int] = mapped_column(Integer)
    type: Mapped[str] = mapped_column(String(40))
    agent: Mapped[str | None] = mapped_column(String(40), nullable=True)
    payload_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    mission: Mapped[Mission] = relationship(back_populates="events")


class RecoveryAttempt(Base):
    __tablename__ = "recovery_attempt"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    mission_id: Mapped[str] = mapped_column(ForeignKey("mission.id", ondelete="CASCADE"), index=True)
    task_id: Mapped[str | None] = mapped_column(ForeignKey("task.id", ondelete="SET NULL"), nullable=True)
    failure_class: Mapped[str] = mapped_column(String(40))
    diagnosis: Mapped[str] = mapped_column(Text, default="")
    strategy: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="diagnosing")
    attempt: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
