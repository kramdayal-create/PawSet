"""FastAPI web server: dashboard UI + scan API.

Run:  uvicorn app.server:app --reload   (from the project root)
"""
from __future__ import annotations

import os
import tempfile

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .analyzer import scan_file

MAX_UPLOAD_BYTES = 400 * 1024 * 1024  # 400 MB
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

app = FastAPI(
    title="Mobile App Security Scanner",
    description="Static analysis for APK/IPA binaries you are authorized to test.",
    version="1.0.0",
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/scan")
async def scan(
    file: UploadFile = File(...),
    authorized: str = Form("false"),
) -> JSONResponse:
    # --- authorization gate (dual-use tool) --------------------------------
    if str(authorized).lower() not in ("true", "on", "1", "yes"):
        raise HTTPException(
            status_code=400,
            detail="You must confirm you are authorized to analyze this binary.",
        )

    filename = file.filename or "upload.bin"
    low = filename.lower()
    if not (low.endswith(".apk") or low.endswith(".ipa") or low.endswith(".aab")):
        raise HTTPException(
            status_code=400,
            detail="Please upload a .apk (Android) or .ipa (iOS) file.",
        )

    suffix = os.path.splitext(filename)[1] or ".bin"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    size = 0
    try:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail="File exceeds 400 MB limit.")
            tmp.write(chunk)
        tmp.close()

        report = scan_file(tmp.name, declared_name=filename)
        return JSONResponse(report.to_dict())
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass


@app.get("/")
def index() -> FileResponse:
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


# Serve CSS/JS. Mounted last so it doesn't shadow API routes.
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
