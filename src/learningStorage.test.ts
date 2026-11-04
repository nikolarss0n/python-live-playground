import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LESSONS } from './examples'
import {
  emptyLearningState,
  isLessonVerified,
  LEARNING_DAMAGED_KEY,
  LEARNING_STORAGE_KEY,
  loadLearningState,
  MAX_LEARNING_STORAGE_LENGTH,
  MAX_LESSON_CODE_LENGTH,
  saveLearningState,
  updateLearningState,
  restartLearningLesson,
  restoreLearningLesson,
  starterFingerprint,
  starterUpdated,
  acknowledgeStarter,
  type LearningState,
  type LearningStorage,
} from './learningStorage'

describe('local learning storage', () => {
  beforeEach(() => window.localStorage.clear())

  it('preserves restart backups across reload and swaps back without losing later edits', () => {
    const original = updateLearningState(emptyLearningState(), { lessonId: 'printing', code: 'print("original")', predictDone: true, verified: true })
    const restarted = restartLearningLesson(original, 'printing', 'starter')
    expect(original.lessons.printing.code).toBe('print("original")')
    expect(restarted.lessons.printing.verifiedCode).toBeNull()
    expect(saveLearningState(restarted)).toBe('saved')
    const restored = restoreLearningLesson(loadLearningState().state, 'printing')
    expect(restored.lessons.printing.code).toBe('print("original")')
    expect(isLessonVerified(restored.lessons.printing)).toBe(true)
    const edited = updateLearningState(restarted, { lessonId: 'printing', code: 'new attempt', predictDone: false })
    const previous = restoreLearningLesson(edited, 'printing')
    expect(restoreLearningLesson(previous, 'printing').lessons.printing.code).toBe('new attempt')
  })

  it('rejects an oversized backup rather than claiming that a reset is recoverable', () => {
    const state = updateLearningState(emptyLearningState(), { lessonId: 'printing', code: 'x'.repeat(MAX_LESSON_CODE_LENGTH + 1), predictDone: false })
    const restarted = restartLearningLesson(state, 'printing', 'starter')
    expect(saveLearningState(restarted)).toBe('too-large')
  })

  it('starts empty without writing storage', () => {
    expect(loadLearningState()).toEqual({ state: emptyLearningState(), status: 'empty' })
    expect(window.localStorage.getItem(LEARNING_STORAGE_KEY)).toBeNull()
  })

  it('round-trips drafts, prediction state, exact completion and last location', () => {
    const first = LESSONS[0]
    const second = LESSONS.find((lesson) => lesson.section !== first.section)
    if (!second) throw new Error('Expected at least two menu sections')
    const started = updateLearningState(emptyLearningState(), {
      lessonId: first.id,
      code: 'print("learner one")',
      predictDone: true,
      verified: true,
    })
    const state = updateLearningState(started, {
      lessonId: second.id,
      code: 'print("learner two")',
      predictDone: false,
    })
    expect(saveLearningState(state)).toBe('saved')
    const loaded = loadLearningState()
    expect(loaded).toEqual({ state, status: 'loaded' })
    expect(loaded.state.activeLessonId).toBe(second.id)
    expect(loaded.state.lastLessonByTrack[first.section]).toBe(first.id)
    expect(loaded.state.lastLessonByTrack[second.section]).toBe(second.id)
    expect(isLessonVerified(loaded.state.lessons[first.id])).toBe(true)
    expect(isLessonVerified(loaded.state.lessons[second.id])).toBe(false)
    expect(started.lessons[second.id]).toBeUndefined()
  })

  it('invalidates completion on edits and only verifies again after a new passing run', () => {
    const lessonId = LESSONS[0].id
    const input = { lessonId, code: 'print(1)', predictDone: true }
    const verified = updateLearningState(emptyLearningState(), { ...input, verified: true })
    const unchanged = updateLearningState(verified, input)
    expect(isLessonVerified(unchanged.lessons[lessonId])).toBe(true)
    const edited = updateLearningState(unchanged, { ...input, code: 'print(2)' })
    expect(isLessonVerified(edited.lessons[lessonId])).toBe(false)
    const reverted = updateLearningState(edited, input)
    expect(isLessonVerified(reverted.lessons[lessonId])).toBe(false)
    const passed = updateLearningState(reverted, { ...input, verified: true })
    expect(isLessonVerified(passed.lessons[lessonId])).toBe(true)
    const failed = updateLearningState(passed, { ...input, verified: false })
    expect(isLessonVerified(failed.lessons[lessonId])).toBe(false)
  })

  it('preserves an intentionally empty draft', () => {
    const lessonId = LESSONS[0].id
    const state = updateLearningState(emptyLearningState(), {
      lessonId, code: '', predictDone: false,
    })
    saveLearningState(state)
    expect(loadLearningState().state.lessons[lessonId].code).toBe('')
  })

  it.each(['{broken', 'null', '[]', '{"version":2,"lessons":{}}', '{"version":1,"lessons":[]}'])(
    'recovers safely from invalid data: %s', (raw) => {
      window.localStorage.setItem(LEARNING_STORAGE_KEY, raw)
      expect(loadLearningState()).toEqual({ state: emptyLearningState(), status: 'invalid', damagedRaw: raw, preserved: true })
      expect(window.localStorage.getItem(LEARNING_DAMAGED_KEY)).toBe(raw)
      expect(window.localStorage.getItem(LEARNING_STORAGE_KEY)).toBe(raw)
    },
  )

  it('reports unreadable data as not preserved when the backup copy cannot be written', () => {
    const raw = ' '.repeat(MAX_LEARNING_STORAGE_LENGTH + 1)
    const full: LearningStorage = {
      getItem: (key) => (key === LEARNING_STORAGE_KEY ? raw : null),
      setItem: () => { throw new DOMException('quota', 'QuotaExceededError') },
    }
    expect(loadLearningState(full)).toMatchObject({ status: 'invalid', damagedRaw: raw, preserved: false })
  })

  it('retires unknown IDs and ignores wrong-track locations and malformed drafts', () => {
    const first = LESSONS[0]
    const second = LESSONS[1]
    window.localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify({
      version: 1,
      activeLessonId: 'removed-lesson',
      lastLessonByTrack: { build: first.id, [first.section]: second.id },
      lessons: {
        'removed-lesson': { code: 'print(1)', predictDone: false },
        [first.id]: { code: 42, predictDone: false },
        [second.id]: { code: 'print(2)', predictDone: true, verifiedCode: 'print(1)' },
      },
    }))
    const { state } = loadLearningState()
    expect(state.activeLessonId).toBeNull()
    expect(state.lastLessonByTrack).toEqual({ [first.section]: second.id })
    expect(state.lessons).toEqual({
      [second.id]: { code: 'print(2)', predictDone: true, verifiedCode: null, backups: [] },
    })
    expect(state.retired).toEqual({ 'removed-lesson': { code: 'print(1)', predictDone: false, verifiedCode: null, backups: [] } })
    const edited = updateLearningState(state, { lessonId: second.id, code: 'print(3)', predictDone: true })
    expect(saveLearningState(edited)).toBe('saved')
    expect(loadLearningState().state.retired?.['removed-lesson']?.code).toBe('print(1)')
    expect(updateLearningState(state, {
      lessonId: 'removed-lesson', code: '', predictDone: true,
    })).toBe(state)
  })

  it('returns an honest status when storage is absent, blocked or full', () => {
    const blocked: LearningStorage = {
      getItem() { throw new DOMException('Blocked', 'SecurityError') },
      setItem() { throw new DOMException('Full', 'QuotaExceededError') },
    }
    expect(loadLearningState(null).status).toBe('unavailable')
    expect(loadLearningState(blocked).status).toBe('unavailable')
    expect(saveLearningState(emptyLearningState(), null)).toBe('unavailable')
    expect(saveLearningState(emptyLearningState(), blocked)).toBe('unavailable')
  })

  it('guards the browser localStorage getter itself', () => {
    const getter = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })
    try {
      expect(loadLearningState().status).toBe('unavailable')
      expect(saveLearningState(emptyLearningState())).toBe('unavailable')
    } finally {
      getter.mockRestore()
    }
  })

  it('rejects oversized data without overwriting the previous save', () => {
    const lessonId = LESSONS[0].id
    const saved = updateLearningState(emptyLearningState(), {
      lessonId, code: 'print(1)', predictDone: false,
    })
    saveLearningState(saved)
    const tooLarge = updateLearningState(saved, {
      lessonId, code: 'x'.repeat(MAX_LESSON_CODE_LENGTH + 1), predictDone: false,
    })
    expect(saveLearningState(tooLarge)).toBe('too-large')
    expect(loadLearningState().state).toEqual(saved)
    const oversized: LearningStorage = {
      getItem: () => ' '.repeat(MAX_LEARNING_STORAGE_LENGTH + 1),
      setItem: () => undefined,
    }
    expect(loadLearningState(oversized).status).toBe('invalid')
  })
})

describe('starter fingerprints', () => {
  const lesson = LESSONS.find((entry) => entry.id === 'functions')!
  const edited = (state: LearningState) => updateLearningState(state, { lessonId: lesson.id, code: `${lesson.code}\nprint(1)`, predictDone: false })

  it('fingerprints a new draft with the current starter and keeps it through edits', () => {
    const state = edited(updateLearningState(emptyLearningState(), { lessonId: lesson.id, code: lesson.code, predictDone: false }))
    expect(state.lessons[lesson.id]?.starter).toBe(starterFingerprint(lesson.code))
    expect(starterUpdated(state, lesson.id)).toBe(false)
  })

  it('reports a draft begun from an older starter until it is restarted or kept', () => {
    const base = edited(updateLearningState(emptyLearningState(), { lessonId: lesson.id, code: lesson.code, predictDone: false }))
    const old: LearningState = { ...base, lessons: { ...base.lessons, [lesson.id]: { ...base.lessons[lesson.id]!, starter: 'deadbeef' } } }
    expect(starterUpdated(old, lesson.id)).toBe(true)
    expect(starterUpdated(edited(old), lesson.id)).toBe(true)
    expect(starterUpdated(acknowledgeStarter(old, lesson.id), lesson.id)).toBe(false)
    const restarted = restartLearningLesson(old, lesson.id, lesson.code)
    expect(starterUpdated(restarted, lesson.id)).toBe(false)
    expect(restarted.lessons[lesson.id]?.backups?.at(-1)?.starter).toBe('deadbeef')
  })

  it('never reports legacy drafts without a fingerprint, and survives a save and load', () => {
    const base = edited(updateLearningState(emptyLearningState(), { lessonId: lesson.id, code: lesson.code, predictDone: false }))
    const { starter: _starter, ...legacyDraft } = base.lessons[lesson.id]!
    const legacy = edited({ ...base, lessons: { ...base.lessons, [lesson.id]: legacyDraft } })
    expect(legacy.lessons[lesson.id]?.starter).toBeUndefined()
    expect(starterUpdated(legacy, lesson.id)).toBe(false)

    const store = new Map<string, string>()
    const storage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value) }
    saveLearningState(base, storage)
    expect(loadLearningState(storage).state.lessons[lesson.id]?.starter).toBe(starterFingerprint(lesson.code))
  })
})
