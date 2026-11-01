import { describe, expect, it } from 'vitest'
import { getLesson } from './examples'
import { evaluateServiceProgress } from './serviceProgress'
import { SERVICE_CHECKS } from './serviceExercise'
import type { RunnerSnapshot } from './execution/PythonRunner'

const code = 'def validate_question(payload): return payload["question"].strip()'
const snapshot: RunnerSnapshot = {
  status: 'success', events: [], durationMs: 4, runId: 'run-1', error: null,
  executedCode: code, routes: [], exerciseId: 'service-validation',
  checks: SERVICE_CHECKS['service-validation'].map((check) => ({ ...check, passed: true, detail: 'Passed' })),
}

describe('service behavior evidence', () => {
  const lesson = getLesson('service-validation')
  it('requires all expected checks for the exact code and exercise', () => {
    expect(evaluateServiceProgress(lesson, code, snapshot)?.goal.met).toBe(true)
    expect(evaluateServiceProgress(lesson, `${code}\n# edit`, snapshot)?.goal.met).toBe(false)
    expect(evaluateServiceProgress(lesson, code, { ...snapshot, exerciseId: 'service-endpoint' })?.goal.met).toBe(false)
    expect(evaluateServiceProgress(lesson, code, { ...snapshot, status: 'stopped' })?.goal.met).toBe(false)
    expect(evaluateServiceProgress(lesson, code, { ...snapshot, checks: [] })?.goal.met).toBe(false)
    const first = snapshot.checks?.[0]
    if (!first) throw new Error('Missing fixture')
    expect(evaluateServiceProgress(lesson, code, { ...snapshot, checks: [first, first, first] })?.goal.met).toBe(false)
  })

  it('explains a failed behavior without crediting printed success text', () => {
    const result = evaluateServiceProgress(lesson, code, {
      ...snapshot,
      events: [{ kind: 'print', text: 'All checks passed' }],
      checks: snapshot.checks?.map((check) => check.id === 'empty-question'
        ? { ...check, passed: false, detail: 'Reject whitespace-only questions.' }
        : check),
    })
    expect(result?.goal.met).toBe(false)
    expect(result?.view.tasks[1].status).toBe('todo')
    expect(result?.evidence).toContain('Reject whitespace-only questions.')
  })
})
