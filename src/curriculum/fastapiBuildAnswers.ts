import type { AlgorithmLadder } from './algorithmLayers'

/**
 * Full answers for the FastAPI lessons where the learner writes the code (lessons 7-22). Each lesson has one ???;
 * its answer is everything that goes there. Lessons 7-9 write routes, 10-14 also the model and the calls,
 * 15-22 the whole file under the data: imports, app, routes, TestClient calls and prints.
 */
export const FASTAPI_BUILD_ANSWERS: Readonly<Record<string, readonly string[]>> = {
  'api-fastapi-path-query': [`@app.get("/books/{book_id}")
def read_book(book_id: int, shout: bool = False):
    title = BOOKS.get(book_id, "unknown")
    return {"id": book_id, "title": title.upper() if shout else title}

@app.get("/search")
def search(q: str, limit: int = 2):
    found = [title for title in BOOKS.values() if q.lower() in title.lower()]
    return {"q": q, "results": found[:limit]}`],
  'fastapi-post-create': [`@app.post("/notes", status_code=201)
def create_note(note: Note):
    note_id = len(NOTES) + 1
    NOTES[note_id] = note.text
    return {"id": note_id, "text": note.text}

@app.get("/notes")
def list_notes():
    return [{"id": note_id, "text": text} for note_id, text in NOTES.items()]`],
  'api-fastapi-crud': [`@app.put("/todos/{todo_id}")
def replace_todo(todo_id: int, todo: Todo):
    if todo_id not in TODOS:
        raise HTTPException(status_code=404, detail="Todo not found")
    TODOS[todo_id] = todo
    return {"id": todo_id, **todo.model_dump()}

@app.delete("/todos/{todo_id}", status_code=204)
def delete_todo(todo_id: int):
    if todo_id not in TODOS:
        raise HTTPException(status_code=404, detail="Todo not found")
    del TODOS[todo_id]`],
  'api-fastapi-body-model': [`class Signup(BaseModel):
    email: str
    age: int
    newsletter: bool = False

@app.post("/signup", status_code=201)
def signup(user: Signup):
    return {"email": user.email, "age": user.age, "newsletter": user.newsletter}

client = TestClient(app)
for name, body in CASES.items():
    response = client.post("/signup", json=body)
    result = response.json()
    print(name, response.status_code, result if response.status_code == 201 else result["detail"][0]["loc"])`],
  'fastapi-field-limits': [`class Review(BaseModel):
    title: str = Field(min_length=3)
    stars: int = Field(ge=1, le=5)

@app.post("/reviews", status_code=201)
def create_review(review: Review):
    return review

client = TestClient(app)
for name, body in CASES.items():
    response = client.post("/reviews", json=body)
    if response.status_code == 201:
        print(name, response.status_code, response.json())
    else:
        error = response.json()["detail"][0]
        print(name, response.status_code, error["loc"], error["msg"])`],
  'fastapi-query-limits': [`@app.get("/books")
def list_books(limit: int = Query(3, ge=1, le=20)):
    return BOOKS[:limit]

@app.get("/books/{book_id}")
def get_book(book_id: int = Path(gt=0)):
    return {"id": book_id, "title": BOOKS[(book_id - 1) % len(BOOKS)]}

client = TestClient(app)
for url in URLS:
    response = client.get(url)
    body = response.json()
    print(url, response.status_code, body if response.status_code == 200 else body["detail"][0]["msg"])`],
  'fastapi-response-model': [`class UserIn(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    username: str

@app.post("/users", status_code=201, response_model=UserOut)
def create_user(user: UserIn):
    USERS[user.username] = user
    return user

@app.get("/users/{username}", response_model=UserOut)
def get_user(username: str):
    return USERS[username]

client = TestClient(app)
created = client.post("/users", json={"username": "ada", "password": "s3cret"})
print("POST", created.status_code, created.json())
fetched = client.get("/users/ada")
print("GET", fetched.status_code, fetched.json())
print("password leaked:", "password" in created.json() or "password" in fetched.json())`],
  'api-fastapi-http-errors': [`@app.get("/users/{username}")
def get_user(username: str):
    if username not in USERS:
        raise HTTPException(status_code=404, detail=f"No user named {username}")
    return USERS[username]

@app.post("/users/{username}", status_code=201)
def create_user(username: str):
    if username in USERS:
        raise HTTPException(status_code=409, detail="Username already taken")
    USERS[username] = {"name": username.title()}
    return USERS[username]

client = TestClient(app)
for name, method, url in CALLS:
    response = client.request(method, url)
    print(name, response.status_code, response.json())`],
  'fastapi-depends': [`from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

app = FastAPI()

def pagination(skip: int = 0, limit: int = 2):
    return {"skip": skip, "limit": limit}

@app.get("/books")
def list_books(page: dict = Depends(pagination)):
    return BOOKS[page["skip"] : page["skip"] + page["limit"]]

@app.get("/authors")
def list_authors(page: dict = Depends(pagination)):
    return AUTHORS[page["skip"] : page["skip"] + page["limit"]]

client = TestClient(app)
for url in ["/books", "/books?skip=2", "/authors?limit=1", "/authors?skip=3&limit=5"]:
    response = client.get(url)
    print(url, response.status_code, response.json())`],
  'fastapi-yield-dependency': [`from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient

def get_db():
    db = FakeSession()
    LOG.append("open")
    try:
        yield db
    finally:
        db.close()
        LOG.append("close")

app = FastAPI()

@app.get("/notes/{note_id}")
def read_note(note_id: int, db: FakeSession = Depends(get_db)):
    if note_id not in NOTES:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"id": note_id, "text": NOTES[note_id], "session_open": db.open}

client = TestClient(app)
for url in ["/notes/1", "/notes/9"]:
    response = client.get(url)
    print(url, response.status_code, response.json())
print("log", LOG)`],
  'api-fastapi-api-key': [`from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.testclient import TestClient

def require_user(x_api_key: str | None = Header(None)):
    if x_api_key is None:
        raise HTTPException(status_code=401, detail="Missing X-API-Key header")
    user = API_KEYS.get(x_api_key)
    if user is None:
        raise HTTPException(status_code=401, detail="Unknown API key")
    return user

app = FastAPI()

@app.get("/me")
def me(user: str = Depends(require_user)):
    return {"user": user}

@app.delete("/admin/cache")
def clear_cache(user: str = Depends(require_user)):
    if user not in ADMINS:
        raise HTTPException(status_code=403, detail="Admins only")
    return {"cleared": True}

client = TestClient(app)
calls = [
    ("no key", "GET", "/me", {}),
    ("bad key", "GET", "/me", {"X-API-Key": "nope"}),
    ("alice", "GET", "/me", {"X-API-Key": "key-alice"}),
    ("bob clears cache", "DELETE", "/admin/cache", {"X-API-Key": "key-bob"}),
    ("alice clears cache", "DELETE", "/admin/cache", {"X-API-Key": "key-alice"}),
]
for name, method, url, headers in calls:
    response = client.request(method, url, headers=headers)
    print(name, response.status_code, response.json())`],
  'fastapi-current-user': [`from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.testclient import TestClient

def current_user(authorization: str | None = Header(None)):
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not signed in")
    user = TOKENS.get(authorization.removeprefix("Bearer "))
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user

def admin_only(user: dict = Depends(current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    return user

app = FastAPI()

@app.get("/me")
def me(user: dict = Depends(current_user)):
    return {"name": user["name"]}

@app.delete("/cache", dependencies=[Depends(admin_only)])
def clear_cache():
    return {"cleared": True}

client = TestClient(app)
calls = [("GET", "/me", None), ("GET", "/me", "token-ada"), ("GET", "/me", "nope"),
         ("DELETE", "/cache", "token-bob"), ("DELETE", "/cache", "token-ada")]
for method, url, token in calls:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    response = client.request(method, url, headers=headers)
    print(method, url, token, response.status_code, response.json())`],
  'fastapi-routers': [`from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient

notes = APIRouter(prefix="/notes")

@notes.get("/")
def list_notes():
    return list(NOTES.values())

@notes.get("/{note_id}")
def read_note(note_id: int):
    return {"id": note_id, "text": NOTES[note_id]}

users = APIRouter(prefix="/users")

@users.get("/")
def list_users():
    return USERS

app = FastAPI()
app.include_router(notes)
app.include_router(users)

client = TestClient(app)
for url in ["/notes", "/notes/1", "/users"]:
    response = client.get(url)
    print(url, response.status_code, response.json())`],
  'api-fastapi-pagination': [`from fastapi import FastAPI
from fastapi.testclient import TestClient

app = FastAPI()

@app.get("/items")
def list_items(limit: int = 5, offset: int = 0):
    limit = min(limit, MAX_LIMIT)
    page = ITEMS[offset:offset + limit]
    next_offset = offset + limit
    return {"items": page, "total": len(ITEMS), "next_offset": next_offset if next_offset < len(ITEMS) else None}

client = TestClient(app)
offset = 0
while offset is not None:
    body = client.get("/items", params={"limit": 10, "offset": offset}).json()
    print("offset", offset, body["items"][0], "to", body["items"][-1], "next", body["next_offset"])
    offset = body["next_offset"]
print("capped", len(client.get("/items?limit=500").json()["items"]))`],
  'fastapi-dependency-overrides': [`from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

def get_db():
    return {"notes": ["real note"]}

def fake_db():
    return {"notes": ["fake 1", "fake 2"]}

app = FastAPI()

@app.get("/notes")
def list_notes(db: dict = Depends(get_db)):
    return db["notes"]

client = TestClient(app)
print("before", client.get("/notes").json())
app.dependency_overrides[get_db] = fake_db
print("override", client.get("/notes").json())
app.dependency_overrides.clear()
print("after", client.get("/notes").json())`],
  'fastapi-test-asserts': [`def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_missing_note():
    response = client.get("/notes/99")
    assert response.status_code == 404
    assert response.json() == {"detail": "Note not found"}

def test_create_note():
    response = client.post("/notes", json={"text": "Buy milk"})
    assert response.status_code == 201
    assert response.json()["text"] == "Buy milk"

for test in [test_health, test_missing_note, test_create_note]:
    try:
        test()
        print("PASS", test.__name__)
    except AssertionError:
        print("FAIL", test.__name__)`],
}

/** Hint ladders for the same lessons: the idea, what to use, a plan, then the shape of the code. */
export const FASTAPI_BUILD_LADDERS: Readonly<Record<string, AlgorithmLadder>> = {
  'api-fastapi-path-query': {
    idea: 'Names in the path come from the URL; every other parameter comes from the query string. The type hint converts the text and rejects what does not fit.',
    tool: '`@app.get("/books/{book_id}")` with `book_id: int`, a `shout: bool = False` query flag, and `q: str` plus `limit: int = 2` on /search.',
    plan: 'read_book looks the id up in BOOKS and upper-cases the title when shout is true. search keeps titles that contain q in any case and slices the first limit.',
    shape: '`def read_book(book_id: int, shout: bool = False):` returning `{"id": ..., "title": ...}`, and `def search(q: str, limit: int = 2):` with a list comprehension and `found[:limit]`.',
  },
  'fastapi-post-create': {
    idea: 'Create answers 201 with the new id; list returns every stored note in order.',
    tool: '`@app.post("/notes", status_code=201)` with a `note: Note` body, and `@app.get("/notes")`.',
    plan: 'The next id is len(NOTES) + 1. Store note.text under it and return the id with the text. The list route turns NOTES.items() into dicts.',
    shape: '`note_id = len(NOTES) + 1`, `NOTES[note_id] = note.text`, `return {"id": note_id, "text": note.text}`; then `return [{"id": i, "text": t} for i, t in NOTES.items()]`.',
  },
  'api-fastapi-crud': {
    idea: 'PUT replaces a whole todo, DELETE removes it. Both must answer 404 for an id that does not exist, not crash with a KeyError.',
    tool: '`@app.put("/todos/{todo_id}")` with `todo: Todo`, `@app.delete("/todos/{todo_id}", status_code=204)`, and `HTTPException(status_code=404, ...)`.',
    plan: 'Each route checks `todo_id in TODOS` first. PUT stores the new todo and returns it with its id; DELETE runs `del TODOS[todo_id]` and returns nothing.',
    shape: '`if todo_id not in TODOS: raise HTTPException(status_code=404, detail="Todo not found")`, then `TODOS[todo_id] = todo` / `return {"id": todo_id, **todo.model_dump()}`, or `del TODOS[todo_id]`.',
  },
  'api-fastapi-body-model': {
    idea: 'A BaseModel describes the JSON body. FastAPI converts "36" to 36, fills defaults, and answers 422 with the field location before your function runs.',
    tool: '`class Signup(BaseModel)` with `email: str`, `age: int`, `newsletter: bool = False`; `@app.post("/signup", status_code=201)`; `client.post(url, json=body)`.',
    plan: 'Write the model, then a route that returns the three fields. Make a client, post each body in CASES, and print the name, the status and either the JSON or the loc of the first error.',
    shape: '`for name, body in CASES.items():` → `response = client.post("/signup", json=body)` → `print(name, response.status_code, result if response.status_code == 201 else result["detail"][0]["loc"])`.',
  },
  'fastapi-field-limits': {
    idea: 'Field(...) adds rules on top of the type, so every route that takes a Review gets the same checks and the same clear 422.',
    tool: '`from pydantic import Field` is already imported: `title: str = Field(min_length=3)`, `stars: int = Field(ge=1, le=5)`.',
    plan: 'Write the model and a 201 route that returns the review. Post each body in CASES; print the JSON on success, or the loc and msg of the first error.',
    shape: '`error = response.json()["detail"][0]` then `print(name, response.status_code, error["loc"], error["msg"])`.',
  },
  'fastapi-query-limits': {
    idea: 'Query(...) and Path(...) give URL parameters the same limits Field gives body fields.',
    tool: '`limit: int = Query(3, ge=1, le=20)` and `book_id: int = Path(gt=0)`.',
    plan: 'list_books slices BOOKS[:limit]; get_book picks a title with (book_id - 1) % len(BOOKS). Then call every URL and print the body, or the first error message.',
    shape: '`for url in URLS:` → `body = response.json()` → `print(url, response.status_code, body if response.status_code == 200 else body["detail"][0]["msg"])`.',
  },
  'fastapi-response-model': {
    idea: 'Store the full user, but let only an allow-listed shape leave the API. response_model filters whatever the route returns.',
    tool: 'Two models, `UserIn` (username, password) and `UserOut` (username), and `response_model=UserOut` on both routes.',
    plan: 'POST /users stores the UserIn and returns it; GET /users/{username} returns the stored one. Post ada, get ada, then print whether "password" is in either JSON.',
    shape: '`@app.post("/users", status_code=201, response_model=UserOut)` and `@app.get("/users/{username}", response_model=UserOut)`, then three prints: POST, GET, `password leaked:`.',
  },
  'api-fastapi-http-errors': {
    idea: 'An error is a status code plus a detail, raised from the route. 404 means it does not exist; 409 means it clashes with what exists.',
    tool: '`raise HTTPException(status_code=404, detail=f"No user named {username}")` and the same with 409.',
    plan: 'GET checks the user exists. POST refuses a taken name with 409, otherwise stores {"name": username.title()} and answers 201. Then run every call in CALLS.',
    shape: '`for name, method, url in CALLS:` → `response = client.request(method, url)` → `print(name, response.status_code, response.json())`.',
  },
  'fastapi-depends': {
    idea: 'Write the paging rule once as a function, and let FastAPI call it for every request that needs it.',
    tool: '`from fastapi import Depends, FastAPI`, `from fastapi.testclient import TestClient`, and `page: dict = Depends(pagination)`.',
    plan: 'Imports, app, a pagination(skip=0, limit=2) function returning a dict, two routes slicing BOOKS and AUTHORS with it, then a client loop over the four URLs.',
    shape: '`def pagination(skip: int = 0, limit: int = 2): return {"skip": skip, "limit": limit}` and `return BOOKS[page["skip"] : page["skip"] + page["limit"]]`.',
  },
  'fastapi-yield-dependency': {
    idea: 'Code before yield opens the session, the yielded value goes to the route, and finally closes it afterwards, even when the route raises.',
    tool: '`yield` inside `try:` / `finally:` in get_db, `Depends(get_db)` in the route, and `HTTPException` for the 404.',
    plan: 'get_db makes a FakeSession, logs "open", yields it, and in finally closes it and logs "close". The route returns the note with session_open, or raises 404. Call both URLs, then print the log.',
    shape: '`try:` with `yield db` inside, then `finally:` with `db.close()` and `LOG.append("close")`; the route is `def read_note(note_id: int, db: FakeSession = Depends(get_db)):`.',
  },
  'api-fastapi-api-key': {
    idea: 'One dependency reads the X-API-Key header and returns the user, or stops the request with 401. Routes that need a user just depend on it.',
    tool: '`x_api_key: str | None = Header(None)` (x_api_key matches the X-API-Key header), `Depends(require_user)`, `HTTPException` with 401 and 403.',
    plan: 'require_user: no key → 401 "Missing X-API-Key header"; unknown key → 401 "Unknown API key"; else the user name. /me returns it; /admin/cache answers 403 unless the user is in ADMINS.',
    shape: '`def me(user: str = Depends(require_user)): return {"user": user}` and a `for name, method, url, headers in calls:` loop with `client.request(method, url, headers=headers)`.',
  },
  'fastapi-current-user': {
    idea: 'current_user answers "who is calling?" once; admin_only builds on it. 401 means sign in, 403 means signed in but not allowed.',
    tool: '`authorization: str | None = Header(None)`, `.startswith("Bearer ")`, `.removeprefix("Bearer ")`, `Depends(current_user)` inside admin_only, and `dependencies=[Depends(admin_only)]` on the route.',
    plan: 'No or malformed header → 401 "Not signed in"; unknown token → 401 "Invalid token"; reader on the admin route → 403 "Admins only". Send each call with an Authorization header when it has a token.',
    shape: '`headers = {"Authorization": f"Bearer {token}"} if token else {}` then `client.request(method, url, headers=headers)` and one print per call.',
  },
  'fastapi-routers': {
    idea: 'Group related routes in a router with a prefix, then include each router in the app.',
    tool: '`from fastapi import APIRouter, FastAPI`, `APIRouter(prefix="/notes")`, `@notes.get("/")`, `app.include_router(notes)`.',
    plan: 'A notes router with "/" and "/{note_id}", a users router with "/", one app that includes both, then GET /notes, /notes/1 and /users.',
    shape: '`notes = APIRouter(prefix="/notes")` … `users = APIRouter(prefix="/users")` … `app = FastAPI()`, `app.include_router(notes)`, `app.include_router(users)`.',
  },
  'api-fastapi-pagination': {
    idea: 'A page is a slice of the list. next_offset tells the client where the next page starts, or None at the end. The server caps the page size.',
    tool: '`min(limit, MAX_LIMIT)`, `ITEMS[offset:offset + limit]`, and `client.get("/items", params={...})`.',
    plan: 'The route returns items, total and next_offset. The client starts at offset 0 and keeps asking until next_offset is None, printing the first and last item of each page; then it asks for limit=500.',
    shape: '`offset = 0` / `while offset is not None:` → `body = client.get(...).json()` → print → `offset = body["next_offset"]`; finally `print("capped", len(...["items"]))`.',
  },
  'fastapi-dependency-overrides': {
    idea: 'Routes ask for get_db through Depends, so a test can swap it for a fake without touching the route.',
    tool: '`app.dependency_overrides[get_db] = fake_db` and `app.dependency_overrides.clear()`.',
    plan: 'Write get_db and fake_db, a /notes route that depends on get_db, then print the notes before, during and after the override.',
    shape: '`print("before", client.get("/notes").json())`, set the override, `print("override", ...)`, clear it, `print("after", ...)`.',
  },
  'fastapi-test-asserts': {
    idea: 'A test calls the API and asserts on the status and the body. A failing assert raises AssertionError, which the loop reports as FAIL.',
    tool: '`assert response.status_code == ...`, `assert response.json() == ...`, and `test.__name__` for the report.',
    plan: 'test_health checks 200 and the body; test_missing_note checks 404 and the detail; test_create_note checks 201 and the text. Run them in a loop with try/except AssertionError.',
    shape: '`for test in [test_health, test_missing_note, test_create_note]:` → `try: test(); print("PASS", test.__name__)` / `except AssertionError: print("FAIL", test.__name__)`.',
  },
}
