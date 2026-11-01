import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ExerciseCheck } from '../serviceExercise'
import { ADVANCED_DAYS } from './advancedDays'
import type { RefresherContext } from './types'

const rawFixtures: unknown = JSON.parse(readFileSync('scripts/fixtures/refresher-advanced.json', 'utf8'))
const rawConsolidation: unknown = JSON.parse(readFileSync('scripts/fixtures/refresher-consolidation.json', 'utf8'))

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fixture(day: string, context: RefresherContext = {}): string {
  if (!isRecord(rawFixtures)) throw new Error('Invalid fixture document')
  let value: unknown
  if (context.variant) {
    const mocks = rawFixtures.mocks
    const variants = isRecord(mocks) ? mocks[day] : undefined
    const phases = isRecord(variants) ? variants[context.variant] : undefined
    value = isRecord(phases) ? phases[context.followUp ? 'followUp' : 'initial'] : undefined
  } else {
    value = isRecord(rawFixtures.practice) ? rawFixtures.practice[day] : undefined
  }
  if (typeof value !== 'string') throw new Error(`Missing solution fixture ${day}/${context.variant ?? 'practice'}`)
  return value
}

function isCheck(value: unknown): value is ExerciseCheck {
  return isRecord(value) && typeof value.id === 'string' && typeof value.label === 'string' &&
    typeof value.passed === 'boolean' && typeof value.detail === 'string'
}

function run(source: string, day: string, context: RefresherContext & { consolidation?: boolean } = {}): ExerciseCheck[] {
  const script = `import asyncio, contextlib, io, json, sys
sys.path.insert(0, ${JSON.stringify(path.resolve('src/execution'))})
from refresher_advanced_checks import check_refresher_advanced
request = json.loads(sys.stdin.read())
namespace = {"__name__": "__main__"}
async def evaluate():
    with contextlib.redirect_stdout(io.StringIO()):
        exec(request["source"], namespace)
        return await asyncio.wait_for(check_refresher_advanced(namespace, request["day"], request["context"]), timeout=3)
print(json.dumps(asyncio.run(evaluate())))
`
  const stdout = execFileSync('python3', ['-c', script], {
    input: JSON.stringify({ source, day, context }), encoding: 'utf8', timeout: 8_000,
  })
  const result: unknown = JSON.parse(stdout)
  if (!Array.isArray(result) || !result.every(isCheck)) throw new Error('Invalid behavior-check result')
  return result
}

function expectPass(day: string, context: RefresherContext = {}): void {
  const checks = run(fixture(day, context), day, context)
  const definition = ADVANCED_DAYS.find((entry) => entry.id === day)
  if (!definition) throw new Error(`Missing ${day}`)
  expect(checks, JSON.stringify(checks)).toEqual(definition.checks.map((check) => ({ ...check, passed: true, detail: 'Passed' })))
}

function expectFailure(day: string, source: string, checkId: string, context: RefresherContext = {}): void {
  const checks = run(source, day, context)
  expect(checks.find((check) => check.id === checkId)?.passed, JSON.stringify(checks)).toBe(false)
}

describe('refresher days 8–14', () => {
  it('contains all later days with executable practice and genuinely separate mock variants', () => {
    expect(ADVANCED_DAYS.map((day) => day.day)).toEqual([8, 9, 10, 11, 12, 13, 14])
    for (const day of ADVANCED_DAYS) {
      expect(day.recall).toBeTruthy()
      expect(day.concepts.length).toBeGreaterThan(0)
      expect(day.reviewPrompts.length).toBeGreaterThan(0)
      if (day.kind === 'practice') {
        expect(day.minutes).toBe(75)
        expect(day.checks).toHaveLength(3)
        expect(day.independentStarter).not.toBe(day.workedExample)
      } else if (day.kind === 'mock') {
        expect(day.minutes).toBe(60)
        expect(day.hints).toEqual([])
        expect(day.variants.map((variant) => variant.id)).toEqual(['a', 'b', 'c'])
        expect(new Set(day.variants.map((variant) => variant.starter)).size).toBe(3)
        for (const variant of day.variants) {
          expect(variant.starter).toContain('raise NotImplementedError')
          expect(variant.requirements.length).toBeGreaterThan(1)
          if (day.day === 13) expect(variant.followUp?.requirements.length).toBeGreaterThan(1)
        }
      } else {
        expect(day.checks).toEqual([])
      }
    }
  })

  it.each(['refresher-08', 'refresher-09', 'refresher-10', 'refresher-11'])('executes the complete %s solution against actual Python', (day) => {
    expectPass(day)
    expect(run('print("All checks passed")', day).every((check) => !check.passed)).toBe(true)
  })

  it('detects file-model, validation and resource-lifecycle regressions', () => {
    const day = 'refresher-08'
    const code = fixture(day)
    expectFailure(day, code.replace('results.append(ToolResult(**row))', 'results.append(row)'), 'file-models')
    expectFailure(day, code.replace('if type(row["ok"]) is not bool:', 'if False:'), 'json-boundaries')
    expectFailure(day, code.replace('with open(path, encoding="utf-8") as file:\n        rows = json.load(file)', 'file = open(path, encoding="utf-8")\n    rows = json.load(file)'), 'file-lifecycle')
  })

  it('detects retry timing, permanent-error and idempotency regressions', () => {
    const day = 'refresher-09'
    const code = fixture(day)
    expectFailure(day, code.replace('sleep(0.1 * 2 ** index)', 'sleep(0)'), 'retry-recovery')
    expectFailure(day, code.replace('{429, 503, 504}', '{403, 429, 503, 504}'), 'retry-stop')
    expectFailure(day, code.replace('operation(idempotency_key)', 'operation("hardcoded")'), 'retry-contract')
  })

  it('distinguishes true sequential work from true overlapping async work', () => {
    const day = 'refresher-10'
    const code = fixture(day)
    expectFailure(day, `${code}\nrun_sequential = run_concurrent\n`, 'async-sequential')
    expectFailure(day, `${code}\nrun_concurrent = run_sequential\n`, 'async-concurrent')
    expectFailure(day, `${code}\nasync def run_concurrent(calls):\n    return []\n`, 'async-boundaries')
  })

  it('detects missing limits, leaking exception details and failure to cancel timed-out work', () => {
    const day = 'refresher-11'
    const code = fixture(day)
    expectFailure(day, code.replace('asyncio.Semaphore(2)', 'asyncio.Semaphore(5)'), 'limited-concurrency')
    expectFailure(day, code.replace('type(error).__name__', 'str(error)'), 'limited-results')
    expectFailure(day, code.replace('asyncio.wait_for(call(), timeout=timeout_s)', 'asyncio.wait_for(asyncio.shield(call()), timeout=timeout_s)'), 'limited-cleanup')
  })

  it.each(['a', 'b', 'c'] as const)('executes unseen data variant %s and rejects an empty implementation', (variant) => {
    expectPass('refresher-12', { variant })
    expect(run('', 'refresher-12', { variant }).every((check) => !check.passed)).toBe(true)
  })

  it.each(['a', 'b', 'c'] as const)('checks both phases of reliability variant %s without demanding the change early', (variant) => {
    expectPass('refresher-13', { variant })
    expectPass('refresher-13', { variant, followUp: true })
    expectFailure('refresher-13', fixture('refresher-13', { variant }), 'mock-follow-up', { variant, followUp: true })
    expect(run('', 'refresher-13', { variant }).every((check) => !check.passed)).toBe(true)
  })

  it('rejects wrong mock ordering, dropped zero balances and skipped validation', () => {
    expectFailure('refresher-12', fixture('refresher-12', { variant: 'a' }).replace('row["room"]))', '""))'), 'mock-boundaries', { variant: 'a' })
    expectFailure('refresher-12', fixture('refresher-12', { variant: 'b' }).replace('sorted(totals.values()', 'sorted([row for row in totals.values() if row["balance"]]'), 'mock-boundaries', { variant: 'b' })
    expectFailure('refresher-12', fixture('refresher-12', { variant: 'c' }).replace('groups = {}', 'if limit == 0:\n        return []\n    groups = {}'), 'mock-inputs', { variant: 'c' })
  })

  it('does not invent success for an undisclosed mock variant or consolidation', () => {
    expect(run('', 'refresher-12')).toEqual([])
    expect(run('', 'refresher-13')).toEqual([])
    expect(run('', 'refresher-14')).toEqual([])
  })

  it('rejects late dependency validation and boolean prior indices in the follow-up mock', () => {
    const source = fixture('refresher-13', { variant: 'b', followUp: true })
    const validation = '        dependencies = step.get("depends_on", [])\n        if not isinstance(dependencies, list) or any(type(value) is not int or not 0 <= value < index for value in dependencies):\n            raise ValueError("Invalid dependencies")\n'
    const tooLate = source.replace(validation, '').replace('    for step in steps:\n', `    for index, step in enumerate(steps):\n${validation}`)
    expect(tooLate).not.toBe(source)
    expectFailure('refresher-13', tooLate, 'mock-follow-up', { variant: 'b', followUp: true })
    const boolAllowed = source.replace('type(value) is not int', 'not isinstance(value, int)')
    expectFailure('refresher-13', boolAllowed, 'mock-follow-up', { variant: 'b', followUp: true })
  })

  it.each(ADVANCED_DAYS.filter((day) => day.kind === 'practice'))('provides one independently checkable consolidation function for $id', (day) => {
    if (!isRecord(rawConsolidation)) throw new Error('Invalid consolidation fixtures')
      if (day.kind !== 'practice') throw new Error('Expected a practice day')
      const source = rawConsolidation[day.id]
      if (typeof source !== 'string') throw new Error(`Missing ${day.id}`)
      const target = day.consolidation
      expect(target.problem).toContain(target.functionName)
      expect(run(source, day.id, { consolidation: true })).toEqual(target.checks.map((check) => ({ ...check, passed: true, detail: 'Passed' })))
      expect(run(target.starter, day.id, { consolidation: true }).every((check) => !check.passed)).toBe(true)
      const script = `import ast, json, sys
request = json.loads(sys.stdin.read())
for source in (request["starter"], request["solution"]):
    functions = [node for node in ast.parse(source).body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))]
    assert len(functions) == 1 and functions[0].name == request["name"]
print("one function")
`
      expect(execFileSync('python3', ['-c', script], { input: JSON.stringify({ starter: target.starter, solution: source, name: target.functionName }), encoding: 'utf8' }).trim()).toBe('one function')
  })

  it('detects meaningful regressions in each advanced consolidation target', () => {
    if (!isRecord(rawConsolidation)) throw new Error('Invalid consolidation fixtures')
    const mutations: Record<string, (source: string) => string> = {
      'refresher-08': (source) => source.replace('results.append(ToolResult(**row))', 'results.append(row)'),
      'refresher-09': (source) => source.replace('sleep(0.1 * 2 ** index)', 'sleep(0)'),
      'refresher-10': (source) => source.replace('return await asyncio.gather(*tasks)', 'return list(reversed(await asyncio.gather(*tasks)))'),
      'refresher-11': (source) => source.replace('asyncio.Semaphore(2)', 'asyncio.Semaphore(5)'),
    }
    for (const [id, mutate] of Object.entries(mutations)) {
      const source = rawConsolidation[id]
      if (typeof source !== 'string') throw new Error(`Missing ${id}`)
      const changed = mutate(source)
      expect(changed).not.toBe(source)
      expect(run(changed, id, { consolidation: true }).some((check) => !check.passed), id).toBe(true)
    }
  })
})
