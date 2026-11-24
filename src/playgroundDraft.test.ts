import { describe, expect, it } from 'vitest'
import {
  LEARNING_STORAGE_KEY,
  PLAYGROUND_STARTER,
  loadPlaygroundDraft,
  savePlaygroundDraft,
} from './playgroundDraft'

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
    dump: (key: string) => map.get(key) ?? null,
  }
}

describe('playgroundDraft', () => {
  it('loads the starter when storage is empty and persists edits', () => {
    const storage = memoryStorage()
    expect(loadPlaygroundDraft(storage)).toEqual({ code: PLAYGROUND_STARTER.code, blocked: false })

    expect(savePlaygroundDraft('print("hi")', storage)).toBe('saved')
    expect(loadPlaygroundDraft(storage)).toEqual({ code: 'print("hi")', blocked: false })
  })

  it('preserves other saved lessons and retired drafts when saving the playground draft', () => {
    const existing = {
      version: 1,
      activeLessonId: 'printing',
      lastLessonByTrack: { python: 'printing' },
      lessons: {
        printing: { code: 'print("mine")', predictDone: true, verifiedCode: 'print("mine")', backups: [] },
      },
      retired: {
        old_lesson: { code: 'x = 1', predictDone: false, verifiedCode: null, backups: [] },
      },
    }
    const storage = memoryStorage({ [LEARNING_STORAGE_KEY]: JSON.stringify(existing) })
    expect(savePlaygroundDraft('print("play")', storage)).toBe('saved')

    const parsed = JSON.parse(storage.dump(LEARNING_STORAGE_KEY) ?? '{}')
    expect(parsed.lessons.printing.code).toBe('print("mine")')
    expect(parsed.retired.old_lesson.code).toBe('x = 1')
    expect(parsed.lessons.playground.code).toBe('print("play")')
    expect(parsed.lastLessonByTrack.python).toBe('printing')
  })

  it('refuses to overwrite corrupt saved progress', () => {
    const storage = memoryStorage({ [LEARNING_STORAGE_KEY]: '{not json' })
    expect(loadPlaygroundDraft(storage)).toEqual({ code: PLAYGROUND_STARTER.code, blocked: true })
    expect(savePlaygroundDraft('print(1)', storage)).toBe('blocked')
    expect(storage.dump(LEARNING_STORAGE_KEY)).toBe('{not json')
  })

  it('rejects drafts exceeding the size limit', () => {
    const storage = memoryStorage()
    expect(savePlaygroundDraft('a'.repeat(80_001), storage)).toBe('too-large')
  })
})
