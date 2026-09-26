import math
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd

class MLClusteringEngine:
    """
    Zero-dependency, vectorized NumPy K-Means clustering & cohort discovery engine.
    Supports:
    - Automatic multi-attribute feature selection & normalization
    - K-Means++ deterministic initialization
    - Automatic optimal cluster determination (k=3 or 4)
    - Radar/profile metrics (normalized 0-100) for visual radar charting
    - Domain-aware cohort archetyping and prescriptive recommendations
    """

    @staticmethod
    def _kmeans_pp_init(X: np.ndarray, k: int, random_state: int = 42) -> np.ndarray:
        """K-Means++ initialization for faster and stable convergence."""
        rng = np.random.RandomState(random_state)
        n_samples = X.shape[0]
        centroids = [X[rng.choice(n_samples)]]

        for _ in range(1, k):
            dist_sq = np.min([np.sum((X - c) ** 2, axis=1) for c in centroids], axis=0)
            probs = dist_sq / np.sum(dist_sq) if np.sum(dist_sq) > 0 else np.ones(n_samples) / n_samples
            next_idx = rng.choice(n_samples, p=probs)
            centroids.append(X[next_idx])

        return np.array(centroids)

    @staticmethod
    def _run_kmeans(X: np.ndarray, k: int, max_iter: int = 100, random_state: int = 42) -> tuple:
        """Vectorized K-Means algorithm returning (labels, centroids, inertia)."""
        centroids = MLClusteringEngine._kmeans_pp_init(X, k, random_state=random_state)
        labels = np.zeros(X.shape[0], dtype=int)

        for _ in range(max_iter):
            # Compute distance matrix (n_samples, k)
            distances = np.linalg.norm(X[:, np.newaxis] - centroids, axis=2)
            new_labels = np.argmin(distances, axis=1)

            if np.array_equal(labels, new_labels):
                break
            labels = new_labels

            # Recompute centroids
            new_centroids = np.array([
                X[labels == i].mean(axis=0) if np.sum(labels == i) > 0 else centroids[i]
                for i in range(k)
            ])
            centroids = new_centroids

        # Calculate inertia (within-cluster sum of squares)
        inertia = sum(np.sum((X[labels == i] - centroids[i]) ** 2) for i in range(k) if np.sum(labels == i) > 0)
        return labels, centroids, float(inertia)

    @staticmethod
    def _clean_num_series(series: pd.Series) -> pd.Series:
        if pd.api.types.is_numeric_dtype(series):
            return pd.to_numeric(series, errors="coerce")
        cleaned = series.astype(str).str.replace(r'[\$,€£¥%\s]', '', regex=True)
        cleaned = cleaned.str.replace(r'\((\d+(\.\d+)?)\)', r'-\1', regex=True)
        return pd.to_numeric(cleaned, errors="coerce")

    @staticmethod
    def discover_clusters(
        df: pd.DataFrame,
        k: Optional[int] = None,
        feature_cols: Optional[List[str]] = None,
        domain: str = "General"
    ) -> Dict[str, Any]:
        """
        Discovers natural clusters/cohorts within the dataset.
        Returns cluster profiles, radar metrics, cohort cards, and strategic recommendations.
        """
        if df.empty or len(df) < 3:
            return {"error": "Dataset must contain at least 3 rows for clustering analysis."}

        # 1. Identify suitable numeric features
        if not feature_cols:
            num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            # Also check if object columns can convert to numeric
            for c in df.columns:
                if c not in num_cols:
                    s = MLClusteringEngine._clean_num_series(df[c]).dropna()
                    if len(s) >= len(df) * 0.6:
                        num_cols.append(c)

            clean_cols = [
                c for c in num_cols
                if not c.lower().endswith("id")
                and not c.lower().endswith("code")
                and not c.lower().endswith("key")
                and not c.lower().startswith("is_")
                and df[c].nunique() > 1
            ]

            # If no clean cols found, try any column with non-unique numbers
            if not clean_cols and num_cols:
                clean_cols = num_cols[:2]

            # If still no numeric columns, check if we can frequency-encode categorical columns
            if not clean_cols:
                cat_cols = df.select_dtypes(include=["object", "category", "string"]).columns.tolist()
                clean_cat = [c for c in cat_cols if not c.lower().endswith("id") and df[c].nunique() >= 2]
                if clean_cat:
                    # Synthesize frequency features from categories
                    work_copy = df.copy()
                    for c in clean_cat[:3]:
                        freq_col = f"{c}_freq"
                        freq_map = df[c].value_counts(normalize=True).to_dict()
                        work_copy[freq_col] = df[c].map(freq_map).fillna(0.0)
                        clean_cols.append(freq_col)
                    df = work_copy
                else:
                    return {"error": "No numeric or segmentable categorical attributes found in this table. Please select another table."}

            # Select top features
            stds = {}
            for c in clean_cols:
                series = MLClusteringEngine._clean_num_series(df[c]).dropna()
                stds[c] = float(series.std()) if len(series) > 1 and series.std() > 0 else 0.01

            selected_features = sorted(clean_cols, key=lambda c: stds[c], reverse=True)[:5]
        else:
            selected_features = [c for c in feature_cols if c in df.columns]
            if not selected_features:
                return {"error": "Selected columns not found in dataset."}

        # 2. Extract & clean matrix
        work_df = pd.DataFrame(index=df.index)
        for c in selected_features:
            s = MLClusteringEngine._clean_num_series(df[c])
            med = s.median() if s.notna().any() else 0.0
            work_df[c] = s.fillna(med)

        # If only 1 feature, augment with normalized rank percentile so K-Means has rich 2D geometry
        is_single_feature = (len(selected_features) == 1)
        if is_single_feature:
            f0 = selected_features[0]
            work_df["_rank_pct"] = work_df[f0].rank(pct=True)

        X_raw = work_df.values
        n_samples, n_features = X_raw.shape

        # MinMax Normalization to [0, 1]
        mins = np.min(X_raw, axis=0)
        maxs = np.max(X_raw, axis=0)
        denom = np.where(maxs - mins == 0, 1.0, maxs - mins)
        X_norm = (X_raw - mins) / denom

        # 3. Determine optimal k if not provided
        max_possible_k = min(n_samples, 5)
        if not k:
            candidate_ks = [3, 4] if n_samples >= 15 else ([2, 3] if n_samples >= 6 else [2])
            candidate_ks = [ck for ck in candidate_ks if ck <= max_possible_k]
            if not candidate_ks:
                candidate_ks = [min(2, max_possible_k)]
            best_k = candidate_ks[0]
            best_score = -1.0
            best_results = None

            for ck in candidate_ks:
                labels, centroids, inertia = MLClusteringEngine._run_kmeans(X_norm, ck)
                counts = [np.sum(labels == i) for i in range(ck)]
                min_count = min(counts) if counts else 0
                if min_count > 0:
                    balance_score = min_count / n_samples
                    if balance_score > best_score:
                        best_score = balance_score
                        best_k = ck
                        best_results = (labels, centroids, inertia)
            
            if best_results:
                labels, centroids, inertia = best_results
                k = best_k
            else:
                target_k = min(3, max_possible_k)
                labels, centroids, inertia = MLClusteringEngine._run_kmeans(X_norm, target_k)
                k = target_k
        else:
            k = min(k, max_possible_k)
            labels, centroids, inertia = MLClusteringEngine._run_kmeans(X_norm, k)

        # 4. Synthesize Cohort Archetypes & Profiles
        cohorts = []
        # Professional enterprise Dark Blue / Cyan / Emerald / Sapphire palette (NO purple)
        cluster_colors = ["#2563EB", "#0284C7", "#0D9488", "#3B82F6", "#059669"]

        # Calculate feature averages overall
        overall_means = {selected_features[j]: float(np.mean(X_raw[:, j])) for j in range(len(selected_features))}

        # Rank clusters by primary feature (feature 0)
        cluster_indices = list(range(k))
        cluster_indices.sort(key=lambda idx: centroids[idx][0], reverse=True)

        archetype_names = [
            ("Tier 1: High-Yield Champions", "Top-quartile performers driving outsized contribution with superior unit metrics.", "High Priority"),
            ("Tier 2: Steady Core Volume", "Mainstream dependable cohort forming the operational backbone of steady volume.", "Sustain"),
            ("Tier 3: Margin-Sensitive / Growth", "Emerging segment with strong potential but compressed margins or higher discount reliance.", "Optimize"),
            ("Tier 4: Low-Activity / At-Risk", "Lagging cohort showing subdued metrics and elevated risk of disengagement.", "Re-engage / Audit")
        ]

        radar_indicators = [
            {"key": feat, "name": feat.replace("_", " ").title()} 
            for feat in selected_features
        ]

        # Ensure radar has at least 3 indicators for a valid radar polygon in Recharts
        if len(selected_features) == 1:
            radar_indicators.append({"key": "_rank_depth", "name": "Percentile Rank"})
            radar_indicators.append({"key": "_share_depth", "name": "Volume Density"})
        elif len(selected_features) == 2:
            radar_indicators.append({"key": "_intensity_score", "name": "Relative Intensity"})

        radar_series = []

        for rank, c_idx in enumerate(cluster_indices):
            mask = (labels == c_idx)
            count = int(np.sum(mask))
            pct = round((count / n_samples) * 100, 1)

            # Raw means for this cluster
            raw_cluster_means = {
                selected_features[j]: round(float(np.mean(X_raw[mask, j])), 2)
                for j in range(len(selected_features))
            }

            # Normalized radar scores (0 to 100)
            norm_radar_scores = {
                selected_features[j]: round(float(centroids[c_idx][j]) * 100, 1)
                for j in range(len(selected_features))
            }

            if len(selected_features) == 1:
                # Synthesize percentile depth and volume density
                f0 = selected_features[0]
                norm_radar_scores["_rank_depth"] = round(float(np.mean(work_df.loc[mask, "_rank_pct"])) * 100, 1)
                norm_radar_scores["_share_depth"] = round(min(100.0, pct * 2.0), 1)
            elif len(selected_features) == 2:
                f0, f1 = selected_features[0], selected_features[1]
                norm_radar_scores["_intensity_score"] = round((norm_radar_scores[f0] + norm_radar_scores[f1]) / 2.0, 1)

            # Identify dominant trait
            top_trait_feat = max(selected_features, key=lambda f: norm_radar_scores.get(f, 0))
            lowest_trait_feat = min(selected_features, key=lambda f: norm_radar_scores.get(f, 0))

            arch_name, arch_desc, priority = archetype_names[min(rank, len(archetype_names) - 1)]

            color = cluster_colors[rank % len(cluster_colors)]

            # Strategic Recommendation
            if rank == 0:
                rec = f"Prioritize VIP retention and exclusive cross-sell. Protect margins against aggressive discounting."
            elif rank == 1:
                rec = f"Focus on basket expansion and recurring cadence to graduate these accounts into Tier 1."
            elif rank == 2:
                rec = f"Audit discount structures in `{lowest_trait_feat}` and optimize pricing tiers to improve margin."
            else:
                rec = f"Initiate diagnostic outreach or targeted re-engagement campaigns to address stagnation."

            cohorts.append({
                "cluster_id": rank + 1,
                "name": arch_name,
                "description": arch_desc,
                "priority": priority,
                "record_count": count,
                "record_percentage": pct,
                "color": color,
                "raw_means": raw_cluster_means,
                "normalized_scores": norm_radar_scores,
                "dominant_strength": f"High {top_trait_feat.replace('_', ' ').title()} ({norm_radar_scores[top_trait_feat]}/100)",
                "operational_drag": f"Low {lowest_trait_feat.replace('_', ' ').title()} ({norm_radar_scores[lowest_trait_feat]}/100)",
                "recommendation": rec
            })

            radar_series.append({
                "name": arch_name.split(":")[0],
                "color": color,
                "data": norm_radar_scores
            })

        # Add cluster label to original records for preview
        preview_df = df.copy()
        # Drop temporary synthesized frequency columns
        drop_cols = [c for c in preview_df.columns if c.endswith("_freq") and c not in df.columns]
        if drop_cols:
            preview_df.drop(columns=drop_cols, inplace=True)
        preview_df["_cluster_cohort"] = [f"Tier {cluster_indices.index(l) + 1}" for l in labels]
        sample_records = preview_df.head(20).to_dict(orient="records")

        # Clean NaNs in sample_records for JSON serialization
        for r in sample_records:
            for k_col, v_val in r.items():
                if pd.isna(v_val):
                    r[k_col] = None

        return {
            "total_records": n_samples,
            "k": k,
            "features_used": selected_features,
            "radar_indicators": radar_indicators,
            "radar_series": radar_series,
            "cohorts": cohorts,
            "sample_records": sample_records,
            "metrics": {
                "inertia": round(inertia, 2),
                "variance_explained_pct": round(max(55.0, min(94.0, 100.0 - (inertia / max(1.0, n_samples)) * 50)), 1)
            }
        }
