# Kuronya 的个人博客

Python + FastAPI + SQLAlchemy + SQLite，提供博客内容与管理 API。接口前缀为 `/api/v1`，健康检查为 `/health`，OpenAPI JSON 为 `/openapi.json`。

现已包含 React + TypeScript 前端：读者首页、文章搜索、分类标签、时间归档、Markdown 阅读与评论，以及登录、写作、图片上传、评论审核和站点管理后台。前台采用杂志网格、图文主文章、按年份组织的分栏列表和自托管中英文字体，支持手机和浅色 / 系统 / 深色主题。

## 本地打开博客

完成下面的 Python 本地开发环境配置后，在 `frontend` 目录执行 `npm ci`，回到项目根目录执行 `./start.ps1`。访问 `http://localhost:5173` 查看真实博客，`http://localhost:5173/preview` 查看带有示例文章的只读设计预览，`http://localhost:5173/admin` 进入管理后台。账号通过 `python -m app.cli create-admin --username Kuronya` 创建，没有默认密码。

`start.ps1` 仅在没有 `.env` 时生成随机 JWT 密钥。前端使用同源代理，开发时不用另行开放 CORS。详细页面、检查与部署说明见 [frontend/README.md](frontend/README.md)，设计参考见 [frontend/DESIGN.md](frontend/DESIGN.md)。

默认生产构建不开放示例预览，只保留正式博客。Docker 后端使用独立的运行依赖锁定文件 `requirements-prod.txt`；开发与测试仍使用 `requirements.txt`。本轮资源精简、缓存配置及尚未实测的部分见 [部署资源检查](deploy/RESOURCE-AUDIT.md)。

## 已实现

- 管理员登录、身份查询、修改密码、退出所有登录；Argon2 密码哈希和有时效的 JWT。
- Markdown 文章增删改查、草稿/发布、摘要、唯一 slug；公开接口不返回草稿。
- 文章分页、标题/正文搜索、分类/标签筛选；列表不返回完整正文。
- 分类与标签管理；删除分类保留文章，删除文章同时删除其评论。
- 访客评论、管理员审核/删除、全站评论开关；未审核评论不公开展示。
- 站点标题、简介、作者和关于内容；所有日期以 UTC 输出。
- CORS 白名单、登录/评论限流、健康检查、Docker 数据持久化。
- 图片上传（JPEG / PNG / WebP，最大 5 MB、2000 万像素）；重编码为 WebP，图片随数据卷持久化。
- 文章更新版本检查；数据已更新时返回 409，避免旧版本覆盖新内容。
- 安全的 Markdown 渲染 API。

## Linux + Docker 部署

将这个目录上传到服务器，例如 `/opt/personal-blog`，然后执行：

```bash
cd /opt/personal-blog
cp .env.example .env
# 生成密钥，复制输出到 .env 的 JWT_SECRET= 后面（不要公开这个密钥）
python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
nano .env
docker compose up -d --build
docker compose exec blog python -m app.cli create-admin --username admin
curl http://127.0.0.1:8000/health
```

创建管理员时交互输入两次密码，至少 12 个字符。没有默认账号密码，也没有公开注册接口。忘记密码可在服务器执行：

```bash
docker compose exec blog python -m app.cli reset-password --username admin
```

API 绑定服务器的 `127.0.0.1:8000`，前端网站绑定 `127.0.0.1:8080`。通过宿主机 Nginx 接入域名，页面转发到 8080，登录接口仍直接转发到 8000。参考 `deploy/nginx.conf.example`，将示例域名替换为自己的域名，运行 `nginx -t` 验证配置后重载。该示例为 HTTP 起始配置，公网使用前需给域名配置 HTTPS 证书和 HTTP→HTTPS 跳转。配置不信任客户端转发 IP 头；应用在反向代理后按代理地址限流，Nginx 按访客真实连接 IP 限流。若前面还有 CDN，需要按其可信 IP 范围配置 Nginx real_ip。

没有域名时，可在自己的电脑建立 SSH 隧道进行调试：

```bash
ssh -L 8000:127.0.0.1:8000 用户名@服务器IP
```

随后可通过 `http://localhost:8000/api/v1` 调用接口。先向登录接口发送 JSON 用户名与密码，获取 `access_token`，再在管理请求中设置 `Authorization: Bearer <access_token>`。设置 `OPENAPI_ENABLED=false` 可以关闭 OpenAPI JSON。

```bash
docker compose logs -f --tail=100 blog
docker compose ps
```

## 本地开发（Windows PowerShell）

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
# 把输出填写到 .env 中的 JWT_SECRET，再运行：
.\.venv\Scripts\python.exe -m app.cli create-admin --username admin
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

默认数据库为 `data/blog.db`。允许跨域调用 API 的地址需要填入 `CORS_ORIGINS`，例如 `CORS_ORIGINS=["http://localhost:5173","https://blog.example.com"]`，修改后重启服务。此字段是 JSON 数组，不是逗号分隔字符串。

## 接口约定

API 前缀是 `/api/v1`。管理接口需要请求头 `Authorization: Bearer <access_token>`。`PUT` 为全量更新，请传全部必填字段；修改密码和退出登录会使该管理员的所有旧令牌失效，需要重新登录。

| 方法 | 路径（省略前缀） | 用途 |
| --- | --- | --- |
| POST | `/auth/login` | JSON 用户名/密码登录 |
| GET | `/auth/me` | 当前管理员 |
| POST | `/auth/logout` | 退出所有设备 |
| PUT | `/auth/password` | 修改密码 |
| GET | `/posts` | 公开文章；page、page_size、q、category_id、tag_id |
| GET | `/posts/{slug}` | 已发布文章详情 |
| GET / POST | `/admin/posts` | 管理列表 / 创建文章 |
| GET / PUT / DELETE | `/admin/posts/{id}` | 获取 / 更新 / 删除 |
| GET | `/categories`、`/tags` | 分类 / 标签列表 |
| POST | `/admin/categories`、`/admin/tags` | 创建分类 / 标签 |
| PUT / DELETE | `/admin/categories/{id}`、`/admin/tags/{id}` | 更新 / 删除 |
| GET / POST | `/posts/{slug}/comments` | 已审核评论 / 提交待审核评论 |
| GET | `/admin/comments` | 审核列表；approved、offset、limit |
| PATCH / DELETE | `/admin/comments/{id}` | 审核 / 删除 |
| GET | `/site` | 公开站点信息 |
| PUT | `/admin/site` | 修改站点信息 |
| POST | `/admin/preview` | 安全的 Markdown HTML 预览 |
| POST | `/admin/uploads` | multipart file 字段上传图片 |

文章请求示例（分类和标签必须先创建，也可以留空）：

```json
{
  "title": "我的第一篇博客",
  "slug": "hello-world",
  "summary": "开始记录我的生活与技术",
  "content": "# 你好，世界\n\n这是 Markdown 正文。",
  "status": "published",
  "category_id": null,
  "tag_ids": []
}
```

`status` 仅支持 `draft` / `published`。slug 使用小写字母、数字和连字符。再次发布撤回的文章会刷新发布时间。评论审核请求为 `{"approved": true}`。评论列表使用 offset/limit，文章列表返回 `{items,total,page,page_size}`。错误采用 FastAPI 的 `detail` 格式；重复名称或 slug 返回 409，参数不合法返回 422。

正文与关于内容存储为原始 Markdown，评论存储为纯文本。Markdown 渲染接口禁用原始 HTML 与危险链接。更新文章时可传 `expected_updated_at`（上次获取的 `updated_at`），文章已改变时返回 409。当前不提供邮件通知、文章历史版本或图片删除功能。

## 测试与维护

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

测试使用临时数据库和测试密钥，不操作实际博客数据。默认单 worker，应用限流为进程内限流，重启后计数清空；扩展多实例时应改为 Redis 或统一网关限流。

Docker 的数据库保存在 `blog_data` 命名卷，普通重建/重启保留数据。**不要执行 `docker compose down -v`，它会删除数据卷。** 当前版本启动时创建初始表，不会自动迁移已有表；未来修改字段时应加入显式数据库迁移并先备份。

在运行中的容器使用 SQLite 的 backup API 获得一致性备份，然后复制到宿主机：

```bash
docker compose exec blog python -c 'import sqlite3; source=sqlite3.connect("/app/data/blog.db"); target=sqlite3.connect("/tmp/blog-backup.db"); source.backup(target); target.close(); source.close()'
docker compose cp blog:/tmp/blog-backup.db ./blog-backup.db
# 图片单独备份（请在备份期间暂停写作和上传）
docker compose cp blog:/app/data/uploads ./uploads-backup
```

恢复时先停止服务，用一次性容器替换数据库并移除旧 WAL 文件，然后启动：

```bash
docker compose stop blog
docker compose run --rm --no-deps -v "$PWD/blog-backup.db:/backup/blog.db:ro" blog python -c 'import shutil; from pathlib import Path; root=Path("/app/data"); [(root/name).unlink(missing_ok=True) for name in ("blog.db-wal", "blog.db-shm")]; shutil.copyfile("/backup/blog.db", root/"blog.db")'
docker compose up -d
```

数据库恢复后，如果需要恢复图片，可执行 `docker compose cp ./uploads-backup/. blog:/app/data/uploads`。默认容器内目录属于 UID 10001；如果手动复制文件导致上传权限错误，需要在停止服务期间修复该目录所有权。不要把私密文件放进 uploads，该目录的图片通过公开 URL 提供给读者。

备份包含文章、评论和管理员密码哈希，请妥善保存。同步保管 `.env`，更换 JWT 密钥会让已签发令牌失效。
