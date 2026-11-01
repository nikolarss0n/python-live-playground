import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PYTHON_PRELUDE } from '../execution/instrument'
import { SERVICE_CHECKS, type ExerciseCheck, type ServiceExerciseId } from '../serviceExercise'
import { previousServiceExercise, SERVICE_LESSON_DRAFTS, serviceStarterCode } from './serviceLessons'

const VALIDATOR = `def validate_question(payload):
    if not isinstance(payload, dict):
        raise ValueError("Send a JSON object")
    question = payload.get("question")
    if not isinstance(question, str):
        raise ValueError("Question must be text")
    question = question.strip()
    if not question:
        raise ValueError("Question cannot be empty")
    return question
`

const ENDPOINT = serviceStarterCode('service-endpoint', VALIDATOR)
  .replace('question = ???', 'question = validate_question(payload)')
  .replace('status_code=???', 'status_code=422')

const TESTS = `
def test_valid_request():
    response = client.post("/ask", json={"question": " What is Python? "})
    assert response.status_code == 200
    assert response.json() == {"question": "What is Python?"}

def test_invalid_request():
    response = client.post("/ask", json={"question": " "})
    assert response.status_code == 422
    assert response.json()["detail"]
`

function isCheck(value: unknown): value is ExerciseCheck {
  return typeof value === 'object' && value !== null &&
    'id' in value && typeof value.id === 'string' &&
    'label' in value && typeof value.label === 'string' &&
    'passed' in value && typeof value.passed === 'boolean' &&
    'detail' in value && typeof value.detail === 'string'
}

function run(source: string, exerciseId: ServiceExerciseId) {
  const script = `import json, sys
request = json.loads(sys.stdin.read())
sys.path.insert(0, ${JSON.stringify(path.resolve('src/execution'))})
exec(request["prelude"])
result = _plp_run(request["source"], request["exerciseId"])
print(json.dumps(result))
`
  const stdout = execFileSync('python3', ['-c', script], {
    input: JSON.stringify({ prelude: PYTHON_PRELUDE, source, exerciseId }),
    encoding: 'utf8',
    timeout: 10_000,
  })
  const result: unknown = JSON.parse(stdout)
  if (typeof result !== 'object' || result === null || !('ok' in result)) {
    throw new Error('Malformed execution result')
  }
  const checks = 'checks' in result && Array.isArray(result.checks)
    ? result.checks.filter(isCheck)
    : []
  return { ok: result.ok === true, checks, raw: result }
}

describe('connected service exercises', () => {
  it('carries the learner source into each next exercise without rewriting it', () => {
    const custom = `${VALIDATOR}\n# My own explanation\nprint("saved work")\n`
    expect(serviceStarterCode('service-endpoint', custom)).toContain(custom.trimEnd())
    expect(serviceStarterCode('service-tests', ENDPOINT)).toContain(ENDPOINT.trimEnd())
    expect(previousServiceExercise('service-validation')).toBeNull()
    expect(previousServiceExercise('service-endpoint')).toBe('service-validation')
    expect(previousServiceExercise('service-tests')).toBe('service-endpoint')
    expect(SERVICE_LESSON_DRAFTS.map((lesson) => lesson.number)).toEqual([1, 2, 3])
  })

  it('accepts a validator based on calls across meaningful boundary inputs', () => {
    const result = run(VALIDATOR, 'service-validation')
    expect(result.ok).toBe(true)
    expect(result.checks.map(({ id, label }) => ({ id, label }))).toEqual(SERVICE_CHECKS['service-validation'])
    expect(result.checks.every((check) => check.passed)).toBe(true)
  })

  it('does not accept matching prints, a hardcoded answer, or untrimmed text', () => {
    for (const source of [
      'print("What is Python? ValueError")',
      'def validate_question(payload):\n    return "What is Python?"',
      VALIDATOR.replace('question = question.strip()', 'question = question'),
    ]) {
      expect(run(source, 'service-validation').checks.some((check) => !check.passed)).toBe(true)
    }
  })

  it('accepts POST /ask and exercises invalid input through the simulated client', () => {
    const result = run(ENDPOINT, 'service-endpoint')
    expect(result.ok, JSON.stringify(result.raw)).toBe(true)
    expect(result.checks, JSON.stringify(result.raw)).toEqual(
      SERVICE_CHECKS['service-endpoint'].map((check) => ({ ...check, passed: true, detail: 'Passed' })),
    )
  })

  it('rejects an endpoint that bypasses the function or uses the wrong status', () => {
    const bypassed = ENDPOINT.replace('question = validate_question(payload)', 'question = payload["question"].strip()')
    expect(run(bypassed, 'service-endpoint').checks.find((check) => check.id === 'reuse-validator')?.passed).toBe(false)
    const wrongStatus = ENDPOINT.replace('status_code=422', 'status_code=400')
    expect(run(wrongStatus, 'service-endpoint').checks.find((check) => check.id === 'invalid-request')?.passed).toBe(false)
  })

  it('accepts meaningful request tests and keeps harness probes out of visible output', () => {
    const result = run(`${ENDPOINT}\n${TESTS}`, 'service-tests')
    expect(result.ok, JSON.stringify(result.raw)).toBe(true)
    expect(result.checks, JSON.stringify(result.raw)).toEqual(
      SERVICE_CHECKS['service-tests'].map((check) => ({ ...check, passed: true, detail: 'Passed' })),
    )
    const observed = JSON.stringify(result.raw)
    expect(observed).not.toContain('wrong answer')
  })

  it('rejects empty tests and weak assertions that never detect a broken response', () => {
    const noOp = `${ENDPOINT}\ndef test_valid_request():\n    pass\ndef test_invalid_request():\n    pass`
    expect(run(noOp, 'service-tests').checks.filter((check) => check.passed)).toHaveLength(1)
    const noBodyAssertion = TESTS.replace('assert response.json() == {"question": "What is Python?"}', 'assert response')
    expect(run(`${ENDPOINT}\n${noBodyAssertion}`, 'service-tests').checks.find((check) => check.id === 'valid-test')?.passed).toBe(false)
    const noInvalidStatus = TESTS.replace('assert response.status_code == 422', 'assert response')
    expect(run(`${ENDPOINT}\n${noInvalidStatus}`, 'service-tests').checks.find((check) => check.id === 'invalid-test')?.passed).toBe(false)
  })

  it('does not mark syntax errors or failing learner tests as completed', () => {
    expect(run(serviceStarterCode('service-validation'), 'service-validation').ok).toBe(false)
    const failing = `${ENDPOINT}\n${TESTS}\nassert False, "my test failed"`
    const result = run(failing, 'service-tests')
    expect(result.ok).toBe(false)
    expect(result.checks).toEqual([])
  })
})
