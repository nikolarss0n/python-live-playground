import type { LessonDraft } from '../examples'
import { practice } from './studyBookPracticeLessons'

/**
 * The everyday FastAPI moves, each run against the in-browser simulator with TestClient: path and query parameters,
 * Pydantic bodies, HTTPException, a CRUD resource, API-key headers and pagination. Depends, middleware and uploads are
 * left out because the simulator rejects them.
 */
const fastapi = (spec: Omit<Parameters<typeof practice>[0], 'difficulty' | 'chapter' | 'bookChapter'>) =>
  practice({ ...spec, difficulty: 'api', chapter: 'FastAPI essentials', bookChapter: 'fastapi' })

export const FASTAPI_ESSENTIALS_LESSON_DRAFTS: LessonDraft[] = [
  fastapi({
    id: 'api-fastapi-path-query',
    number: 43,
    topic: 'Path and query parameters',
    pipeline: ['match the path', 'convert path params', 'read query params', 'return JSON'],
    goal:
      'Type the path parameter so /books/2 returns Emma and /books/abc returns 422, and give search a default limit of 2 so /search?q=e returns two titles.',
    why:
      'FastAPI reads the function signature: names in the path come from the URL, everything else from the query string, and the type hint decides what gets converted or rejected with 422.',
    tasks: [
      'Annotate book_id so FastAPI converts it to a number',
      'Give limit a default of 2 so it becomes an optional query parameter',
      'Run and compare the 200 and 422 lines',
    ],
    code: `# FastAPI essentials — path and query parameters
# {book_id} in the route becomes a function argument; its type hint converts it.
# Arguments that are not in the path come from the query string: /search?q=e
from fastapi import FastAPI
from fastapi.testclient import TestClient

app = FastAPI()
BOOKS = {1: "Dune", 2: "Emma", 3: "Ulysses"}

@app.get("/books/{book_id}")
def read_book(book_id: ???, shout: bool = False):
    title = BOOKS.get(book_id, "unknown")
    return {"id": book_id, "title": title.upper() if shout else title}

@app.get("/search")
def search(q: str, limit: int = ???):
    found = [title for title in BOOKS.values() if q.lower() in title.lower()]
    return {"q": q, "results": found[:limit]}

client = TestClient(app)
for url in ["/books/2", "/books/2?shout=true", "/books/abc", "/search?q=e", "/search"]:
    response = client.get(url)
    print(url, response.status_code, response.json())
`,
    codeIncludes: ['book_id: int', 'limit: int = 2'],
    printPatterns: [
      "^/books/2 200 \\{'id': 2, 'title': 'Emma'\\}$",
      "^/books/2\\?shout=true 200 \\{'id': 2, 'title': 'EMMA'\\}$",
      '^/books/abc 422 ',
      "^/search\\?q=e 200 \\{'q': 'e', 'results': \\['Dune', 'Emma'\\]\\}$",
      '^/search 422 ',
    ],
    hints: [
      'Without int, book_id stays the text "2", and BOOKS has no key "2".',
      'A parameter with a default is optional; q has none, so /search without q is a 422.',
    ],
    predict: {
      prompt: 'GET /books/abc when the handler says book_id: int. Status?',
      answer: '422, before the handler runs',
      distractors: ['404 Not Found', '500 Internal Server Error'],
    },
    compare: {
      note: 'The type hint is the validation. Leave it out and the handler gets a string.',
      wrong: 'def read_book(book_id, shout: bool = False):',
      fixed: 'def read_book(book_id: int, shout: bool = False):',
    },
    stretch:
      'Stretch: add /books/{book_id}/title that returns only the title, and call it with an id that is not in BOOKS to see what comes back.',
  }),
  fastapi({
    id: 'api-fastapi-body-model',
    number: 44,
    topic: 'Pydantic request bodies',
    pipeline: ['parse JSON', 'validate the model', 'fill defaults', 'call the handler'],
    goal:
      'Make newsletter optional with a default of False and take a Signup body, so a valid signup returns 201 and a missing or non-numeric age returns 422 at body.age.',
    why:
      'A BaseModel is the contract for a JSON body. FastAPI converts "36" to 36, fills defaults and answers 422 with the exact field location before your handler runs.',
    tasks: [
      'Give newsletter a default so clients may leave it out',
      'Annotate the user parameter with the Signup model',
      'Run and read where each 422 points',
    ],
    code: `# FastAPI essentials — Pydantic request bodies
# A BaseModel parameter is read from the JSON body and validated field by field.
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

class Signup(BaseModel):
    email: str
    age: int
    newsletter: bool = ???

app = FastAPI()

@app.post("/signup", status_code=201)
def signup(user: ???):
    return {"email": user.email, "age": user.age, "newsletter": user.newsletter}

client = TestClient(app)
cases = {
    "valid": {"email": "ada@example.com", "age": "36"},
    "missing_age": {"email": "ada@example.com"},
    "bad_age": {"email": "ada@example.com", "age": "old"},
}
for name, body in cases.items():
    response = client.post("/signup", json=body)
    result = response.json()
    print(name, response.status_code, result if response.status_code < 400 else result["detail"][0]["loc"])
`,
    codeIncludes: ['newsletter: bool = False', 'user: Signup'],
    printPatterns: [
      "^valid 201 \\{'email': 'ada@example.com', 'age': 36, 'newsletter': False\\}$",
      "^missing_age 422 \\['body', 'age'\\]$",
      "^bad_age 422 \\['body', 'age'\\]$",
    ],
    hints: [
      'A field with a default value is optional: newsletter: bool = False.',
      'Annotate with the class itself: user: Signup. A plain dict skips all validation.',
    ],
    predict: {
      prompt: 'The body is {"email": "ada@example.com"} and age has no default. Status?',
      answer: '422 with loc body.age',
      distractors: ['201 with age None', '400 Bad Request'],
    },
    compare: {
      note: 'Typed models validate; a dict lets bad data reach your code.',
      wrong: 'def signup(user: dict):',
      fixed: 'def signup(user: Signup):',
    },
    stretch:
      'Stretch: add a name: str field with no default, send a body without it and check that the 422 now lists body.name as well as any other missing field.',
  }),
  fastapi({
    id: 'api-fastapi-http-errors',
    number: 45,
    topic: 'HTTPException and status codes',
    pipeline: ['look up the resource', 'raise on a gap', 'pick 404 / 409', 'return the body'],
    goal:
      'Return 404 for an unknown user and raise HTTPException with 409 when the username is taken, so the five calls print 200, 404, 201, 409 and 200.',
    why:
      'A handler that returns {"error": ...} with status 200 tells every client it worked. HTTPException stops the handler and sends the status and detail the client can act on.',
    tasks: [
      'Use 404 when the user does not exist',
      'Raise HTTPException for a duplicate username',
      'Run and check the five status lines',
    ],
    code: `# FastAPI essentials — HTTPException
# raise HTTPException(status_code=..., detail=...) ends the request with that error.
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

app = FastAPI()
USERS = {"ada": {"name": "Ada"}}

@app.get("/users/{username}")
def get_user(username: str):
    if username not in USERS:
        raise HTTPException(status_code=???, detail=f"No user named {username}")
    return USERS[username]

@app.post("/users/{username}", status_code=201)
def create_user(username: str):
    if username in USERS:
        raise ???(status_code=409, detail="Username already taken")
    USERS[username] = {"name": username.title()}
    return USERS[username]

client = TestClient(app)
calls = [
    ("get ada", "GET", "/users/ada"),
    ("get bob", "GET", "/users/bob"),
    ("create bob", "POST", "/users/bob"),
    ("create ada", "POST", "/users/ada"),
    ("get bob", "GET", "/users/bob"),
]
for name, method, url in calls:
    response = client.request(method, url)
    print(name, response.status_code, response.json())
`,
    codeIncludes: ['status_code=404', 'raise HTTPException(status_code=409'],
    printPatterns: [
      "^get ada 200 \\{'name': 'Ada'\\}$",
      "^get bob 404 \\{'detail': 'No user named bob'\\}$",
      "^create bob 201 \\{'name': 'Bob'\\}$",
      "^create ada 409 \\{'detail': 'Username already taken'\\}$",
      "^get bob 200 \\{'name': 'Bob'\\}$",
    ],
    hints: [
      'Not found is 404. Conflict with existing state is 409.',
      'The second ??? is the exception class you imported from fastapi.',
    ],
    predict: {
      prompt: 'POST /users/ada when ada already exists. Best status?',
      answer: '409 Conflict',
      distractors: ['200 OK', '404 Not Found'],
    },
    compare: {
      note: 'Raise the error; do not return it with a 200.',
      wrong: 'return {"error": "Username already taken"}',
      fixed: 'raise HTTPException(status_code=409, detail="Username already taken")',
    },
    stretch:
      'Stretch: reject usernames shorter than three characters with 422 and a detail that says why, and add that call to the list.',
  }),
  fastapi({
    id: 'api-fastapi-crud',
    number: 46,
    topic: 'A CRUD resource',
    pipeline: ['create 201', 'read 200', 'replace 200', 'delete 204 / 404'],
    goal:
      'Finish PUT and DELETE for /todos so updating todo 1 returns 200, deleting todo 2 returns 204 and then 404, and the final list holds only the finished todo 1.',
    why:
      'Most services are a handful of resources with create, read, update and delete. The same four verbs, a 404 for missing ids and 201/204 for create/delete come up in every API review.',
    tasks: [
      'Store the new todo in PUT',
      'Remove the todo in DELETE',
      'Run and check the list at the end',
    ],
    code: `# FastAPI essentials — create, read, update, delete
from itertools import count
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel

class Todo(BaseModel):
    title: str
    done: bool = False

app = FastAPI()
TODOS = {}
ids = count(1)

@app.post("/todos", status_code=201)
def create_todo(todo: Todo):
    todo_id = next(ids)
    TODOS[todo_id] = todo
    return {"id": todo_id, **todo.model_dump()}

@app.get("/todos")
def list_todos():
    return [{"id": todo_id, **todo.model_dump()} for todo_id, todo in TODOS.items()]

@app.put("/todos/{todo_id}")
def replace_todo(todo_id: int, todo: Todo):
    if todo_id not in TODOS:
        raise HTTPException(status_code=404, detail="Todo not found")
    TODOS[todo_id] = ???
    return {"id": todo_id, **todo.model_dump()}

@app.delete("/todos/{todo_id}", status_code=204)
def delete_todo(todo_id: int):
    if todo_id not in TODOS:
        raise HTTPException(status_code=404, detail="Todo not found")
    ???

client = TestClient(app)
print("create", client.post("/todos", json={"title": "Write tests"}).status_code)
print("create", client.post("/todos", json={"title": "Ship it"}).status_code)
print("update 1", client.put("/todos/1", json={"title": "Write tests", "done": True}).status_code)
print("delete 2", client.delete("/todos/2").status_code)
print("delete 2 again", client.delete("/todos/2").status_code)
print("list", client.get("/todos").json())
`,
    codeIncludes: ['TODOS[todo_id] = todo', 'del TODOS[todo_id]'],
    printPatterns: [
      '^update 1 200$',
      '^delete 2 204$',
      '^delete 2 again 404$',
      "^list \\[\\{'id': 1, 'title': 'Write tests', 'done': True\\}\\]$",
    ],
    hints: [
      'PUT replaces the whole resource, so store the validated todo under its id.',
      'del TODOS[todo_id] removes it; a 204 response has no body, so nothing needs returning.',
    ],
    predict: {
      prompt: 'DELETE the same todo twice. What does the second call return?',
      answer: '404, because it no longer exists',
      distractors: ['204 again', '500 KeyError'],
    },
    compare: {
      note: 'Check existence first so a missing id is a 404, not a KeyError and a 500.',
      wrong: 'del TODOS[todo_id]  # without the check above',
      fixed: 'if todo_id not in TODOS:\n    raise HTTPException(status_code=404, detail="Todo not found")\ndel TODOS[todo_id]',
    },
    stretch:
      'Stretch: add GET /todos/{todo_id} that returns one todo or 404, and a PATCH that only flips done without needing the title again.',
  }),
  fastapi({
    id: 'api-fastapi-api-key',
    number: 47,
    topic: 'API keys in headers',
    pipeline: ['read the header', 'know the caller 401', 'check the role 403', 'run the handler'],
    goal:
      'Read X-API-Key as an optional header and return 403 when a known non-admin clears the cache, so the calls print 401, 401, 200, 403 and 200.',
    why:
      '401 means "who are you?" and 403 means "I know you, and no". Real FastAPI moves this check into Depends; the playground has no Depends, so a plain function does the same job.',
    tasks: [
      'Declare x_api_key as an optional Header in /me',
      'Use 403 for a known user who is not an admin',
      'Run and compare the 401 and 403 lines',
    ],
    code: `# FastAPI essentials — API keys in headers
# Header(None) reads an optional header; x_api_key matches the X-API-Key header.
from fastapi import FastAPI, Header, HTTPException
from fastapi.testclient import TestClient

API_KEYS = {"key-alice": "alice", "key-bob": "bob"}
ADMINS = {"alice"}

def require_user(x_api_key):
    if x_api_key is None:
        raise HTTPException(status_code=401, detail="Missing X-API-Key header")
    user = API_KEYS.get(x_api_key)
    if user is None:
        raise HTTPException(status_code=401, detail="Unknown API key")
    return user

app = FastAPI()

@app.get("/me")
def me(x_api_key: str | None = ???):
    return {"user": require_user(x_api_key)}

@app.delete("/admin/cache")
def clear_cache(x_api_key: str | None = Header(None)):
    user = require_user(x_api_key)
    if user not in ADMINS:
        raise HTTPException(status_code=???, detail="Admins only")
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
    print(name, response.status_code, response.json())
`,
    codeIncludes: ['= Header(None)', 'status_code=403'],
    printPatterns: [
      "^no key 401 \\{'detail': 'Missing X-API-Key header'\\}$",
      "^bad key 401 \\{'detail': 'Unknown API key'\\}$",
      "^alice 200 \\{'user': 'alice'\\}$",
      "^bob clears cache 403 \\{'detail': 'Admins only'\\}$",
      "^alice clears cache 200 \\{'cleared': True\\}$",
    ],
    hints: [
      'Copy the default from clear_cache: Header(None). Without Header, FastAPI looks in the query string.',
      'Bob has a valid key, so this is not 401. He is just not allowed: 403.',
    ],
    predict: {
      prompt: 'A valid key for a user who is not an admin calls an admin route. Status?',
      answer: '403 Forbidden',
      distractors: ['401 Unauthorized', '404 Not Found'],
    },
    compare: {
      note: 'Missing or unknown credentials are 401; known but not allowed is 403.',
      wrong: 'raise HTTPException(status_code=401, detail="Admins only")',
      fixed: 'raise HTTPException(status_code=403, detail="Admins only")',
    },
    stretch:
      'Stretch: compare keys with secrets.compare_digest instead of a dict lookup on the raw key, and explain in a comment why timing matters for key checks.',
  }),
  fastapi({
    id: 'api-fastapi-pagination',
    number: 48,
    topic: 'Pagination with limit and offset',
    pipeline: ['cap the limit', 'slice the page', 'compute next_offset', 'stop at the end'],
    goal:
      'Slice one page from limit and offset and stop next_offset at the end, so walking 23 items ten at a time prints three pages and an oversized limit is capped at 20.',
    why:
      'Every list endpoint needs paging before the data grows. A capped limit protects the server, and next_offset tells clients when to stop instead of letting them guess.',
    tasks: [
      'Fill the slice so page starts at offset and holds at most limit items',
      'Return None for next_offset once it passes the last item',
      'Run and check the three pages and the cap',
    ],
    code: `# FastAPI essentials — pagination
from fastapi import FastAPI
from fastapi.testclient import TestClient

app = FastAPI()
ITEMS = [f"item-{n}" for n in range(1, 24)]
MAX_LIMIT = 20

@app.get("/items")
def list_items(limit: int = 5, offset: int = 0):
    limit = min(limit, MAX_LIMIT)
    page = ITEMS[???]
    next_offset = offset + limit
    return {
        "items": page,
        "total": len(ITEMS),
        "next_offset": next_offset if next_offset < ??? else None,
    }

client = TestClient(app)
offset = 0
while offset is not None:
    body = client.get("/items", params={"limit": 10, "offset": offset}).json()
    print("offset", offset, body["items"][0], "to", body["items"][-1], "next", body["next_offset"])
    offset = body["next_offset"]
print("capped", len(client.get("/items?limit=500").json()["items"]))
`,
    codeIncludes: ['offset:offset + limit', 'len(ITEMS)'],
    printPatterns: [
      '^offset 0 item-1 to item-10 next 10$',
      '^offset 10 item-11 to item-20 next 20$',
      '^offset 20 item-21 to item-23 next None$',
      '^capped 20$',
    ],
    hints: [
      'A page is ITEMS[offset:offset + limit].',
      'There is a next page only while next_offset is below the total, len(ITEMS).',
    ],
    predict: {
      prompt: 'ITEMS has 23 entries. With limit 10, how many pages?',
      answer: '3',
      distractors: ['2', '23'],
    },
    compare: {
      note: 'Cap the limit on the server; never trust a client to ask for a sane page size.',
      wrong: 'page = ITEMS[offset:offset + limit]  # limit=500 returns everything',
      fixed: 'limit = min(limit, MAX_LIMIT)\npage = ITEMS[offset:offset + limit]',
    },
    stretch:
      'Stretch: switch to cursor paging that returns the last item name as next_cursor, and explain in a comment why cursors survive inserts better than offsets.',
  }),
]
