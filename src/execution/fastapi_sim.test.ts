import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PYTHON_PRELUDE } from './instrument'

const SIM = path.resolve('src/execution/fastapi_sim.py')

function sim(req: Record<string, unknown>): Record<string, unknown> {
  const stdout = execFileSync('python3', [SIM], {
    input: JSON.stringify(req),
    encoding: 'utf8',
    timeout: 15_000,
  })
  return JSON.parse(stdout) as Record<string, unknown>
}

const GET_HELLO = `
from fastapi import FastAPI

app = FastAPI()

@app.get("/hello")
def hello():
    return {"message": "hi"}
`

const PATH_ITEM = `
from fastapi import FastAPI

app = FastAPI()

@app.get("/items/{item_id}")
def read_item(item_id: int):
    return {"id": item_id}
`

const QUERY_GREET = `
from fastapi import FastAPI

app = FastAPI()

@app.get("/greet")
def greet(name: str = "world"):
    return {"message": f"Hello, {name}!"}
`

const POST_USER = `
from fastapi import FastAPI
from pydantic import BaseModel

class User(BaseModel):
    name: str

app = FastAPI()

@app.post("/users")
def create(user: User):
    return {"name": user.name}
`

const HTTP_EXC = `
from fastapi import FastAPI, HTTPException

app = FastAPI()

@app.get("/secret")
def secret():
    raise HTTPException(status_code=401, detail="nope")
`

const HANDLER_TRAP = `
from fastapi import FastAPI

app = FastAPI()

@app.get("/hello")
def hello():
    raise RuntimeError("handler ran at import")
`

describe('fastapi_sim dispatch (shipped python module)', () => {
  it('GET 200 JSON does not run the handler until dispatch', () => {
    const registered = sim({ op: 'register', source: HANDLER_TRAP })
    expect(registered.routes).toEqual([
      { method: 'GET', path: '/hello', callPath: '/hello', name: 'hello' },
    ])

    const result = sim({
      source: GET_HELLO,
      method: 'GET',
      path: '/hello',
    })
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ message: 'hi' })
    expect(result.method).toBe('GET')
    expect(result.path).toBe('/hello')
    expect(result.simulated).toBe(true)
  })

  it('fills a path param', () => {
    const result = sim({
      source: PATH_ITEM,
      method: 'GET',
      path: '/items/7',
    })
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ id: 7 })
  })

  it('reads a query param', () => {
    const result = sim({
      source: QUERY_GREET,
      method: 'GET',
      path: '/greet',
      query: { name: 'Ada' },
    })
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ message: 'Hello, Ada!' })
  })

  it('POST valid BaseModel', () => {
    const result = sim({
      source: POST_USER,
      method: 'POST',
      path: '/users',
      body: { name: 'Ada' },
    })
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ name: 'Ada' })
  })

  it('POST invalid body is 4xx', () => {
    const result = sim({
      source: POST_USER,
      method: 'POST',
      path: '/users',
      body: {},
    })
    expect(result.status).toBeGreaterThanOrEqual(400)
    expect(result.status).toBeLessThan(500)
  })

  it('treats a dict annotation as a JSON object body without coercing its values', () => {
    const source = `from fastapi import FastAPI
app = FastAPI()
@app.post("/questions")
def question(payload: dict):
    return payload
`
    expect(sim({ source, method: 'POST', path: '/questions', body: { question: 42 } })).toMatchObject({
      status: 200, body: { question: 42 },
    })
    expect(sim({ source, method: 'POST', path: '/questions', body: [] }).status).toBe(422)
    expect(sim({ source, method: 'POST', path: '/questions' }).status).toBe(422)
  })

  it('HTTPException uses its status', () => {
    const result = sim({
      source: HTTP_EXC,
      method: 'GET',
      path: '/secret',
    })
    expect(result.status).toBe(401)
    expect(result.body).toEqual({ detail: 'nope' })
  })

  it('unmatched path is 404', () => {
    const result = sim({
      source: GET_HELLO,
      method: 'GET',
      path: '/missing',
    })
    expect(result.status).toBe(404)
  })

  it('awaits an async def route instead of returning the coroutine', () => {
    const result = sim({
      source: `
import asyncio
from fastapi import FastAPI
app = FastAPI()
async def total(n: int) -> int:
    await asyncio.sleep(0.01)
    return n * 2
@app.get("/double/{n}")
async def double(n: int):
    return {"n": await total(n)}
`,
      method: 'GET',
      path: '/double/21',
    })
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ n: 42 })
  })

  it('awaits an async def route called from learner code that already runs in an event loop', () => {
    const script = `import asyncio, json, sys
sys.path.insert(0, ${JSON.stringify(path.resolve('src/execution'))})
request = json.loads(sys.stdin.read())
exec(request["prelude"], globals())
print(json.dumps(asyncio.run(_plp_run_async(request["source"])), default=str))
`
    const source = `import asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient
app = FastAPI()
async def lookup(item_id: int):
    await asyncio.sleep(0)
    return {"id": item_id}
@app.get("/items/{item_id}")
async def read_item(item_id: int):
    return await lookup(item_id)
@app.get("/slow")
async def slow():
    await asyncio.sleep(1)
    return {}
client = TestClient(app)
print(client.get("/items/7").json())
client.get("/slow")
`
    const output = execFileSync('python3', ['-c', script], {
      input: JSON.stringify({ source, prelude: PYTHON_PRELUDE }), encoding: 'utf8', timeout: 15_000,
    })
    const payload = JSON.parse(output) as { events: { kind: string; text?: string; message?: string }[] }
    expect(payload.events[0]).toMatchObject({ kind: 'print', text: "{'id': 7}" })
    expect(payload.events.at(-1)?.message).toMatch(/cannot pause an async route for a timer/)
  })

  it('solves Depends, yield dependencies, router prefixes, response_model, limits and test overrides', () => {
    const { value } = sim({
      op: 'exec',
      source: `
from typing import Annotated
from fastapi import FastAPI, Depends, APIRouter, Query, Path, HTTPException, Header
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field
log = []
def get_db():
    log.append("open")
    try:
        yield {1: "milk"}
    finally:
        log.append("close")
def paging(limit: int = Query(10, ge=1, le=50)):
    return limit
def current_user(authorization: str = Header(None)):
    if authorization != "Bearer t":
        raise HTTPException(401, "bad token")
    return "ada"
class UserOut(BaseModel):
    name: str
class NoteIn(BaseModel):
    title: str = Field(min_length=3)
router = APIRouter(prefix="/notes")
@router.get("/")
def list_notes(db: Annotated[dict, Depends(get_db)], limit: int = Depends(paging)):
    return {"count": len(db), "limit": limit}
@router.get("/{note_id}")
def one(note_id: int = Path(gt=0)):
    return {"id": note_id}
@router.post("/", status_code=201)
def make(note: NoteIn):
    return note
@router.delete("/{note_id}", status_code=204)
def remove(note_id: int):
    return None
app = FastAPI()
app.include_router(router)
@app.get("/me", response_model=UserOut)
def me(name: str = Depends(current_user)):
    return {"name": name, "password": "secret"}
c = TestClient(app)
out = [[r.status_code, r.json()] for r in [
    c.get("/notes"), c.get("/notes?limit=0"), c.get("/notes/0"), c.post("/notes", json={"title": "hi"}),
    c.delete("/notes/1"), c.get("/me", headers={"Authorization": "Bearer t"}), c.get("/me"),
]]
out.append(log)
app.dependency_overrides[get_db] = lambda: {}
out.append(c.get("/notes").json())
`,
    })
    expect(value).toEqual([
      [200, { count: 1, limit: 10 }],
      [422, { detail: [{ loc: ['query', 'limit'], msg: 'Input should be greater than or equal to 1', type: 'greater_than_equal' }] }],
      [422, { detail: [{ loc: ['path', 'note_id'], msg: 'Input should be greater than 0', type: 'greater_than' }] }],
      [422, { detail: [{ loc: ['body', 'title'], msg: 'String should have at least 3 characters', type: 'string_too_short' }] }],
      [204, null],
      [200, { name: 'ada' }],
      [401, { detail: 'bad token' }],
      ['open', 'close', 'open', 'close'],
      { count: 0, limit: 10 },
    ])
  })

  it('uvicorn.run fails with a simulated-FastAPI error', () => {
    expect(() =>
      sim({
        op: 'register',
        source: `
from fastapi import FastAPI
import uvicorn
app = FastAPI()
uvicorn.run(app)
`,
      }),
    ).toThrow(/uvicorn/i)
  })

  it('GET /docs is a clear simulated miss, not a hang', () => {
    const result = sim({
      source: GET_HELLO,
      method: 'GET',
      path: '/docs',
    })
    expect(result.status).toBe(404)
    expect(JSON.stringify(result.body)).toMatch(/simulated FastAPI/i)
  })

  it('PUT PATCH DELETE with JSON body', () => {
    const source = `
from fastapi import FastAPI
from pydantic import BaseModel

class Item(BaseModel):
    title: str

app = FastAPI()

@app.put("/items/{item_id}")
def replace(item_id: int, item: Item):
    return {"id": item_id, "title": item.title}

@app.patch("/items/{item_id}")
def update(item_id: int, item: Item):
    return {"id": item_id, "title": item.title}

@app.delete("/items/{item_id}")
def remove(item_id: int):
    return {"deleted": item_id}
`
    expect(
      sim({
        source,
        method: 'PUT',
        path: '/items/3',
        body: { title: 'Notebook' },
      }),
    ).toMatchObject({
      status: 200,
      body: { id: 3, title: 'Notebook' },
    })
    expect(
      sim({
        source,
        method: 'PATCH',
        path: '/items/3',
        body: { title: 'Journal' },
      }),
    ).toMatchObject({
      status: 200,
      body: { id: 3, title: 'Journal' },
    })
    expect(
      sim({ source, method: 'DELETE', path: '/items/3' }),
    ).toMatchObject({
      status: 200,
      body: { deleted: 3 },
    })
  })

  it('reads Authorization via Header() case-insensitively', () => {
    const source = `
from fastapi import FastAPI, Header, HTTPException

app = FastAPI()

@app.get("/secret")
def secret(authorization: str | None = Header(default=None)):
    if authorization != "Bearer secret":
        raise HTTPException(status_code=401, detail="nope")
    return {"ok": True}
`
    expect(
      sim({
        source,
        method: 'GET',
        path: '/secret',
        headers: { Authorization: 'Bearer secret' },
      }),
    ).toMatchObject({ status: 200, body: { ok: true } })
    expect(
      sim({ source, method: 'GET', path: '/secret', headers: {} }),
    ).toMatchObject({ status: 401, body: { detail: 'nope' } })
  })

  it('maps x_api_key Header param to X-API-Key', () => {
    const source = `
from fastapi import FastAPI, Header

app = FastAPI()

@app.get("/tenant")
def tenant(x_api_key: str = Header()):
    return {"key": x_api_key}
`
    const result = sim({
      source,
      method: 'GET',
      path: '/tenant',
      headers: { 'X-API-Key': 'acme' },
    })
    expect(result).toMatchObject({ status: 200, body: { key: 'acme' } })
  })

  it('accepts nested list fields on BaseModel', () => {
    const source = `
from fastapi import FastAPI
from pydantic import BaseModel

class User(BaseModel):
    name: str
    tags: list[str] = []

app = FastAPI()

@app.post("/users", status_code=201)
def create(user: User):
    return {"id": 1, "name": user.name, "tags": user.tags}
`
    const result = sim({
      source,
      method: 'POST',
      path: '/users',
      body: { name: 'Ada', tags: ['admin', 'staff'] },
    })
    expect(result.status).toBe(201)
    expect(result.body).toEqual({
      id: 1,
      name: 'Ada',
      tags: ['admin', 'staff'],
    })
  })

  it('TestClient posts JSON with headers and exposes status_code/json', () => {
    const source = `
from fastapi import FastAPI, Header, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel

class User(BaseModel):
    name: str
    tags: list[str] = []

app = FastAPI()

@app.post("/users", status_code=201)
def create(user: User, authorization: str | None = Header(default=None)):
    if authorization != "Bearer secret":
        raise HTTPException(status_code=401, detail="nope")
    return {"id": 1, "name": user.name, "tags": user.tags}

client = TestClient(app)
response = client.post(
    "/users",
    json={"name": "Ada", "tags": ["admin"]},
    headers={"Authorization": "Bearer secret"},
)
out = {
    "status_code": response.status_code,
    "json": response.json(),
    "printed": dict(response),
}
`
    const result = sim({ op: 'exec', source, export: 'out' })
    expect(result.value).toEqual({
      status_code: 201,
      json: { id: 1, name: 'Ada', tags: ['admin'] },
      printed: {
        method: 'POST',
        path: '/users',
        status: 201,
        body: { id: 1, name: 'Ada', tags: ['admin'] },
        simulated: true,
      },
    })
  })

  it('TestClient get with query params and 404', () => {
    const source = `
from fastapi import FastAPI
from fastapi.testclient import TestClient

app = FastAPI()

@app.get("/greet")
def greet(name: str = "world"):
    return {"message": f"Hello, {name}!"}

client = TestClient(app)
out = {
    "ok": client.get("/greet", params={"name": "Ada"}).json(),
    "missing": dict(client.get("/nope")),
}
`
    const result = sim({ op: 'exec', source, export: 'out' })
    expect(result.value).toEqual({
      ok: { message: 'Hello, Ada!' },
      missing: {
        method: 'GET',
        path: '/nope',
        status: 404,
        body: { detail: 'Not Found' },
        simulated: true,
      },
    })
  })
})

const PREPARED = `
from enum import Enum
from typing import Annotated, Literal
from fastapi import APIRouter, Depends, FastAPI, Header, Query
from pydantic import BaseModel, Field

app = FastAPI()

class Color(Enum):
    red = "red"
    blue = "blue"

class Tag(BaseModel):
    label: str

class Item(BaseModel):
    name: str = Field(..., min_length=8)
    price: float = Field(..., gt=10)
    qty: int = 1
    color: Color
    kind: Literal["new", "used"]
    main: Tag
    tags: list[Tag] = []
    note: str | None = None

def auth(x_token: str = Header()):
    return x_token

def paging(skip: int = 0, limit: Annotated[int, Query(le=50)] = 10):
    return skip, limit

@app.get("/items/{item_id}")
def read_item(item_id: int, q: str | None = None, verbose: bool = False, page=Depends(paging)):
    return {"id": item_id, "page": page}

@app.post("/items", status_code=201)
def create_item(item: Item, token: str = Depends(auth)):
    return {"name": item.name, "token": token}

@app.get("/search")
def search(term: str, min_price: float = Query(..., ge=5)):
    return {"term": term, "min_price": min_price}

admin = APIRouter(prefix="/admin", dependencies=[Depends(auth)])

@admin.delete("/items/{item_id}")
def remove(item_id: int):
    return {"removed": item_id}

app.include_router(admin)
`

type Field = { name: string; value: string; required: boolean }
type Prepared = { method: string; path: string; callPath: string; name?: string; query?: Field[]; headers?: Field[]; body?: string }
const pairs = (fields: Field[] = []) => Object.fromEntries(fields.filter((field) => field.value !== '').map((field) => [field.name, field.value]))

describe('fastapi_sim prepared requests', () => {
  const routes = sim({ op: 'register', source: PREPARED }).routes as Prepared[]
  const route = (method: string, path: string) => routes.find((r) => r.method === method && r.path === path)!

  it('keeps defaults and samples required query parameters, including a dependency\'s', () => {
    expect(route('GET', '/items/{item_id}').query).toEqual([
      { name: 'q', value: '', required: false },
      { name: 'verbose', value: 'false', required: false },
      { name: 'skip', value: '0', required: false },
      { name: 'limit', value: '10', required: false },
    ])
    expect(route('GET', '/search').query).toEqual([
      { name: 'term', value: 'string', required: true },
      { name: 'min_price', value: '9.99', required: true },
    ])
  })

  it('finds headers read by a handler dependency and by a router dependency', () => {
    const header = [{ name: 'x-token', value: 'string', required: true }]
    expect(route('POST', '/items').headers).toEqual(header)
    expect(route('DELETE', '/admin/items/{item_id}').headers).toEqual(header)
  })

  it('builds the JSON body from the model, inside its limits', () => {
    expect(JSON.parse(route('POST', '/items').body!)).toEqual({
      name: 'stringxx', price: 11, qty: 1, color: 'red', kind: 'new', main: { label: 'string' }, tags: [], note: null,
    })
    expect(route('GET', '/search').body).toBeUndefined()
    expect(route('POST', '/items').name).toBe('create_item')
  })

  it('every prepared request is accepted as it stands', () => {
    const expected: Record<string, number> = { 'GET /items/{item_id}': 200, 'POST /items': 201, 'GET /search': 200, 'DELETE /admin/items/{item_id}': 200 }
    for (const prepared of routes) {
      const result = sim({
        source: PREPARED, method: prepared.method, path: prepared.callPath,
        query: pairs(prepared.query), headers: pairs(prepared.headers),
        ...(prepared.body ? { body: JSON.parse(prepared.body) } : {}),
      })
      expect(`${prepared.method} ${prepared.path} → ${result.status}`).toBe(`${prepared.method} ${prepared.path} → ${expected[`${prepared.method} ${prepared.path}`]}`)
    }
  })
})

const EDGE_CASES = `
from __future__ import annotations
from datetime import date, datetime
from enum import Enum
from typing import Annotated
from fastapi import Depends, FastAPI, Header, Path, Query
from pydantic import BaseModel, Field

app = FastAPI()

class Color(Enum):
    red = "red"
    blue = "blue"

class Event(BaseModel):
    at: datetime
    day: date = date(2026, 1, 15)
    color: Color = Color.blue
    point: tuple[int, int]
    ratio: float = Field(..., gt=0, lt=0.4)
    parent: Event | None = None

def find(order_id: int = Path(..., ge=1000)):
    return order_id

@app.get("/orders/{order_id}/{color}/{owner}/{share}")
def order(color: Color, owner: str, share: float, found: int = Depends(find)):
    return {"order": found, "color": color, "owner": owner, "share": share}

@app.get("/paint")
def paint(color: Color = Color.blue, since: date = date(2026, 1, 1), tags: list[str] = Query([]), ids: list[int] = Query(...)):
    return {"color": color, "since": since, "tags": tags, "ids": ids}

@app.post("/events")
def event(event: Event):
    return event

@app.get("/var")
def var(*args, **kwargs):
    return {"args": len(args)}

@app.get("/same")
def first():
    return {"n": 1}

@app.get("/same")
def second():
    return {"n": 2}

app.get("/lambda")(lambda who="Ada": {"hi": who})
`

describe('fastapi_sim prepared requests, edge cases', () => {
  const routes = sim({ op: 'register', source: EDGE_CASES }).routes as Prepared[]
  const route = (method: string, path: string) => routes.find((r) => r.method === method && r.path === path)!
  const send = (prepared: Prepared) => sim({
    source: EDGE_CASES, method: prepared.method, path: prepared.callPath,
    query: pairs(prepared.query), headers: pairs(prepared.headers),
    ...(prepared.body ? { body: JSON.parse(prepared.body) } : {}),
  })

  it('fills the path by type and limit, including a parameter a dependency reads', () => {
    const prepared = route('GET', '/orders/{order_id}/{color}/{owner}/{share}')
    expect(prepared.callPath).toBe('/orders/1000/red/owner/1.5')
    expect(send(prepared)).toMatchObject({ status: 200, body: { order: 1000, color: 'red', owner: 'owner', share: 1.5 } })
  })

  it('writes Enum and date defaults as JSON carries them and leaves a list default unsent', () => {
    expect(route('GET', '/paint').query).toEqual([
      { name: 'color', value: 'blue', required: false },
      { name: 'since', value: '2026-01-01', required: false },
      { name: 'tags', value: '', required: false },
      { name: 'ids', value: '1', required: true },
    ])
    expect(send(route('GET', '/paint'))).toMatchObject({ status: 200, body: { color: 'blue', since: '2026-01-01', tags: [], ids: [1] } })
  })

  it('samples dates, fixed tuples and ranged floats, and resolves postponed annotations', () => {
    const prepared = route('POST', '/events')
    expect(JSON.parse(prepared.body!)).toEqual({ at: '2026-01-15T09:30:00', day: '2026-01-15', color: 'blue', point: [1, 1], ratio: 0.2, parent: null })
    expect(send(prepared).status).toBe(200)
  })

  it('reads *args and **kwargs as FastAPI does: two required query parameters', () => {
    expect(route('GET', '/var').query).toEqual([
      { name: 'args', value: 'string', required: true },
      { name: 'kwargs', value: 'string', required: true },
    ])
    expect(send(route('GET', '/var'))).toMatchObject({ status: 200, body: { args: 0 } })
    expect(sim({ source: EDGE_CASES, method: 'GET', path: '/var' })).toMatchObject({ status: 422, body: { detail: [{ loc: ['query', 'args'] }, { loc: ['query', 'kwargs'] }] } })
  })

  it('lists a method and path once, and names only real functions', () => {
    expect(routes.filter((r) => r.path === '/same').map((r) => r.name)).toEqual(['first'])
    expect(route('GET', '/lambda').name).toBeUndefined()
    expect(route('GET', '/lambda').query).toEqual([{ name: 'who', value: 'Ada', required: false }])
  })
})

const RAW_REQUESTS = `
from fastapi import Depends, FastAPI, Header, Request

app = FastAPI()

@app.get("/files/{file_path:path}")
def files(file_path: str, width: int = 200):
    return {"file": file_path, "width": width}

@app.get("/v1.0/items/{item_id:int}")
def versioned(item_id: int):
    return {"id": item_id}

def caller(request: Request):
    return request.headers.get("X-Caller", "nobody")

@app.post("/hooks/{name}")
async def hook(name: str, request: Request, who: str = Depends(caller), x_signature: str = Header("none")):
    payload = await request.json()
    return {
        "method": request.method, "url": str(request.url), "path": request.url.path,
        "query": request.query_params, "params": request.path_params, "who": who,
        "keys": sorted(payload or {}), "bytes": len(await request.body()), "signature": x_signature,
    }
`

describe('fastapi_sim path converters and Request', () => {
  const routes = sim({ op: 'register', source: RAW_REQUESTS }).routes as Prepared[]

  it('matches slashes with {name:path} and prepares a path that shows it', () => {
    const prepared = routes.find((r) => r.path === '/files/{file_path:path}')!
    expect(prepared.callPath).toBe('/files/folder/file.txt')
    expect(prepared.query).toEqual([{ name: 'width', value: '200', required: false }])
    expect(sim({ source: RAW_REQUESTS, method: 'GET', path: prepared.callPath })).toMatchObject({ status: 200, body: { file: 'folder/file.txt', width: 200 } })
  })

  it('treats the rest of the path as literal text and honours {name:int}', () => {
    expect(sim({ source: RAW_REQUESTS, method: 'GET', path: '/v1.0/items/7' })).toMatchObject({ status: 200, body: { id: 7 } })
    expect(sim({ source: RAW_REQUESTS, method: 'GET', path: '/v1x0/items/7' }).status).toBe(404)
    expect(sim({ source: RAW_REQUESTS, method: 'GET', path: '/v1.0/items/seven' }).status).toBe(404)
  })

  it('hands a handler and its dependency the request', () => {
    const prepared = routes.find((r) => r.path === '/hooks/{name}')!
    expect(prepared.callPath).toBe('/hooks/Example')
    expect(prepared.query).toBeUndefined()
    expect(prepared.headers).toEqual([{ name: 'x-signature', value: 'none', required: false }])
    expect(prepared.body).toBe('{}')
    expect(sim({ source: RAW_REQUESTS, method: 'POST', path: '/hooks/pay' })).toMatchObject({ status: 500, body: { detail: expect.stringContaining('JSONDecodeError') } })
    const result = sim({ source: RAW_REQUESTS, method: 'POST', path: '/hooks/pay', query: { retry: '2' }, headers: { 'x-caller': 'stripe' }, body: { id: 1, amount: 5 } })
    expect(result).toMatchObject({
      status: 200,
      body: {
        method: 'POST', url: 'http://testserver/hooks/pay?retry=2', path: '/hooks/pay', query: { retry: '2' }, params: { name: 'pay' },
        who: 'stripe', keys: ['amount', 'id'], bytes: 19, signature: 'none',
      },
    })
  })
})

const NAMED = `
from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI()

class Signup(BaseModel):
    email: str
    firstName: str
    title: str = Field(..., max_length=40)
    city: str = Field(..., min_length=10)
    unit_price: float
    stars: int = Field(..., ge=1, le=3)
    age: int
    nickname: str

@app.post("/users/{username}/signups")
def signup(username: str, signup: Signup, year: int, website: str):
    return signup

@app.get("/divide")
def divide(by: int = 0):
    total = 10
    return total / by
`

describe('fastapi_sim samples by field name, and crash lines', () => {
  const routes = sim({ op: 'register', source: NAMED }).routes as Prepared[]

  it('fills a field with a value that suits its name, when that value fits the limits', () => {
    const prepared = routes.find((r) => r.path === '/users/{username}/signups')!
    expect(prepared.callPath).toBe('/users/ada/signups')
    expect(prepared.query).toEqual([
      { name: 'year', value: '2026', required: true },
      { name: 'website', value: 'https://example.com', required: true },
    ])
    expect(JSON.parse(prepared.body!)).toEqual({
      email: 'ada@example.com', firstName: 'Ada', title: 'Example title', city: 'stringxxxx',
      unit_price: 9.99, stars: 3, age: 30, nickname: 'string',
    })
    expect(sim({ source: NAMED, method: 'POST', path: prepared.callPath, query: pairs(prepared.query), body: JSON.parse(prepared.body!) }).status).toBe(200)
  })

  it('reports the line a handler crashed on', () => {
    const line = NAMED.split('\n').findIndex((text) => text.includes('return total / by')) + 1
    expect(sim({ source: NAMED, method: 'GET', path: '/divide' })).toMatchObject({ status: 500, line, body: { detail: 'ZeroDivisionError: division by zero' } })
    expect(sim({ source: NAMED, method: 'GET', path: '/divide', query: { by: '2' } })).not.toHaveProperty('line')
  })
})

const STRICT = `
from datetime import date
from enum import Enum
from typing import Literal
from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI()

class Genre(Enum):
    fiction = "fiction"
    science = "science"

class Author(BaseModel):
    name: str = Field(..., min_length=2)

class Book(BaseModel):
    title: str = Field(..., min_length=3)
    price: float = Field(..., le=500)
    genre: Genre
    author: Author
    format: Literal["paper", "ebook"] = "paper"
    published: date = date(2026, 1, 15)
    pages: int

@app.post("/books")
def create(book: Book, limit: int = 10):
    return {"genre": book.genre.name, "year": book.published.year, "book": book}
`

describe('fastapi_sim validation', () => {
  const post = (body: unknown, query?: Record<string, string>) => sim({ source: STRICT, method: 'POST', path: '/books', body, ...(query ? { query } : {}) })
  const good = { title: 'Dune', price: 12.5, genre: 'science', author: { name: 'Frank' }, published: '1965-08-01', pages: 412 }

  it('hands the handler Enum members and dates, and sends them back as JSON', () => {
    expect(post(good)).toMatchObject({ status: 200, body: { genre: 'science', year: 1965, book: { ...good, format: 'paper' } } })
  })

  it('lists every field that is wrong, with nested fields under their parent', () => {
    const result = post({ title: 'ab', price: 900, genre: 'poetry', author: { name: 'A' }, format: 'scroll', published: 'last week', pages: 'many' })
    expect(result.status).toBe(422)
    expect((result.body as { detail: { loc: string[]; msg: string }[] }).detail.map((each) => [each.loc.join('.'), each.msg])).toEqual([
      ['body.title', 'String should have at least 3 characters'],
      ['body.price', 'Input should be less than or equal to 500'],
      ['body.genre', "Input should be 'fiction' or 'science'"],
      ['body.author.name', 'String should have at least 2 characters'],
      ['body.format', "Input should be 'paper' or 'ebook'"],
      ['body.published', 'Input should be a valid date, like 2026-01-15'],
      ['body.pages', 'Input should be a valid integer'],
    ])
    expect(post({ title: 'Dune' })).toMatchObject({ status: 422, body: { detail: [{ loc: ['body', 'price'] }, { loc: ['body', 'genre'] }, { loc: ['body', 'author'] }, { loc: ['body', 'pages'] }] } })
  })

  it('explains a query value of the wrong type', () => {
    expect(post(good, { limit: 'ten' })).toMatchObject({ status: 422, body: { detail: [{ loc: ['query', 'limit'], msg: 'Input should be a valid integer' }] } })
  })
})

const LIKE_PYDANTIC = `
from datetime import date, datetime
from typing import Union
from fastapi import FastAPI, Header, Query
from pydantic import BaseModel, Field

app = FastAPI()

class Line(BaseModel):
    sku: str
    qty: int = 1

class Order(BaseModel):
    note: str
    count: int
    total: float
    when: date
    at: datetime | None = None
    size: Union[int, str] = 1
    tags: list[str] = Field(default_factory=list)
    seen: set[int] = set()
    scores: dict[str, float] = {}
    pair: tuple[int, str] = (1, "a")
    lines: list[Line] = []

@app.post("/orders")
def order(order: Order, limit: int = 10, x_token: str = Header(), search: str | None = Query(None, alias="q", min_length=2)):
    return order

@app.post("/bulk")
def bulk(lines: list[Line]):
    return {"count": len(lines)}
`

// Each expectation here was checked against FastAPI 0.165 with pydantic 2.14 (npm run verify:fastapi-parity).
describe('fastapi_sim validates as pydantic does', () => {
  const post = (path: string, body: unknown, extra: Record<string, unknown> = {}) => sim({ source: LIKE_PYDANTIC, method: 'POST', path, body, ...extra })
  const locs = (result: Record<string, unknown>) => (result.body as { detail: { loc: (string | number)[] }[] }).detail.map((each) => each.loc.join('.')).sort()
  const token = { headers: { 'x-token': 't' } }

  it('accepts what JSON may stand for: true as 1, a timestamp as a date, unknown keys ignored', () => {
    const result = post('/orders', { note: 'a', count: true, total: 1, when: 0, at: 0, size: 'L', seen: [1, 1, 2], scores: { a: 1 }, surprise: 1 }, token)
    expect(result).toMatchObject({ status: 200, body: {
      note: 'a', count: 1, total: 1, when: '1970-01-01', at: '1970-01-01T00:00:00Z', size: 'L', tags: [], seen: [1, 2], scores: { a: 1 }, pair: [1, 'a'], lines: [],
    } })
    expect(result.body).not.toHaveProperty('surprise')
  })

  it('refuses everything that is wrong in one response, each at its own place', () => {
    const result = post('/orders', {
      note: 5, count: 2.5, total: 'x', when: 86399, size: [], tags: 'abc', seen: 'abc', scores: { a: 'x' }, pair: [1], lines: [{ sku: 'a' }, { qty: 'many' }],
    }, { query: { limit: 'ten', q: 'a' } })
    expect(result.status).toBe(422)
    expect(locs(result)).toEqual([
      'body.count', 'body.lines.1.qty', 'body.lines.1.sku', 'body.note', 'body.pair.1', 'body.scores.a', 'body.seen', 'body.size',
      'body.tags', 'body.total', 'body.when', 'header.x-token', 'query.limit', 'query.q',
    ])
  })

  it('takes a list of models as the body', () => {
    const prepared = (sim({ op: 'register', source: LIKE_PYDANTIC }).routes as Prepared[]).find((r) => r.path === '/bulk')!
    expect(JSON.parse(prepared.body!)).toEqual([{ sku: 'string', qty: 1 }])
    expect(post('/bulk', JSON.parse(prepared.body!))).toMatchObject({ status: 200, body: { count: 1 } })
    expect(locs(post('/bulk', [{ sku: 'a' }, { sku: 7 }]))).toEqual(['body.1.sku'])
    expect(locs(post('/bulk', { sku: 'a' }))).toEqual(['body'])
    expect(locs(sim({ source: LIKE_PYDANTIC, method: 'POST', path: '/bulk' }))).toEqual(['body'])
  })

  it('deep-copies mutable BaseModel defaults so instances do not share state across requests', () => {
    const source = `
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

app = FastAPI()

class Bag(BaseModel):
    items: list[str] = []
    meta: dict[str, int] = {}

@app.post("/bags")
def add(bag: Bag, tag: str):
    bag.items.append(tag)
    bag.meta[tag] = len(bag.items)
    return bag

client = TestClient(app)
out = [
    client.post("/bags?tag=first", json={}).json(),
    client.post("/bags?tag=second", json={}).json(),
]
`
    expect(sim({ op: 'exec', source }).value).toEqual([
      { items: ['first'], meta: { first: 1 } },
      { items: ['second'], meta: { second: 1 } },
    ])
  })
})

describe('fastapi_sim module path', () => {
  it('tests the shipped file in src/execution', () => {
    expect(path.basename(SIM)).toBe('fastapi_sim.py')
    expect(SIM).toContain(`${path.sep}src${path.sep}execution${path.sep}`)
  })
})
