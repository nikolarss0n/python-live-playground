import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PYTHON_PRELUDE } from './instrument'
import type { FullstackPayload } from './protocol'

function run(source: string, fullstack: { seed: number; calls: string[]; datasets?: string[] }) {
  const script = `import asyncio, json, sys
sys.path.insert(0, ${JSON.stringify(path.resolve('src/execution'))})
request = json.loads(sys.stdin.read())
exec(request["prelude"], globals())
payload = asyncio.run(_plp_run_async(request["source"], None, {}, request["fullstack"]))
print(json.dumps(payload, default=str))
`
  const output = execFileSync('python3', ['-c', script], {
    input: JSON.stringify({ source, fullstack, prelude: PYTHON_PRELUDE }),
    encoding: 'utf8', timeout: 8_000,
  })
  return JSON.parse(output) as { ok: boolean; fullstack: FullstackPayload }
}

const APP = `import playdb
from fastapi import FastAPI

db = playdb.connect()
playdb.load(db, "orders")
app = FastAPI()

@app.get("/orders/by-city")
def by_city(min_total: float = 0):
    rows = db.execute("SELECT city, ROUND(SUM(amount), 2) AS total FROM orders GROUP BY city ORDER BY city").fetchall()
    return [dict(row) for row in rows if row["total"] >= min_total]
`

describe('full-stack runs', () => {
  it('returns the database tables and calls each requested route after the run', () => {
    const { ok, fullstack } = run(APP, { seed: 1, calls: ['/orders/by-city', 'GET /orders/by-city?min_total=99999', '/missing'] })
    expect(ok).toBe(true)
    expect(fullstack.tables).toHaveLength(1)
    expect(fullstack.tables[0]).toMatchObject({ name: 'orders', count: 40 })
    expect(fullstack.tables[0].columns.map((column) => column.name)).toEqual(['id', 'day', 'city', 'product', 'amount'])
    const [all, none, missing] = fullstack.calls
    expect(all).toMatchObject({ method: 'GET', path: '/orders/by-city', status: 200 })
    expect((all.body as { city: string }[]).map((row) => row.city)).toEqual(['Berlin', 'Lisbon', 'Oslo', 'Paris'])
    expect(none).toMatchObject({ path: '/orders/by-city?min_total=99999', status: 200, body: [] })
    expect(missing.status).toBe(404)
  })

  it('gives repeatable data per seed and different data for another seed', () => {
    const first = run(APP, { seed: 1, calls: [] }).fullstack.tables[0].rows
    expect(run(APP, { seed: 1, calls: [] }).fullstack.tables[0].rows).toEqual(first)
    expect(run(APP, { seed: 2, calls: [] }).fullstack.tables[0].rows).not.toEqual(first)
  })

  it('posts JSON bodies from the API tab before reading the tables', () => {
    const source = `${APP}
from pydantic import BaseModel

class Order(BaseModel):
    city: str
    amount: float

@app.post("/orders", status_code=201)
def create(order: Order):
    db.execute("INSERT INTO orders (id, day, city, product, amount) VALUES (41, '2026-10-08', ?, 'Tent', ?)", (order.city, order.amount))
    return {"ok": True}
`
    const { fullstack } = run(source, { seed: 1, calls: ['POST /orders {"city": "Rome", "amount": 99}', 'GET /orders/by-city'] })
    expect(fullstack.calls[0]).toMatchObject({ method: 'POST', path: '/orders', status: 201, body: { ok: true } })
    expect((fullstack.calls[1].body as { city: string }[]).map((row) => row.city)).toContain('Rome')
    expect(fullstack.tables[0].count).toBe(41)
  })

  it('preloads the chosen datasets before the code runs, without loading them twice', () => {
    const source = 'import playdb\ndb = playdb.connect()\nplaydb.load(db, "weather")\nprint(db.execute("SELECT COUNT(*) FROM weather").fetchone()[0])'
    const { ok, fullstack } = run(source, { seed: 1, calls: [], datasets: ['weather', 'tickets', 'nope'] })
    expect(ok).toBe(true)
    expect(fullstack.tables.map((table) => [table.name, table.count])).toEqual([['tickets', 30], ['weather', 28]])
  })

  it('still reports what was created when the code fails later', () => {
    const { ok, fullstack } = run(`${APP}\nraise RuntimeError("after the table")`, { seed: 1, calls: [] })
    expect(ok).toBe(false)
    expect(fullstack.tables[0].count).toBe(40)
  })
})
