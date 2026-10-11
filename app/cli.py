import argparse
import getpass

from sqlalchemy import select

from .database import Base, SessionLocal, engine
from .models import Admin
from .security import password_hasher


def main():
    parser = argparse.ArgumentParser(description="博客管理员管理（服务器本地运行）")
    parser.add_argument("action", choices=["create-admin", "reset-password"])
    parser.add_argument("--username", default="admin")
    args = parser.parse_args()
    if not args.username.strip() or len(args.username) > 80:
        parser.error("用户名必须是 1–80 个字符")
    password = getpass.getpass("密码（至少 12 个字符）: ")
    if len(password) < 12 or len(password) > 256 or not password.strip():
        parser.error("密码长度必须是 12–256 个字符")
    if password != getpass.getpass("再次输入密码: "):
        parser.error("两次密码不一致")
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = db.scalar(select(Admin).where(Admin.username == args.username.strip()))
        if args.action == "create-admin":
            if admin:
                parser.error("管理员已存在，重置密码请使用 reset-password")
            admin = Admin(username=args.username.strip(), password_hash=password_hasher.hash(password))
            db.add(admin)
        else:
            if not admin:
                parser.error("管理员不存在")
            admin.password_hash = password_hasher.hash(password)
            admin.token_version += 1
        db.commit()
    print("管理员已创建" if args.action == "create-admin" else "密码已重置，旧令牌已失效")


if __name__ == "__main__":
    main()
