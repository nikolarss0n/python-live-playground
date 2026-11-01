// Runs every error program through the app's own runner (PYTHON_PRELUDE) in Pyodide — the Python 3.12 the browser
// uses — then checks the local diagnosis, applies its fix, and runs the fixed program again.
// Run with `npm run verify:pyodide-errors`.
import { createRequire } from 'node:module'
import path from 'node:path'
import { loadPyodide } from 'pyodide'
import fixtures from '../src/jev/__fixtures__/python-errors.json' with { type: 'json' }
import { FAR_ORIGIN_CASES, TAB_CASES, unclosedBracketCases } from '../src/jev/__fixtures__/generated.ts'
import { diagnose, diagnoseTimeout, markReported, type DiagnoseInput } from '../src/jev/diagnose.ts'
import { PYTHON_PRELUDE } from '../src/execution/instrument.ts'

const indexURL = path.dirname(createRequire(import.meta.url).resolve('pyodide/package.json')) + path.sep
const pyodide = await loadPyodide({ indexURL })
pyodide.runPython(PYTHON_PRELUDE)
const runner = pyodide.globals.get('_plp_run')

type ErrorEvent = DiagnoseInput & { kind: 'error' }
function run(source: string): ErrorEvent | null {
  const proxy = runner(source)
  const result = proxy.toJs({ dict_converter: Object.fromEntries }) as { ok: boolean; events: ErrorEvent[] }
  proxy.destroy()
  return result.ok ? null : result.events.findLast((event) => event.kind === 'error') ?? null
}

const strip = (message: string) => message.replace(/\s*\(<[^>]+>, line \d+\)/, '')
const programs: [string, string, number | null][] = [
  ...Object.entries(fixtures as Record<string, DiagnoseInput>).map(([name, input]) => [name, input.code, input.line ?? null] as [string, string, number | null]),
  ...unclosedBracketCases(), ...TAB_CASES,
]

const problems: string[] = []
let marked = 0
let fixed = 0
let unfixable = 0
for (const [name, source, expectedLine] of programs) {
  const error = run(source)
  if (!error) { problems.push(`${name}: ran without an error in Python 3.12`); continue }
  if (expectedLine !== null && error.line != null && error.line !== expectedLine && !/^TimeoutError/.test(error.message)) {
    problems.push(`${name}: Python 3.12 reports line ${error.line}, 3.13 reported ${expectedLine} (${error.message})`)
  }
  const timedOut = /^TimeoutError/.test(error.message)
  const result = diagnose({ ...error, code: source }) ?? (timedOut && !error.line ? diagnoseTimeout(source) : null)
  const shown = result ?? markReported({ ...error, code: source })
  if (!shown) { problems.push(`${name}: nothing marked for ${error.message}`); continue }
  marked += 1
  if (result?.fixedLine === undefined) { unfixable += 1; console.log(`NO FIX ${name}: ${error.message}`); continue }
  const lines = source.split('\n')
  lines[(result.fixLine ?? result.line) - 1] = result.fixedLine
  const after = run(result.fixedCode ?? lines.join('\n'))
  if (after && (strip(after.message) === strip(error.message) || /^TimeoutError/.test(after.message))) {
    problems.push(`${name}: still fails after Apply fix with ${after.message}`)
  } else fixed += 1
}

for (const [name, source, line, text] of FAR_ORIGIN_CASES) {
  const error = run(source)
  const result = error ? diagnose({ ...error, code: source }) : null
  const marked = result ? source.split('\n')[result.line - 1].slice(result.from, result.to) : ''
  if (!result || result.line !== line || marked !== text) problems.push(`${name}: expected ${text} on line ${line}, got ${result ? `"${marked}" on line ${result.line}` : 'nothing'}`)
}

console.log(`${FAR_ORIGIN_CASES.length} bad values traced back from where Python stopped to where they were set.`)
console.log(`${programs.length} programs on Python ${pyodide.runPython('import sys; sys.version.split()[0]')}: ${marked} marked, ${fixed} fixed and re-run clean, ${unfixable} marked without a fix.`)
for (const problem of problems) console.log(`PROBLEM ${problem}`)
process.exit(problems.length ? 1 : 0)
