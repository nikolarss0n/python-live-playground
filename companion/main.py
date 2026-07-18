"""
Optional local FastAPI companion for Python Live (Web APIs track).

  cd companion
  python -m venv .venv && source .venv/bin/activate
  pip install -r requirements.txt
  # optional: export PLP_API_KEY=dev-secret
  uvicorn main:app --reload --host 127.0.0.1 --port 8000

In the playground: Settings → set the same API key (if PLP_API_KEY is set) and
companion URL, then use the Local API strip on the Web APIs track.
"""

from __future__ import annotations

import os
from typing import Any, Callable

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.middleware.base import BaseHTTPMiddleware

# When set, every request must send matching X-API-Key or Authorization: Bearer.
REQUIRED_API_KEY = os.environ.get("PLP_API_KEY", "").strip()


class ApiKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not REQUIRED_API_KEY:
            return await call_next(request)
        # OpenAPI docs stay open so learners can explore
        if request.url.path in ("/docs", "/openapi.json", "/redoc"):
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
    description="Tiny local API for the Web APIs lessons — not required for the playground itself.",
    version="0.2.0",
)

app.add_middleware(ApiKeyMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB: dict[str, dict[str, Any]] = {
    "a1": {"title": "Notebook"},
}


class UserIn(BaseModel):
    name: str = Field(min_length=1)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "python-live-companion",
        "auth_required": bool(REQUIRED_API_KEY),
    }


@app.get("/hello")
def hello() -> dict[str, str]:
    return {"message": "hi"}


@app.get("/greet")
def greet(name: str = Query(default="world")) -> dict[str, str]:
    return {"message": f"Hello, {name}!"}


@app.get("/items/{item_id}")
def get_item(item_id: str) -> dict[str, Any]:
    item = DB.get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="missing")
    return item


@app.post("/users", status_code=201)
def create_user(body: UserIn) -> dict[str, Any]:
    return {"id": 1, "name": body.name}


@app.get("/me")
def me(request: Request) -> dict[str, Any]:
    """Shows whether the playground sent a key (for the auth lesson mental model)."""
    key = request.headers.get("x-api-key", "").strip()
    auth = request.headers.get("authorization", "").strip()
    has_key = bool(key or auth.lower().startswith("bearer "))
    return {
        "authenticated": has_key and (
            not REQUIRED_API_KEY
            or key == REQUIRED_API_KEY
            or auth == f"Bearer {REQUIRED_API_KEY}"
        ),
        "auth_required": bool(REQUIRED_API_KEY),
    }


@app.get("/")
def root() -> dict[str, Any]:
    return {
        "service": "python-live-companion",
        "docs": "/docs",
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
