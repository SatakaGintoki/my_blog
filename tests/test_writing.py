from io import BytesIO

from PIL import Image


def test_preview_escapes_scripts_and_unsafe_links(client, headers):
    markdown = '# 标题\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n**粗体**'
    assert client.post("/api/v1/admin/preview", json={"content": markdown}).status_code == 401
    html = client.post("/api/v1/admin/preview", json={"content": markdown}, headers=headers).json()["html"]
    assert "<h1>标题</h1>" in html
    assert "<strong>粗体</strong>" in html
    assert "<script>" not in html
    assert 'href="javascript:' not in html


def test_upload_validates_and_serves_only_images(client, headers):
    buffer = BytesIO()
    Image.new("RGB", (16, 16), "green").save(buffer, "PNG")
    raw = buffer.getvalue()
    assert client.post("/api/v1/admin/uploads", files={"file": ("photo.png", raw, "image/png")}).status_code == 401
    response = client.post("/api/v1/admin/uploads", files={"file": ("photo.png", raw, "image/png")}, headers=headers)
    assert response.status_code == 201
    image = client.get(response.json()["url"])
    assert image.status_code == 200
    assert image.headers["content-type"] == "image/webp"
    assert Image.open(BytesIO(image.content)).size == (16, 16)
    assert client.post("/api/v1/admin/uploads", files={"file": ("fake.png", b"<script>alert(1)</script>", "image/png")}, headers=headers).status_code == 422
    assert client.post("/api/v1/admin/uploads", files={"file": ("huge.png", b"0" * (5 * 1024 * 1024 + 1), "image/png")}, headers=headers).status_code == 413
    assert client.get("/uploads/blog.db").status_code == 404


def test_editor_keeps_markdown_whitespace_and_detects_stale_edits(client, headers):
    content = "    code block\n\nline with break  \nnext\n"
    payload = {"title": "编辑测试", "slug": "editor-test", "content": content}
    response = client.post("/api/v1/admin/posts", json=payload, headers=headers)
    assert response.status_code == 201
    saved = response.json()
    assert saved["content"] == content
    payload["expected_updated_at"] = saved["updated_at"]
    payload["title"] = "已修改"
    assert client.put(f'/api/v1/admin/posts/{saved["id"]}', json=payload, headers=headers).status_code == 200
    payload["title"] = "过期窗口的修改"
    assert client.put(f'/api/v1/admin/posts/{saved["id"]}', json=payload, headers=headers).status_code == 409
    assert client.get(f'/api/v1/admin/posts/{saved["id"]}', headers=headers).json()["title"] == "已修改"
