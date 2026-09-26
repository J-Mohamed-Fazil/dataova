from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.schemas.dataset import DatasetSchema
from app.routers.datasets import upload_dataset
from app.models.dataset import Dataset
from app.models.user import User
from app.routers.auth import get_optional_user

router = APIRouter(prefix="/samples", tags=["samples"])

SAMPLES_META = [
    {
        "key": "retail",
        "name": "Global Retail & E-Commerce Sales",
        "domain": "Retail & E-Commerce",
        "filename": "retail_sales.csv",
        "description": "Transactional sales records featuring products, regional categories, discounts, quantities, and net revenue.",
        "icon": "ShoppingCart",
        "rows": 30,
        "cols": 10
    },
    {
        "key": "hr",
        "name": "Corporate Workforce & Attrition",
        "domain": "Human Resources",
        "filename": "hr_workforce.csv",
        "description": "Departmental personnel data detailing salary levels, performance scores, attrition status, and remote work ratios.",
        "icon": "Users",
        "rows": 25,
        "cols": 9
    },
    {
        "key": "banking",
        "name": "Commercial Banking Transactions",
        "domain": "Banking & Finance",
        "filename": "banking_transactions.csv",
        "description": "Financial debit and credit activity monitoring account balances, transaction channels, and fraud indicators.",
        "icon": "Landmark",
        "rows": 20,
        "cols": 8
    },
    {
        "key": "education",
        "name": "Academic Student Performance",
        "domain": "Education & Academics",
        "filename": "student_performance.csv",
        "description": "Student cohort examination scores across STEM and humanities subjects with attendance and remedial assistance tracking.",
        "icon": "GraduationCap",
        "rows": 20,
        "cols": 8
    },
    {
        "key": "multi_retail",
        "name": "Multi-Table Relational Store (Orders, Customers & Products)",
        "domain": "Retail & E-Commerce",
        "filenames": ["relational_orders.csv", "relational_customers.csv", "relational_products.csv"],
        "description": "Cross-table relational ecosystem: Orders linked to Customers (Customer_ID) and Products (Product_ID) enabling 2-table and 3-table unified dashboards and charts.",
        "icon": "GitBranch",
        "rows": 27,
        "cols": 18
    }
]

@router.get("", response_model=List[Dict[str, Any]])
def list_samples(
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Lists available demo datasets, annotated with whether the active user has already loaded each."""
    user_loaded: Dict[str, str] = {}
    if user:
        # Map demo dataset names to their active dataset ID for this user
        rows = db.query(Dataset.name, Dataset.id).filter(
            Dataset.user_id == user.id,
            Dataset.status == "ready"
        ).all()
        user_loaded = {r[0]: r[1] for r in rows}

    results = []
    for s in SAMPLES_META:
        item = dict(s)
        expected_name = s["name"] + " [DEMO DATA]"
        item["already_loaded"] = expected_name in user_loaded
        item["dataset_id"] = user_loaded.get(expected_name)
        results.append(item)
    return results

@router.post("/{sample_key}/load", response_model=DatasetSchema)
async def load_sample(
    sample_key: str,
    force_reload: bool = False,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user)
):
    """Loads a demo sample into the active user's workspace, reusing existing ready dataset if already loaded."""
    key_clean = sample_key.strip().lower()
    meta = next((s for s in SAMPLES_META if s["key"].lower() == key_clean), None)
    if not meta:
        raise HTTPException(status_code=404, detail="Sample dataset key not found")

    demo_dataset_name = meta["name"] + " [DEMO DATA]"

    # If already loaded and ready in user's workspace, reuse immediately to prevent duplicate clutter
    if not force_reload and user:
        existing = db.query(Dataset).filter(
            Dataset.user_id == user.id,
            Dataset.name == demo_dataset_name,
            Dataset.status == "ready"
        ).first()
        if existing:
            return existing

    import io
    filenames = meta.get("filenames", [meta.get("filename")])
    upload_files: List[UploadFile] = []

    for fn in filenames:
        file_path = settings.SAMPLES_DIR / fn
        if not file_path.exists():
            raise HTTPException(status_code=500, detail=f"Sample file {fn} missing from server")

        with open(file_path, "rb") as f:
            file_bytes = f.read()

        upload_files.append(
            UploadFile(
                file=io.BytesIO(file_bytes),
                filename=fn,
                size=len(file_bytes),
                headers={"content-type": "text/csv"}
            )
        )

    dataset = await upload_dataset(
        files=upload_files,
        dataset_name=demo_dataset_name,
        db=db,
        user=user
    )

    return dataset
