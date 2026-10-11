"""Create a private local configuration only when it does not already exist."""
from pathlib import Path
import secrets

root = Path(__file__).resolve().parents[1]
target = root / ".env"
if not target.exists():
    sample = (root / ".env.example").read_text(encoding="utf-8")
    with target.open("x", encoding="utf-8") as stream:
        stream.write(sample.replace("JWT_SECRET=\n", f"JWT_SECRET={secrets.token_urlsafe(48)}\n", 1))
    print("已生成本地 .env 和随机 JWT 密钥。请勿公开 .env。")
else:
    print("使用已有 .env 配置。")
