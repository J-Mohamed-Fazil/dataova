import os
import time
import threading
from pathlib import Path
from typing import Dict, Optional, Tuple
import pandas as pd
from app.services.file_processor import FileProcessor

class DataFrameCache:
    """
    High-performance in-memory DataFrame cache with mtime-based invalidation,
    LRU capacity control, and thread-safe locks to eliminate redundant disk I/O.
    """
    _MAX_ENTRIES: int = 30
    _CACHE: Dict[str, Tuple[float, float, Dict[str, pd.DataFrame]]] = {}
    _LOCK: threading.RLock = threading.RLock()
    # key: canonical file_path -> (mtime, last_accessed, dict[table_name, pd.DataFrame])

    @classmethod
    def get_dataframes(cls, file_path: str) -> Dict[str, pd.DataFrame]:
        canonical_path = str(Path(file_path).resolve())
        
        if not os.path.exists(canonical_path):
            raise FileNotFoundError(f"Data file not found at path: {canonical_path}")
            
        current_mtime = os.path.getmtime(canonical_path)
        now = time.time()

        with cls._LOCK:
            # Check if already in cache and mtime matches
            if canonical_path in cls._CACHE:
                cached_mtime, _, cached_dfs = cls._CACHE[canonical_path]
                if cached_mtime == current_mtime:
                    cls._CACHE[canonical_path] = (cached_mtime, now, cached_dfs)
                    return cached_dfs

            # Load from disk
            dfs = FileProcessor.read_file_to_dataframes(canonical_path)

            # Evict oldest entry if at capacity
            if len(cls._CACHE) >= cls._MAX_ENTRIES:
                oldest_key = min(cls._CACHE.keys(), key=lambda k: cls._CACHE[k][1])
                del cls._CACHE[oldest_key]

            cls._CACHE[canonical_path] = (current_mtime, now, dfs)
            return dfs

    @classmethod
    def get_table_dataframe(cls, file_path: str, table_name: Optional[str] = None) -> Optional[pd.DataFrame]:
        dfs = cls.get_dataframes(file_path)
        if not dfs:
            return None
        if table_name and table_name in dfs:
            return dfs[table_name]
        if table_name:
            # Case-insensitive lookup fallback
            for k, v in dfs.items():
                if k.lower() == table_name.lower():
                    return v
        # Fallback to first table
        return list(dfs.values())[0]

    @classmethod
    def get(cls, file_path: str, table_name: Optional[str] = None) -> Optional[pd.DataFrame]:
        """
        Universal retrieval interface. Safely retrieves a DataFrame for a given file and table.
        Ensures standard cache interface compatibility (.get / .set) and prevents AttributeError.
        """
        if not file_path:
            return None
        canonical_path = str(Path(file_path).resolve())
        with cls._LOCK:
            if canonical_path in cls._CACHE:
                cached_mtime, _, cached_dfs = cls._CACHE[canonical_path]
                cls._CACHE[canonical_path] = (cached_mtime, time.time(), cached_dfs)
                if table_name and table_name in cached_dfs:
                    return cached_dfs[table_name]
                if table_name:
                    for k, v in cached_dfs.items():
                        if k.lower() == table_name.lower():
                            return v
                if cached_dfs:
                    return list(cached_dfs.values())[0]

        try:
            return cls.get_table_dataframe(file_path, table_name)
        except Exception:
            return None

    @classmethod
    def set(cls, file_path: str, table_name: str, df: pd.DataFrame) -> None:
        """
        Universal storage interface. Injects or updates a DataFrame into the cache.
        Ensures standard cache interface compatibility (.get / .set).
        """
        if not file_path or df is None:
            return
        canonical_path = str(Path(file_path).resolve())
        now = time.time()
        mtime = os.path.getmtime(canonical_path) if os.path.exists(canonical_path) else now

        with cls._LOCK:
            if canonical_path in cls._CACHE:
                cached_mtime, _, cached_dfs = cls._CACHE[canonical_path]
                cached_dfs[table_name] = df
                cls._CACHE[canonical_path] = (cached_mtime, now, cached_dfs)
            else:
                if len(cls._CACHE) >= cls._MAX_ENTRIES:
                    oldest_key = min(cls._CACHE.keys(), key=lambda k: cls._CACHE[k][1])
                    del cls._CACHE[oldest_key]
                cls._CACHE[canonical_path] = (mtime, now, {table_name: df})

    @classmethod
    def invalidate(cls, file_path: Optional[str] = None) -> None:
        with cls._LOCK:
            if file_path:
                canonical = str(Path(file_path).resolve())
                cls._CACHE.pop(canonical, None)
            else:
                cls._CACHE.clear()

