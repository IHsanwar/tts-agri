from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_and_time(client: AsyncClient):
    res = await client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["db"] == "ok"
    assert "x-request-id" in res.headers

    time_res = await client.get("/api/time")
    assert time_res.status_code == 200
    t_data = time_res.json()
    assert "now_iso" in t_data
    assert "now_ms" in t_data
    assert isinstance(t_data["now_ms"], int)


@pytest.mark.asyncio
async def test_auth_registration_and_login_flow(client: AsyncClient):
    # 1. Invalid invite code
    bad_reg = await client.post(
        "/api/auth/register",
        json={
            "email": "teacher1@school.id",
            "password": "Password123!",
            "name": "Budi Raharjo",
            "invite_code": "wrong-code",
        },
    )
    assert bad_reg.status_code == 400
    assert bad_reg.json()["error"]["code"] == "validation_error"

    # 2. Valid register
    reg = await client.post(
        "/api/auth/register",
        json={
            "email": "teacher1@school.id",
            "password": "Password123!",
            "name": "Budi Raharjo",
            "invite_code": "test-invite-123",
        },
    )
    assert reg.status_code == 200
    data = reg.json()
    assert data["teacher"]["email"] == "teacher1@school.id"
    assert data["teacher"]["name"] == "Budi Raharjo"
    assert "tts_teacher" in reg.cookies
    assert "tts_teacher_csrf" in reg.cookies

    # 3. Duplicate email
    dup_reg = await client.post(
        "/api/auth/register",
        json={
            "email": "teacher1@school.id",
            "password": "AnotherPassword123!",
            "name": "Budi Dua",
            "invite_code": "test-invite-123",
        },
    )
    assert dup_reg.status_code == 409
    assert dup_reg.json()["error"]["code"] == "conflict"

    # 4. Check me with auth cookies
    me_res = await client.get("/api/auth/me")
    assert me_res.status_code == 200
    assert me_res.json()["teacher"]["email"] == "teacher1@school.id"
    csrf_token = me_res.json()["csrf_token"]
    assert csrf_token is not None

    # 5. Logout with CSRF
    logout_res = await client.post(
        "/api/auth/logout",
        headers={"x-csrf-token": csrf_token},
    )
    assert logout_res.status_code == 200
    assert logout_res.json()["ok"] is True

    # 6. Check me after logout -> 401
    me_after = await client.get("/api/auth/me")
    assert me_after.status_code == 401

    # 7. Login with wrong password -> 401
    bad_login = await client.post(
        "/api/auth/login",
        json={"email": "teacher1@school.id", "password": "WrongPassword123!"},
    )
    assert bad_login.status_code == 401

    # 8. Login with correct password -> 200
    good_login = await client.post(
        "/api/auth/login",
        json={"email": "teacher1@school.id", "password": "Password123!"},
    )
    assert good_login.status_code == 200
    assert good_login.json()["teacher"]["name"] == "Budi Raharjo"
