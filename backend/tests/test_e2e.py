import httpx
import pytest
from fastapi.testclient import TestClient
from app.main import app

def test_full_system_integration():
    # Try connecting to live server if active, otherwise use in-process TestClient
    is_live = False
    try:
        live_probe = httpx.get('http://127.0.0.1:8000/', timeout=1.0)
        if live_probe.status_code == 200:
            is_live = True
    except Exception:
        is_live = False

    if is_live:
        client = httpx.Client(base_url='http://127.0.0.1:8000', timeout=30.0)
        print('[INFO] Testing against LIVE FastAPI server on port 8000')
    else:
        client = TestClient(app)
        print('[INFO] Testing against IN-PROCESS FastAPI TestClient')

    # 1. Health checks
    be_resp = client.get('/')
    assert be_resp.status_code == 200, f'Backend failed: {be_resp.status_code}'
    print('[PASS] Backend API healthy (HTTP 200):', be_resp.json()['app'])

    # 2. Sample Datasets
    samples_resp = client.get('/api/samples')
    assert samples_resp.status_code == 200
    samples = samples_resp.json()
    assert len(samples) >= 4
    print('[PASS] Sample datasets endpoint working, available domains:', [s['domain'] for s in samples])

    # 3. Load Sample Retail
    load_resp = client.post('/api/samples/retail/load')
    assert load_resp.status_code == 200, f'Load failed: {load_resp.text}'
    dataset = load_resp.json()
    ds_id = dataset['id']
    print(f'[PASS] Ingested sample dataset {dataset["name"]} (ID: {ds_id})')
    print(f'  - Domain: {dataset["detected_domain"]} ({int(dataset["domain_confidence"]*100)}% conf)')
    print(f'  - Health Score: {dataset["data_health_score"]}/100')
    print(f'  - Rows: {dataset["row_count"]}, Cols: {dataset["column_count"]}')

    # 4. Overview & KPIs
    overview_resp = client.get(f'/api/analysis/{ds_id}/overview')
    assert overview_resp.status_code == 200
    overview = overview_resp.json()
    print('[PASS] Discovered KPIs:', [f'{k["display_name"]}: {k["formatted_value"]}' for k in overview['kpis']])
    print('[PASS] Generated Insights count:', len(overview['insights']))

    # 5. Dashboard & Sheets
    sheets_resp = client.get(f'/api/dashboard/{ds_id}/sheets')
    assert sheets_resp.status_code == 200
    sheets = sheets_resp.json()
    print(f'[PASS] Dashboard sheets count: {len(sheets)}')
    for s in sheets:
        print(f'  Sheet "{s["title"]}": {len(s["charts"])} chart(s)')
        for c in s['charts']:
            print(f'    - Chart "{c["title"]}" ({c["chart_type"]}) with {len(c.get("data") or [])} data points')

    # 6. Table Pagination & Browsing
    table_name = dataset['tables'][0]['table_name']
    rows_resp = client.get(f'/api/datasets/{ds_id}/tables/{table_name}/rows?page=1&page_size=10')
    assert rows_resp.status_code == 200
    rows_data = rows_resp.json()
    assert rows_data['page'] == 1
    assert len(rows_data['rows']) <= 10
    print(f'[PASS] Table pagination working: {len(rows_data["rows"])} rows retrieved of {rows_data["total_rows"]}')

    # 7. Chat / Ask DATOVA Query
    chat_query_resp = client.post(f'/api/chat/{ds_id}/query', json={'query': 'Which category performs best?'})
    assert chat_query_resp.status_code == 200
    chat_res = chat_query_resp.json()
    print('[PASS] Ask DATOVA response:')
    print('  Content:', chat_res['content'][:120] + '...')

    # 8. Chat Chart Action
    chart_action_resp = client.post(f'/api/chat/{ds_id}/query', json={'query': 'Create a bar chart showing revenue by category'})
    assert chart_action_resp.status_code == 200
    action_res = chart_action_resp.json()
    print('[PASS] Ask DATOVA chart creation action:', action_res.get('action_type'))

    # 9. Report Export
    pdf_resp = client.get(f'/api/reports/{ds_id}/export/pdf')
    assert pdf_resp.status_code == 200
    assert 'application/pdf' in pdf_resp.headers['content-type']
    print(f'[PASS] PDF Export generated successfully ({len(pdf_resp.content)} bytes)')

    excel_resp = client.get(f'/api/reports/{ds_id}/export/excel')
    assert excel_resp.status_code == 200
    print(f'[PASS] Excel Export generated successfully ({len(excel_resp.content)} bytes)')

    print('\nALL END-TO-END INTEGRATION TESTS PASSED!')

if __name__ == '__main__':
    test_full_system_integration()
