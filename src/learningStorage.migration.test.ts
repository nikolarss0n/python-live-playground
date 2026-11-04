import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LESSONS } from './examples'

const [renamedTo, mergedInto] = [LESSONS[0], LESSONS[1]]

vi.mock('./lessonIds', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lessonIds')>()
  const { LESSONS: lessons } = await import('./examples')
  const aliases: Record<string, string> = { 'old-name': lessons[0].id, 'older-name': 'old-name', 'old-twin': lessons[1].id }
  return {
    ...actual,
    resolveLessonId: (id: string) => {
      let next: string | undefined = id
      for (let hop = 0; next !== undefined && hop < 5; hop += 1) {
        if (lessons.some((lesson) => lesson.id === next)) return next
        next = aliases[next]
      }
      return null
    },
  }
})

const { LEARNING_STORAGE_KEY, loadLearningState, saveLearningState, starterUpdated } = await import('./learningStorage')

function seed(value: unknown) {
  window.localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(value))
}

describe('renamed and removed lesson IDs', () => {
  beforeEach(() => window.localStorage.clear())

  it('moves a draft, its backups and the last location to the renamed lesson, following alias chains', () => {
    seed({
      version: 1,
      activeLessonId: 'older-name',
      lastLessonByTrack: { [renamedTo.section]: 'older-name' },
      lessons: { 'older-name': { code: 'print("mine")', predictDone: true, verifiedCode: 'print("mine")', starter: '00000000', backups: [{ code: 'first try', predictDone: false }] } },
    })
    const { state } = loadLearningState()
    expect(state.activeLessonId).toBe(renamedTo.id)
    expect(state.lastLessonByTrack[renamedTo.section]).toBe(renamedTo.id)
    expect(state.lessons[renamedTo.id]?.code).toBe('print("mine")')
    expect(state.lessons[renamedTo.id]?.backups?.map((backup) => backup.code)).toEqual(['first try'])
    expect(state.lessons['older-name']).toBeUndefined()
    expect(starterUpdated(state, renamedTo.id)).toBe(true)
  })

  it('keeps the current draft and adds the old one as a restorable backup when both exist', () => {
    seed({
      version: 1,
      activeLessonId: null,
      lastLessonByTrack: {},
      lessons: {
        'old-twin': { code: 'old work', predictDone: true },
        [mergedInto.id]: { code: 'new work', predictDone: false },
      },
    })
    const draft = loadLearningState().state.lessons[mergedInto.id]
    expect(draft?.code).toBe('new work')
    expect(draft?.backups?.map((backup) => backup.code)).toEqual(['old work'])
  })

  it('retires the old draft instead of dropping it when the backups are full', () => {
    const backups = Array.from({ length: 20 }, (_, index) => ({ code: `b${index}`, predictDone: false }))
    seed({
      version: 1,
      activeLessonId: null,
      lastLessonByTrack: {},
      lessons: { 'old-twin': { code: 'old work', predictDone: true }, [mergedInto.id]: { code: 'new work', predictDone: false, backups } },
    })
    const { state } = loadLearningState()
    expect(state.lessons[mergedInto.id]?.backups).toHaveLength(20)
    expect(state.retired?.[`${mergedInto.id}~moved`]?.code).toBe('old work')
  })

  it('keeps retired drafts across saves and brings one back once an alias points to a lesson', () => {
    seed({
      version: 1,
      activeLessonId: null,
      lastLessonByTrack: {},
      lessons: {},
      retired: { 'gone-for-good': { code: 'keep me', predictDone: false }, 'old-name': { code: 'revived', predictDone: true } },
    })
    const { state } = loadLearningState()
    expect(state.retired).toEqual({ 'gone-for-good': { code: 'keep me', predictDone: false, verifiedCode: null, backups: [] } })
    expect(state.lessons[renamedTo.id]?.code).toBe('revived')
    expect(saveLearningState(state)).toBe('saved')
    expect(loadLearningState().state.retired?.['gone-for-good']?.code).toBe('keep me')
  })
})
