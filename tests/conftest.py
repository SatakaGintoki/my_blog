import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

test_dir = tempfile.TemporaryDirectory(prefix="blog-tests-")
os.environ["DATABASE_URL"] = "sqlite:///" + (Path(test_dir.name) / "blog.db").as_posix()
os.environ["JWT_SECRET"] = "test-only-4ede3bd82c5948cbb684ad748a9fd11f"
os.environ["UPLOAD_DIR"] = (Path(test_dir.name) / "uploads").as_posix()

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import Admin
from app.security import limiter, password_hasher


@pytest.fixture(scope="session", autouse=True)
def cleanup_database():
    yield
    engine.dispose()
    test_dir.cleanup()


@pytest.fixture
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    limiter.entries.clear()
    with SessionLocal() as db:
        db.add(Admin(username="admin", password_hash=password_hasher.hash("secure-password-123")))
        db.commit()
    with TestClient(app) as client:
        yield client


@pytest.fixture
def headers(client):
    response = client.post("/api/v1/auth/login", json={"username": "admin", "password": "secure-password-123"})
    assert response.status_code == 200
    return {"Authorization": "Bearer " + response.json()["access_token"]}
