from datetime import datetime, timezone
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

def utc_now() -> datetime:
    """Returns naive UTC datetime, replacing deprecated datetime.utcnow()."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

# If using SQLite, check_same_thread=False is required for FastAPI multithreading
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False, "timeout": 15}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

# High-Performance SQLite Pragmas (WAL Mode, Cache, Busy Timeout)
if settings.DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("PRAGMA synchronous=NORMAL;")
            cursor.execute("PRAGMA busy_timeout=10000;")
            cursor.execute("PRAGMA cache_size=-64000;")
            cursor.execute("PRAGMA foreign_keys=ON;")
        except Exception:
            pass
        finally:
            cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    # Import all models to ensure they are registered with Base.metadata
    from app.models import (
        dataset,
        relationship,
        analysis,
        dashboard,
        chat,
        report,
        user
    )
    Base.metadata.create_all(bind=engine)

    # Seed default demo users for instant access
    from app.services.auth_service import AuthService
    seed_db = SessionLocal()
    try:
        AuthService.seed_default_users(seed_db)
    finally:
        seed_db.close()

    # Automated SQLite column migrations if existing database
    from sqlalchemy import text
    with engine.connect() as conn:
        for col_name in ["join_table", "primary_key", "join_key"]:
            try:
                conn.execute(text(f"ALTER TABLE dashboard_charts ADD COLUMN {col_name} VARCHAR(255)"))
                conn.commit()
            except Exception:
                pass
        try:
            conn.execute(text("ALTER TABLE dashboard_sheets ADD COLUMN business_questions JSON"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE datasets ADD COLUMN user_id VARCHAR(255)"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN user_id VARCHAR(255)"))
            conn.commit()
        except Exception:
            pass
        # Migrations for KPI metrics statistical quintet and AI insight
        for kpi_col, kpi_type in [
            ("min_value", "FLOAT"),
            ("max_value", "FLOAT"),
            ("sum_value", "FLOAT"),
            ("avg_value", "FLOAT"),
            ("count_value", "INTEGER"),
            ("formatted_min", "VARCHAR(100)"),
            ("formatted_max", "VARCHAR(100)"),
            ("formatted_sum", "VARCHAR(100)"),
            ("formatted_avg", "VARCHAR(100)"),
            ("formatted_count", "VARCHAR(100)"),
            ("ai_insight", "TEXT"),
            ("statistical_summary", "JSON"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE kpi_metrics ADD COLUMN {kpi_col} {kpi_type}"))
                conn.commit()
            except Exception:
                pass
        try:
            # Associate legacy unassigned datasets with the primary active user
            primary_user = conn.execute(text("SELECT id FROM users ORDER BY CASE WHEN email = 'admin@datanova.ai' THEN 1 WHEN email = 'demo@datanova.ai' THEN 2 ELSE 3 END, created_at ASC LIMIT 1")).fetchone()
            if primary_user:
                target_user_id = primary_user[0]
                conn.execute(
                    text("UPDATE datasets SET user_id = :uid WHERE user_id IS NULL"),
                    {"uid": target_user_id}
                )
                conn.commit()
        except Exception:
            pass
