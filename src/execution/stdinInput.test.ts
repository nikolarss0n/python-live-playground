import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { PYTHON_PRELUDE } from './instrument'
import type { ResultEvent } from './protocol'

function run(source: string, stdin: string | null) {
  const script = `import asyncio, json, sys
request = json.loads(sys.stdin.read())
exec(request["prelude"], globals())
payload = asyncio.run(_plp_run_async(request["source"], None, {}, None, request["stdin"]))
payload["after"] = [sys.stdin is _plp_stdin, input is _plp_input]
print(json.dumps(payload, default=str))
`
  const output = execFileSync('python3', ['-c', script], {
    input: JSON.stringify({ source, stdin, prelude: PYTHON_PRELUDE }),
    encoding: 'utf8', timeout: 8_000,
  })
  return JSON.parse(output) as { ok: boolean; events: ResultEvent[]; after: boolean[] }
}

const prints = (events: ResultEvent[]) => events.flatMap((e) => (e.kind === 'print' ? [`${e.line}:${e.text}`] : []))
const error = (events: ResultEvent[]) => events.find((e) => e.kind === 'error')

describe('input() reads the Inputs box', () => {
  it('returns one line per call and echoes the prompt with the value on its source line', () => {
    const result = run('name = input("Name? ")\nage = int(input("Age? "))\nprint(name, age + 1)', 'Ada\n36\n')
    expect(result.ok).toBe(true)
    expect(prints(result.events)).toEqual(['1:Name? Ada', '2:Age? 36', '3:Ada 37'])
  })

  it('explains an empty Inputs box with an EOFError', () => {
    const result = run('name = input("Name? ")', null)
    expect(error(result.events)).toMatchObject({ message: 'EOFError: input() needs a value, but the Inputs box is empty', line: 1 })
  })

  it('says how many lines were given when input() runs out', () => {
    const result = run('a = input()\nb = input()', 'x')
    expect(error(result.events)).toMatchObject({ message: 'EOFError: input() asked for value 2, but the Inputs box has only 1 line', line: 2 })
  })

  it('lets sys.stdin read the same lines and restores the real stdin and input afterwards', () => {
    const result = run('import sys\nprint(input())\nprint(sys.stdin.read().split())', 'a\nb\nc')
    expect(prints(result.events).map((p) => p.split(':').slice(1).join(':'))).toEqual(['a', 'a', "['b', 'c']"])
    expect(result.after).toEqual([false, false])
  })

  it('keeps a deliberately empty line as an empty value', () => {
    const result = run('print(repr(input("? ")))', '\n')
    expect(prints(result.events)).toEqual(['1:? ', "1:''"])
  })
})
