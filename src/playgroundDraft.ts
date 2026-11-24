import { PLAYGROUND_DRAFTS, PLAYGROUND_LESSON_ID } from './curriculum/playgroundLessons'

/**
 * Lightweight localStorage persistence for the default plain-editor scratchpad.
 * Reads and updates only `lessons.playground` inside `plp-learning-v1` so all other saved
 * lesson progress stays untouched without loading the full curriculum catalog.
 */

export const LEARNING_STORAGE_KEY = 'plp-learning-v1'
const MAX_LESSON_CODE_LENGTH = 80_000
const MAX_LEARNING_STORAGE_LENGTH = 2_000_000

export type PlaygroundSaveStatus = 'saved' | 'unavailable' | 'too-large' | 'blocked'

export const PLAYGROUND_STARTER = PLAYGROUND_DRAFTS[0]!

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function starterFingerprint(code: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < code.length; index += 1) {
    hash ^= code.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

export type PlaygroundLoadResult = {
  code: string
  blocked: boolean
}

export function loadPlaygroundDraft(storage: StorageLike | null = browserStorage()): PlaygroundLoadResult {
  if (!storage) return { code: PLAYGROUND_STARTER.code, blocked: false }
  let raw: string | null
  try {
    raw = storage.getItem(LEARNING_STORAGE_KEY)
  } catch {
    return { code: PLAYGROUND_STARTER.code, blocked: false }
  }
  if (raw === null) return { code: PLAYGROUND_STARTER.code, blocked: false }
  if (raw.length > MAX_LEARNING_STORAGE_LENGTH) {
    return { code: PLAYGROUND_STARTER.code, blocked: true }
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.lessons)) {
      return { code: PLAYGROUND_STARTER.code, blocked: true }
    }
    const entry = parsed.lessons[PLAYGROUND_LESSON_ID]
    if (isRecord(entry) && typeof entry.code === 'string' && entry.code.length <= MAX_LESSON_CODE_LENGTH) {
      return { code: entry.code, blocked: false }
    }
    return { code: PLAYGROUND_STARTER.code, blocked: false }
  } catch {
    return { code: PLAYGROUND_STARTER.code, blocked: true }
  }
}

export function savePlaygroundDraft(
  code: string,
  storage: StorageLike | null = browserStorage(),
): PlaygroundSaveStatus {
  if (!storage) return 'unavailable'
  if (code.length > MAX_LESSON_CODE_LENGTH) return 'too-large'
  let raw: string | null
  try {
    raw = storage.getItem(LEARNING_STORAGE_KEY)
  } catch {
    return 'unavailable'
  }
  let state: Record<string, unknown>
  if (raw === null) {
    state = { version: 1, activeLessonId: PLAYGROUND_LESSON_ID, lastLessonByTrack: {}, lessons: {} }
  } else {
    if (raw.length > MAX_LEARNING_STORAGE_LENGTH) return 'blocked'
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.lessons)) return 'blocked'
      state = parsed
    } catch {
      return 'blocked'
    }
  }
  const lessons = state.lessons as Record<string, unknown>
  const previous = isRecord(lessons[PLAYGROUND_LESSON_ID]) ? lessons[PLAYGROUND_LESSON_ID] : null
  const currentStarter = starterFingerprint(PLAYGROUND_STARTER.code)
  const starter = !previous || code === PLAYGROUND_STARTER.code
    ? currentStarter
    : typeof previous.starter === 'string'
      ? previous.starter
      : undefined
  const lastByTrack = isRecord(state.lastLessonByTrack) ? state.lastLessonByTrack : {}
  const next = {
    ...state,
    version: 1,
    activeLessonId: PLAYGROUND_LESSON_ID,
    lastLessonByTrack: { ...lastByTrack, playground: PLAYGROUND_LESSON_ID },
    lessons: {
      ...lessons,
      [PLAYGROUND_LESSON_ID]: {
        ...(previous ?? {}),
        code,
        predictDone: typeof previous?.predictDone === 'boolean' ? previous.predictDone : false,
        verifiedCode: previous?.verifiedCode === code ? code : null,
        ...(starter ? { starter } : {}),
        backups: Array.isArray(previous?.backups) ? previous.backups : [],
      },
    },
  }
  const serialized = JSON.stringify(next)
  if (serialized.length > MAX_LEARNING_STORAGE_LENGTH) return 'too-large'
  try {
    storage.setItem(LEARNING_STORAGE_KEY, serialized)
    return 'saved'
  } catch {
    return 'unavailable'
  }
}
