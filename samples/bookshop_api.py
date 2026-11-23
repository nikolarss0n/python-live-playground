# A sample bookshop API for the API tab. Open it with File > Open, then pick a route and press Send.
from datetime import date
from enum import Enum
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Path, Query, Request
from pydantic import BaseModel, Field

app = FastAPI(title="Bookshop")


class Genre(Enum):
    fiction = "fiction"
    science = "science"
    history = "history"


class Author(BaseModel):
    name: str = Field(..., min_length=2, max_length=40)
    born: int | None = None


class BookIn(BaseModel):
    title: str = Field(..., min_length=3)
    price: float = Field(..., gt=0, le=500)
    genre: Genre
    author: Author
    format: Literal["paper", "ebook"] = "paper"
    tags: list[str] = []
    published: date = date(2026, 1, 15)
    stock: int = Field(1, ge=0)


class BookOut(BaseModel):
    id: int
    title: str
    price: float
    genre: Genre


class BookPatch(BaseModel):
    title: str | None = None
    price: float | None = Field(None, gt=0)


class Review(BaseModel):
    stars: int = Field(..., ge=1, le=5)
    text: str = ""


class Category(BaseModel):
    name: str
    children: list["Category"] = []


class Order(BaseModel):
    lines: list[dict[str, int]]
    coupon: str | None
    address: tuple[str, str]


books: dict[int, dict] = {
    1: {"id": 1, "title": "Dune", "price": 12.5, "genre": "fiction", "stock": 3, "secret_cost": 4.0},
    2: {"id": 2, "title": "Cosmos", "price": 18.0, "genre": "science", "stock": 0, "secret_cost": 7.5},
}
reviews: dict[int, list[dict]] = {1: [{"stars": 5, "text": "Classic"}]}


# Dependencies: a header check, paging shared by lists, a class, and one that cleans up after the request.
def require_token(x_token: str = Header()):
    if x_token != "string" and x_token != "secret":
        raise HTTPException(status_code=401, detail="Bad token")
    return x_token


def paging(skip: int = 0, limit: Annotated[int, Query(ge=1, le=50)] = 10):
    return skip, limit


class Sorting:
    def __init__(self, sort_by: str = "title", descending: bool = False):
        self.sort_by = sort_by
        self.descending = descending


def audit_log(user_agent: str | None = Header(None)):
    print("request from", user_agent)
    yield "audit"
    print("request finished")


def find_book(book_id: int = Path(..., ge=1)):
    if book_id not in books:
        raise HTTPException(status_code=404, detail=f"No book {book_id}")
    return books[book_id]


# No parameters at all.
@app.get("/")
def home():
    return {"shop": "Bookshop", "books": len(books)}


# Optional, defaulted, aliased and limited query parameters, plus two dependencies.
@app.get("/books", response_model=list[BookOut])
def list_books(
    genre: Genre | None = None,
    in_stock: bool = False,
    max_price: float = Query(100, gt=0),
    search: str | None = Query(None, alias="q", min_length=2),
    page=Depends(paging),
    sorting: Sorting = Depends(),
):
    found = [book for book in books.values() if book["price"] <= max_price]
    if genre:
        found = [book for book in found if book["genre"] == getattr(genre, "value", genre)]
    if in_stock:
        found = [book for book in found if book["stock"] > 0]
    if search:
        found = [book for book in found if search.lower() in book["title"].lower()]
    found.sort(key=lambda book: book[sorting.sort_by], reverse=sorting.descending)
    skip, limit = page
    return found[skip : skip + limit]


# Required query parameters, one of them with length limits.
@app.get("/search")
def search(term: str = Query(..., min_length=8, max_length=12), year: int = Query(..., ge=1900)):
    return {"term": term, "year": year}


# A nested model, an Enum, a Literal, a date default and a required header.
@app.post("/books", status_code=201, response_model=BookOut)
def create_book(book: BookIn, token: str = Depends(require_token)):
    new_id = max(books) + 1
    books[new_id] = {"id": new_id, **book.model_dump(), "secret_cost": 1.0}
    return books[new_id]


# The same path under three methods; the path parameter is checked by a dependency.
@app.get("/books/{book_id}", response_model=BookOut)
def read_book(book: dict = Depends(find_book)):
    return book


@app.put("/books/{book_id}")
def replace_book(book_id: int, book: BookIn, token: str = Depends(require_token)):
    books[book_id] = {"id": book_id, **book.model_dump()}
    return books[book_id]


@app.patch("/books/{book_id}")
def patch_book(change: BookPatch, book: dict = Depends(find_book)):
    for key, value in change.model_dump().items():
        if value is not None:
            book[key] = value
    return book


@app.delete("/books/{book_id}", status_code=204)
def delete_book(book_id: int, token: str = Depends(require_token), log=Depends(audit_log)):
    books.pop(book_id, None)


# Two path parameters of different types, and a body.
@app.post("/books/{book_id}/reviews/{reviewer}")
async def add_review(book_id: int, reviewer: str, review: Review):
    reviews.setdefault(book_id, []).append({"by": reviewer, **review.model_dump()})
    return reviews[book_id]


# A path parameter with a floor above the usual sample value, a float and an Enum in the path.
@app.get("/orders/{order_id}")
def read_order(order_id: int = Path(..., ge=1000)):
    return {"order_id": order_id}


@app.get("/discount/{percent}/{genre}")
def discount(percent: float, genre: Genre):
    return {"percent": percent, "genre": genre}


# A model that contains itself, and one with a required nullable field, a tuple and a list of dicts.
@app.post("/categories")
def create_category(category: Category):
    return category


@app.post("/orders", status_code=201)
def create_order(order: Order, x_request_id: str | None = Header(None), accept_language: str = Header("en")):
    return {"lines": len(order.lines), "coupon": order.coupon, "request": x_request_id, "language": accept_language}


# A plain dict body, a handler that answers with an error status, and one that crashes.
@app.post("/echo")
def echo(payload: dict):
    return payload


@app.get("/teapot")
def teapot():
    raise HTTPException(status_code=418, detail="I am a teapot")


@app.get("/crash")
def crash(divisor: int = 0):
    return {"result": 1 / divisor}


# A path parameter that swallows slashes, and handlers that read the raw request.
@app.get("/covers/{file_path:path}")
def cover(file_path: str, width: int = 200):
    return {"file": file_path, "folders": file_path.split("/")[:-1], "width": width}


@app.get("/whoami")
def whoami(request: Request):
    return {
        "method": request.method,
        "url": str(request.url),
        "agent": request.headers.get("User-Agent", "unknown"),
        "query": request.query_params,
    }


@app.post("/webhook")
async def webhook(request: Request, x_signature: str = Header("none")):
    payload = await request.json()
    return {"keys": sorted(payload or {}), "signature": x_signature, "bytes": len(await request.body())}


# A router with a prefix and its own dependency.
admin = APIRouter(prefix="/admin", dependencies=[Depends(require_token)])


@admin.get("/stats")
def stats():
    return {"books": len(books), "reviews": sum(len(each) for each in reviews.values())}


@admin.delete("/reviews/{book_id}", status_code=204)
def clear_reviews(book_id: int):
    reviews.pop(book_id, None)


app.include_router(admin)
