import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import fixtures from './__fixtures__/python-errors.json'
import { diagnose, type DiagnoseInput } from './diagnose'
import { FAR_ORIGIN_CASES, TAB_CASES, unclosedBracketCases } from './__fixtures__/generated'

const RUNNER = `
import sys
source = sys.stdin.read()
try:
    exec(compile(source, "<playground>", "exec"), {"__name__": "__main__"})
    print("OK")
except BaseException as exc:
    print(f"{type(exc).__name__}: {exc}")
`
const hasPython = spawnSync('python3', ['--version']).status === 0
function run(source: string): string | null {
  const result = spawnSync('python3', ['-I', '-c', RUNNER], { input: source, encoding: 'utf8', timeout: 5000 })
  if (result.status === null) return null
  return (result.stdout.trim().split('\n').at(-1) ?? '').replace(/\s*\(<playground>, line \d+\)/, '')
}

describe.skipIf(!hasPython)('applying local fixes in real Python', () => {
  const cases = Object.entries(fixtures as Record<string, DiagnoseInput>).flatMap(([name, input]) => {
    const result = diagnose(input)
    return result?.fixedLine !== undefined ? [[name, input, result] as const] : []
  })

  it.each(cases)('%s: the original error is gone after Apply fix', (_name, input, result) => {
    const lines = input.code.split('\n')
    lines[(result.fixLine ?? result.line) - 1] = result.fixedLine!
    const outcome = run(result.fixedCode ?? lines.join('\n'))
    expect(outcome, 'the fixed program still runs forever').not.toBeNull()
    expect(outcome).not.toBe(input.message.replace(/\s*\(<playground>, line \d+\)/, ''))
  })
})

const SYNTAX_RUNNER = `
import sys, json
source = sys.stdin.read()
try:
    compile(source, "<playground>", "exec")
    print(json.dumps(None))
except SyntaxError as exc:
    print(json.dumps({"message": f"{type(exc).__name__}: {exc.msg}", "line": exc.lineno, "column": (exc.offset or 1) - 1}))
`
const syntaxError = (source: string) =>
  JSON.parse(spawnSync('python3', ['-I', '-c', SYNTAX_RUNNER], { input: source, encoding: 'utf8' }).stdout) as DiagnoseInput | null

describe.skipIf(!hasPython)('a bracket left open several lines before the code stops', () => {
  it.each([
    ['call', 'total = sum([1, 2, 3]\na = 1\nb = 2\nc = 3\nd = 4\nprint(total)\n', 1],
    ['list', 'items = [1, 2, 3\na = 1\nb = 2\nc = 3\nd = 4\nprint(items)\n', 1],
    ['print', 'print("a"\nprint("b")\nx = 1\ny = 2\nz = 3\n', 1],
    ['inside a function', 'def f():\n    values = [1, 2, 3\n    x = 1\n    y = 2\n    z = 3\n    return values\n', 2],
    ['math', 'x = (1 + 2\ny = 3\nz = 4\nw = 5\nv = 6\nprint(x)\n', 1],
  ])('%s: marks the opening line and the fix compiles', (_name, source, line) => {
    const error = syntaxError(source)!
    const result = diagnose({ ...error, code: source })
    expect(result?.line).toBe(line)
    const lines = source.split('\n')
    lines[(result!.fixLine ?? result!.line) - 1] = result!.fixedLine!
    expect(syntaxError(result!.fixedCode ?? lines.join('\n'))).toBeNull()
  })
})

describe.skipIf(!hasPython)('generated unclosed brackets and mixed tabs', () => {
  const cases = unclosedBracketCases()

  it.each([...cases, ...TAB_CASES])('%s', (_name, source, line) => {
    const error = syntaxError(source)
    expect(error, 'the generated code should not compile').not.toBeNull()
    expect(error!.line, `Python reported ${error!.message}`).toBe(line)
    const result = diagnose({ ...error!, code: source })
    expect(result?.line).toBe(line)
    expect(result?.fixedLine, result?.message).toBeDefined()
    const lines = source.split('\n')
    lines[(result!.fixLine ?? result!.line) - 1] = result!.fixedLine!
    expect(syntaxError(result!.fixedCode ?? lines.join('\n'))).toBeNull()
  })
})

const FRAMES_RUNNER = `
import sys, json, traceback
source = sys.stdin.read()
try:
    exec(compile(source, "<playground>", "exec"), {"__name__": "__main__"})
    print(json.dumps(None))
except Exception as exc:
    frames = [{"line": f.lineno, "name": f.name} for f in traceback.extract_tb(exc.__traceback__) if f.filename == "<playground>"]
    print(json.dumps({"message": f"{type(exc).__name__}: {exc}", "line": frames[-1]["line"], "frames": frames}))
`
const runtimeError = (source: string) =>
  JSON.parse(spawnSync('python3', ['-I', '-c', FRAMES_RUNNER], { input: source, encoding: 'utf8', timeout: 5000 }).stdout.trim().split('\n').at(-1) ?? 'null') as DiagnoseInput | null

describe.skipIf(!hasPython)('bad values traced back through the traceback', () => {
  it.each(FAR_ORIGIN_CASES)('%s', (_name, source, line, marked) => {
    const error = runtimeError(source)!
    expect(error.line).not.toBe(line)
    const result = diagnose({ ...error, code: source })!
    expect(result.line, result.message).toBe(line)
    expect(source.split('\n')[line - 1].slice(result.from, result.to)).toBe(marked)
    if (result.fixedLine === undefined) return
    const lines = source.split('\n')
    lines[line - 1] = result.fixedLine
    expect(runtimeError(lines.join('\n'))).toBeNull()
  })
})
