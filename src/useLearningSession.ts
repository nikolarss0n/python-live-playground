import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_SECTION,
  getLesson,
  firstLessonId,
  isSection,
  type Section,
} from './examples'
import {
  isLessonVerified,
  loadLearningState,
  saveLearningState,
  updateLearningState,
  restartLearningLesson,
  restoreLearningLesson,
  starterUpdated,
  acknowledgeStarter,
  type LearningState,
  type LearningSaveStatus,
} from './learningStorage'
import { readSnapshotFromLocation } from './shareSnapshot'
import { downloadText } from './downloadText'
import { isServiceExerciseId } from './serviceExercise'
import { previousServiceExercise, serviceStarterCode } from './curriculum/serviceLessons'

export function readPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writePreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Learning persistence reports unavailable storage in the footer.
  }
}

function lessonLocked(id: string, state: LearningState): boolean {
  if (!isServiceExerciseId(id) || state.lessons[id]) return false
  const previous = previousServiceExercise(id)
  return previous !== null && !isLessonVerified(state.lessons[previous])
}

function selectLesson(state: LearningState, requestedId: string): LearningState {
  let lesson = getLesson(requestedId)
  while (isServiceExerciseId(lesson.id) && lessonLocked(lesson.id, state)) {
    const previous = previousServiceExercise(lesson.id)
    if (previous === null) break
    lesson = getLesson(previous)
  }
  const saved = state.lessons[lesson.id]
  const previous = isServiceExerciseId(lesson.id) ? previousServiceExercise(lesson.id) : null
  const previousDraft = previous === null ? undefined : state.lessons[previous]
  const code = saved?.code ?? (isServiceExerciseId(lesson.id)
    ? serviceStarterCode(lesson.id, isLessonVerified(previousDraft) ? previousDraft?.code : undefined)
    : lesson.code)
  return updateLearningState(state, {
    lessonId: lesson.id,
    code,
    predictDone: saved?.predictDone ?? false,
  })
}

function initialSession(state: LearningState): LearningState {
  const shared = readSnapshotFromLocation()
  if (shared && getLesson(shared.lessonId).id === shared.lessonId) {
    return updateLearningState(state, {
      lessonId: shared.lessonId,
      code: shared.code,
      predictDone: true,
    })
  }
  const queryId = new URLSearchParams(window.location.search).get('lesson')
  if (queryId && getLesson(queryId).id === queryId) return selectLesson(state, queryId)
  if (state.activeLessonId) return selectLesson(state, state.activeLessonId)
  const preference = readPreference('plp-section')
  const track = preference && isSection(preference) ? preference : DEFAULT_SECTION
  return selectLesson(state, firstLessonId(track))
}

/** Earlier saved data could not be read: kept as a backup copy, or still in place with saving paused. */
export type DamagedNotice = 'kept' | 'blocked'

export function useLearningSession() {
  const [initial] = useState(() => {
    const load = loadLearningState()
    return { load, state: initialSession(load.state) }
  })
  const [state, setState] = useState(initial.state)
  const damage = initial.load.status === 'invalid' ? initial.load : null
  // Unreadable data with no backup copy must not be overwritten until the learner has downloaded it.
  const [savesBlocked, setSavesBlocked] = useState(damage !== null && !damage.preserved)
  const [saveStatus, setSaveStatus] = useState<LearningSaveStatus | 'saving' | 'blocked'>('saving')
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null)
  const persist = useCallback(
    (next: LearningState) => (savesBlocked ? 'blocked' as const : saveLearningState(next)),
    [savesBlocked],
  )
  const lesson = getLesson(state.activeLessonId ?? firstLessonId(DEFAULT_SECTION))
  const draft = state.lessons[lesson.id]
  const code = draft?.code ?? lesson.code
  const predictDone = draft?.predictDone ?? false

  useEffect(() => {
    setSaveStatus(persist(state))
    const url = new URL(window.location.href)
    url.searchParams.set('lesson', lesson.id)
    if (url.hash.startsWith('#plp=')) url.hash = ''
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [state, lesson.id, persist])

  const downloadDamaged = useCallback(() => {
    if (!damage) return
    downloadText(damage.damagedRaw, 'python-live-saved-progress.json')
    setSavesBlocked(false)
  }, [damage])

  const setCode = useCallback((next: string | ((current: string) => string)) => {
    setState((current) => {
      if (!current.activeLessonId) return current
      const saved = current.lessons[current.activeLessonId]
      if (!saved) return current
      const updated = typeof next === 'function' ? next(saved.code) : next
      if (updated === saved.code) return current
      return updateLearningState(current, {
        lessonId: current.activeLessonId,
        code: updated,
        predictDone: saved.predictDone,
      })
    })
  }, [])

  const setPredictDone = useCallback((done: boolean) => {
    setState((current) => {
      if (!current.activeLessonId) return current
      const saved = current.lessons[current.activeLessonId]
      if (!saved || saved.predictDone === done) return current
      return updateLearningState(current, {
        lessonId: current.activeLessonId,
        code: saved.code,
        predictDone: done,
      })
    })
  }, [])

  const recordVerification = useCallback((id: string, executedCode: string, passed: boolean) => {
    setState((current) => {
      const saved = current.lessons[id]
      if (current.activeLessonId !== id || !saved || saved.code !== executedCode) return current
      if (isLessonVerified(saved) === passed) return current
      return updateLearningState(current, {
        lessonId: id,
        code: saved.code,
        predictDone: saved.predictDone,
        verified: passed,
      })
    })
  }, [])

  const select = useCallback((id: string) => {
    setRecoveryMessage(null)
    setState((current) => selectLesson(current, id))
  }, [])
  const selectTrack = useCallback((track: Section) => {
    setRecoveryMessage(null)
    setState((current) => selectLesson(current, current.lastLessonByTrack[track] ?? firstLessonId(track)))
  }, [])
  const completedIds = useMemo(() => new Set(
    Object.entries(state.lessons).filter(([, saved]) => isLessonVerified(saved)).map(([id]) => id),
  ), [state])
  const isLocked = useCallback((id: string) => lessonLocked(id, state), [state])

  const restart = useCallback(() => {
    const previous = isServiceExerciseId(lesson.id) ? previousServiceExercise(lesson.id) : null
    const previousDraft = previous ? state.lessons[previous] : undefined
    const starter = isServiceExerciseId(lesson.id)
      ? serviceStarterCode(lesson.id, isLessonVerified(previousDraft) ? previousDraft?.code : undefined)
      : lesson.code
    const next = restartLearningLesson(state, lesson.id, starter)
    if (next === state) {
      setRecoveryMessage(code === starter ? 'This is already the starter.' : 'Backup history is full. Your code is unchanged.')
      return false
    }
    const saved = persist(next)
    setSaveStatus(saved)
    if (saved !== 'saved') {
      setRecoveryMessage('Restart cancelled because your backup could not be saved. Your code is unchanged.')
      return false
    }
    setState(next)
    setRecoveryMessage('Starter restored. Your previous draft is saved and can be restored, including after reload.')
    return true
  }, [state, lesson, code, persist])

  const restore = useCallback(() => {
    const next = restoreLearningLesson(state, lesson.id)
    if (next === state) return false
    const saved = persist(next)
    setSaveStatus(saved)
    if (saved !== 'saved') {
      setRecoveryMessage('Your previous draft could not be saved as the current draft. Nothing was changed.')
      return false
    }
    setState(next)
    setRecoveryMessage('Previous draft restored.')
    return true
  }, [state, lesson.id, persist])

  const keepDraft = useCallback(() => {
    setState((current) => acknowledgeStarter(current, lesson.id))
  }, [lesson.id])

  return {
    lessonId: lesson.id,
    difficulty: lesson.difficulty,
    section: lesson.section,
    code,
    predictDone,
    setCode,
    setPredictDone,
    select,
    selectTrack,
    recordVerification,
    completedIds,
    isLocked,
    saveStatus,
    restart,
    restore,
    canRestore: (draft?.backups?.length ?? 0) > 0,
    recoveryMessage,
    /** The lesson's starter changed after this draft was begun. */
    starterUpdated: starterUpdated(state, lesson.id),
    keepDraft,
    /** Earlier saved progress could not be read: kept as a backup copy, or still in place with saving paused. */
    damagedNotice: (damage ? (savesBlocked ? 'blocked' : 'kept') : null) as DamagedNotice | null,
    downloadDamaged,
  }
}
