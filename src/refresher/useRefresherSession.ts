import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MAX_BACKUPS, MAX_DRAFT_LENGTH, MAX_MISTAKES, MAX_NOTE_LENGTH, MAX_WORKSPACES, MOCK_DURATION_MS,
  browserSessionStorage, completedDays, completedStages, contextFor, currentAttempt,
  defaultStarter, ensureDay, expireMockAttempts, loadRefresherState, newWorkspace,
  saveRefresherState, verificationKey,
  type DaySession, type Draft, type Mistake, type RefresherState, type Rubric,
  type SaveStatus, type SessionStorage, type StarterFor,
} from './sessionStore'
import {
  isPracticeDayId, type PracticeDayId, type RefresherDay, type RefresherDayId, type StudyStage,
} from './types'

type SessionOptions = {
  storage?: SessionStorage | null
  now?: () => number
  random?: () => number
  starterFor?: StarterFor
}
type VerificationInput = {
  dayId: RefresherDayId; stage: StudyStage; code: string; contextKey: string; passed: boolean
}
type MistakeInput = Pick<Mistake, 'dayId' | 'error' | 'cause' | 'correctPattern'>

function replaceDay(state: RefresherState, id: RefresherDayId, session: DaySession): RefresherState {
  return { ...state, days: { ...state.days, [id]: session } }
}
function replaceDraft(session: DaySession, target: StudyStage, draft: Draft): DaySession {
  return { ...session, workspaces: { ...session.workspaces,
    [session.workspaceKey]: { ...session.workspaces[session.workspaceKey], [target]: draft } } }
}
function activeMock(session: DaySession, now: number): boolean {
  const attempt = currentAttempt(session)
  return attempt !== undefined && attempt.finishedAt === null && now < attempt.startedAt + MOCK_DURATION_MS
}
function mockCodeLocked(day: RefresherDay, session: DaySession, now: number): boolean {
  return day.kind === 'mock' && !activeMock(session, now)
}

export function useRefresherSession(day: RefresherDay | null, options: SessionOptions = {}) {
  const now = options.now ?? Date.now
  const random = options.random ?? Math.random
  const starter = options.starterFor ?? defaultStarter
  const storage = options.storage === undefined ? browserSessionStorage() : options.storage
  const [initial] = useState(() => loadRefresherState(storage))
  const [state, setState] = useState(() => expireMockAttempts(initial.state, now()))
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(initial.status === 'unavailable' ? 'unavailable' : 'saved')
  const [clock, setClock] = useState(now)
  const stateRef = useRef(state)
  const dayRef = useRef(day)
  dayRef.current = day

  const commit = useCallback((next: RefresherState, requireSaved = false): boolean => {
    const result = saveRefresherState(next, storage)
    setSaveStatus(result)
    if (requireSaved && result !== 'saved') return false
    stateRef.current = next
    setState(next)
    return true
  }, [storage])

  useEffect(() => {
    const current = expireMockAttempts(stateRef.current, now())
    const next = day ? ensureDay(current, day, starter) : current
    if (next !== stateRef.current || next !== initial.state) commit(next)
  }, [day, starter, commit, now, initial.state])

  const hasRunningMock = Object.values(state.days).some((session) =>
    session?.attempts.some((attempt) => attempt.finishedAt === null))
  useEffect(() => {
    if (!hasRunningMock) return
    const tick = () => {
      const time = now()
      setClock(time)
      const next = expireMockAttempts(stateRef.current, time)
      if (next !== stateRef.current) commit(next)
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [hasRunningMock, now, commit])

  const session = day ? (state.days[day.id] ?? ensureDay(state, day, starter).days[day.id]) : undefined
  const currentStage = session?.stage ?? 'recall'
  const workspace = session?.workspaces[session.workspaceKey]
  const code = workspace?.[currentStage].code ?? ''
  const context = day && session ? contextFor(day.id, session, clock) : {}
  const contextKey = day && session ? verificationKey(day.id, session, currentStage, clock) : ''
  const attempt = session ? currentAttempt(session) : undefined
  const elapsedMs = attempt ? Math.max(0, Math.min(MOCK_DURATION_MS, (attempt.finishedAt ?? clock) - attempt.startedAt)) : 0
  const mock = attempt ? {
    active: attempt.finishedAt === null && elapsedMs < MOCK_DURATION_MS,
    elapsedMs, remainingMs: MOCK_DURATION_MS - elapsedMs,
    followUp: context.followUp === true,
    phase: attempt.finishedAt !== null ? 'finished' : elapsedMs < 5 * 60_000 ? 'clarify'
      : elapsedMs < 10 * 60_000 ? 'plan' : elapsedMs < 40 * 60_000 ? 'implement'
        : elapsedMs < 55 * 60_000 ? 'test' : 'explain',
    variantId: attempt.variantId, retake: attempt.retake,
    startedAt: attempt.startedAt, finishedAt: attempt.finishedAt, submittedCode: attempt.submittedCode,
  } : null
  const completed = day && session ? completedStages(day.id, session, clock) : {
    recall: false, explain: false, guided: false, independent: false, review: false,
  }
  const notes = {
    recall: workspace?.recall.note ?? '', explain: workspace?.explain.note ?? '',
    guided: workspace?.guided.note ?? '', independent: workspace?.independent.note ?? '',
    review: workspace?.review.note ?? '',
  }

  const current = useCallback(() => {
    const metadata = dayRef.current
    if (!metadata) return null
    const state = expireMockAttempts(ensureDay(stateRef.current, metadata, starter), now())
    const session = state.days[metadata.id]
    if (!session) return null
    return { metadata, state, session }
  }, [now, starter])

  const changeStage = useCallback((target: StudyStage): boolean => {
    const value = current()
    if (!value) return false
    const { metadata, state, session } = value
    if (metadata.kind === 'mock') {
      const attempt = currentAttempt(session)
      if (!attempt && target !== 'recall') return false
      if (attempt?.finishedAt === null && target !== 'independent') return false
      if (attempt?.finishedAt !== null && attempt && target !== 'independent' && target !== 'review') return false
    }
    return commit(replaceDay(state, metadata.id, { ...session, stage: target }))
  }, [current, commit])

  const updateCode = useCallback((next: string | ((previous: string) => string)): boolean => {
    const value = current()
    if (!value) return false
    const { metadata, state, session } = value
    if (mockCodeLocked(metadata, session, now())) return false
    const draft = session.workspaces[session.workspaceKey][session.stage]
    const code = typeof next === 'function' ? next(draft.code) : next
    if (code.length > MAX_DRAFT_LENGTH) { setSaveStatus('too-large'); return false }
    if (code === draft.code) return true
    return commit(replaceDay(state, metadata.id, replaceDraft(session, session.stage,
      { ...draft, code, verification: null })))
  }, [current, commit, now])

  const setNote = useCallback((note: string, target?: StudyStage): boolean => {
    const value = current()
    if (!value) return false
    if (note.length > MAX_NOTE_LENGTH) { setSaveStatus('too-large'); return false }
    const { metadata, state, session } = value
    const targetStage = target ?? session.stage
    const draft = session.workspaces[session.workspaceKey][targetStage]
    return commit(replaceDay(state, metadata.id, replaceDraft(session, targetStage,
      { ...draft, note, selfComplete: note === draft.note && draft.selfComplete })))
  }, [current, commit])

  const completeStage = useCallback((target?: StudyStage, complete = true): boolean => {
    const value = current()
    if (!value) return false
    const { metadata, state, session } = value
    const targetStage = target ?? session.stage
    if ((targetStage === 'guided' && metadata.kind !== 'consolidation') || targetStage === 'independent') return false
    const draft = session.workspaces[session.workspaceKey][targetStage]
    if (complete && targetStage !== 'explain' && !draft.note.trim()) return false
    return commit(replaceDay(state, metadata.id, replaceDraft(session, targetStage,
      { ...draft, selfComplete: complete })))
  }, [current, commit])

  const verify = useCallback((input: VerificationInput): boolean => {
    const value = current()
    if (!value) return false
    const { metadata, state, session } = value
    if (metadata.id !== input.dayId || (session.stage !== input.stage && !(session.stage === 'review' && input.stage === 'independent')) ||
      (input.stage !== 'guided' && input.stage !== 'independent') ||
      verificationKey(metadata.id, session, input.stage, now()) !== input.contextKey) return false
    const draft = session.workspaces[session.workspaceKey][input.stage]
    if (draft.code !== input.code) return false
    if (input.passed && draft.verification?.contextKey === input.contextKey && draft.verification.code === input.code) return true
    if (!input.passed && !draft.verification) return true
    return commit(replaceDay(state, metadata.id, replaceDraft(session, input.stage,
      { ...draft, verification: input.passed ? { code: input.code, contextKey: input.contextKey } : null })))
  }, [current, commit, now])

  const restart = useCallback((): boolean => {
    const value = current()
    if (!value || value.metadata.kind === 'mock') return false
    const { metadata, state, session } = value
    const draft = session.workspaces[session.workspaceKey][session.stage]
    const code = starter(metadata, session.stage, contextFor(metadata.id, session, now()))
    if (draft.code === code && !draft.note && !draft.verification && !draft.selfComplete) return true
    if (state.backups.length >= MAX_BACKUPS) { setSaveStatus('history-full'); return false }
    const backup = { id: crypto.randomUUID(), dayId: metadata.id, workspaceKey: session.workspaceKey,
      stage: session.stage, draft, createdAt: now() }
    const reset = replaceDay(state, metadata.id, replaceDraft(session, session.stage,
      { code, note: '', selfComplete: false, verification: null }))
    // Commit the recoverable backup to disk before the editor can show the reset.
    return commit({ ...reset, backups: [...state.backups, backup] }, true)
  }, [current, commit, starter, now])

  const restore = useCallback((): boolean => {
    const value = current()
    if (!value || value.metadata.kind === 'mock') return false
    const { metadata, state, session } = value
    const index = state.backups.findLastIndex((backup) => backup.dayId === metadata.id &&
      backup.workspaceKey === session.workspaceKey && backup.stage === session.stage)
    const backup = state.backups[index]
    if (!backup) return false
    const draft = session.workspaces[session.workspaceKey][session.stage]
    const starterCode = starter(metadata, session.stage, contextFor(metadata.id, session, now()))
    const backups = state.backups.filter((_, position) => position !== index)
    if (draft.code !== starterCode || draft.note || draft.verification || draft.selfComplete) {
      backups.push({ ...backup, id: crypto.randomUUID(), draft, createdAt: now() })
    }
    return commit({ ...replaceDay(state, metadata.id, replaceDraft(session, session.stage, backup.draft)), backups }, true)
  }, [current, commit, starter, now])

  const addMistake = useCallback((input: MistakeInput): boolean => {
    if (!input.error.trim() || [input.error, input.cause, input.correctPattern].some((field) => field.length > 2000)) return false
    const state = stateRef.current
    if (state.mistakes.length >= MAX_MISTAKES) { setSaveStatus('history-full'); return false }
    return commit({ ...state, mistakes: [...state.mistakes,
      { ...input, id: crypto.randomUUID(), createdAt: now(), resolved: false }] })
  }, [commit, now])

  const editMistake = useCallback((id: string, update: Partial<Pick<Mistake, 'error' | 'cause' | 'correctPattern'>>): boolean => {
    const state = stateRef.current
    if (!state.mistakes.some((entry) => entry.id === id) || Object.values(update).some((text) => text.length > 2000)) return false
    const mistakes = state.mistakes.map((entry) => entry.id === id ? { ...entry, ...update } : entry)
    if (mistakes.some((entry) => !entry.error.trim())) return false
    return commit({ ...state, mistakes })
  }, [commit])

  const resolveMistake = useCallback((id: string, resolved = true): boolean => {
    const state = stateRef.current
    if (!state.mistakes.some((entry) => entry.id === id)) return false
    return commit({ ...state, mistakes: state.mistakes.map((entry) => entry.id === id ? { ...entry, resolved } : entry) })
  }, [commit])

  const startMock = useCallback((): boolean => {
    const value = current()
    if (!value || value.metadata.kind !== 'mock') return false
    const { metadata, state, session } = value
    if (activeMock(session, now())) return false
    if (Object.values(state.days).some((saved) => saved && activeMock(saved, now()))) return false
    if (Object.keys(session.workspaces).length >= MAX_WORKSPACES) { setSaveStatus('history-full'); return false }
    const unseen = metadata.variants.filter((entry) => !session.usedVariants.includes(entry.id))
    const candidates = unseen.length ? unseen : metadata.variants
    const index = Math.max(0, Math.min(candidates.length - 1, Math.floor(random() * candidates.length)))
    const variant = candidates[index]
    if (!variant) return false
    const id = crypto.randomUUID()
    const workspaceKey = `mock:${id}`
    const startedAt = now()
    const workspace = newWorkspace(metadata, { variant: variant.id, followUp: false },
      (day, stage, context) => stage === 'independent' ? variant.starter : starter(day, stage, context))
    const next = { ...session, stage: 'independent' as const, workspaceKey,
      workspaces: { ...session.workspaces, [workspaceKey]: workspace },
      attempts: [...session.attempts.map((attempt) => attempt.workspaceKey === session.workspaceKey
        ? { ...attempt, rubric: session.rubric } : attempt), { id, workspaceKey, variantId: variant.id, startedAt,
        finishedAt: null, submittedCode: null, retake: unseen.length === 0 }],
      usedVariants: [...new Set([...session.usedVariants, variant.id])],
      rubric: { readability: false, edgeCases: false, debugging: false, communication: false, notes: '' },
    }
    const saved = commit(replaceDay(state, metadata.id, next), true)
    if (saved) setClock(startedAt)
    return saved
  }, [current, commit, now, random, starter])

  const finishMock = useCallback((): boolean => {
    const value = current()
    if (!value || value.metadata.kind !== 'mock') return false
    const { metadata, state, session } = value
    const attempt = currentAttempt(session)
    if (!attempt) return false
    if (attempt.finishedAt !== null) return commit(state)
    const finishedAt = Math.min(now(), attempt.startedAt + MOCK_DURATION_MS)
    const submittedCode = session.workspaces[session.workspaceKey].independent.code
    setClock(finishedAt)
    return commit(replaceDay(state, metadata.id, { ...session,
      attempts: session.attempts.map((entry) => entry.id === attempt.id ? { ...entry, finishedAt, submittedCode } : entry) }))
  }, [current, commit, now])

  const setRubric = useCallback((update: Partial<Rubric>): boolean => {
    const value = current()
    if (!value) return false
    if (update.notes && update.notes.length > MAX_NOTE_LENGTH) { setSaveStatus('too-large'); return false }
    const rubric = { ...value.session.rubric, ...update }
    return commit(replaceDay(value.state, value.metadata.id,
      { ...value.session, rubric, attempts: value.session.attempts.map((attempt) =>
        attempt.workspaceKey === value.session.workspaceKey ? { ...attempt, rubric } : attempt) }))
  }, [current, commit])

  const selectDays = useCallback((pair: readonly [PracticeDayId, PracticeDayId]): boolean => {
    const value = current()
    if (!value || value.metadata.kind !== 'consolidation' || pair[0] === pair[1] ||
      !pair.every(isPracticeDayId)) return false
    const { metadata, state, session } = value
    const workspaceKey = `revisit:${pair.join(':')}`
    if (!session.workspaces[workspaceKey] && Object.keys(session.workspaces).length >= MAX_WORKSPACES) {
      setSaveStatus('history-full'); return false
    }
    const selectedDays: [PracticeDayId, PracticeDayId] = [pair[0], pair[1]]
    return commit(replaceDay(state, metadata.id, { ...session, workspaceKey, selectedDays,
      workspaces: { ...session.workspaces,
        [workspaceKey]: session.workspaces[workspaceKey] ?? newWorkspace(metadata, { revisit: selectedDays }, starter) } }))
  }, [current, commit, starter])

  const completedDayIds = useMemo(() => completedDays(state, clock), [state, clock])
  return {
    stage: currentStage, code, note: notes[currentStage], notes, context, contextKey,
    independentContextKey: day && session ? verificationKey(day.id, session, 'independent', clock) : '',
    guidedCode: workspace?.guided.code ?? '', independentCode: workspace?.independent.code ?? '',
    completedStages: completed, completedDayIds, saveStatus, loadStatus: initial.status,
    mistakes: state.mistakes, rubric: session?.rubric ?? null,
    selectedDays: session?.selectedDays ?? ['refresher-03', 'refresher-04'] as [PracticeDayId, PracticeDayId],
    mock, isReadOnly: !day || !session || mockCodeLocked(day, session, clock),
    hasRunningMock,
    runningMockDayId: Object.entries(state.days).find(([, saved]) => saved && activeMock(saved, clock))?.[0] ?? null,
    canRestore: Boolean(day && session && state.backups.some((backup) => backup.dayId === day.id &&
      backup.workspaceKey === session.workspaceKey && backup.stage === session.stage)),
    changeStage, updateCode, setNote, completeStage, verify, restart, restore,
    addMistake, editMistake, resolveMistake, startMock, finishMock, setRubric, selectDays,
  }
}
