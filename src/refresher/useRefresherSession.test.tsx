import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRefresherSession } from './useRefresherSession'
import { MAX_BACKUPS, MOCK_DURATION_MS, loadRefresherState, type SessionStorage, type StarterFor } from './sessionStore'
import type { ConsolidationDay, MockDay, PracticeDay, RefresherDay } from './types'

const practice: PracticeDay = {
  id: 'refresher-01', day: 1, title: 'Contracts', kind: 'practice', minutes: 60,
  consolidation: { functionName: 'example', problem: 'Return a value', starter: 'def example():\n    pass\n', checks: [] },
  support: 'worked', recall: 'Recall a function.', concepts: [], workedExample: 'print(1)',
  guidedStarter: 'guided starter', independentStarter: 'independent starter', problem: 'Build it',
  acceptance: [], hints: [], reviewPrompts: [], resources: [], checks: [],
}
const mockDay: MockDay = {
  ...practice, id: 'refresher-13', day: 13, kind: 'mock',
  variants: [
    { id: 'a', title: 'A', prompt: 'Prompt A', starter: 'starter a', requirements: [] },
    { id: 'b', title: 'B', prompt: 'Prompt B', starter: 'starter b', requirements: [] },
    { id: 'c', title: 'C', prompt: 'Prompt C', starter: 'starter c', requirements: [] },
  ],
}
const consolidation: ConsolidationDay = { ...practice, id: 'refresher-14', day: 14, kind: 'consolidation' }
const chooseFirst = () => 0

describe('refresher learning state machine', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-29T10:00:00Z'))
  })
  afterEach(() => { cleanup(); vi.useRealTimers() })

  it('preserves each stage draft and notes across navigation and reload', () => {
    const hook = renderHook(() => useRefresherSession(practice))
    act(() => { hook.result.current.setNote('remember dictionaries'); hook.result.current.completeStage() })
    act(() => { hook.result.current.changeStage('guided'); hook.result.current.updateCode('my guided code') })
    act(() => { hook.result.current.changeStage('independent'); hook.result.current.updateCode('my own code') })
    hook.unmount()
    const restored = renderHook(() => useRefresherSession(practice))
    expect(restored.result.current.stage).toBe('independent')
    expect(restored.result.current.code).toBe('my own code')
    expect(restored.result.current.notes.recall).toBe('remember dictionaries')
    expect(restored.result.current.completedStages.recall).toBe(true)
    act(() => { restored.result.current.changeStage('guided') })
    expect(restored.result.current.code).toBe('my guided code')
  })

  it('requires guided and independent evidence plus honest reflection to complete practice', () => {
    const hook = renderHook(() => useRefresherSession(practice))
    act(() => { hook.result.current.completeStage() })
    expect(hook.result.current.completedStages.recall).toBe(false)
    act(() => {
      hook.result.current.setNote('Recall answer', 'recall')
      hook.result.current.completeStage('recall')
      hook.result.current.completeStage('explain')
      hook.result.current.setNote('I fixed an edge case', 'review')
      hook.result.current.completeStage('review')
    })
    for (const stage of ['guided', 'independent'] as const) {
      act(() => { hook.result.current.changeStage(stage) })
      const snapshot = hook.result.current
      act(() => { hook.result.current.verify({ dayId: practice.id, stage, code: snapshot.code, contextKey: snapshot.contextKey, passed: true }) })
    }
    expect(hook.result.current.completedDayIds.has(practice.id)).toBe(true)
    act(() => { hook.result.current.updateCode('changed after verification') })
    expect(hook.result.current.completedDayIds.has(practice.id)).toBe(false)
  })

  it('rejects verification from old code, a different stage or an old context', () => {
    const hook = renderHook(() => useRefresherSession(practice))
    act(() => { hook.result.current.changeStage('guided') })
    const captured = hook.result.current
    act(() => { hook.result.current.updateCode('new code') })
    act(() => {
      expect(hook.result.current.verify({ dayId: practice.id, stage: 'guided', code: captured.code, contextKey: captured.contextKey, passed: true })).toBe(false)
    })
    act(() => { hook.result.current.changeStage('independent') })
    act(() => {
      expect(hook.result.current.verify({ dayId: practice.id, stage: 'guided', code: 'new code', contextKey: captured.contextKey, passed: true })).toBe(false)
      expect(hook.result.current.verify({ dayId: practice.id, stage: 'independent', code: hook.result.current.code, contextKey: 'old attempt', passed: true })).toBe(false)
    })
  })

  it('makes restart recoverable across reload and does not overwrite a backup on a second reset', () => {
    const hook = renderHook(() => useRefresherSession(practice))
    act(() => { hook.result.current.changeStage('guided'); hook.result.current.updateCode('valuable work'); hook.result.current.setNote('my reasoning') })
    const captured = hook.result.current
    act(() => { hook.result.current.verify({ dayId: practice.id, stage: 'guided', code: captured.code, contextKey: captured.contextKey, passed: true }) })
    act(() => { expect(hook.result.current.restart()).toBe(true); expect(hook.result.current.restart()).toBe(true) })
    expect(loadRefresherState().state.backups).toHaveLength(1)
    expect(hook.result.current.code).toBe('guided starter')
    hook.unmount()
    const restored = renderHook(() => useRefresherSession(practice))
    expect(restored.result.current.canRestore).toBe(true)
    act(() => { expect(restored.result.current.restore()).toBe(true) })
    expect(restored.result.current.code).toBe('valuable work')
    expect(restored.result.current.note).toBe('my reasoning')
    expect(restored.result.current.completedStages.guided).toBe(true)
  })

  it('preserves new edits when restoring an older backup', () => {
    const hook = renderHook(() => useRefresherSession(practice))
    act(() => { hook.result.current.changeStage('guided'); hook.result.current.updateCode('original'); hook.result.current.restart(); hook.result.current.updateCode('new work'); hook.result.current.restore() })
    expect(hook.result.current.code).toBe('original')
    hook.unmount()
    const restored = renderHook(() => useRefresherSession(practice))
    act(() => { restored.result.current.restore() })
    expect(restored.result.current.code).toBe('new work')
  })

  it('refuses restart when a backup cannot be saved', () => {
    let allowed = true
    const storage: SessionStorage = {
      getItem: (key) => window.localStorage.getItem(key),
      setItem(key, value) { if (!allowed) throw new Error('Quota'); window.localStorage.setItem(key, value) },
    }
    const hook = renderHook(() => useRefresherSession(practice, { storage }))
    act(() => { hook.result.current.changeStage('guided'); hook.result.current.updateCode('keep this') })
    allowed = false
    act(() => { expect(hook.result.current.restart()).toBe(false) })
    expect(hook.result.current.code).toBe('keep this')
    expect(hook.result.current.saveStatus).toBe('unavailable')
    expect(loadRefresherState().state.backups).toHaveLength(0)
  })

  it('refuses a full backup history instead of discarding old work', () => {
    const hook = renderHook(() => useRefresherSession(practice))
    act(() => { hook.result.current.changeStage('guided') })
    for (let index = 0; index < MAX_BACKUPS; index++) {
      act(() => { hook.result.current.updateCode(`work ${index}`); expect(hook.result.current.restart()).toBe(true) })
    }
    act(() => { hook.result.current.updateCode('last work'); expect(hook.result.current.restart()).toBe(false) })
    expect(hook.result.current.code).toBe('last work')
    expect(hook.result.current.saveStatus).toBe('history-full')
    expect(loadRefresherState().state.backups[0].draft.code).toBe('work 0')
  })

  it('does not reveal a mock variant before start and chooses unused variants before retakes', () => {
    const hook = renderHook(() => useRefresherSession(mockDay, { random: chooseFirst }))
    act(() => { expect(hook.result.current.changeStage('independent')).toBe(false); expect(hook.result.current.updateCode('early')).toBe(false) })
    expect(hook.result.current.mock).toBeNull()
    for (const variant of ['a', 'b', 'c']) {
      act(() => { expect(hook.result.current.startMock()).toBe(true) })
      expect(hook.result.current.mock?.variantId).toBe(variant)
      expect(hook.result.current.mock?.retake).toBe(false)
      act(() => { hook.result.current.finishMock() })
    }
    hook.unmount()
    const restored = renderHook(() => useRefresherSession(mockDay, { random: chooseFirst }))
    act(() => { restored.result.current.startMock() })
    expect(restored.result.current.mock?.variantId).toBe('a')
    expect(restored.result.current.mock?.retake).toBe(true)
  })

  it('changes follow-up context at 30 minutes and rejects earlier checks', () => {
    const hook = renderHook(() => useRefresherSession(mockDay, { random: chooseFirst }))
    act(() => { hook.result.current.startMock() })
    const captured = hook.result.current
    act(() => { hook.result.current.verify({ dayId: mockDay.id, stage: 'independent', code: captured.code, contextKey: captured.contextKey, passed: true }) })
    act(() => { vi.advanceTimersByTime(30 * 60_000) })
    expect(hook.result.current.mock?.followUp).toBe(true)
    expect(hook.result.current.mock?.phase).toBe('implement')
    expect(hook.result.current.contextKey).not.toBe(captured.contextKey)
    expect(hook.result.current.completedStages.independent).toBe(false)
    act(() => { expect(hook.result.current.verify({ dayId: mockDay.id, stage: 'independent', code: captured.code, contextKey: captured.contextKey, passed: true })).toBe(false) })
  })

  it('expires mocks even while another day is selected and freezes submitted code', () => {
    const hook = renderHook(({ day }: { day: RefresherDay }) => useRefresherSession(day, { random: chooseFirst }), { initialProps: { day: mockDay as RefresherDay } })
    act(() => { hook.result.current.startMock(); hook.result.current.updateCode('submission') })
    const startedAt = hook.result.current.mock?.startedAt
    hook.rerender({ day: practice })
    act(() => { vi.advanceTimersByTime(MOCK_DURATION_MS) })
    hook.rerender({ day: mockDay })
    expect(hook.result.current.mock?.submittedCode).toBe('submission')
    expect(hook.result.current.mock?.finishedAt).toBe((startedAt ?? 0) + MOCK_DURATION_MS)
    expect(hook.result.current.mock?.active).toBe(false)
    act(() => { expect(hook.result.current.updateCode('late edit')).toBe(false) })
    expect(hook.result.current.code).toBe('submission')
  })

  it('expires an overdue saved mock immediately on reload', () => {
    const hook = renderHook(() => useRefresherSession(mockDay, { random: chooseFirst }))
    act(() => { hook.result.current.startMock(); hook.result.current.updateCode('last saved') })
    hook.unmount()
    vi.setSystemTime(Date.now() + MOCK_DURATION_MS + 10_000)
    const restored = renderHook(() => useRefresherSession(mockDay))
    expect(restored.result.current.mock?.active).toBe(false)
    expect(restored.result.current.mock?.submittedCode).toBe('last saved')
    expect(restored.result.current.mock?.remainingMs).toBe(0)
    expect(restored.result.current.isReadOnly).toBe(true)
    expect(loadRefresherState().state.days[mockDay.id]?.attempts[0].finishedAt).not.toBeNull()
  })

  it('requires finished hidden checks and self-reported review to complete a mock', () => {
    const hook = renderHook(() => useRefresherSession(mockDay, { random: chooseFirst }))
    act(() => { hook.result.current.startMock() })
    act(() => { vi.advanceTimersByTime(30 * 60_000); hook.result.current.finishMock() })
    const captured = hook.result.current
    act(() => { hook.result.current.verify({ dayId: mockDay.id, stage: 'independent', code: captured.code, contextKey: captured.contextKey, passed: true }) })
    expect(hook.result.current.completedDayIds.has(mockDay.id)).toBe(false)
    act(() => {
      hook.result.current.setNote('Review notes', 'review')
      hook.result.current.completeStage('review')
      hook.result.current.setRubric({ readability: true, edgeCases: true, debugging: true, communication: true })
    })
    expect(hook.result.current.completedDayIds.has(mockDay.id)).toBe(true)
  })

  it('does not complete day 13 when submitted before its requirement change', () => {
    const hook = renderHook(() => useRefresherSession(mockDay, { random: chooseFirst }))
    act(() => { hook.result.current.startMock(); hook.result.current.finishMock() })
    const captured = hook.result.current
    act(() => {
      hook.result.current.verify({ dayId: mockDay.id, stage: 'independent', code: captured.code, contextKey: captured.contextKey, passed: true })
      hook.result.current.setNote('Reviewed the partial attempt', 'review')
      hook.result.current.completeStage('review')
      hook.result.current.setRubric({ readability: true, edgeCases: true, debugging: true, communication: true })
    })
    expect(hook.result.current.mock?.finishedAt).not.toBeNull()
    expect(hook.result.current.completedStages.independent).toBe(true)
    expect(hook.result.current.mock?.followUp).toBe(false)
    expect(hook.result.current.completedDayIds.has(mockDay.id)).toBe(false)
    act(() => { vi.advanceTimersByTime(MOCK_DURATION_MS) })
    expect(hook.result.current.completedDayIds.has(mockDay.id)).toBe(false)
  })

  it('keeps earlier submitted code and review rubric when starting a new attempt', () => {
    const hook = renderHook(() => useRefresherSession(mockDay, { random: chooseFirst }))
    act(() => {
      hook.result.current.startMock()
      hook.result.current.updateCode('first submitted code')
      hook.result.current.finishMock()
      hook.result.current.setRubric({ readability: true, notes: 'Improve edge cases next time' })
      hook.result.current.startMock()
    })
    const saved = loadRefresherState().state.days[mockDay.id]
    expect(saved?.attempts[0].submittedCode).toBe('first submitted code')
    expect(saved?.attempts[0].rubric?.notes).toBe('Improve edge cases next time')
    expect(hook.result.current.rubric?.notes).toBe('')
    expect(hook.result.current.mock?.variantId).toBe('b')
  })

  it('persists editable and resolved mistakes and uses unresolved days for consolidation', () => {
    const starterFor: StarterFor = (day, stage, context) =>
      stage === 'independent' && context.revisit ? context.revisit.join(' + ') : day.guidedStarter
    const hook = renderHook(({ day }: { day: RefresherDay }) => useRefresherSession(day, { starterFor }), { initialProps: { day: practice as RefresherDay } })
    act(() => { hook.result.current.addMistake({ dayId: 'refresher-05', error: 'forgot await', cause: 'async', correctPattern: 'await task' }) })
    const id = hook.result.current.mistakes[0].id
    act(() => { hook.result.current.editMistake(id, { cause: 'assumed sync' }); hook.result.current.resolveMistake(id); hook.result.current.resolveMistake(id, false) })
    hook.rerender({ day: consolidation })
    expect(hook.result.current.selectedDays).toEqual(['refresher-05', 'refresher-03'])
    act(() => { hook.result.current.changeStage('independent'); hook.result.current.updateCode('first pair work') })
    act(() => { expect(hook.result.current.selectDays(['refresher-03', 'refresher-03'])).toBe(false); hook.result.current.selectDays(['refresher-07', 'refresher-08']); hook.result.current.updateCode('second pair work') })
    act(() => { hook.result.current.selectDays(['refresher-05', 'refresher-03']) })
    expect(hook.result.current.code).toBe('first pair work')
    hook.unmount()
    const restored = renderHook(() => useRefresherSession(consolidation, { starterFor }))
    expect(restored.result.current.selectedDays).toEqual(['refresher-05', 'refresher-03'])
    expect(restored.result.current.code).toBe('first pair work')
    expect(restored.result.current.mistakes[0].cause).toBe('assumed sync')
    expect(restored.result.current.mistakes[0].resolved).toBe(false)
    act(() => { restored.result.current.selectDays(['refresher-07', 'refresher-08']) })
    expect(restored.result.current.code).toBe('second pair work')
  })
})
