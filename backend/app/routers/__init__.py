from app.routers.datasets import router as datasets_router
from app.routers.analysis import router as analysis_router
from app.routers.dashboard import router as dashboard_router
from app.routers.chat import router as chat_router
from app.routers.reports import router as reports_router
from app.routers.samples import router as samples_router
from app.routers.settings import router as settings_router
from app.routers.fusion import router as fusion_router
from app.routers.model_studio import router as model_studio_router
from app.routers.auth import router as auth_router

__all__ = [
    "datasets_router",
    "analysis_router",
    "dashboard_router",
    "chat_router",
    "reports_router",
    "samples_router",
    "settings_router",
    "fusion_router",
    "model_studio_router",
    "auth_router",
]

