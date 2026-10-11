"""Start an isolated E2E API; never uses the user's database or credentials."""
import os
import sys
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root))
with tempfile.TemporaryDirectory(prefix="kuronya-e2e-") as directory:
    os.environ["DATABASE_URL"] = "sqlite:///" + (Path(directory) / "blog.db").as_posix()
    os.environ["UPLOAD_DIR"] = (Path(directory) / "uploads").as_posix()
    os.environ["JWT_SECRET"] = "e2e-only-98a27630dcb64965b294f31ed597cae2"
    from app.database import Base, SessionLocal, engine
    from app.models import Admin
    from app.security import password_hasher
    import uvicorn
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        db.add(Admin(username="test-admin", password_hash=password_hasher.hash("test-only-password-123")))
        db.commit()
    uvicorn.run("app.main:app", host="127.0.0.1", port=8001, log_level="warning")
    engine.dispose()
