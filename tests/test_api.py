from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.config import get_settings


def article(**changes):
    return {"title": "第一篇博客", "slug": "hello-world", "content": "# Hello\n你好，世界！", **changes}


def test_draft_publish_unpublish_and_search(client, headers):
    draft = client.post("/api/v1/admin/posts", json=article(), headers=headers)
    assert draft.status_code == 201
    id = draft.json()["id"]
    assert client.get("/api/v1/posts").json()["total"] == 0
    assert client.get("/api/v1/posts/hello-world").status_code == 404
    assert client.get("/api/v1/admin/posts").status_code == 401
    assert client.get(f"/api/v1/admin/posts/{id}", headers=headers).json()["content"].startswith("# Hello")
    published = client.put(f"/api/v1/admin/posts/{id}", json=article(status="published"), headers=headers)
    assert published.status_code == 200
    assert published.json()["published_at"].endswith("Z")
    page = client.get("/api/v1/posts?q=世界&page_size=1").json()
    assert page["total"] == 1
    assert "content" not in page["items"][0]
    assert client.get("/api/v1/posts?q=%").json()["total"] == 0
    assert client.get("/api/v1/posts/hello-world").status_code == 200
    assert client.put(f"/api/v1/admin/posts/{id}", json=article(), headers=headers).json()["published_at"] is None
    assert client.get("/api/v1/posts/hello-world").status_code == 404


def test_auth_revocation_password_and_expiration(client, headers):
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 204
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
    new_headers = {"Authorization": "Bearer " + client.post("/api/v1/auth/login", json={"username": "admin", "password": "secure-password-123"}).json()["access_token"]}
    assert client.put("/api/v1/auth/password", json={"old_password": "bad", "new_password": "new-password-456"}, headers=new_headers).status_code == 400
    assert client.put("/api/v1/auth/password", json={"old_password": "secure-password-123", "new_password": "new-password-456"}, headers=new_headers).status_code == 204
    assert client.get("/api/v1/auth/me", headers=new_headers).status_code == 401
    assert client.post("/api/v1/auth/login", json={"username": "admin", "password": "secure-password-123"}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"username": "admin", "password": "new-password-456"}).status_code == 200
    expired = jwt.encode({"sub": "1", "ver": 2, "iat": datetime.now(timezone.utc) - timedelta(hours=2), "exp": datetime.now(timezone.utc) - timedelta(hours=1)}, get_settings().jwt_secret, algorithm="HS256")
    assert client.get("/api/v1/auth/me", headers={"Authorization": "Bearer " + expired}).status_code == 401
    assert client.get("/api/v1/auth/me", headers={"Authorization": "Bearer nonsense"}).status_code == 401


def test_categories_tags_constraints_and_deletion(client, headers):
    category = client.post("/api/v1/admin/categories", json={"name": "技术", "slug": "tech"}, headers=headers).json()
    tag = client.post("/api/v1/admin/tags", json={"name": "Python", "slug": "python"}, headers=headers).json()
    assert client.post("/api/v1/admin/categories", json={"name": "技术", "slug": "other"}, headers=headers).status_code == 409
    assert client.post("/api/v1/admin/posts", json=article(tag_ids=[999]), headers=headers).status_code == 422
    assert client.post("/api/v1/admin/posts", json=article(category_id=999), headers=headers).status_code == 404
    payload = article(status="published", category_id=category["id"], tag_ids=[tag["id"], tag["id"]])
    post = client.post("/api/v1/admin/posts", json=payload, headers=headers)
    assert post.status_code == 201
    assert len(post.json()["tags"]) == 1
    assert client.get(f'/api/v1/posts?category_id={category["id"]}&tag_id={tag["id"]}').json()["total"] == 1
    assert client.post("/api/v1/admin/posts", json=article(), headers=headers).status_code == 409
    assert client.delete(f'/api/v1/admin/categories/{category["id"]}', headers=headers).status_code == 204
    assert client.delete(f'/api/v1/admin/tags/{tag["id"]}', headers=headers).status_code == 204
    detail = client.get("/api/v1/posts/hello-world").json()
    assert detail["category"] is None
    assert detail["tags"] == []


def test_comments_moderation_close_and_cascade(client, headers):
    post = client.post("/api/v1/admin/posts", json=article(status="published"), headers=headers).json()
    response = client.post("/api/v1/posts/hello-world/comments", json={"author": "读者", "content": "不错"})
    assert response.status_code == 201
    comment = response.json()
    assert comment["approved"] is False
    assert client.get("/api/v1/posts/hello-world/comments").json() == []
    assert client.patch(f'/api/v1/admin/comments/{comment["id"]}', json={"approved": True}).status_code == 401
    assert client.patch(f'/api/v1/admin/comments/{comment["id"]}', json={"approved": True}, headers=headers).status_code == 200
    assert len(client.get("/api/v1/posts/hello-world/comments").json()) == 1
    site = client.get("/api/v1/site").json()
    site["comments_enabled"] = False
    assert client.put("/api/v1/admin/site", json=site, headers=headers).status_code == 200
    assert client.post("/api/v1/posts/hello-world/comments", json={"author": "访客", "content": "评论"}).status_code == 403
    assert client.delete(f'/api/v1/admin/posts/{post["id"]}', headers=headers).status_code == 204
    assert client.get("/api/v1/admin/comments", headers=headers).json() == []


def test_validation_and_login_throttle(client, headers):
    assert client.post("/api/v1/admin/posts", json=article(title="   "), headers=headers).status_code == 422
    assert client.post("/api/v1/admin/posts", json=article(slug="../oops"), headers=headers).status_code == 422
    assert client.get("/api/v1/posts?page_size=101").status_code == 422
    for _ in range(9):
        assert client.post("/api/v1/auth/login", json={"username": "missing", "password": "bad"}).status_code == 401
    response = client.post("/api/v1/auth/login", json={"username": "admin", "password": "secure-password-123"})
    assert response.status_code == 429
    assert "Retry-After" in response.headers


def test_health_openapi_and_security_headers(client):
    assert client.get("/health").json() == {"status": "ok"}
    response = client.get("/openapi.json")
    assert response.status_code == 200
    assert "/api/v1/admin/posts" in response.json()["paths"]
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    from app.main import app
    from app.admin import router
    routes = [route for route in app.routes if hasattr(route, "path")] + router.routes
    assert all(route.path.startswith("/api/v1/") or route.path in
               {"/health", "/openapi.json", "/uploads/{filename}"}
               for route in routes)


@pytest.mark.parametrize("method,path,payload", [
    ("POST", "/admin/posts", article()),
    ("PUT", "/admin/posts/1", article()),
    ("DELETE", "/admin/posts/1", None),
    ("POST", "/admin/categories", {"name": "Test", "slug": "test"}),
    ("PUT", "/admin/categories/1", {"name": "Test", "slug": "test"}),
    ("DELETE", "/admin/categories/1", None),
    ("POST", "/admin/tags", {"name": "Test", "slug": "test"}),
    ("PUT", "/admin/tags/1", {"name": "Test", "slug": "test"}),
    ("DELETE", "/admin/tags/1", None),
    ("GET", "/admin/comments", None),
    ("PATCH", "/admin/comments/1", {"approved": True}),
    ("DELETE", "/admin/comments/1", None),
    ("PUT", "/admin/site", {"title": "Test", "author": "Test"}),
    ("PUT", "/auth/password", {"old_password": "test", "new_password": "secure-new-password"}),
    ("POST", "/auth/logout", None),
])
def test_management_requires_authentication(client, method, path, payload):
    response = client.request(method, "/api/v1" + path, **({"json": payload} if payload else {}))
    assert response.status_code == 401
