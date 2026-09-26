import httpx
import time
from app.database import SessionLocal
from app.models import Dataset

db = SessionLocal()
ds = db.query(Dataset).filter(Dataset.name.like('%Global Retail%')).first()
did = ds.id
print('Testing dataset:', ds.name, did)

# 1. Test GET /sheets
t0 = time.time()
s1 = httpx.get(f'http://127.0.0.1:8000/api/dashboard/{did}/sheets', timeout=15.0)
t1 = time.time()

s2 = httpx.get(f'http://127.0.0.1:8000/api/dashboard/{did}/sheets', timeout=15.0)
t2 = time.time()

print(f'GET /sheets (first): {t1-t0:.4f}s ({len(s1.json())} sheets, status: {s1.status_code})')
print(f'GET /sheets (cached): {t2-t1:.4f}s ({len(s2.json())} sheets, status: {s2.status_code})')

# 2. Test POST /ai-agent-generate
t3 = time.time()
res = httpx.post(f'http://127.0.0.1:8000/api/dashboard/{did}/ai-agent-generate', json={'preset': 'executive', 'palette': 'cyberpunk'}, timeout=20.0)
t4 = time.time()
sheets = res.json()
print(f'POST /ai-agent-generate took: {t4-t3:.4f}s (status: {res.status_code}, total sheets: {len(sheets)})')

last = sheets[-1]
print('AI Agent Sheet Title:', last['title'])
print('Total Charts in Sheet:', len(last['charts']))
print('Executive Business Questions:', len(last.get('business_questions') or []))
for c in last['charts']:
    data_len = len(c.get('data') or [])
    agent_tag = c.get('config', {}).get('ai_agent_generated')
    print(f"  * {c['title']} [{c['chart_type']}] -> {data_len} data points (ai_agent: {agent_tag})")
