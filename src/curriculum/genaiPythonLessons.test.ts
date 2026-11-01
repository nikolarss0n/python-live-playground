import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { GENAI_PYTHON_CHECKS, GENAI_PYTHON_EXERCISE_IDS, type GenaiPythonExerciseId } from '../genaiPythonExercise'
import type { ExerciseCheck } from '../serviceExercise'
import { GENAI_PYTHON_LESSON_DRAFTS } from './genaiPythonLessons'

const REPLACEMENTS: Record<GenaiPythonExerciseId, readonly string[]> = {
  'genai-typed': ['isinstance(value, str)', 'not value.strip()', 'AskRequest(**clean)'],
  'genai-async': ['asyncio.gather', 'asyncio.wait_for', 'TimeoutError'],
  'genai-pytest': ['expected', 'AssertionError'],
  'genai-prompts': ['len(user_content) > max_chars', 'PROMPT_VERSION', '"user"'],
  'genai-structured': ['isinstance(citations, list)', 'data'],
}

export function genaiPythonSolution(id: GenaiPythonExerciseId): string {
  const lesson = GENAI_PYTHON_LESSON_DRAFTS.find((entry) => entry.id === id)
  if (!lesson) throw new Error(`Missing lesson ${id}`)
  return REPLACEMENTS[id].reduce((code, replacement) => code.replace('???', replacement), lesson.code)
}

function isCheck(value: unknown): value is ExerciseCheck {
  return typeof value === 'object' && value !== null &&
    'id' in value && typeof value.id === 'string' &&
    'label' in value && typeof value.label === 'string' &&
    'passed' in value && typeof value.passed === 'boolean' &&
    'detail' in value && typeof value.detail === 'string'
}

function run(id: GenaiPythonExerciseId, source = genaiPythonSolution(id)) {
  const script = `import asyncio, contextlib, io, json, sys
sys.path.insert(0, ${JSON.stringify(path.resolve('src/execution'))})
from genai_python_checks import check_genai_python
request = json.loads(sys.stdin.read())
namespace = {"__name__": "__main__"}
output = io.StringIO()
with contextlib.redirect_stdout(output):
    exec(request["source"], namespace)
    checks = asyncio.run(check_genai_python(namespace, request["id"]))
print(json.dumps(checks))
`
  const stdout = execFileSync('python3', ['-c', script], {
    input: JSON.stringify({ id, source }), encoding: 'utf8', timeout: 10_000,
  })
  const value: unknown = JSON.parse(stdout)
  if (!Array.isArray(value) || !value.every(isCheck)) throw new Error('Invalid check result')
  return value
}

function failedIds(checks: ExerciseCheck[]): string[] {
  return checks.filter((check) => !check.passed).map((check) => check.id)
}

describe('GenAI Python foundations', () => {
  it.each(GENAI_PYTHON_EXERCISE_IDS)('%s has executable positive evidence for all three contracts', (id) => {
    expect(run(id)).toEqual(GENAI_PYTHON_CHECKS[id].map((check) => ({ ...check, passed: true, detail: 'Passed' })))
  })

  it('keeps each lesson independent, concise, and explicit about browser limitations', () => {
    expect(GENAI_PYTHON_LESSON_DRAFTS.map((lesson) => lesson.id)).toEqual(GENAI_PYTHON_EXERCISE_IDS)
    for (const lesson of GENAI_PYTHON_LESSON_DRAFTS) {
      expect(lesson.tasks).toHaveLength(3)
      expect(lesson.taskInstructions).toHaveLength(3)
      expect(lesson.code.split('\n').length).toBeLessThan(40)
      expect(lesson.code).not.toMatch(/(?:from|import)\s+(?:pytest|requests|boto3)/)
    }
    expect(GENAI_PYTHON_LESSON_DRAFTS[2].why).toMatch(/not installed in the browser/)
    expect(GENAI_PYTHON_LESSON_DRAFTS[3].taskInstructions?.join(' ')).toMatch(/not a token/)
  })

  it('requires a dataclass result and real runtime type checks', () => {
    const solution = genaiPythonSolution('genai-typed')
    expect(failedIds(run('genai-typed', solution.replace('return AskRequest(**clean)', 'return clean')))).toContain('typed-request')
    const coerced = solution.replace('value = payload.get(name)', 'value = str(payload.get(name))')
    expect(failedIds(run('genai-typed', coerced))).toContain('runtime-types')
  })

  it('detects sequential tool execution without depending on elapsed-speed thresholds', () => {
    const sequential = genaiPythonSolution('genai-async').replace(
      'return await asyncio.gather(\n        call_tool("facts", 0.01),\n        call_tool("policy", 0.01),\n    )',
      'return [await call_tool("facts", 0.01), await call_tool("policy", 0.01)]',
    )
    expect(failedIds(run('genai-async', sequential))).toContain('concurrent-tools')
  })

  it('rejects broad exception handling and unawaited cancellation', () => {
    const solution = genaiPythonSolution('genai-async')
    expect(failedIds(run('genai-async', solution.replace('except TimeoutError:', 'except Exception:')))).toContain('timeout-result')
    const leaking = solution.replace(
      'return await asyncio.wait_for(call_tool("slow", 0.05), timeout=timeout_s)',
      'task = asyncio.create_task(call_tool("slow", 0.05))\n        done, pending = await asyncio.wait([task], timeout=timeout_s)\n        if pending:\n            return "timeout"\n        return task.result()',
    )
    expect(failedIds(run('genai-async', leaking))).toContain('cancel-work')
  })

  it('does not accept no-op tests or assertions that miss both regression directions', () => {
    const solution = genaiPythonSolution('genai-pytest')
    expect(failedIds(run('genai-pytest', `${solution}\ndef run_cases():\n    pass\n`))).toHaveLength(3)
    expect(failedIds(run('genai-pytest', solution.replace('== expected', '!= ""')))).toContain('trim-regression')
    const acceptsInvalid = solution.replace('raise AssertionError("Invalid input was accepted")', 'pass')
    expect(failedIds(run('genai-pytest', acceptsInvalid))).toContain('invalid-regression')
  })

  it('rejects user-instruction mixing, wrong prompt versions, and missing budget guards', () => {
    const solution = genaiPythonSolution('genai-prompts')
    const mixedRoles = solution.replace('"content": SYSTEM_MESSAGE', '"content": SYSTEM_MESSAGE + question')
    expect(failedIds(run('genai-prompts', mixedRoles))).toContain('message-roles')
    expect(failedIds(run('genai-prompts', solution.replace('"version": PROMPT_VERSION', '"version": "unknown"')))).toContain('prompt-version')
    expect(failedIds(run('genai-prompts', solution.replace('if len(user_content) > max_chars:', 'if False:')))).toContain('context-budget')
    expect(failedIds(run('genai-prompts', solution.replace('if len(user_content) > max_chars:', 'if len(user_content) >= max_chars:')))).toContain('context-budget')
  })

  it('requires schema validation after JSON parsing and permits a legitimate empty citation list', () => {
    const permissive = 'import json\ndef parse_answer(raw_json):\n    return json.loads(raw_json)\n'
    expect(failedIds(run('genai-structured', permissive))).toEqual(['malformed-answer', 'strict-answer'])
    const overStrict = genaiPythonSolution('genai-structured').replace(
      'if not isinstance(citations, list):',
      'if not isinstance(citations, list) or not citations:',
    )
    expect(failedIds(run('genai-structured', overStrict))).toContain('valid-answer')
  })
})
