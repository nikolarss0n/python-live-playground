import type { RunnerSnapshot } from '../execution/PythonRunner'
import { refresherChecksFor } from './catalog'
import type { RefresherContext, RefresherDayId } from './types'

export function refresherEvidence(input: {
  dayId: RefresherDayId
  context: RefresherContext
  contextKey: string
  code: string
  snapshot: RunnerSnapshot
  checking: boolean
}) {
  const { dayId, context, contextKey, code, snapshot, checking } = input
  const expected = refresherChecksFor(dayId, context)
  const fresh = checking && snapshot.exerciseId === dayId && snapshot.contextKey === contextKey && snapshot.executedCode === code
  const finished = fresh && ['success', 'error', 'timeout', 'stopped'].includes(snapshot.status)
  const checks = fresh && snapshot.status === 'success' ? snapshot.checks ?? [] : []
  const passed = expected.filter((definition) => {
    const matches = checks.filter((check) => check.id === definition.id)
    return matches.length === 1 && matches[0]?.passed
  }).length
  const met = finished && snapshot.status === 'success' && expected.length > 0 && checks.length === expected.length && passed === expected.length
  const failed = checks.find((check) => !check.passed)
  const evidence = !checking ? null : !finished
    ? 'Run your current attempt to check its behavior.'
    : snapshot.status !== 'success'
      ? 'Fix the execution error before the behavior checks can finish.'
      : `${passed}/${expected.length} behavior checks passed.${failed ? ` ${failed.detail}` : met ? ' Record what you learned, then continue.' : ''}`
  return { fresh: finished, checks, met, evidence }
}
