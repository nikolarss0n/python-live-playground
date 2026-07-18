"""
Optional local FastAPI companion for Python Live (Web APIs track).

The playground stays browser-first. This process is only for learners who
want real HTTP after the dict-based lessons.

  cd companion
  python -m venv .venv && source .venv/bin/activate
  pip install -r requirements.txt
  uvicorn main:app --reload --port 8000

Then open the playground Web APIs track — the Local API strip can ping this app.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="Python Live companion",
    description="Tiny local API for the Web APIs lessons — not required for the playground itself.",
    version="0.1.0",
)

# Browser playground (Vite) talks cross-origin on localhost.
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
    return {"ok": True, "service": "python-live-companion"}


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


@app.get("/")
def root() -> dict[str, Any]:
    return {
        "service": "python-live-companion",
        "docs": "/docs",
        "routes": ["/health", "/hello", "/greet", "/items/{id}", "/users"],
    }
