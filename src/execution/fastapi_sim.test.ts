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
      { method: 'GET', path: '/hello', callPath: '/hello' },
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

describe('fastapi_sim module path', () => {
  it('tests the shipped file in src/execution', () => {
    expect(path.basename(SIM)).toBe('fastapi_sim.py')
    expect(SIM).toContain(`${path.sep}src${path.sep}execution${path.sep}`)
  })
})
