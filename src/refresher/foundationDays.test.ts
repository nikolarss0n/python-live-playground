import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PYTHON_PRELUDE } from '../execution/instrument'
import type { ExerciseCheck } from '../serviceExercise'
import { FOUNDATION_DAYS } from './foundationDays'

type FoundationFixture = { id: string; replacements: string[]; independentSolution: string; guidedSolution?: string }

function isFixture(value: unknown): value is FoundationFixture {
  return typeof value === 'object' && value !== null &&
    'id' in value && typeof value.id === 'string' &&
    'independentSolution' in value && typeof value.independentSolution === 'string' &&
    'replacements' in value && Array.isArray(value.replacements) &&
    value.replacements.every((item) => typeof item === 'string') &&
    (!('guidedSolution' in value) || typeof value.guidedSolution === 'string')
}

const parsedFixtures: unknown = JSON.parse(readFileSync('scripts/fixtures/refresher-foundations.json', 'utf8'))
if (!Array.isArray(parsedFixtures) || !parsedFixtures.every(isFixture)) throw new Error('Malformed foundation fixtures')
const fixtures = parsedFixtures

const consolidationFixtures: unknown = JSON.parse(readFileSync('scripts/fixtures/refresher-consolidation.json', 'utf8'))
function consolidationSource(id: string): string {
  if (typeof consolidationFixtures !== 'object' || consolidationFixtures === null) throw new Error('Invalid consolidation fixtures')
  const entry = Object.entries(consolidationFixtures).find(([key]) => key === id)?.[1]
  if (typeof entry !== 'string') throw new Error(`Missing consolidation fixture ${id}`)
  return entry
}

function fixture(id: string): FoundationFixture {
  const result = fixtures.find((entry) => entry.id === id)
  if (!result) throw new Error(`Missing fixture ${id}`)
  return result
}

function isCheck(value: unknown): value is ExerciseCheck {
  return typeof value === 'object' && value !== null &&
    'id' in value && typeof value.id === 'string' &&
    'label' in value && typeof value.label === 'string' &&
    'passed' in value && typeof value.passed === 'boolean' &&
    'detail' in value && typeof value.detail === 'string'
}

function run(id: string, source = fixture(id).independentSolution, consolidation = false): ExerciseCheck[] {
  const script = `import asyncio, contextlib, io, json, sys
sys.path.insert(0, ${JSON.stringify(path.resolve('src/execution'))})
from refresher_foundation_checks import check_refresher_foundations
request = json.loads(sys.stdin.read())
exec(request["prelude"])
result = _plp_run(request["source"], include_namespace=True)
if not result["ok"]:
    raise RuntimeError(json.dumps(result["events"]))
with contextlib.redirect_stdout(io.StringIO()):
    checks = asyncio.run(check_refresher_foundations(result["namespace"], request["id"], {"consolidation": request["consolidation"]}))
print(json.dumps(checks))
`
  const stdout = execFileSync('python3', ['-c', script], {
    input: JSON.stringify({ id, source, consolidation, prelude: PYTHON_PRELUDE }), encoding: 'utf8', timeout: 10_000,
  })
  const result: unknown = JSON.parse(stdout)
  if (!Array.isArray(result) || !result.every(isCheck)) throw new Error('Invalid foundation check result')
  return result
}

function failures(id: string, source: string): string[] {
  return run(id, source).filter((check) => !check.passed).map((check) => check.id)
}

describe('refresher foundation days', () => {
  it.each(FOUNDATION_DAYS)('day $day guided solution satisfies the real behavior contract', (day) => {
    const code = fixture(day.id).guidedSolution ?? fixture(day.id).replacements.reduce((source, replacement) => source.replace('???', replacement), day.guidedStarter)
    expect(code).not.toContain('???')
    expect(run(day.id, code)).toEqual(day.checks.map((check) => ({ ...check, passed: true, detail: 'Passed' })))
  })

  it.each(FOUNDATION_DAYS)('day $day independent solution passes and empty stubs do not', (day) => {
    expect(run(day.id)).toEqual(day.checks.map((check) => ({ ...check, passed: true, detail: 'Passed' })))
    expect(run(day.id, day.independentStarter).every((check) => !check.passed)).toBe(true)
  })

  it('provides the complete five-stage learning material with gradually reduced scaffolding', () => {
    expect(FOUNDATION_DAYS.map((day) => day.day)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(FOUNDATION_DAYS.map((day) => day.support)).toEqual(['worked', 'worked', 'partial', 'partial', 'partial', 'minimal', 'minimal'])
    for (const day of FOUNDATION_DAYS) {
      expect(day.minutes).toBe(75)
      expect(day.recall.length).toBeGreaterThan(70)
      expect(day.concepts.length).toBeGreaterThanOrEqual(4)
      expect(day.concepts.every((concept) => concept.explanation.length > 90 && concept.example.length > 35)).toBe(true)
      expect(day.acceptance).toHaveLength(3)
      expect(day.reviewPrompts).toHaveLength(3)
      expect(day.checks).toHaveLength(3)
      expect(day.workedExample).not.toEqual(day.guidedStarter)
      expect(day.independentStarter).not.toContain('???')
      expect(day.independentStarter).not.toContain('#')
    }
  })

  it('keeps examples executable and independent attempts limited to signatures, docstrings, and pass', () => {
    const payload = FOUNDATION_DAYS.map((day) => ({ examples: [...day.concepts.map((concept) => concept.example), day.workedExample], independent: day.independentStarter }))
    const script = `import ast, contextlib, io, json, sys
for day in json.loads(sys.stdin.read()):
    for source in day["examples"]:
        with contextlib.redirect_stdout(io.StringIO()):
            exec(source, {})
    tree = ast.parse(day["independent"])
    assert all(isinstance(node, ast.FunctionDef) for node in tree.body)
    for function in tree.body:
        assert all(isinstance(node, ast.Pass) or (isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant) and isinstance(node.value.value, str)) for node in function.body)
print("verified")
`
    expect(execFileSync('python3', ['-c', script], { input: JSON.stringify(payload), encoding: 'utf8', timeout: 10_000 }).trim()).toBe('verified')
  })

  it('covers every ordered foundation topic from the supplied refresher', () => {
    const expectedTerms = [
      ['file', 'indentation', 'colon', 'comment', 'variable', 'str', 'int', 'float', 'bool', 'None', 'conversion', 'print', 'f-string', 'def', 'return'],
      ['comparison', 'if', 'elif', 'else', 'and', 'or', 'not', 'truthiness', 'is None', 'for', 'while', 'range', 'enumerate', 'break', 'continue'],
      ['list', 'tuple', 'set', 'index', 'slic', 'append', 'unpack', 'membership', 'in', 'add'],
      ['key', 'value', 'index', 'get', 'updat', 'items', 'list', 'missing'],
      ['parameter', 'argument', 'positional', 'keyword', 'default', 'return', 'scope', 'hint', 'mutable', 'shallow'],
      ['strip', 'split', 'join', 'count', 'group', 'comprehension', 'loop', 'sorted', 'key', 'Counter', 'complexity'],
      ['traceback', 'try', 'except', 'finally', 'raise', 'specific', 'assert', 'pytest', 'parametrize', 'raises'],
    ]
    FOUNDATION_DAYS.forEach((day, index) => {
      const content = day.concepts.map((concept) => `${concept.term} ${concept.explanation} ${concept.example}`).join(' ').toLowerCase()
      for (const term of expectedTerms[index]) expect(content, `${day.id}: ${term}`).toContain(term.toLowerCase())
    })
  })

  it('rejects printing in place of returning and boolean truthiness shortcuts', () => {
    const printing = fixture('refresher-01').independentSolution.replace('return f"', 'print(f"').replace('(success={success})"', '(success={success})")')
    expect(failures('refresher-01', printing)).toHaveLength(3)
    const noisyReturn = fixture('refresher-01').independentSolution.replace('return f"', 'print("unwanted output")\n    return f"')
    expect(failures('refresher-01', noisyReturn)).toEqual(['return-not-print'])
    const truthy = fixture('refresher-02').independentSolution.replace('if status is True:', 'if status:').replace('elif status is False:', 'elif not status:')
    expect(failures('refresher-02', truthy)).toContain('count-missing')
  })

  it('rejects sorted deduplication, last-wins ties, and aliased record results', () => {
    expect(failures('refresher-03', 'def unique_ids(ids):\n    return sorted(set(ids))\n')).toContain('unique-order')
    const latest = fixture('refresher-04').independentSolution
    expect(failures('refresher-04', latest.replace('timestamp > previous', 'timestamp >= previous'))).toContain('latest-winners')
    expect(failures('refresher-04', latest.replace('record.copy()', 'record'))).toContain('latest-copies')
  })

  it('rejects nested-list mutation and nondeterministic tie ordering', () => {
    const sharedTags = fixture('refresher-05').independentSolution.replace('copied_tags = list(source)', 'copied_tags = source')
    expect(failures('refresher-05', sharedTags)).toContain('function-tags')
    const noTiePolicy = fixture('refresher-06').independentSolution.replace('(-pair[1], pair[0])', '-pair[1]')
    expect(failures('refresher-06', noTiePolicy)).toContain('tools-order')
  })

  it('rejects no-op and weak tests and identifies a broken validator independently', () => {
    const solution = fixture('refresher-07').independentSolution
    const noOps = `${solution}\ndef test_valid_records():\n    pass\ndef test_invalid_records():\n    pass\n`
    expect(failures('refresher-07', noOps)).toEqual(['record-valid-tests', 'record-invalid-tests'])
    const permissive = `${solution}\ndef validate_record(record):\n    return {"id": "accepted", "duration": 0.0, "success": True}\n`
    expect(failures('refresher-07', permissive)).toContain('record-contract')
    const weak = `${solution}\ndef test_valid_records():\n    assert validate_record({"id": "r1", "duration": 1, "success": True})\n    assert validate_record({"id": "r2", "duration": 0, "success": False})\n`
    expect(failures('refresher-07', weak)).toContain('record-valid-tests')
  })

  it('starts day 7 with a runnable broken implementation and a meaningful failing assertion', () => {
    const day = FOUNDATION_DAYS.find((entry) => entry.id === 'refresher-07')
    if (!day) throw new Error('Missing day 7')
    expect(day.guidedStarter).not.toContain('???')
    const script = `import ast, json, sys
source = json.loads(sys.stdin.read())
ast.parse(source)
try:
    exec(source, {})
except AssertionError:
    print("learner must diagnose a failing assertion")
else:
    raise AssertionError("The initial validator must be observably broken")
`
    expect(execFileSync('python3', ['-c', script], { input: JSON.stringify(day.guidedStarter), encoding: 'utf8' })).toContain('learner must diagnose')
  })

  it.each(FOUNDATION_DAYS)('day $day has one independently checkable consolidation function', (day) => {
    const target = day.consolidation
    expect(target.problem).toContain(target.functionName)
    expect(target.checks).toHaveLength(3)
    expect(run(day.id, consolidationSource(day.id), true)).toEqual(target.checks.map((check) => ({ ...check, passed: true, detail: 'Passed' })))
    expect(run(day.id, target.starter, true).every((check) => !check.passed)).toBe(true)
    const script = `import ast, json, sys
request = json.loads(sys.stdin.read())
for source in (request["starter"], request["solution"]):
    functions = [node for node in ast.parse(source).body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))]
    assert len(functions) == 1 and functions[0].name == request["name"]
print("one function")
`
    expect(execFileSync('python3', ['-c', script], { input: JSON.stringify({ starter: target.starter, solution: consolidationSource(day.id), name: target.functionName }), encoding: 'utf8' }).trim()).toBe('one function')
  })

  it('rejects meaningful consolidation regressions in every foundation target', () => {
    const mutations: Record<string, (source: string) => string> = {
      'refresher-01': () => 'def format_tool(name, duration, success):\n    return "hardcoded"\n',
      'refresher-02': (source) => source.replace('if status is True:', 'if status:'),
      'refresher-03': () => 'def unique_ids(ids):\n    return sorted(set(ids))\n',
      'refresher-04': (source) => source.replace('timestamp > previous', 'timestamp >= previous'),
      'refresher-05': (source) => source.replace('record["name"].strip().lower()', 'record["name"]'),
      'refresher-06': (source) => source.replace('(-pair[1], pair[0])', '-pair[1]'),
      'refresher-07': (source) => source.replace('float(duration)', 'duration'),
    }
    for (const day of FOUNDATION_DAYS) {
      const source = consolidationSource(day.id)
      const mutate = mutations[day.id]
      if (!mutate) throw new Error(`Missing mutation ${day.id}`)
      const changed = mutate(source)
      expect(changed).not.toBe(source)
      expect(run(day.id, changed, true).some((check) => !check.passed), day.id).toBe(true)
    }
  })
})
