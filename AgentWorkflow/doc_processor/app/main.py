# services/doc-processor/app/main.py
# FastAPI microservice that converts PDF and PPTX files into slide PNG images.
# Called by the Next.js API after a professor uploads their file.

import os
import uuid
import shutil
import tempfile
from pathlib import Path
from typing import List

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.converters.pdf_converter import convert_pdf_to_images
from app.converters.pptx_converter import convert_pptx_to_images
from app.converters.marker_converter import extract_text_with_marker

app = FastAPI(
    title="LectureLife Doc Processor",
    description="Converts PDF/PPTX files into slide PNG images for Agent 1",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", os.getenv("NEXT_PUBLIC_APP_URL", "*")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Output directory for generated images
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "/tmp/lecturelife/slides"))
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.ms-powerpoint": "ppt",
}

MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "50"))


@app.get("/health")
async def health():
    return {"status": "ok", "service": "doc-processor"}


@app.post("/convert")
async def convert_file(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    dpi: int = Form(150),
):
    """
    Convert an uploaded PDF or PPTX into slide PNG images.

    Returns a list of image paths and metadata for each slide.
    """
    # ── Validate file type ────────────────────────────────────────────────────
    content_type = file.content_type or ""
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}. Supported: PDF, PPTX",
        )

    file_format = ALLOWED_TYPES[content_type]

    # ── Validate file size ────────────────────────────────────────────────────
    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail=f"File too large: {size_mb:.1f}MB. Max: {MAX_FILE_SIZE_MB}MB",
        )

    # ── Magic bytes check ─────────────────────────────────────────────────────
    if file_format == "pdf" and not contents.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="File is not a valid PDF")
    if file_format in ("pptx", "ppt") and not contents[:4] in (b"PK\x03\x04", b"\xd0\xcf\x11\xe0"):
        raise HTTPException(status_code=400, detail="File is not a valid PPTX/PPT")

    # ── Save upload to temp file ──────────────────────────────────────────────
    session_output_dir = OUTPUT_DIR / session_id
    session_output_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.NamedTemporaryFile(
        suffix=f".{file_format}", delete=False
    ) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        # ── Convert to images ─────────────────────────────────────────────────
        if file_format == "pdf":
            image_paths = convert_pdf_to_images(
                pdf_path=tmp_path,
                output_dir=str(session_output_dir),
                dpi=dpi,
            )
        else:
            image_paths = convert_pptx_to_images(
                pptx_path=tmp_path,
                output_dir=str(session_output_dir),
            )

        # ── Build response ────────────────────────────────────────────────────
        slides = [
            {
                "slideIndex": i + 1,
                "imagePath": str(path),
                "fileName": Path(path).name,
            }
            for i, path in enumerate(image_paths)
        ]

        return JSONResponse({
            "sessionId": session_id,
            "slideCount": len(slides),
            "slides": slides,
            "format": file_format,
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")
    finally:
        os.unlink(tmp_path)


@app.post("/convert/pdf-to-markdown")
async def pdf_to_markdown(
    file: UploadFile = File(...),
):
    """
    Marker fallback endpoint — extracts text from a PDF as markdown.
    Used by Agent 1 when Claude Vision fails for a slide.
    Called from lessonDesignerAgent.ts retry logic.
    """
    contents = await file.read()

    if not contents.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="File is not a valid PDF")

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        markdown_text = extract_text_with_marker(tmp_path)
        return JSONResponse({"markdown": markdown_text, "success": True})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Marker extraction failed: {str(e)}")
    finally:
        os.unlink(tmp_path)


@app.delete("/sessions/{session_id}")
async def cleanup_session(session_id: str):
    """
    Delete all slide images for a session (called when session is deleted).
    """
    session_dir = OUTPUT_DIR / session_id
    if session_dir.exists():
        shutil.rmtree(session_dir)
    return {"message": f"Cleaned up session {session_id}"}
