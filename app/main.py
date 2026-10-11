from contextlib import asynccontextmanager
from datetime import timezone

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, or_, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .config import get_settings
from .database import Base, SessionLocal, engine, get_db
from .models import Admin, Category, Comment, Post, Site, Tag, utcnow
from .schemas import (CommentInput, CommentModeration, CommentOut, Login, PasswordChange,
                      PostInput, PostOut, PostPage, SiteInput, TaxonomyInput, TaxonomyOut)
from .security import create_token, current_admin, dummy_hash, limiter, password_hasher
from .admin import router as admin_router


@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(engine)
    get_settings().upload_dir.mkdir(parents=True, exist_ok=True)
    with SessionLocal() as db:
        if db.get(Site, 1) is None:
            db.add(Site(id=1))
            db.commit()
    yield


settings = get_settings()
app = FastAPI(title="个人博客 API", version="1.0.0", lifespan=lifespan,
              docs_url=None, redoc_url=None,
              openapi_url="/openapi.json" if settings.openapi_enabled else None)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins,
                   allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
                   allow_headers=["Authorization", "Content-Type"])
app.include_router(admin_router)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-store"
    return response


def commit(db: Session):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "名称或 slug 已存在，或关联数据无效")


def required(db: Session, model, id: int):
    item = db.get(model, id)
    if item is None:
        raise HTTPException(404, "记录不存在")
    return item


@app.get("/health", tags=["系统"])
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}


@app.post("/api/v1/auth/login", tags=["认证"])
def login(body: Login, request: Request, db: Session = Depends(get_db)):
    limiter.check(request, "login", 10, 300)
    admin = db.scalar(select(Admin).where(Admin.username == body.username))
    valid = password_hasher.verify(body.password, admin.password_hash if admin else dummy_hash)
    if not admin or not valid:
        raise HTTPException(401, "用户名或密码错误")
    return {"access_token": create_token(admin), "token_type": "bearer",
            "expires_in": settings.access_token_minutes * 60}


@app.get("/api/v1/auth/me", tags=["认证"])
def me(admin: Admin = Depends(current_admin)):
    return {"id": admin.id, "username": admin.username}


@app.post("/api/v1/auth/logout", status_code=204, tags=["认证"])
def logout(admin: Admin = Depends(current_admin), db: Session = Depends(get_db)):
    admin.token_version += 1
    commit(db)
    return Response(status_code=204)


@app.put("/api/v1/auth/password", status_code=204, tags=["认证"])
def password(body: PasswordChange, admin: Admin = Depends(current_admin), db: Session = Depends(get_db)):
    if not password_hasher.verify(body.old_password, admin.password_hash):
        raise HTTPException(400, "原密码错误")
    admin.password_hash = password_hasher.hash(body.new_password)
    admin.token_version += 1
    commit(db)
    return Response(status_code=204)


def query_posts(db, page, page_size, q, category_id, tag_id, status):
    query = select(Post)
    if status:
        query = query.where(Post.status == status)
    if q:
        # Escape LIKE wildcards so user input remains a literal search.
        keyword = q.replace("/", "//").replace("%", "/%").replace("_", "/_")
        query = query.where(or_(Post.title.ilike(f"%{keyword}%", escape="/"),
                                Post.content.ilike(f"%{keyword}%", escape="/")))
    if category_id is not None:
        query = query.where(Post.category_id == category_id)
    if tag_id is not None:
        query = query.where(Post.tags.any(Tag.id == tag_id))
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(query.order_by(Post.published_at.desc(), Post.id.desc())
                       .offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@app.get("/api/v1/posts", response_model=PostPage, tags=["公开文章"])
def posts(page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=100),
          q: str | None = Query(None, max_length=100), category_id: int | None = Query(None, gt=0),
          tag_id: int | None = Query(None, gt=0), db: Session = Depends(get_db)):
    return query_posts(db, page, page_size, q, category_id, tag_id, "published")


@app.get("/api/v1/posts/{slug}", response_model=PostOut, tags=["公开文章"])
def post_detail(slug: str, db: Session = Depends(get_db)):
    post = db.scalar(select(Post).where(Post.slug == slug, Post.status == "published"))
    if post is None:
        raise HTTPException(404, "文章不存在")
    return post


@app.get("/api/v1/admin/posts", response_model=PostPage, dependencies=[Depends(current_admin)], tags=["文章管理"])
def admin_posts(page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=100),
                q: str | None = Query(None, max_length=100), status: str | None = Query(None, pattern="^(draft|published)$"),
                db: Session = Depends(get_db)):
    return query_posts(db, page, page_size, q, None, None, status)


@app.get("/api/v1/admin/posts/{id}", response_model=PostOut, dependencies=[Depends(current_admin)], tags=["文章管理"])
def admin_post(id: int, db: Session = Depends(get_db)):
    return required(db, Post, id)


def assign_post(post: Post, body: PostInput, db: Session):
    if body.category_id is not None:
        required(db, Category, body.category_id)
    ids = set(body.tag_ids)
    tags = db.scalars(select(Tag).where(Tag.id.in_(ids))).all() if ids else []
    if len(tags) != len(ids):
        raise HTTPException(422, "标签不存在")
    was_published = post.status == "published"
    for key, value in body.model_dump(exclude={"tag_ids", "expected_updated_at"}).items():
        setattr(post, key, value)
    post.tags = list(tags)
    if body.status == "published" and not was_published:
        post.published_at = utcnow()
    elif body.status == "draft":
        post.published_at = None


@app.post("/api/v1/admin/posts", response_model=PostOut, status_code=201,
          dependencies=[Depends(current_admin)], tags=["文章管理"])
def create_post(body: PostInput, db: Session = Depends(get_db)):
    post = Post()
    assign_post(post, body, db)
    db.add(post)
    commit(db)
    db.refresh(post)
    return post


@app.put("/api/v1/admin/posts/{id}", response_model=PostOut,
         dependencies=[Depends(current_admin)], tags=["文章管理"])
def update_post(id: int, body: PostInput, db: Session = Depends(get_db)):
    post = required(db, Post, id)
    if body.expected_updated_at is not None:
        expected = body.expected_updated_at
        expected = expected.replace(tzinfo=timezone.utc) if expected.tzinfo is None else expected.astimezone(timezone.utc)
        actual = post.updated_at
        actual = actual.replace(tzinfo=timezone.utc) if actual.tzinfo is None else actual.astimezone(timezone.utc)
        if expected != actual:
            raise HTTPException(409, "文章已被其他窗口修改，请保留本地备份并重新打开文章后合并修改")
        guarded = db.execute(update(Post).where(Post.id == id, Post.updated_at == post.updated_at)
                             .values(updated_at=utcnow()).execution_options(synchronize_session=False))
        if guarded.rowcount != 1:
            db.rollback()
            raise HTTPException(409, "文章已被其他窗口修改，请重新打开文章")
        db.refresh(post)
    assign_post(post, body, db)
    commit(db)
    db.refresh(post)
    return post


@app.delete("/api/v1/admin/posts/{id}", status_code=204,
            dependencies=[Depends(current_admin)], tags=["文章管理"])
def delete_post(id: int, db: Session = Depends(get_db)):
    db.delete(required(db, Post, id))
    commit(db)
    return Response(status_code=204)


def taxonomy_routes(model, path):
    def listing(db: Session = Depends(get_db)):
        return db.scalars(select(model).order_by(model.id)).all()

    def create(body: TaxonomyInput, db: Session = Depends(get_db)):
        item = model(**body.model_dump())
        db.add(item)
        commit(db)
        return item

    def update(id: int, body: TaxonomyInput, db: Session = Depends(get_db)):
        item = required(db, model, id)
        for key, value in body.model_dump().items():
            setattr(item, key, value)
        commit(db)
        return item

    def delete(id: int, db: Session = Depends(get_db)):
        db.delete(required(db, model, id))
        commit(db)
        return Response(status_code=204)

    app.add_api_route(f"/api/v1/{path}", listing, methods=["GET"], response_model=list[TaxonomyOut], tags=["分类与标签"], name=f"list_{path}")
    for endpoint, method, suffix, response, code in [
        (create, "POST", "", TaxonomyOut, 201), (update, "PUT", "/{id}", TaxonomyOut, 200),
        (delete, "DELETE", "/{id}", None, 204),
    ]:
        app.add_api_route(f"/api/v1/admin/{path}{suffix}", endpoint, methods=[method],
                          response_model=response, status_code=code, dependencies=[Depends(current_admin)],
                          tags=["分类与标签"], name=f"{method.lower()}_{path}")


taxonomy_routes(Category, "categories")
taxonomy_routes(Tag, "tags")


@app.get("/api/v1/posts/{slug}/comments", response_model=list[CommentOut], tags=["评论"])
def comments(slug: str, offset: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    post = post_detail(slug, db)
    return db.scalars(select(Comment).where(Comment.post_id == post.id, Comment.approved.is_(True))
                      .order_by(Comment.id).offset(offset).limit(limit)).all()


@app.post("/api/v1/posts/{slug}/comments", response_model=CommentOut, status_code=201, tags=["评论"])
def create_comment(slug: str, body: CommentInput, request: Request, db: Session = Depends(get_db)):
    limiter.check(request, "comment", 5, 60)
    post = post_detail(slug, db)
    if not db.get(Site, 1).comments_enabled:
        raise HTTPException(403, "评论已关闭")
    item = Comment(post_id=post.id, **body.model_dump())
    db.add(item)
    commit(db)
    return item


@app.get("/api/v1/admin/comments", response_model=list[CommentOut], dependencies=[Depends(current_admin)], tags=["评论管理"])
def admin_comments(approved: bool | None = None, offset: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    query = select(Comment)
    if approved is not None:
        query = query.where(Comment.approved == approved)
    return db.scalars(query.order_by(Comment.id.desc()).offset(offset).limit(limit)).all()


@app.patch("/api/v1/admin/comments/{id}", response_model=CommentOut, dependencies=[Depends(current_admin)], tags=["评论管理"])
def moderate_comment(id: int, body: CommentModeration, db: Session = Depends(get_db)):
    item = required(db, Comment, id)
    item.approved = body.approved
    commit(db)
    return item


@app.delete("/api/v1/admin/comments/{id}", status_code=204, dependencies=[Depends(current_admin)], tags=["评论管理"])
def delete_comment(id: int, db: Session = Depends(get_db)):
    db.delete(required(db, Comment, id))
    commit(db)
    return Response(status_code=204)


@app.get("/api/v1/site", response_model=SiteInput, tags=["站点"])
def site(db: Session = Depends(get_db)):
    return db.get(Site, 1)


@app.put("/api/v1/admin/site", response_model=SiteInput, dependencies=[Depends(current_admin)], tags=["站点"])
def update_site(body: SiteInput, db: Session = Depends(get_db)):
    item = db.get(Site, 1)
    for key, value in body.model_dump().items():
        setattr(item, key, value)
    commit(db)
    return item
