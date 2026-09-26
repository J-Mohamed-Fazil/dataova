import asyncio
from app.database import SessionLocal
from app.models import Dataset
from app.services.file_processor import FileProcessor
from app.services.cache_manager import DataFrameCache
from app.services.dashboard_generator import DashboardGenerator

def test_ai_dashboard_generator():
    db = SessionLocal()
    try:
        ds = db.query(Dataset).first()
        if not ds or not ds.tables:
            print("[SKIP] No dataset available in local database to test live generator.")
            return

        print(f"Testing AI Dashboard Generator for dataset: '{ds.name}' ({ds.id})")
        
        all_dfs = {}
        for tbl in ds.tables:
            t_df = DataFrameCache.get_table_dataframe(tbl.storage_path, tbl.table_name)
            if t_df is not None:
                all_dfs[tbl.table_name] = t_df

        print(f"Loaded {len(all_dfs)} tables into memory.")
        
        # Test preset synthesis
        sheets = DashboardGenerator.generate_ai_themed_dashboard(
            dataset_id=ds.id,
            all_dataframes=all_dfs,
            detected_rels=[],
            db=db,
            preset="executive",
            palette="cyberpunk",
            mode="add_sheet"
        )
        assert len(sheets) > 0, "Expected at least 1 sheet generated"
        print(f"[PASS] Successfully generated sheet: '{sheets[0].title}' with {len(sheets[0].charts)} charts.")
        
        # Test custom prompt synthesis
        custom_sheets = DashboardGenerator.generate_ai_themed_dashboard(
            dataset_id=ds.id,
            all_dataframes=all_dfs,
            detected_rels=[],
            db=db,
            prompt="Regional profit margins and delivery risk",
            preset="executive",
            palette="emerald",
            mode="add_sheet"
        )
        assert len(custom_sheets) > 0, "Expected custom prompt sheet generated"
        print(f"[PASS] Successfully generated custom prompt sheet: '{custom_sheets[0].title}' with {len(custom_sheets[0].charts)} charts.")

    finally:
        db.close()

if __name__ == "__main__":
    test_ai_dashboard_generator()
