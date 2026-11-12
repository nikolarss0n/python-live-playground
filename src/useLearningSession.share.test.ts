import { afterEach, describe, expect, it } from 'vitest'
import { emptyLearningState, loadLearningState, restartLearningLesson, restoreLearningLesson, saveLearningState, trustSharedCode, updateLearningState } from './learningStorage'
import { encodeSnapshot } from './shareSnapshot'
import { initialSession, sharedLinkSkipped } from './useLearningSession'

function openShared(code: string) {
  window.history.replaceState(null, '', `/#${encodeSnapshot({ v: 1, lessonId: 'printing', difficulty: 'beginner', code })}`)
}

describe('opening a shared link', () => {
  afterEach(() => { window.history.replaceState(null, '', '/'); window.localStorage.clear() })

  it('keeps the learner draft as a restorable backup before showing the shared code', () => {
    const mine = updateLearningState(emptyLearningState(), { lessonId: 'printing', code: 'print("my work")', predictDone: true, verified: true })
    openShared('print("from a link")')
    const state = initialSession(mine)
    expect(state.activeLessonId).toBe('printing')
    expect(state.lessons.printing?.code).toBe('print("from a link")')
    expect(restoreLearningLesson(state, 'printing').lessons.printing?.code).toBe('print("my work")')
  })

  it('does not replace the draft when no backup slot is left', () => {
    let mine = updateLearningState(emptyLearningState(), { lessonId: 'printing', code: 'print("my work")', predictDone: true })
    mine = { ...mine, lessons: { printing: { ...mine.lessons.printing!, backups: Array.from({ length: 20 }, (_, i) => ({ code: `b${i}`, predictDone: false, verifiedCode: null })) } } }
    openShared('print("from a link")')
    const state = initialSession(mine)
    expect(state.lessons.printing?.code).toBe('print("my work")')
    expect(sharedLinkSkipped(state)).toBe(true)
  })

  it('opens the shared code directly when there is no draft yet', () => {
    openShared('print("from a link")')
    const state = initialSession(emptyLearningState())
    expect(state.lessons.printing?.code).toBe('print("from a link")')
    expect(state.lessons.printing?.backups).toEqual([])
    expect(sharedLinkSkipped(state)).toBe(false)
  })

  it('marks shared code untrusted until the learner runs it, through edits and a save and reload', () => {
    openShared('print("from a link")')
    const state = initialSession(emptyLearningState())
    expect(state.lessons.printing?.shared).toBe(true)
    expect(saveLearningState(state)).toBe('saved')
    const reloaded = loadLearningState().state
    expect(reloaded.lessons.printing?.shared).toBe(true)
    expect(updateLearningState(reloaded, { lessonId: 'printing', code: 'print("from a link")', predictDone: true }).lessons.printing?.shared).toBe(true)
    const edited = updateLearningState(reloaded, { lessonId: 'printing', code: 'print("edited")', predictDone: true })
    expect(edited.lessons.printing?.shared).toBe(true)
    const trusted = trustSharedCode(edited, 'printing')
    expect(trusted.lessons.printing).toMatchObject({ code: 'print("edited")' })
    expect(trusted.lessons.printing?.shared).toBeUndefined()
    expect(updateLearningState(trusted, { lessonId: 'printing', code: 'print("mine")', predictDone: true }).lessons.printing?.shared).toBeUndefined()
  })

  it('treats the starter as trusted after a reset, and keeps the shared draft marked in its backup', () => {
    openShared('print("from a link")')
    const reset = restartLearningLesson(initialSession(emptyLearningState()), 'printing', 'print("starter")')
    expect(reset.lessons.printing?.code).toBe('print("starter")')
    expect(reset.lessons.printing?.shared).toBeUndefined()
    expect(reset.lessons.printing?.backups?.at(-1)).toMatchObject({ code: 'print("from a link")', shared: true })
  })

  it('keeps the untrusted mark when a shared draft is backed up and restored', () => {
    openShared('print("link X")')
    const first = initialSession(emptyLearningState())
    openShared('print("link Y")')
    const second = initialSession(first)
    expect(second.lessons.printing?.backups?.at(-1)).toMatchObject({ code: 'print("link X")', shared: true })
    expect(saveLearningState(second)).toBe('saved')
    const restored = restoreLearningLesson(loadLearningState().state, 'printing')
    expect(restored.lessons.printing).toMatchObject({ code: 'print("link X")', shared: true })
    expect(restored.lessons.printing?.backups?.at(-1)).toMatchObject({ code: 'print("link Y")', shared: true })
  })
})
