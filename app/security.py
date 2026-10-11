from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from threading import Lock
from time import monotonic

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db
from .models import Admin

password_hasher = PasswordHash.recommended()
dummy_hash = password_hasher.hash("dummy-password-never-used")
bearer = HTTPBearer(auto_error=False)


def create_token(admin: Admin):
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": str(admin.id), "ver": admin.token_version, "iat": now,
                       "exp": now + timedelta(minutes=get_settings().access_token_minutes)},
                      get_settings().jwt_secret, algorithm="HS256")


def current_admin(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)):
    error = HTTPException(401, "请先登录或重新登录", headers={"WWW-Authenticate": "Bearer"})
    if credentials is None:
        raise error
    try:
        payload = jwt.decode(credentials.credentials, get_settings().jwt_secret, algorithms=["HS256"],
                             options={"require": ["sub", "exp", "iat", "ver"]})
        admin = db.get(Admin, int(payload["sub"]))
        if admin is None or admin.token_version != payload["ver"]:
            raise error
        return admin
    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise error


class RateLimiter:
    """Bounded per-process limiter; deploy a single worker or use a shared gateway."""
    def __init__(self):
        self.entries = OrderedDict()
        self.lock = Lock()

    def check(self, request: Request, bucket: str, limit: int, window: int):
        key = (bucket, request.client.host if request.client else "unknown")
        now = monotonic()
        with self.lock:
            count, start = self.entries.pop(key, (0, now))
            if now - start >= window:
                count, start = 0, now
            self.entries[key] = (count + 1, start)
            while len(self.entries) > 10000:
                self.entries.popitem(last=False)
            if count >= limit:
                raise HTTPException(429, "请求过于频繁，请稍后重试", headers={"Retry-After": str(max(1, int(window - (now - start))))})


limiter = RateLimiter()
