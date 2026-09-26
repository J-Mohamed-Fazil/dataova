import httpx

client = httpx.Client(base_url="http://127.0.0.1:8000", timeout=30.0)
ds = client.post("/api/samples/retail/load").json()
dataset_id = ds["id"]
print(f"Loaded dataset: {dataset_id}")

presets = [
    "executive",
    "revenue_growth",
    "customer_cohort",
    "operations_risk",
    "profitability_frontier",
    "predictive_momentum"
]

for p in presets:
    res = client.post(f"/api/dashboard/{dataset_id}/ai-generate-dashboard", json={"preset": p, "mode": "replace_all"}).json()
    sheet = res[0]
    chart_types = [c["chart_type"] for c in sheet["charts"]]
    chart_titles = [c["title"] for c in sheet["charts"]]
    print(f"[{p.upper()}] -> Sheet: '{sheet['title']}'")
    print(f"  Chart Types: {chart_types}")
    print(f"  Chart Titles: {chart_titles}")
    print(f"  Business Questions Count: {len(sheet.get('business_questions', []))}")
    print("-" * 60)
