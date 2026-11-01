// Live check of the Jev fallback: errors the local diagnoser cannot place and failing behaviour checks.
// Run with `npm run verify:jev` (needs TYPESAFE_API_KEY in .env.local and python3 on PATH).
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { diagnose } from '../src/jev/diagnose.ts'
import { forwardJev } from '../src/jev/forward.ts'
import { askJevPinpoint, type Problem } from '../src/jev/pinpoint.ts'

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')
  .map((line) => line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter((match) => match !== null).map((match) => [match[1], match[2].replace(/^["']|["']$/g, '')]))
const apiKey = env.TYPESAFE_API_KEY ?? process.env.TYPESAFE_API_KEY ?? ''
if (!apiKey) { console.error('TYPESAFE_API_KEY is not set in .env.local'); process.exit(1) }

const RUNNER = `
import sys, json, traceback
source = sys.stdin.read()
try:
    exec(compile(source, "<playground>", "exec"), {"__name__": "__main__"})
    print(json.dumps(None))
except BaseException as exc:
    line = getattr(exc, "lineno", None) if isinstance(exc, SyntaxError) else None
    frames = [{"line": f.lineno, "name": f.name} for f in traceback.extract_tb(exc.__traceback__) if f.filename == "<playground>"]
    if line is None and frames: line = frames[-1]["line"]
    print(json.dumps({"message": f"{type(exc).__name__}: {exc}".replace(" (<playground>, line %s)" % line, ""), "line": line, "frames": frames}))
`

type Case = { name: string; code: string; line: number; token?: string; check?: { label: string; detail: string } }
const CASES: Case[] = [
  { name: 'wrong comparison in condition', line: 3, token: '<', code: 'def is_adult(age):\n    # adults are 18 or older\n    return age < 18\n\nprint(is_adult(20))\n',
    check: { label: 'is_adult(20) returns True', detail: 'expected True, got False' } },
  { name: 'off-by-one range', line: 3, code: 'def total(n):\n    s = 0\n    for i in range(1, n):\n        s += i\n    return s\n\nprint(total(4))\n',
    check: { label: 'total(4) returns 10', detail: 'expected 10, got 6' } },
  { name: 'subtracts instead of adds', line: 2, token: '-', code: 'def add(a, b):\n    return a - b\n\nprint(add(2, 3))\n',
    check: { label: 'add(2, 3) returns 5', detail: 'expected 5, got -1' } },
  { name: 'return inside loop', line: 6, code: 'def count_even(items):\n    n = 0\n    for x in items:\n        if x % 2 == 0:\n            n += 1\n        return n\n\nprint(count_even([2, 4, 6]))\n',
    check: { label: 'count_even([2, 4, 6]) returns 3', detail: 'expected 3, got 1' } },
  // The cause is outside the old ±2 window around the reported line; only the traceback frames lead there.
  { name: 'bad value six lines above the failing line', line: 7, token: '"30"',
    code: 'def total_price(prices):\n    return sum(prices)\n\n\n\n\nprices = [10, 20, "30"]\nprint(total_price(prices))\n' },
  { name: 'wrong argument at a far call site', line: 9, token: '"3"',
    code: 'def repeat(word, times):\n    return word * times + "!"\n\n\n\n\n\n\nprint(repeat("ab", "3"))\n' },
  { name: 'bad item ten lines above, two calls deep', line: 11, token: '"4"',
    code: 'def double(x):\n    return x * 2 + 1\n\ndef double_all(items):\n    return [double(x) for x in items]\n\n\n\n\n\nnumbers = [1, 2, 3, "4"]\nprint(double_all(numbers))\n' },
  { name: 'None from a dict default far above', line: 4, token: 'None',
    code: 'def shout(text):\n    return text.upper() + "!"\n\nsettings = {"greeting": None}\n\n\n\n\n\nprint(shout(settings["greeting"]))\n' },
  { name: 'text count used in a range eight lines away', line: 3, token: '"3"',
    code: 'def stars(n):\n    return "".join("*" for _ in range(n))\nrows = "3"\n\n\n\n\n\n\nprint(stars(rows))\n' },
  { name: 'string divided twelve lines below its value', line: 1, token: '"10"',
    code: 'width = "10"\n\n\n\n\n\n\n\n\n\n\ndef half(value):\n    return value / 2\nprint(half(width))\n' },
  { name: 'unclosed bracket two lines up', line: 1, code: 'total = sum([1, 2, 3]\nprint(total)\nx = 1\n' },
  { name: 'string never closed', line: 1, code: 'name = "Ada\nprint(name)\n' },
]

const fetchImpl = (async (_url: string, init: RequestInit) => {
  const result = await forwardJev(String(init.body), { apiKey, model: env.TYPESAFE_MODEL ?? 'jev-latest' })
  return new Response(result.body, { status: result.status, headers: { 'content-type': 'application/json' } })
}) as typeof fetch

let passed = 0
let total = 0
const placed = (line: number, from: number, to: number, item: Case) => {
  const marked = item.code.split('\n')[line - 1].slice(from, to)
  return { marked, ok: line === item.line && (!item.token || marked.includes(item.token)) }
}
for (const item of CASES) {
  let problem: Problem
  if (item.check) problem = { message: '', check: item.check }
  else {
    const run = JSON.parse(spawnSync('python3', ['-I', '-c', RUNNER], { input: item.code, encoding: 'utf8' }).stdout)
    if (!run) { console.log(`SKIP ${item.name}: no error`); continue }
    const local = diagnose({ code: item.code, ...run })
    if (local) {
      const { marked, ok } = placed(local.line, local.from, local.to, item)
      total += 1
      if (ok) passed += 1
      console.log(`${ok ? 'LOCAL' : 'MISS LOCAL'} ${item.name}: line ${local.line} "${marked}" (${run.message}) — ${local.message}`)
      // Errors with a traceback are also sent to Jev directly, so its reach through the frames stays tested.
      if (!run.frames || run.frames.length < 2) continue
    }
    problem = run
  }
  total += 1
  const result = await askJevPinpoint(item.code, problem, { fetchImpl })
  if (!result.ok) { console.log(`FAIL ${item.name}: ${result.error}`); continue }
  const { pinpoint } = result
  const { marked, ok } = placed(pinpoint.line, pinpoint.from, pinpoint.to, item)
  if (ok) passed += 1
  console.log(`${ok ? 'PASS' : 'MISS'} Jev ${item.name}: line ${pinpoint.line} (Python reported ${'line' in problem ? problem.line : '-'}) "${marked}" (${result.durationMs}ms) — ${pinpoint.message}`)
}
console.log(`\n${passed}/${total} placed on the expected line`)
process.exit(passed === total ? 0 : 1)
