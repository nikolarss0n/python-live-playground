import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { PYTHON_PRELUDE } from './instrument'
import type { ResultEvent } from './protocol'

function run(source: string) {
  const script = `import asyncio, json, sys
request = json.loads(sys.stdin.read())
exec(request["prelude"], globals())
payload = asyncio.run(_plp_run_async(request["source"]))
print(json.dumps(payload, default=str))
`
  const output = execFileSync('python3', ['-c', script], { input: JSON.stringify({ source, prelude: PYTHON_PRELUDE }), encoding: 'utf8', timeout: 8_000 })
  return JSON.parse(output) as { ok: boolean; events: ResultEvent[] }
}

const printed = (events: ResultEvent[]) => events.flatMap((event) => (event.kind === 'print' ? [event.text] : []))

describe('top-level await', () => {
  it('awaits a coroutine at module level, like a notebook', () => {
    const { ok, events } = run(`import asyncio

async def slow(value, delay):
    await asyncio.sleep(delay)
    return value

async def main():
    print(await asyncio.wait_for(slow("fast", 0), timeout=1))
    try:
        await asyncio.wait_for(slow("late", 1), timeout=0.01)
    except asyncio.TimeoutError:
        print("timed out")

await main()
`)
    expect(ok).toBe(true)
    expect(printed(events)).toEqual(['fast', 'timed out'])
  })

  it('reports errors raised while awaiting on the right line', () => {
    const { ok, events } = run('async def boom():\n    raise ValueError("nope")\n\nawait boom()\n')
    expect(ok).toBe(false)
    expect(events.at(-1)).toMatchObject({ kind: 'error', message: 'ValueError: nope', line: 2 })
  })
})
