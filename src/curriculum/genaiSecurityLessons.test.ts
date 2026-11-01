import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ExerciseCheck } from '../serviceExercise'
import {
  GENAI_SECURITY_CHECKS,
  GENAI_SECURITY_EXERCISE_IDS,
  type GenaiSecurityExerciseId,
} from '../genaiSecurityExercise'
import { GENAI_SECURITY_LESSON_DRAFTS } from './genaiSecurityLessons'

function solution(id: GenaiSecurityExerciseId, replacements: readonly string[]): string {
  const lesson = GENAI_SECURITY_LESSON_DRAFTS.find((entry) => entry.id === id)
  if (!lesson) throw new Error(`Missing lesson ${id}`)
  let code = lesson.code
  for (const replacement of replacements) {
    if (!code.includes('???')) throw new Error(`Too many replacements for ${id}`)
    code = code.replace('???', replacement)
  }
  if (code.includes('???')) throw new Error(`Unsolved fixture ${id}`)
  return code
}

export const GENAI_SECURITY_SOLUTIONS: Record<GenaiSecurityExerciseId, string> = {
  'genai-bedrock': solution('genai-bedrock', ['question.strip()', '128']),
  'genai-retries': solution('genai-retries', ['TRANSIENT_STATUSES', '0.1 * 2 ** attempt']),
  'genai-tools': solution('genai-tools', ['max_steps', '"lookup_status"']),
  'genai-authorization': solution('genai-authorization', ['"records:read"', 'tenant']),
  'genai-audit': solution('genai-audit', [
    '"[EMAIL]"',
    '{"kind", "outcome", "latency_ms", "input_tokens", "output_tokens"}',
    'allowed',
  ]),
}

function isCheck(value: unknown): value is ExerciseCheck {
  return typeof value === 'object' && value !== null &&
    'id' in value && typeof value.id === 'string' &&
    'label' in value && typeof value.label === 'string' &&
    'passed' in value && typeof value.passed === 'boolean' &&
    'detail' in value && typeof value.detail === 'string'
}

function run(source: string, exerciseId: GenaiSecurityExerciseId) {
  const script = `import contextlib, io, json, sys
sys.path.insert(0, ${JSON.stringify(path.resolve('src/execution'))})
from genai_security_checks import check_genai_security
request = json.loads(sys.stdin.read())
namespace = {"__name__": "__main__"}
try:
    with contextlib.redirect_stdout(io.StringIO()):
        exec(request["source"], namespace)
        checks = check_genai_security(namespace, request["exerciseId"])
    result = {"ok": True, "checks": checks}
except Exception as error:
    result = {"ok": False, "checks": [], "error": type(error).__name__ + ": " + str(error)}
print(json.dumps(result))
`
  const stdout = execFileSync('python3', ['-c', script], {
    input: JSON.stringify({ source, exerciseId }),
    encoding: 'utf8', timeout: 10_000,
  })
  const result: unknown = JSON.parse(stdout)
  if (typeof result !== 'object' || result === null || !('ok' in result)) {
    throw new Error('Malformed Python checker result')
  }
  const checks = 'checks' in result && Array.isArray(result.checks)
    ? result.checks.filter(isCheck) : []
  return { ok: result.ok === true, checks, raw: result }
}

function expectCheckFailure(id: GenaiSecurityExerciseId, code: string, checkId: string): void {
  const result = run(code, id)
  expect(result.ok, JSON.stringify(result.raw)).toBe(true)
  expect(result.checks.find((check) => check.id === checkId)?.passed, JSON.stringify(result.raw)).toBe(false)
}

describe('provider and secure GenAI learning exercises', () => {
  it('provides five independent exercises with three aligned checks each', () => {
    expect(GENAI_SECURITY_LESSON_DRAFTS.map((lesson) => lesson.id)).toEqual(GENAI_SECURITY_EXERCISE_IDS)
    expect(GENAI_SECURITY_LESSON_DRAFTS.map((lesson) => lesson.number)).toEqual([6, 7, 8, 9, 10])
    for (const lesson of GENAI_SECURITY_LESSON_DRAFTS) {
      expect(lesson.difficulty).toBe('genai')
      expect(lesson.tasks).toHaveLength(3)
      expect(lesson.taskInstructions).toHaveLength(3)
      expect(lesson.why).toBeTruthy()
      expect(lesson.predict).toBeDefined()
      expect(lesson.compare).toBeDefined()
    }
  })

  it.each(GENAI_SECURITY_EXERCISE_IDS)('executes the completed %s exercise against actual Python probes', (id) => {
    const result = run(GENAI_SECURITY_SOLUTIONS[id], id)
    expect(result.ok, JSON.stringify(result.raw)).toBe(true)
    expect(result.checks, JSON.stringify(result.raw)).toEqual(
      GENAI_SECURITY_CHECKS[id].map((check) => ({ ...check, passed: true, detail: 'Passed' })),
    )
  })

  it.each(GENAI_SECURITY_EXERCISE_IDS)('does not accept starter blanks or printed success for %s', (id) => {
    const lesson = GENAI_SECURITY_LESSON_DRAFTS.find((entry) => entry.id === id)
    if (!lesson) throw new Error(`Missing lesson ${id}`)
    expect(run(lesson.code, id).ok).toBe(false)
    const printed = run('print("All three checks passed")', id)
    expect(printed.checks).toHaveLength(3)
    expect(printed.checks.every((check) => !check.passed)).toBe(true)
  })

  it('detects wrong Converse request shapes and missing response bounds', () => {
    const code = GENAI_SECURITY_SOLUTIONS['genai-bedrock']
    expectCheckFailure('genai-bedrock', code.replace('modelId=model_id', 'modelId="hardcoded"'), 'converse-request')
    expectCheckFailure('genai-bedrock', code.replace('"maxTokens": 128', '"maxTokens": 4096'), 'converse-request')
    expectCheckFailure('genai-bedrock', code.replace('return text\n', 'return "hardcoded answer"\n'), 'converse-response')
    expectCheckFailure('genai-bedrock', code.replace('response.get("stopReason") != "end_turn"', 'False'), 'converse-boundaries')
  })

  it('detects retrying denials, skipping backoff and exceeding the budget', () => {
    const code = GENAI_SECURITY_SOLUTIONS['genai-retries']
    expectCheckFailure('genai-retries', code.replace('{429, 500, 502, 503, 504}', '{401, 403, 422, 429, 500, 502, 503, 504}'), 'terminal-error')
    expectCheckFailure('genai-retries', code.replace('sleep(0.1 * 2 ** attempt)', 'sleep(0)'), 'transient-retry')
    expectCheckFailure('genai-retries', code.replace('attempt == max_attempts - 1', 'False'), 'retry-budget')
  })

  it('detects permissive tool dispatch, malformed arguments and missing turn limits', () => {
    const code = GENAI_SECURITY_SOLUTIONS['genai-tools']
    expectCheckFailure('genai-tools', code.replace('if name != "lookup_status":', 'if False:'), 'tool-boundary')
    expectCheckFailure('genai-tools', code.replace(' or set(arguments) != {"record_id"}', ''), 'tool-boundary')
    expectCheckFailure('genai-tools', code.replace('range(max_steps)', 'range(6)'), 'tool-budget')
    expectCheckFailure('genai-tools', code.replace('"result": result', '"result": {"status": "invented"}'), 'tool-observation')
  })

  it('detects denying every request and bypassing identity, scope or tenant checks', () => {
    const code = GENAI_SECURITY_SOLUTIONS['genai-authorization']
    expectCheckFailure('genai-authorization', code.replace('if record["tenant"] != tenant:', 'if True:'), 'allowed-record')
    expectCheckFailure('genai-authorization', code.replace(' or principal.get("authenticated") is not True', ''), 'deny-default')
    expectCheckFailure('genai-authorization', code.replace(' or "records:read" not in scopes', ''), 'deny-default')
    expectCheckFailure('genai-authorization', code.replace('if record["tenant"] != tenant:', 'if False:'), 'tenant-boundary')
    expectCheckFailure('genai-authorization', code.replace(' or set(proposal) != {"record_id"}', ''), 'tenant-boundary')
  })

  it('detects raw audit copying, ineffective redaction and unvalidated metadata', () => {
    const code = GENAI_SECURITY_SOLUTIONS['genai-audit']
    expectCheckFailure('genai-audit', code.replace('return safe\n', 'return {**event, **safe}\n'), 'audit-redaction')
    expectCheckFailure('genai-audit', code.replace('def redact_text(text):', 'def redact_text(text):\n    return text'), 'audit-redaction')
    expectCheckFailure('genai-audit', code.replace('safe[key] = value if type(value) is int and 0 <= value <= 10_000_000 else 0', 'safe[key] = value'), 'audit-values')
    expectCheckFailure('genai-audit', code.replace('safe["outcome"] = event.get("outcome") if event.get("outcome") in ("success", "denied", "error") else "unknown"', 'safe["outcome"] = event.get("outcome")'), 'audit-values')
  })
})
