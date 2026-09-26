import sys
import traceback
from app.database import SessionLocal
from app.models import Dataset, TableMetadata
from app.services.cache_manager import DataFrameCache
from app.services.dashboard_generator import DashboardGenerator
from app.routers.dashboard import _calculate_chart_data, AIGenerateDashboardRequest, ai_generate_dashboard

def diagnose_all_datasets():
    db = SessionLocal()
    try:
        datasets = db.query(Dataset).all()
        print(f"Total datasets in database: {len(datasets)}")
        for ds in datasets:
            print(f"\n--- Diagnosing dataset: '{ds.name}' (ID: {ds.id}, domain: {ds.detected_domain}) ---")
            for t in ds.tables:
                print(f"  Table: {t.table_name}, path: {t.storage_path}, rows: {t.row_count}")
            
            payload = AIGenerateDashboardRequest(
                prompt=None,
                preset="executive",
                palette="cyberpunk",
                mode="add_sheet"
            )
            try:
                res = ai_generate_dashboard(ds.id, payload, db)
                print(f"  SUCCESS! Generated/retrieved {len(res)} sheets.")
                for s in res:
                    print(f"    Sheet: '{s.title}', charts: {len(s.charts)}")
            except Exception as e:
                print(f"  ERROR generating dashboard for '{ds.name}': {e}")
                traceback.print_exc()

    finally:
        db.close()

if __name__ == "__main__":
    diagnose_all_datasets()
