from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True, extra="forbid")


class Login(Schema):
    model_config = ConfigDict(str_strip_whitespace=False)
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=256)


class PasswordChange(Schema):
    model_config = ConfigDict(str_strip_whitespace=False)
    old_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=12, max_length=256)


class TaxonomyInput(Schema):
    name: str = Field(min_length=1, max_length=80)
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class TaxonomyOut(TaxonomyInput):
    id: int


class PostInput(Schema):
    model_config = ConfigDict(str_strip_whitespace=False)
    title: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=160, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    summary: str = Field(default="", max_length=500)
    content: str = Field(min_length=1, max_length=200000)
    status: Literal["draft", "published"] = "draft"
    category_id: int | None = Field(default=None, gt=0)
    tag_ids: list[int] = Field(default_factory=list, max_length=30)
    expected_updated_at: datetime | None = None

    @field_validator("title", "slug", "summary", mode="before")
    @classmethod
    def trim_metadata(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("content")
    @classmethod
    def nonempty_content(cls, value):
        if not value.strip():
            raise ValueError("正文不能为空")
        return value


class PostOut(Schema):
    model_config = ConfigDict(str_strip_whitespace=False)
    id: int
    title: str
    slug: str
    summary: str
    content: str
    status: str
    category: TaxonomyOut | None
    tags: list[TaxonomyOut]
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None

    @field_validator("created_at", "updated_at", "published_at")
    @classmethod
    def utc_timestamp(cls, value):
        return value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value


class PostSummary(PostOut):
    content: str = Field(exclude=True)


class PostPage(Schema):
    items: list[PostSummary]
    total: int
    page: int
    page_size: int


class CommentInput(Schema):
    author: str = Field(min_length=1, max_length=80)
    content: str = Field(min_length=1, max_length=2000)


class CommentOut(CommentInput):
    id: int
    post_id: int
    approved: bool
    created_at: datetime

    @field_validator("created_at")
    @classmethod
    def utc_timestamp(cls, value):
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


class CommentModeration(Schema):
    approved: bool


class SiteInput(Schema):
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)
    author: str = Field(min_length=1, max_length=80)
    about: str = Field(default="", max_length=20000)
    comments_enabled: bool = True


class PreviewInput(Schema):
    model_config = ConfigDict(str_strip_whitespace=False)
    content: str = Field(max_length=200000)
