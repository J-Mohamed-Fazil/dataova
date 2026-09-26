import os
import shutil
from pathlib import Path
from typing import List, Dict, Any, Tuple
import pandas as pd
from app.config import settings

class FileProcessor:
    SUPPORTED_EXTENSIONS = {".csv", ".tsv", ".xlsx", ".xls"}

    @staticmethod
    def validate_file(filename: str, file_size_bytes: int) -> Tuple[bool, str]:
        ext = Path(filename).suffix.lower()
        if ext not in FileProcessor.SUPPORTED_EXTENSIONS:
            return False, f"Unsupported file extension '{ext}'. Allowed: CSV, TSV, XLSX, XLS"
        
        max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
        if file_size_bytes > max_bytes:
            return False, f"File size exceeds maximum limit of {settings.MAX_FILE_SIZE_MB}MB."
            
        return True, ""

    @staticmethod
    def save_upload(file_obj, dataset_id: str, filename: str) -> str:
        dataset_dir = settings.UPLOAD_DIR / dataset_id
        dataset_dir.mkdir(parents=True, exist_ok=True)
        
        # Sanitize filename
        safe_name = "".join(c for c in filename if c.isalnum() or c in "._- ")
        target_path = dataset_dir / safe_name
        
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file_obj, buffer)
            
        return str(target_path)

    @staticmethod
    def read_file_to_dataframes(file_path: str) -> Dict[str, pd.DataFrame]:
        path = Path(file_path)
        ext = path.suffix.lower()
        result: Dict[str, pd.DataFrame] = {}

        if ext in [".csv", ".tsv"]:
            sep = "\t" if ext == ".tsv" else ","
            # Try utf-8 first, then fallback to latin1 / cp1252
            encodings = ["utf-8", "latin1", "cp1252", "iso-8859-1"]
            df = None
            for enc in encodings:
                try:
                    df = pd.read_csv(file_path, sep=sep, encoding=enc, low_memory=False)
                    break
                except (UnicodeDecodeError, Exception):
                    continue
            
            if df is None:
                raise ValueError(f"Could not parse file {path.name} with standard encodings.")
            
            # Clean column names (strip whitespace)
            df.columns = [str(c).strip() for c in df.columns]
            table_name = path.stem
            result[table_name] = df

        elif ext in [".xlsx", ".xls"]:
            excel_file = pd.ExcelFile(file_path)
            for sheet_name in excel_file.sheet_names:
                try:
                    df = pd.read_excel(excel_file, sheet_name=sheet_name)
                    df.columns = [str(c).strip() for c in df.columns]
                    # Table name: if multiple sheets, include sheet name
                    table_name = f"{path.stem}_{sheet_name}" if len(excel_file.sheet_names) > 1 else path.stem
                    result[table_name] = df
                except Exception as e:
                    continue

        if not result:
            raise ValueError(f"No usable tabular data found in {path.name}")

        return result
