import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { PYTHON_PRELUDE } from './instrument'
import type { ResultEvent } from './protocol'
import { evaluateGoal } from '../goalCheck'

function run(source: string) {
  const script = `import asyncio, json, sys
request = json.loads(sys.stdin.read())
exec(request["prelude"], globals())
payload = asyncio.run(_plp_run_async(request["source"]))
print(json.dumps(payload, default=str))
`
  const output = execFileSync('python3', ['-c', script], {
    input: JSON.stringify({ source, prelude: PYTHON_PRELUDE }),
    encoding: 'utf8', timeout: 8_000, maxBuffer: 64 * 1024 * 1024,
  })
  return JSON.parse(output) as { ok: boolean; events: ResultEvent[] }
}

const prints = (events: ResultEvent[]) => events.flatMap((e) => (e.kind === 'print' ? [e.text] : []))
const warnings = (events: ResultEvent[]) => events.flatMap((e) => (e.kind === 'warning' ? [e.text] : []))

describe('printed output limits', () => {
  it('keeps the first 500 lines and says how many more were left out', () => {
    const result = run('for i in range(20000):\n    print(i)')
    expect(result.ok).toBe(true)
    const lines = prints(result.events)
    expect(lines).toHaveLength(500)
    expect(lines.at(-1)).toBe('499')
    expect(warnings(result.events)).toEqual(['Output limited: showing the first 500 printed lines. 19,500 more lines were not shown.'])
  })

  it('shortens a very long line, including one built from many print(end="") calls', () => {
    const result = run('print("x" * 5000)\nfor _ in range(3000):\n    print("ab", end="")\nprint()\nprint("done")')
    const [long, built, done] = prints(result.events)
    expect(long).toBe(`${'x'.repeat(2000)}… (3,000 more characters)`)
    expect(built).toBe(`${'ab'.repeat(1000)}… (4,000 more characters)`)
    expect(done).toBe('done')
    expect(warnings(result.events)).toEqual([])
  })

  it('shortens a huge expression value', () => {
    const result = run('"y" * 4000')
    const expr = result.events.find((e) => e.kind === 'expr')
    expect(expr && expr.kind === 'expr' && expr.value.endsWith('… (2,002 more characters)')).toBe(true)
  })

  it('still reports the limit when the run ends in an error', () => {
    const result = run('for i in range(600):\n    print(i)\n1 / 0')
    expect(warnings(result.events)).toEqual(['Output limited: showing the first 500 printed lines. 100 more lines were not shown.'])
    expect(result.events.at(-1)?.kind).toBe('error')
  })

  it('never lets a lesson check pass on output that was cut away', () => {
    const result = run('for i in range(600):\n    print(i)\nprint("x" * 3000)')
    const goal = (goalCheck: Parameters<typeof evaluateGoal>[0]['goalCheck']) => evaluateGoal(
      { code: 'pass', goalCheck },
      { code: 'x', starterCode: 'pass', status: 'success', events: result.events, executedCode: 'x' },
    ).met
    expect(goal({ printsInclude: ['599'] })).toBe(false)
    expect(goal({ printPatterns: ['^x{3000}$'] })).toBe(false)
    expect(goal({ printsInclude: ['499'] })).toBe(true)
  })
})
