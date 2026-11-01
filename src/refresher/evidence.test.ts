import { describe, expect, it } from 'vitest'
import type { RunnerSnapshot } from '../execution/PythonRunner'
import { refresherChecksFor } from './catalog'
import { refresherEvidence } from './evidence'

describe('refresher execution evidence', () => {
  const definitions = refresherChecksFor('refresher-13', { variant: 'b', followUp: true })
  const snapshot: RunnerSnapshot = {
    status: 'success', events: [], durationMs: 3, runId: 'run-1', error: null, executedCode: 'solution', routes: [],
    exerciseId: 'refresher-13', contextKey: 'attempt-b-followup',
    checks: definitions.map((check) => ({ ...check, passed: true, detail: 'Passed' })),
  }
  const input = { dayId: 'refresher-13' as const, context: { variant: 'b' as const, followUp: true },
    contextKey: 'attempt-b-followup', code: 'solution', snapshot, checking: true }

  it('requires the exact source and attempt/phase/requirement context', () => {
    expect(refresherEvidence(input).met).toBe(true)
    expect(refresherEvidence({ ...input, contextKey: 'new-attempt' }).met).toBe(false)
    expect(refresherEvidence({ ...input, code: 'edited' }).met).toBe(false)
    expect(refresherEvidence({ ...input, snapshot: { ...snapshot, checks: [] } }).met).toBe(false)
  })

  it('hides all automated feedback before a mock is submitted', () => {
    expect(refresherEvidence({ ...input, checking: false })).toMatchObject({ fresh: false, met: false, checks: [], evidence: null })
  })

  it('requires evidence for both selected consolidation functions', () => {
    const context = { revisit: ['refresher-05', 'refresher-07'] as const }
    const checks = refresherChecksFor('refresher-14', context)
    expect(checks).toHaveLength(6)
    expect(checks.every((check) => /refresher-0[57]:/.test(check.id))).toBe(true)
  })
})
