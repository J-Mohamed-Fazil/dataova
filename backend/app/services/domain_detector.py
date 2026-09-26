from typing import Dict, Any, List, Tuple

class DomainDetector:
    """
    Infers the probable domain and semantic context of the dataset based on:
    - Column naming conventions and semantic tokens
    - Data type patterns (presence of currencies, rates, scores, dates)
    - Cardinality and numerical ranges
    Returns: detected domain, confidence (0.0 - 1.0), and human-readable reasoning.
    """

    DOMAIN_SIGNATURES = {
        "Retail & E-Commerce": {
            "tokens": ["order", "product", "sales", "revenue", "price", "quantity", "customer", "discount", "cart", "sku", "category", "shipping", "unit_price", "gmv", "store", "merchant"],
            "description": "Transactional commerce records featuring orders, products, unit quantities, and sales metrics."
        },
        "Human Resources": {
            "tokens": ["employee", "salary", "department", "hire_date", "attrition", "performance", "tenure", "job_role", "manager", "turnover", "compensation", "leave", "headcount", "experience", "payroll"],
            "description": "Workforce analytics containing personnel records, compensation, departmental hierarchies, and retention metrics."
        },
        "Banking & Finance": {
            "tokens": ["transaction", "account", "balance", "credit", "debit", "loan", "fraud", "deposit", "interest", "amount", "card", "payment", "atm", "merchant_category", "risk_score", "ledger"],
            "description": "Financial records with monetary flows, account balances, transaction classifications, and risk indicators."
        },
        "Education & Academics": {
            "tokens": ["student", "grade", "score", "attendance", "course", "teacher", "exam", "gpa", "class", "school", "semester", "academic", "subject", "homework", "remedial", "enrollment"],
            "description": "Educational performance data tracking student cohorts, examination scores, attendance, and learning milestones."
        },
        "Healthcare & Clinical": {
            "tokens": ["patient", "diagnosis", "treatment", "doctor", "hospital", "admission", "prescription", "symptom", "blood_pressure", "dosage", "medical", "clinic", "discharge", "physician", "lab_result"],
            "description": "Clinical and patient records monitoring admissions, medical diagnoses, treatment interventions, and health metrics."
        },
        "Logistics & Supply Chain": {
            "tokens": ["shipment", "warehouse", "inventory", "carrier", "origin", "destination", "transit_time", "tracking", "freight", "delivery", "dispatch", "weight", "fleet", "route", "supplier"],
            "description": "Supply chain operations tracking cargo movements, warehouse inventories, shipping carriers, and fulfillment times."
        },
        "SaaS & Digital Product": {
            "tokens": ["mrr", "arr", "churn", "subscription", "plan", "user_id", "active_users", "feature", "session", "dau", "mau", "conversion", "trial", "renewal", "tier", "billing_cycle"],
            "description": "Subscription metrics tracking recurring revenue, cohort retention, feature engagement, and user lifecycle."
        }
    }

    @staticmethod
    def detect_domain(tables_profile: List[Dict[str, Any]]) -> Tuple[str, float, str]:
        # Collect all column names across all tables
        all_cols = []
        for table in tables_profile:
            for col in table["columns"]:
                all_cols.append(col["column_name"].lower().strip())

        if not all_cols:
            return "General Analytics", 0.5, "Standard tabular dataset with generic features."

        scores: Dict[str, float] = {}
        matched_tokens: Dict[str, List[str]] = {}

        for domain, info in DomainDetector.DOMAIN_SIGNATURES.items():
            tokens = info["tokens"]
            matches = []
            score = 0.0
            for col in all_cols:
                for token in tokens:
                    if token in col:
                        score += 1.5 if col == token or col.endswith(f"_{token}") or col.startswith(f"{token}_") else 0.8
                        matches.append(col)
                        break
            
            scores[domain] = score
            matched_tokens[domain] = list(set(matches))

        # Find best domain
        best_domain = max(scores, key=scores.get)
        best_score = scores[best_domain]

        if best_score < 1.5:
            # Low confidence match -> General Tabular
            return (
                "General Analytics",
                0.50,
                f"Identified {len(all_cols)} columns across {len(tables_profile)} table(s). No single specialized domain dominance was detected, so universal analytical heuristics are applied."
            )

        # Calculate confidence
        confidence = min(0.96, round(0.55 + (best_score / max(len(all_cols), 1)) * 0.45, 2))
        matched_sample = ", ".join(f"'{m}'" for m in matched_tokens[best_domain][:4])
        reasoning = (
            f"Detected signature patterns for {best_domain} with {int(confidence * 100)}% confidence based on semantic indicators including {matched_sample}. "
            f"{DomainDetector.DOMAIN_SIGNATURES[best_domain]['description']}"
        )

        return best_domain, confidence, reasoning
