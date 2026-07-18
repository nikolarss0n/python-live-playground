"""
Python Live companion API — local or public HTTPS demo.

Local:
  uvicorn main:app --reload --host 127.0.0.1 --port 8000

Public (Docker / Fly / Render):
  set CORS_ORIGINS / CORS_ORIGIN_REGEX for your playground origin
  optional PLP_API_KEY (usually leave empty for zero-install demos)
  RATE_LIMIT_PER_MINUTE (default 90)
"""

from __future__ import annotations

import os
import time
from collections import defaultdict
from typing import Any, Callable

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.middleware.base import BaseHTTPMiddleware

REQUIRED_API_KEY = os.environ.get("PLP_API_KEY", "").strip()
RATE_LIMIT = max(10, int(os.environ.get("RATE_LIMIT_PER_MINUTE", "90")))
DEMO_MODE = os.environ.get("PLP_DEMO_MODE", "1").strip() not in ("0", "false", "False")

# Comma-separated exact origins; empty → use built-in local + regex below.
_cors_raw = os.environ.get("CORS_ORIGINS", "").strip()
CORS_ORIGINS = (
    [o.strip() for o in _cors_raw.split(",") if o.strip()]
    if _cors_raw
    else [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
    ]
)
CORS_ORIGIN_REGEX = os.environ.get(
    "CORS_ORIGIN_REGEX",
    r"https://([a-z0-9-]+\.)*(github\.io|pages\.dev|vercel\.app|netlify\.app)",
).strip() or None


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple per-IP sliding window (in-memory; fine for a tiny demo API)."""

    def __init__(self, app: Any) -> None:
        super().__init__(app)
        self._hits: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.url.path in ("/docs", "/openapi.json", "/redoc", "/"):
            return await call_next(request)
        ip = request.client.host if request.client else "unknown"
        now = time.time()
        window = self._hits[ip]
        self._hits[ip] = [t for t in window if now - t < 60.0]
        if len(self._hits[ip]) >= RATE_LIMIT:
            return Response(
                content='{"detail":"rate limit exceeded — try again in a minute"}',
                status_code=429,
                media_type="application/json",
            )
        self._hits[ip].append(now)
        return await call_next(request)


class ApiKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not REQUIRED_API_KEY:
            return await call_next(request)
        if request.url.path in ("/docs", "/openapi.json", "/redoc", "/health", "/"):
            return await call_next(request)
        provided = request.headers.get("x-api-key", "").strip()
        auth = request.headers.get("authorization", "").strip()
        if auth.lower().startswith("bearer "):
            provided = provided or auth[7:].strip()
        if provided != REQUIRED_API_KEY:
            return Response(
                content='{"detail":"invalid or missing API key"}',
                status_code=401,
                media_type="application/json",
            )
        return await call_next(request)


app = FastAPI(
    title="Python Live companion",
    description=(
        "Tiny teaching API for the Web APIs track. "
        "Safe for zero-install HTTPS demos with rate limits."
    ),
    version="0.3.0",
)

# Order: last added runs first for request path.
app.add_middleware(ApiKeyMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# In-memory demo store (resets on restart — intentional for public demos).
DB: dict[str, dict[str, Any]] = {
    "a1": {"title": "Notebook"},
}


class UserIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "python-live-companion",
        "demo": DEMO_MODE,
        "auth_required": bool(REQUIRED_API_KEY),
        "rate_limit_per_minute": RATE_LIMIT,
    }


@app.get("/hello")
def hello() -> dict[str, str]:
    return {"message": "hi"}


@app.get("/greet")
def greet(name: str = Query(default="world", max_length=40)) -> dict[str, str]:
    safe = name.strip() or "world"
    return {"message": f"Hello, {safe}!"}


@app.get("/items/{item_id}")
def get_item(item_id: str) -> dict[str, Any]:
    if len(item_id) > 32:
        raise HTTPException(status_code=400, detail="id too long")
    item = DB.get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="missing")
    return item


@app.post("/users", status_code=201)
def create_user(body: UserIn) -> dict[str, Any]:
    # Demo only — does not persist across workers; returns echo id.
    return {"id": 1, "name": body.name.strip()}


@app.get("/me")
def me(request: Request) -> dict[str, Any]:
    key = request.headers.get("x-api-key", "").strip()
    auth = request.headers.get("authorization", "").strip()
    has_key = bool(key or auth.lower().startswith("bearer "))
    return {
        "authenticated": has_key
        and (
            not REQUIRED_API_KEY
            or key == REQUIRED_API_KEY
            or auth == f"Bearer {REQUIRED_API_KEY}"
        ),
        "auth_required": bool(REQUIRED_API_KEY),
        "demo": DEMO_MODE,
    }


@app.get("/")
def root() -> dict[str, Any]:
    return {
        "service": "python-live-companion",
        "docs": "/docs",
        "demo": DEMO_MODE,
        "auth_required": bool(REQUIRED_API_KEY),
        "routes": [
            "/health",
            "/hello",
            "/greet",
            "/items/{id}",
            "/users",
            "/me",
        ],
    }
