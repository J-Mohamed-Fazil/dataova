import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    init_db()

@pytest.fixture
def client():
    return TestClient(app)

def test_login_demo_user(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "demo@datanova.ai", "password": "datanova123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "demo@datanova.ai"
    assert data["user"]["full_name"] == "Alex Chen"
    assert "Senior AI Analyst" in data["user"]["role"]

def test_login_admin_user(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@datanova.ai", "password": "admin123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["email"] == "admin@datanova.ai"
    assert data["user"]["full_name"] == "Dr. Elena Vance"

def test_login_invalid_password(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "demo@datanova.ai", "password": "incorrect_password"}
    )
    assert response.status_code == 401
    assert "Incorrect password" in response.json()["detail"]

def test_login_nonexistent_email(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "nonexistent@datanova.ai", "password": "password123"}
    )
    assert response.status_code == 404
    assert "No account found" in response.json()["detail"]

def test_register_new_user_success(client):
    import uuid
    email = f"test.analyst.{uuid.uuid4().hex[:8]}@example.com"
    response = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "strongPassword123",
            "full_name": "Test Analyst",
            "role": "Lead Data Scientist"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == email
    assert data["user"]["full_name"] == "Test Analyst"
    assert data["user"]["role"] == "Lead Data Scientist"

def test_register_duplicate_email(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "demo@datanova.ai",
            "password": "anotherpassword",
            "full_name": "Duplicate Person"
        }
    )
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]

def test_auth_me_with_valid_token(client):
    # First login to obtain token
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "demo@datanova.ai", "password": "datanova123"}
    )
    token = login_resp.json()["access_token"]

    # Call /api/auth/me
    me_resp = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["email"] == "demo@datanova.ai"
    assert me_data["full_name"] == "Alex Chen"

def test_auth_me_without_token(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401

def test_auth_me_with_invalid_token(client):
    resp = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid.token.string"}
    )
    assert resp.status_code == 401

def test_logout(client):
    resp = client.post("/api/auth/logout")
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"

def test_forgot_password_flow(client):
    # 1. Request forgot password for demo user
    resp = client.post(
        "/api/auth/forgot-password",
        json={"email": "demo@datanova.ai"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "verification_code" in data
    code = data["verification_code"]
    assert len(code) == 6

    # 2. Try reset with wrong code
    wrong_resp = client.post(
        "/api/auth/reset-password",
        json={
            "email": "demo@datanova.ai",
            "code": "999999",
            "new_password": "newSecurePassword123"
        }
    )
    assert wrong_resp.status_code == 400
    assert "Invalid or expired" in wrong_resp.json()["detail"]

    # 3. Reset with correct code
    reset_resp = client.post(
        "/api/auth/reset-password",
        json={
            "email": "demo@datanova.ai",
            "code": code,
            "new_password": "datanovaNewPassword123"
        }
    )
    assert reset_resp.status_code == 200
    assert reset_resp.json()["status"] == "success"

    # 4. Old password should fail
    old_login = client.post(
        "/api/auth/login",
        json={"email": "demo@datanova.ai", "password": "datanova123"}
    )
    assert old_login.status_code == 401

    # 5. New password should succeed
    new_login = client.post(
        "/api/auth/login",
        json={"email": "demo@datanova.ai", "password": "datanovaNewPassword123"}
    )
    assert new_login.status_code == 200

    # Reset back to default so other tests are unaffected
    code_reset = client.post("/api/auth/forgot-password", json={"email": "demo@datanova.ai"}).json()["verification_code"]
    client.post(
        "/api/auth/reset-password",
        json={"email": "demo@datanova.ai", "code": code_reset, "new_password": "datanova123"}
    )

def test_user_data_isolation(client):
    import uuid
    # Create User A
    user_a_email = f"usera.{uuid.uuid4().hex[:6]}@example.com"
    resp_a = client.post(
        "/api/auth/register",
        json={"email": user_a_email, "password": "Password123", "full_name": "User A"}
    )
    token_a = resp_a.json()["access_token"]

    # Create User B
    user_b_email = f"userb.{uuid.uuid4().hex[:6]}@example.com"
    resp_b = client.post(
        "/api/auth/register",
        json={"email": user_b_email, "password": "Password123", "full_name": "User B"}
    )
    token_b = resp_b.json()["access_token"]

    # User A loads sample dataset (which assigns user_id)
    load_resp = client.post(
        "/api/samples/retail/load",
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert load_resp.status_code == 200
    user_a_dataset_id = load_resp.json()["id"]

    # User A lists datasets -> sees their dataset
    list_a = client.get("/api/datasets", headers={"Authorization": f"Bearer {token_a}"})
    assert any(d["id"] == user_a_dataset_id for d in list_a.json())

    # User B lists datasets -> DOES NOT see User A's dataset
    list_b = client.get("/api/datasets", headers={"Authorization": f"Bearer {token_b}"})
    assert not any(d["id"] == user_a_dataset_id for d in list_b.json())

    # User B attempts to access User A's dataset -> 404
    direct_get = client.get(
        f"/api/datasets/{user_a_dataset_id}",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert direct_get.status_code == 404

    # User B attempts to get chat history for User A's dataset -> 404
    chat_get = client.get(
        f"/api/chat/{user_a_dataset_id}/history",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert chat_get.status_code == 404

def test_update_user_role_and_password(client):
    import uuid
    email = f"profile.test.{uuid.uuid4().hex[:6]}@example.com"
    reg_resp = client.post(
        "/api/auth/register",
        json={"email": email, "password": "initialPassword123", "full_name": "Original Name", "role": "Data Analyst"}
    )
    token = reg_resp.json()["access_token"]

    # 1. Update role only
    update_role_resp = client.put(
        "/api/auth/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={"role": "Student (Academic / Research)"}
    )
    assert update_role_resp.status_code == 200
    assert update_role_resp.json()["user"]["role"] == "Student (Academic / Research)"

    # 2. Update password with wrong current password -> 400
    bad_pw_resp = client.put(
        "/api/auth/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "wrongOldPassword", "new_password": "newSecurePassword456"}
    )
    assert bad_pw_resp.status_code == 400
    assert "Current password does not match" in bad_pw_resp.json()["detail"]

    # 3. Update password with correct current password and update full_name and role
    success_pw_resp = client.put(
        "/api/auth/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "full_name": "Updated Lead Analyst",
            "role": "Lead Data Scientist",
            "current_password": "initialPassword123",
            "new_password": "newSecurePassword456"
        }
    )
    assert success_pw_resp.status_code == 200
    data = success_pw_resp.json()
    assert data["user"]["full_name"] == "Updated Lead Analyst"
    assert data["user"]["role"] == "Lead Data Scientist"

    # 4. Try logging in with old password -> 401
    old_login = client.post("/api/auth/login", json={"email": email, "password": "initialPassword123"})
    assert old_login.status_code == 401

    # 5. Try logging in with new password -> 200
    new_login = client.post("/api/auth/login", json={"email": email, "password": "newSecurePassword456"})
    assert new_login.status_code == 200
    assert new_login.json()["user"]["role"] == "Lead Data Scientist"

def test_unauthenticated_list_datasets_returns_empty(client):
    """Ensure that callers without a valid Bearer token never receive dataset records."""
    unauth_resp = client.get("/api/datasets")
    assert unauth_resp.status_code == 200
    assert unauth_resp.json() == []

def test_dataset_search_isolation_by_user(client):
    """Ensure search queries return only datasets belonging to the querying user and never leak other users' datasets."""
    import uuid
    # Create User Alpha
    email_alpha = f"user.alpha.{uuid.uuid4().hex[:6]}@example.com"
    resp_alpha = client.post("/api/auth/register", json={"email": email_alpha, "password": "Password123", "full_name": "User Alpha"})
    token_alpha = resp_alpha.json()["access_token"]

    # Create User Beta
    email_beta = f"user.beta.{uuid.uuid4().hex[:6]}@example.com"
    resp_beta = client.post("/api/auth/register", json={"email": email_beta, "password": "Password123", "full_name": "User Beta"})
    token_beta = resp_beta.json()["access_token"]

    # User Alpha loads Retail sample
    load_alpha = client.post("/api/samples/retail/load", headers={"Authorization": f"Bearer {token_alpha}"})
    assert load_alpha.status_code == 200
    alpha_ds_id = load_alpha.json()["id"]

    # User Beta loads HR sample
    load_beta = client.post("/api/samples/hr/load", headers={"Authorization": f"Bearer {token_beta}"})
    assert load_beta.status_code == 200
    beta_ds_id = load_beta.json()["id"]

    # User Alpha searches for 'Retail' -> sees their dataset
    search_alpha_retail = client.get("/api/datasets?search=Retail", headers={"Authorization": f"Bearer {token_alpha}"})
    assert search_alpha_retail.status_code == 200
    assert any(d["id"] == alpha_ds_id for d in search_alpha_retail.json())
    assert not any(d["id"] == beta_ds_id for d in search_alpha_retail.json())

    # User Alpha searches for 'Workforce' -> returns [] (does NOT see Beta's HR dataset)
    search_alpha_hr = client.get("/api/datasets?search=Workforce", headers={"Authorization": f"Bearer {token_alpha}"})
    assert search_alpha_hr.status_code == 200
    assert search_alpha_hr.json() == []

    # User Beta searches for 'Retail' -> returns [] (does NOT see Alpha's Retail dataset)
    search_beta_retail = client.get("/api/datasets?search=Retail", headers={"Authorization": f"Bearer {token_beta}"})
    assert search_beta_retail.status_code == 200
    assert search_beta_retail.json() == []

    # User Beta searches for 'Workforce' -> sees their HR dataset
    search_beta_hr = client.get("/api/datasets?search=Workforce", headers={"Authorization": f"Bearer {token_beta}"})
    assert search_beta_hr.status_code == 200
    assert any(d["id"] == beta_ds_id for d in search_beta_hr.json())
    assert not any(d["id"] == alpha_ds_id for d in search_beta_hr.json())


