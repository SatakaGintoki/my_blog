from io import BytesIO
from uuid import uuid4
import warnings

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from markdown_it import MarkdownIt
from PIL import Image, ImageOps, UnidentifiedImageError

from .config import get_settings
from .schemas import PreviewInput
from .security import current_admin

router = APIRouter()
markdown = MarkdownIt("js-default")
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 20_000_000


@router.post("/api/v1/admin/preview", dependencies=[Depends(current_admin)], tags=["写作"])
def preview(body: PreviewInput):
    # js-default escapes raw HTML and refuses dangerous link protocols.
    return {"html": markdown.render(body.content)}


@router.post("/api/v1/admin/uploads", status_code=201, dependencies=[Depends(current_admin)], tags=["写作"])
def upload_image(file: UploadFile = File(...)):
    try:
        raw = file.file.read(MAX_UPLOAD_BYTES + 1)
        if len(raw) > MAX_UPLOAD_BYTES:
            raise HTTPException(413, "图片不能超过 5 MB")
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(raw)) as source:
                if source.format not in {"JPEG", "PNG", "WEBP"}:
                    raise HTTPException(422, "只支持 JPEG、PNG、WebP 图片")
                if source.width * source.height > MAX_PIXELS:
                    raise HTTPException(422, "图片不能超过 2000 万像素")
                image = ImageOps.exif_transpose(source)
                image.load()
                # Re-encode pixels, dropping metadata, active content and animations.
                image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
                directory = get_settings().upload_dir
                directory.mkdir(parents=True, exist_ok=True)
                filename = uuid4().hex + ".webp"
                image.save(directory / filename, "WEBP", quality=88)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombWarning, Image.DecompressionBombError, ValueError):
        raise HTTPException(422, "无效图片或图片尺寸过大")
    finally:
        file.file.close()
    return {"url": f"/uploads/{filename}", "width": image.width, "height": image.height}


@router.get("/uploads/{filename}", include_in_schema=False)
def image_file(filename: str):
    if len(filename) != 37 or not filename.endswith(".webp") or any(c not in "0123456789abcdef" for c in filename[:-5]):
        raise HTTPException(404, "图片不存在")
    path = get_settings().upload_dir / filename
    if not path.is_file():
        raise HTTPException(404, "图片不存在")
    return FileResponse(path, media_type="image/webp")
