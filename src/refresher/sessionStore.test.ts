import { beforeEach, describe, expect, it } from 'vitest'
import {
  MAX_DRAFT_LENGTH, REFRESHER_DAMAGED_KEY, REFRESHER_STORAGE_KEY, defaultStarter, emptyRefresherState, ensureDay,
  loadRefresherState, saveRefresherState, suggestRevisit, type SessionStorage,
} from './sessionStore'
import type { PracticeDay } from './types'

const day: PracticeDay = {
  id: 'refresher-01', day: 1, title: 'Contracts', kind: 'practice', minutes: 60,
  consolidation: { functionName: 'example', problem: 'Return a value', starter: 'def example():\n    pass\n', checks: [] },
  support: 'worked', recall: 'Recall a function.', concepts: [], workedExample: 'print(1)',
  guidedStarter: 'guided starter', independentStarter: 'independent starter', problem: 'Build it',
  acceptance: [], hints: [], reviewPrompts: [], resources: [], checks: [],
}

describe('refresher session storage', () => {
  beforeEach(() => window.localStorage.clear())

  it('round-trips independent drafts and self-reported notes without a lesson catalog', () => {
    const state = ensureDay(emptyRefresherState(), day, defaultStarter)
    const saved = state.days[day.id]
    if (!saved) throw new Error('Missing day')
    saved.workspaces.practice.guided.code = 'learner guided'
    saved.workspaces.practice.independent.code = 'learner independent'
    saved.workspaces.practice.recall.note = 'My recall'
    saved.workspaces.practice.recall.selfComplete = true
    expect(saveRefresherState(state)).toBe('saved')
    expect(loadRefresherState()).toEqual({ state, status: 'loaded' })
  })

  it.each(['null', '{broken', '{"version":2}', '{"version":1,"days":[],"mistakes":[],"backups":[]}'])(
    'recovers from invalid storage without crashing: %s', (value) => {
      window.localStorage.setItem(REFRESHER_STORAGE_KEY, value)
      expect(loadRefresherState().status).toBe('invalid')
      expect(loadRefresherState().state).toEqual(emptyRefresherState())
      expect(loadRefresherState()).toMatchObject({ damagedRaw: value, preserved: true })
      expect(window.localStorage.getItem(REFRESHER_DAMAGED_KEY)).toBe(value)
      expect(window.localStorage.getItem(REFRESHER_STORAGE_KEY)).toBe(value)
    },
  )

  it('reports unreadable data as not preserved when the backup copy cannot be written', () => {
    const full: SessionStorage = {
      getItem: (key) => (key === REFRESHER_STORAGE_KEY ? '{broken' : null),
      setItem() { throw new Error('Quota') },
    }
    expect(loadRefresherState(full)).toMatchObject({ status: 'invalid', damagedRaw: '{broken', preserved: false })
  })

  it('reports blocked storage and quota failures accurately', () => {
    const blocked: SessionStorage = {
      getItem() { throw new Error('Blocked') }, setItem() { throw new Error('Quota') },
    }
    expect(loadRefresherState(blocked).status).toBe('unavailable')
    expect(saveRefresherState(emptyRefresherState(), blocked)).toBe('unavailable')
    expect(saveRefresherState(emptyRefresherState(), null)).toBe('unavailable')
  })

  it('rejects an oversized backup before claiming a successful save', () => {
    const state = ensureDay(emptyRefresherState(), day, defaultStarter)
    expect(saveRefresherState(state)).toBe('saved')
    const previous = window.localStorage.getItem(REFRESHER_STORAGE_KEY)
    state.backups.push({ id: 'backup', dayId: day.id, workspaceKey: 'practice', stage: 'guided', createdAt: 0,
      draft: { code: 'x'.repeat(MAX_DRAFT_LENGTH + 1), note: '', selfComplete: false, verification: null } })
    expect(saveRefresherState(state)).toBe('too-large')
    expect(window.localStorage.getItem(REFRESHER_STORAGE_KEY)).toBe(previous)
  })

  it('suggests two distinct unresolved practice days and fills from sensible defaults', () => {
    const mistake = { id: 'one', dayId: 'refresher-05' as const, error: 'bug', cause: '', correctPattern: '', createdAt: 0, resolved: false }
    expect(suggestRevisit([mistake, { ...mistake, id: 'two' }])).toEqual(['refresher-05', 'refresher-03'])
    expect(suggestRevisit([{ ...mistake, resolved: true }])).toEqual(['refresher-03', 'refresher-04'])
  })
})
