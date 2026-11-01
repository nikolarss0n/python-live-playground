import { LESSONS, type Section } from './examples'

export const LEARNING_STORAGE_KEY = 'plp-learning-v1'
export const MAX_LESSON_CODE_LENGTH = 80_000
export const MAX_LEARNING_STORAGE_LENGTH = 2_000_000

export type SavedDraft = {
  code: string
  predictDone: boolean
  verifiedCode: string | null
  /** Fingerprint of the lesson starter this draft was begun from; absent for drafts saved before fingerprints. */
  starter?: string
}
export type SavedLesson = SavedDraft & { backups?: SavedDraft[] }

export type LearningState = {
  version: 1
  activeLessonId: string | null
  /** Last lesson opened in each menu section. */
  lastLessonByTrack: Partial<Record<Section, string>>
  lessons: Record<string, SavedLesson>
}

export type LearningStorage = Pick<Storage, 'getItem' | 'setItem'>

export type LearningLoadResult = {
  state: LearningState
  status: 'loaded' | 'empty' | 'invalid' | 'unavailable'
}

export type LearningSaveStatus = 'saved' | 'unavailable' | 'too-large'

export function emptyLearningState(): LearningState {
  return {
    version: 1,
    activeLessonId: null,
    lastLessonByTrack: {},
    lessons: {},
  }
}

function browserStorage(): LearningStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/** FNV-1a 32-bit hash of the authored starter, as 8 hex digits. */
export function starterFingerprint(code: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < code.length; index += 1) {
    hash ^= code.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

const readFingerprint = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}$/.test(value) ? { starter: value } : {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readSavedLesson(value: unknown): SavedLesson | null {
  if (
    !isRecord(value) ||
    typeof value.code !== 'string' ||
    value.code.length > MAX_LESSON_CODE_LENGTH ||
    typeof value.predictDone !== 'boolean'
  ) {
    return null
  }
  return {
    code: value.code,
    predictDone: value.predictDone,
    verifiedCode: value.verifiedCode === value.code ? value.code : null,
    ...readFingerprint(value.starter),
    backups: Array.isArray(value.backups)
      ? value.backups.filter(isRecord).filter((backup) =>
        typeof backup.code === 'string' && backup.code.length <= MAX_LESSON_CODE_LENGTH &&
        typeof backup.predictDone === 'boolean',
      ).flatMap((backup) => typeof backup.code === 'string' && typeof backup.predictDone === 'boolean'
        ? [{ code: backup.code, predictDone: backup.predictDone, verifiedCode: backup.verifiedCode === backup.code ? backup.code : null, ...readFingerprint(backup.starter) }]
        : [])
      : [],
  }
}

function parseLearningState(value: unknown): LearningState | null {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.lessons)) {
    return null
  }
  const state = emptyLearningState()
  for (const lesson of LESSONS) {
    const saved = readSavedLesson(value.lessons[lesson.id])
    if (saved) state.lessons[lesson.id] = saved
    if (value.activeLessonId === lesson.id) state.activeLessonId = lesson.id
    if (
      isRecord(value.lastLessonByTrack) &&
      value.lastLessonByTrack[lesson.section] === lesson.id
    ) {
      state.lastLessonByTrack[lesson.section] = lesson.id
    }
  }
  return state
}

export function loadLearningState(
  storage: LearningStorage | null = browserStorage(),
): LearningLoadResult {
  if (!storage) return { state: emptyLearningState(), status: 'unavailable' }
  let raw: string | null
  try {
    raw = storage.getItem(LEARNING_STORAGE_KEY)
  } catch {
    return { state: emptyLearningState(), status: 'unavailable' }
  }
  if (raw === null) return { state: emptyLearningState(), status: 'empty' }
  if (raw.length > MAX_LEARNING_STORAGE_LENGTH) {
    return { state: emptyLearningState(), status: 'invalid' }
  }
  try {
    const value: unknown = JSON.parse(raw)
    const state = parseLearningState(value)
    return state
      ? { state, status: 'loaded' }
      : { state: emptyLearningState(), status: 'invalid' }
  } catch {
    return { state: emptyLearningState(), status: 'invalid' }
  }
}

export function saveLearningState(
  state: LearningState,
  storage: LearningStorage | null = browserStorage(),
): LearningSaveStatus {
  if (!storage) return 'unavailable'
  if (
    Object.values(state.lessons).flatMap((lesson) => [lesson, ...(lesson.backups ?? [])]).some(
      (lesson) => lesson.code.length > MAX_LESSON_CODE_LENGTH,
    )
  ) {
    return 'too-large'
  }
  const raw = JSON.stringify(state)
  if (raw.length > MAX_LEARNING_STORAGE_LENGTH) return 'too-large'
  try {
    storage.setItem(LEARNING_STORAGE_KEY, raw)
    return 'saved'
  } catch {
    return 'unavailable'
  }
}

export function isLessonVerified(lesson: SavedLesson | undefined): boolean {
  return (
    lesson !== undefined &&
    lesson.verifiedCode !== null &&
    lesson.verifiedCode === lesson.code
  )
}

export function updateLearningState(
  state: LearningState,
  input: {
    lessonId: string
    code: string
    predictDone: boolean
    verified?: boolean
  },
): LearningState {
  const lesson = LESSONS.find((entry) => entry.id === input.lessonId)
  if (!lesson) return state
  const previous = state.lessons[lesson.id]
  const verifiedCode =
    input.verified === true
      ? input.code
      : input.verified === false
        ? null
        : previous?.verifiedCode === input.code
          ? input.code
          : null
  // A new draft, or one that is the current starter, begins from today's starter; an older draft keeps what it had.
  const current = starterFingerprint(lesson.code)
  const starter = !previous || input.code === lesson.code ? current : previous.starter
  return {
    version: 1,
    activeLessonId: lesson.id,
    lastLessonByTrack: {
      ...state.lastLessonByTrack,
      [lesson.section]: lesson.id,
    },
    lessons: {
      ...state.lessons,
      [lesson.id]: {
        code: input.code,
        predictDone: input.predictDone,
        verifiedCode,
        ...(starter ? { starter } : {}),
        backups: previous?.backups ?? [],
      },
    },
  }
}

export function restartLearningLesson(state: LearningState, id: string, starter: string): LearningState {
  const saved = state.lessons[id]
  if (!LESSONS.some((lesson) => lesson.id === id) || !saved || saved.code === starter || (saved.backups?.length ?? 0) >= 20) return state
  const next = updateLearningState(state, { lessonId: id, code: starter, predictDone: false, verified: false })
  const backup: SavedDraft = { code: saved.code, predictDone: saved.predictDone, verifiedCode: saved.verifiedCode, ...(saved.starter ? { starter: saved.starter } : {}) }
  const nextDraft = next.lessons[id]
  const lesson = LESSONS.find((entry) => entry.id === id)
  if (!nextDraft || !lesson) return state
  nextDraft.starter = starterFingerprint(lesson.code)
  nextDraft.backups = [...(saved.backups ?? []), backup]
  return next
}

export function restoreLearningLesson(state: LearningState, id: string): LearningState {
  const saved = state.lessons[id]
  const backup = saved?.backups?.at(-1)
  if (!saved || !backup) return state
  const current: SavedDraft = { code: saved.code, predictDone: saved.predictDone, verifiedCode: saved.verifiedCode, ...(saved.starter ? { starter: saved.starter } : {}) }
  return {
    ...state,
    lessons: { ...state.lessons, [id]: { ...backup, backups: [...(saved.backups?.slice(0, -1) ?? []), current] } },
  }
}

/** True when the saved draft began from an older version of the lesson's starter and is not the current starter. */
export function starterUpdated(state: LearningState, id: string): boolean {
  const saved = state.lessons[id]
  const lesson = LESSONS.find((entry) => entry.id === id)
  return Boolean(saved?.starter && lesson && saved.starter !== starterFingerprint(lesson.code) && saved.code !== lesson.code)
}

/** Keep the current draft and stop reporting the starter change. */
export function acknowledgeStarter(state: LearningState, id: string): LearningState {
  const saved = state.lessons[id]
  const lesson = LESSONS.find((entry) => entry.id === id)
  if (!saved || !lesson) return state
  return { ...state, lessons: { ...state.lessons, [id]: { ...saved, starter: starterFingerprint(lesson.code) } } }
}
