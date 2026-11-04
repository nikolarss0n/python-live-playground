import { LESSONS, type Section } from './examples'
import { resolveLessonId } from './lessonIds'

export const LEARNING_STORAGE_KEY = 'plp-learning-v1'
/** Holds the last saved data that could not be read, so the next save cannot destroy it. */
export const LEARNING_DAMAGED_KEY = 'plp-learning-v1-damaged'
export const MAX_LESSON_CODE_LENGTH = 80_000
export const MAX_LEARNING_STORAGE_LENGTH = 2_000_000

export type SavedDraft = {
  code: string
  predictDone: boolean
  verifiedCode: string | null
  /** Fingerprint of the lesson starter this draft was begun from; absent for drafts saved before fingerprints. */
  starter?: string
  /** The code came from a shared link and has not been edited since, so it runs as untrusted. */
  shared?: true
}
export type SavedLesson = SavedDraft & { backups?: SavedDraft[] }

export type LearningState = {
  version: 1
  activeLessonId: string | null
  /** Last lesson opened in each menu section. */
  lastLessonByTrack: Partial<Record<Section, string>>
  lessons: Record<string, SavedLesson>
  /** Drafts whose lesson no longer exists, kept untouched so a save never deletes a learner's code. */
  retired?: Record<string, SavedLesson>
}

export type LearningStorage = Pick<Storage, 'getItem' | 'setItem'>

export type LearningLoadResult =
  | { state: LearningState; status: 'loaded' | 'empty' | 'unavailable' }
  | {
    state: LearningState
    status: 'invalid'
    /** The unreadable text, kept so the learner can download it. */
    damagedRaw: string
    /** True when a copy was written to LEARNING_DAMAGED_KEY; false means only the original still holds it. */
    preserved: boolean
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
const readShared = (value: unknown) => (value === true ? { shared: true as const } : {})
/** The draft fields a backup keeps, including whether the code is still untrusted. */
const draftOf = (saved: SavedDraft): SavedDraft => ({
  code: saved.code, predictDone: saved.predictDone, verifiedCode: saved.verifiedCode,
  ...(saved.starter ? { starter: saved.starter } : {}), ...(saved.shared ? { shared: true as const } : {}),
})

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
    ...readShared(value.shared),
    backups: Array.isArray(value.backups)
      ? value.backups.filter(isRecord).filter((backup) =>
        typeof backup.code === 'string' && backup.code.length <= MAX_LESSON_CODE_LENGTH &&
        typeof backup.predictDone === 'boolean',
      ).flatMap((backup) => typeof backup.code === 'string' && typeof backup.predictDone === 'boolean'
        ? [{ code: backup.code, predictDone: backup.predictDone, verifiedCode: backup.verifiedCode === backup.code ? backup.code : null, ...readFingerprint(backup.starter), ...readShared(backup.shared) }]
        : [])
      : [],
  }
}

const MAX_BACKUPS = 20

function parseLearningState(value: unknown): LearningState | null {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.lessons)) {
    return null
  }
  const state = emptyLearningState()
  const retired: Record<string, SavedLesson> = {}
  const moved: [string, SavedLesson][] = []
  for (const [id, raw] of Object.entries(value.lessons)) {
    const saved = readSavedLesson(raw)
    if (!saved) continue
    const current = resolveLessonId(id)
    if (current === id) state.lessons[id] = saved
    else if (current) moved.push([current, saved])
    else retired[id] = saved
  }
  if (isRecord(value.retired)) {
    for (const [id, raw] of Object.entries(value.retired)) {
      const saved = readSavedLesson(raw)
      if (!saved) continue
      const current = id.endsWith('~moved') ? null : resolveLessonId(id)
      if (current) moved.push([current, saved])
      else if (!retired[id]) retired[id] = saved
    }
  }
  for (const [id, saved] of moved) {
    const existing = state.lessons[id]
    if (!existing) state.lessons[id] = saved
    else {
      const backups = [...(existing.backups ?? []), ...(saved.backups ?? []), draftOf(saved)]
      if (backups.length <= MAX_BACKUPS) existing.backups = backups
      else retired[`${id}~moved`] = saved
    }
  }
  if (Object.keys(retired).length > 0) state.retired = retired
  if (typeof value.activeLessonId === 'string') state.activeLessonId = resolveLessonId(value.activeLessonId)
  if (isRecord(value.lastLessonByTrack)) {
    for (const lesson of LESSONS) {
      const saved = value.lastLessonByTrack[lesson.section]
      if (typeof saved === 'string' && resolveLessonId(saved) === lesson.id) state.lastLessonByTrack[lesson.section] = lesson.id
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
  if (raw.length <= MAX_LEARNING_STORAGE_LENGTH) {
    try {
      const state = parseLearningState(JSON.parse(raw))
      if (state) return { state, status: 'loaded' }
    } catch {
      // Falls through to keeping a copy of the unreadable data.
    }
  }
  return { state: emptyLearningState(), status: 'invalid', damagedRaw: raw, preserved: keepDamagedCopy(storage, raw) }
}

function keepDamagedCopy(storage: LearningStorage, raw: string): boolean {
  try {
    storage.setItem(LEARNING_DAMAGED_KEY, raw)
    return true
  } catch {
    return false
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
    ...state,
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
        ...(previous?.shared && previous.code === input.code ? { shared: true as const } : {}),
        backups: previous?.backups ?? [],
      },
    },
  }
}

export function restartLearningLesson(state: LearningState, id: string, starter: string): LearningState {
  const saved = state.lessons[id]
  if (!LESSONS.some((lesson) => lesson.id === id) || !saved || saved.code === starter || (saved.backups?.length ?? 0) >= MAX_BACKUPS) return state
  const next = updateLearningState(state, { lessonId: id, code: starter, predictDone: false, verified: false })
  const backup = draftOf(saved)
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
  const current = draftOf(saved)
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

/** Opens code from a shared link in a lesson and marks it untrusted until the learner edits it. */
export function openSharedCode(state: LearningState, id: string, code: string): LearningState {
  const next = updateLearningState(state, { lessonId: id, code, predictDone: true })
  const draft = next.lessons[id]
  return draft ? { ...next, lessons: { ...next.lessons, [id]: { ...draft, shared: true } } } : next
}
