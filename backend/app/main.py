from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.database import init_db
from app.routers import (
    datasets_router,
    analysis_router,
    dashboard_router,
    chat_router,
    reports_router,
    samples_router,
    settings_router,
    fusion_router,
    model_studio_router,
    auth_router
)

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("datova")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing DATOVA AI Database and Schemas...")
    init_db()
    logger.info("DATOVA AI Engine Ready.")
    yield

# FastAPI App
app = FastAPI(
    title="DATOVA AI API",
    description="Universal Domain-Agnostic AI Data Analyst Engine. Upload. Ask. Discover. Decide.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for flexible development and hackathon testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error handling request {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"An internal analytical engine error occurred: {str(exc)}"}
    )

# Include Routers
app.include_router(datasets_router, prefix=settings.API_V1_STR)
app.include_router(analysis_router, prefix=settings.API_V1_STR)
app.include_router(dashboard_router, prefix=settings.API_V1_STR)
app.include_router(chat_router, prefix=settings.API_V1_STR)
app.include_router(reports_router, prefix=settings.API_V1_STR)
app.include_router(samples_router, prefix=settings.API_V1_STR)
app.include_router(settings_router, prefix=settings.API_V1_STR)
app.include_router(fusion_router, prefix=settings.API_V1_STR)
app.include_router(model_studio_router, prefix=settings.API_V1_STR)
app.include_router(auth_router, prefix=settings.API_V1_STR)

@app.get("/")
def health_check():
    return {
        "status": "online",
        "app": "DATOVA AI",
        "tagline": "Upload. Ask. Discover. Decide.",
        "version": "1.0.0",
        "llm_mode": settings.DEFAULT_LLM_PROVIDER
    }

@app.get("/api/health")
def api_health():
    return {
        "status": "healthy",
        "database": "connected",
        "storage": "writable"
    }
