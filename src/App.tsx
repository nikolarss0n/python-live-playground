import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { CodeEditor } from './components/CodeEditor'
import { ResultsPanel } from './components/ResultsPanel'
import { ResultConnectors } from './components/ResultConnectors'
import { Toolbar } from './components/Toolbar'
import { LessonGoal } from './components/LessonGoal'
import {
  getLesson,
  lessonsForSection,
  type Section,
} from './examples'
import { usePythonExecution } from './execution/usePythonExecution'
import { namesOnSourceLine } from './editor/variableColors'
import { linesFromEvents, pulseSourceLines } from './editor/runPulse'
import { evaluateLessonGoal } from './lessonGoalCheck'
import {
  buildLessonProgress,
  isIncompleteAttempt,
} from './lessonProgress'
import { updatedEventIndices } from './resultDiff'
import type { ResultEvent } from './execution/protocol'
import { useLearningSession, readPreference, writePreference } from './useLearningSession'
import { isExerciseId, SERVICE_EXERCISE_IDS, GENAI_EXERCISE_IDS } from './serviceExercise'
import { evaluateServiceProgress } from './serviceProgress'
import { LocalApiStrip } from './components/LocalApiStrip'
import { SettingsModal } from './components/SettingsModal'
import { ModelRunBar } from './components/ModelRunBar'
import { loadSettings, type AppSettings } from './settings'
import {
  askLessonCoach,
  buildLessonContextPack,
  nextCoachId,
  type CoachTurn,
  type CoachUiMessage,
} from './lessonCoach'
import {
  enrichResultEvents,
  evaluateEssentialsTasks,
  taskEvidenceLine,
} from './taskEvidence'
import { getRefresherDay, refresherStarterFor } from './refresher/catalog'
import { useRefresherSession } from './refresher/useRefresherSession'
import { RefresherPanel } from './refresher/RefresherPanel'
import { JevPill } from './jev/JevPill'
import { StarterUpdatedPill } from './components/StarterUpdatedPill'
import { SharedCodePill, SharedLinkSkippedPill } from './components/SharedCodePill'
import { ConceptPills } from './refresher/ConceptPills'
import { useJevPinpoint } from './jev/useJevPinpoint'
import { useJevGoalCheck } from './jev/useJevGoalCheck'
import { useSettledValue } from './useSettledValue'
import { showProblemMark } from './editor/problemMark'
import { BLANK } from './goalCheck'
import { blankHints, hintLevels } from './blankHints'
import { closeHintBubble, currentHintBubble, showHintBubble } from './editor/blankHint'
import { HintPill } from './components/HintPill'
import { InputsField } from './components/InputsField'
import { usesInput } from './usesInput'
import { SolutionPill } from './components/SolutionPill'
import { DamagedProgressNotice } from './components/DamagedProgressNotice'
import { FullstackPanel, FullstackTabs, type FullstackTab } from './components/FullstackPanel'
import { BLANK_ANSWERS } from './curriculum/blankAnswers'
import type { ErrorAdvice } from './errorAdvice'
import { refresherEvidence } from './refresher/evidence'
import './App.css'

type ThemeMode = 'light' | 'dark'

const COACH_KEY = 'plp-seen-success'
const LESSON_DETAILS_KEY = 'plp-lesson-details-open'
const HELP_HINT =
  'Shortcuts: ⌘/Ctrl+Enter Run · Esc Stop · ? help'

function preferredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  const stored = readPreference('plp-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function preferredLessonDetailsOpen(): boolean {
  if (typeof window === 'undefined') return false
  return readPreference(LESSON_DETAILS_KEY) === '1'
}

function useWideLayout(minWidth = 801): boolean {
  const [wide, setWide] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= minWidth : true,
  )
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`)
    const update = () => setWide(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [minWidth])
  return wide
}

const PROJECT_DATASETS_KEY = 'plp-project-datasets'

function readProjectDatasets(): string[] | null {
  try {
    const parsed: unknown = JSON.parse(readPreference(PROJECT_DATASETS_KEY) ?? 'null')
    return Array.isArray(parsed) && parsed.every((name) => typeof name === 'string') ? parsed : null
  } catch {
    return null
  }
}

export default function App() {
  const learning = useLearningSession()
  const { difficulty, section, lessonId, select, selectTrack, isLocked, recordVerification } = learning
  const refresherDay = useMemo(() => getRefresherDay(lessonId), [lessonId])
  const study = useRefresherSession(refresherDay, { starterFor: refresherStarterFor })
  const code = refresherDay ? study.stage === 'review' ? study.independentCode : study.code : learning.code
  const updateStudyCode = study.updateCode
  const updateLessonCode = learning.setCode
  const verifyStudy = study.verify
  const setCode = useCallback((next: string | ((current: string) => string)) => {
    if (refresherDay) updateStudyCode(next)
    else updateLessonCode(next)
  }, [refresherDay, updateStudyCode, updateLessonCode])
  const saveStatus = refresherDay ? study.saveStatus : learning.saveStatus
  const completedIds = useMemo(() => new Set([...learning.completedIds, ...study.completedDayIds]), [learning.completedIds, study.completedDayIds])
  const aiBlocked = Boolean(refresherDay) || study.hasRunningMock
  const errorAiAllowed = !study.hasRunningMock && refresherDay?.kind !== 'mock' && !(refresherDay && study.stage === 'independent')
  const aiBlockedRef = useRef(aiBlocked)
  aiBlockedRef.current = aiBlocked
  const coachGeneration = useRef(0)
  useEffect(() => () => { coachGeneration.current += 1 }, [])
  const [theme, setTheme] = useState<ThemeMode>(preferredTheme)
  const [editorView, setEditorView] = useState<EditorView | null>(null)
  const [geometryKey, setGeometryKey] = useState(0)
  const [activeResult, setActiveResult] = useState<number | null>(null)
  const [stuckRevealed, setStuckRevealed] = useState(false)
  const [incompleteRuns, setIncompleteRuns] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [lessonDetailsOpen, setLessonDetailsOpen] = useState(
    preferredLessonDetailsOpen,
  )
  const [showHelp, setShowHelp] = useState(false)
  const [showPrevious, setShowPrevious] = useState(false)
  const [previousEvents, setPreviousEvents] = useState<ResultEvent[] | null>(
    null,
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [appSettings, setAppSettings] = useState<AppSettings>(() =>
    loadSettings(),
  )
  const [seenSuccess, setSeenSuccess] = useState(() => {
    if (typeof window === 'undefined') return false
    return readPreference(COACH_KEY) === '1'
  })
  const [coachUi, setCoachUi] = useState<CoachUiMessage[]>([])
  const [coachHistory, setCoachHistory] = useState<CoachTurn[]>([])
  const [coachBusy, setCoachBusy] = useState(false)
  const workspaceRef = useRef<HTMLElement>(null)
  const lastRunId = useRef<string | null>(null)
  const prevEventsRef = useRef<ResultEvent[]>([])
  const isWide = useWideLayout()
  const coachConfigured =
    appSettings.apiKey.trim().length > 0 &&
    appSettings.llmBaseUrl.trim().length > 0

  const verificationStage = study.stage === 'review' ? 'independent' : study.stage
  const checkContextKey = study.stage === 'review' ? study.independentContextKey : study.contextKey
  const checkingRefresher = Boolean(refresherDay && (study.stage === 'guided' || study.stage === 'independent' || study.stage === 'review') &&
    !(refresherDay.kind === 'consolidation' && study.stage === 'guided') &&
    (refresherDay.kind !== 'mock' || (study.mock && !study.mock.active)))
  const exerciseId = refresherDay ? checkingRefresher ? refresherDay.id : undefined : isExerciseId(lessonId) ? lessonId : undefined
  const activeLesson = useMemo(() => getLesson(lessonId), [lessonId])
  const lessonFullstack = refresherDay ? undefined : activeLesson.fullstack
  const freePlay = activeLesson.difficulty === 'playground'
  const [fsTab, setFsTab] = useState<FullstackTab>('results')
  const [seed, setSeed] = useState(1)
  const [callEdits, setCallEdits] = useState<{ lessonId: string; calls: string[] } | null>(null)
  const fullstackCalls = useMemo(
    () => (callEdits?.lessonId === lessonId ? callEdits.calls : lessonFullstack?.calls ?? []),
    [callEdits, lessonId, lessonFullstack],
  )
  const activeFsTab: FullstackTab = lessonFullstack ? fsTab : 'results'
  const [projectDatasets, setProjectDatasets] = useState<string[] | null>(readProjectDatasets)
  const chosenDatasets = lessonFullstack?.datasets ? projectDatasets ?? lessonFullstack.datasets : undefined
  const chooseDatasets = useCallback((next: string[]) => {
    setProjectDatasets(next)
    writePreference(PROJECT_DATASETS_KEY, JSON.stringify(next))
  }, [])
  const [inputsText, setInputsText] = useState('')
  const showInputs = usesInput(code)
  const stdinOption = showInputs ? { stdin: inputsText } : {}
  const { snapshot: runSnapshot, runNow: runCode, stop } = usePythonExecution(code, {
    exerciseId,
    untrustedCode: learning.untrustedCode,
    // Code from a shared link waits for Run: opening a link must not execute someone else's code.
    autoRun: learning.untrustedCode === null,
    checkOptions: refresherDay
      ? { context: study.context, contextKey: checkContextKey, ...stdinOption }
      : lessonFullstack ? { fullstack: { seed, calls: fullstackCalls, ...(chosenDatasets ? { datasets: chosenDatasets } : {}) }, ...stdinOption }
      : showInputs ? stdinOption : undefined,
  })
  const [touchedLessonId, setTouchedLessonId] = useState<string | null>(null)
  const [runBeforeReset, setRunBeforeReset] = useState<string | null>(null)
  const [solutionFor, setSolutionFor] = useState<string | null>(null)
  const { untrustedCode, trustSharedDraft } = learning
  const runNow = useCallback(() => {
    setTouchedLessonId(lessonId)
    // runCode picks the untrusted worker path synchronously, before the shared mark is cleared.
    const run = runCode()
    if (untrustedCode !== null) trustSharedDraft()
    return run
  }, [lessonId, runCode, untrustedCode, trustSharedDraft])
  const sharedNotRun = learning.untrustedCode !== null && runSnapshot.status !== 'running' && runSnapshot.executedCode !== code
  const onEditorChange = useCallback((next: string) => {
    setTouchedLessonId(lessonId)
    setCode(next)
  }, [lessonId, setCode])
  const restartLesson = useCallback(() => {
    const restarted = learning.restart()
    if (restarted) {
      setAttempt((count) => count + 1)
      setTouchedLessonId(null)
      setRunBeforeReset(runSnapshot.runId)
      setStuckRevealed(false)
      setIncompleteRuns(0)
    }
    return restarted
  }, [learning, runSnapshot.runId])
  // An opened or reset starter still holding ??? always fails to parse; wait for the first edit or Run before showing that or an older run.
  const quietStart = !refresherDay && touchedLessonId !== lessonId && code.includes(BLANK)
    && (runSnapshot.status === 'error' || (runSnapshot.runId !== null && runSnapshot.runId === runBeforeReset))
  const snapshot = useMemo(
    () => (quietStart ? { ...runSnapshot, status: 'ready' as const, events: [], durationMs: null, executedCode: null, checks: undefined } : runSnapshot),
    [quietStart, runSnapshot],
  )
  const blankCount = refresherDay ? 0 : code.split(BLANK).length - 1
  const studyEvidence = refresherDay ? refresherEvidence({
    dayId: refresherDay.id, context: study.context, contextKey: checkContextKey, code, snapshot, checking: checkingRefresher,
  }) : null

  const trackLessons = useMemo(
    () => lessonsForSection(section),
    [section],
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    writePreference('plp-theme', theme)
  }, [theme])

  useEffect(() => {
    writePreference('plp-section', section)
  }, [section])

  useEffect(() => {
    writePreference(
      LESSON_DETAILS_KEY,
      lessonDetailsOpen ? '1' : '0',
    )
  }, [lessonDetailsOpen])

  useEffect(() => {
    if (
      snapshot.status === 'running' ||
      snapshot.status === 'idle' ||
      snapshot.status === 'booting'
    ) {
      setActiveResult(null)
    }
  }, [snapshot.status, snapshot.runId])

  const onSelectLesson = useCallback((id: string) => {
    coachGeneration.current += 1
    select(id)
    setActiveResult(null)
    setStuckRevealed(false)
    setIncompleteRuns(0)
    setPreviousEvents(null)
    setShowPrevious(false)
    prevEventsRef.current = []
    setCoachUi([])
    setCoachHistory([])
    setCoachBusy(false)
  }, [select])

  const onSelectSection = useCallback((next: Section) => {
    coachGeneration.current += 1
    selectTrack(next)
    setActiveResult(null)
    setStuckRevealed(false)
    setIncompleteRuns(0)
    setPreviousEvents(null)
    setShowPrevious(false)
    prevEventsRef.current = []
    setCoachUi([])
    setCoachHistory([])
    setCoachBusy(false)
  }, [selectTrack])

  const serviceProgress = useMemo(() => exerciseId
    ? evaluateServiceProgress(activeLesson, code, snapshot, stuckRevealed)
    : null, [exerciseId, activeLesson, code, snapshot, stuckRevealed])

  const studyMet = studyEvidence?.met
  const studyEvidenceText = studyEvidence?.evidence
  const hasStudyEvidence = studyEvidence !== null

  const goalProgress = useMemo(
    () =>
      (hasStudyEvidence ? { met: studyMet === true, missing: studyEvidenceText ? [studyEvidenceText] : [] } : null) ?? serviceProgress?.goal ?? evaluateLessonGoal(
        activeLesson,
        code,
        snapshot.events,
        snapshot.status,
        snapshot.executedCode,
      ),
    [
      activeLesson,
      serviceProgress,
      hasStudyEvidence,
      studyMet,
      studyEvidenceText,
      code,
      snapshot.events,
      snapshot.status,
      snapshot.executedCode,
    ],
  )

  const lessonView = useMemo(
    () =>
      serviceProgress?.view ?? buildLessonProgress(
        activeLesson,
        code,
        goalProgress,
        snapshot.status,
        snapshot.events,
        {
          stuckRevealed,
          incompleteRunCount: incompleteRuns,
          executedCode: snapshot.executedCode,
        },
      ),
    [
      activeLesson,
      serviceProgress,
      code,
      goalProgress,
      snapshot.status,
      snapshot.events,
      snapshot.executedCode,
      stuckRevealed,
      incompleteRuns,
    ],
  )

  const displayEvents = useMemo(
    () => enrichResultEvents(activeLesson, code, snapshot.events),
    [activeLesson, code, snapshot.events],
  )

  const evidenceLine = useMemo(
    () =>
      studyEvidence?.evidence ?? serviceProgress?.evidence ?? taskEvidenceLine(activeLesson, {
        code,
        executedCode: snapshot.executedCode,
        status: snapshot.status,
        events: snapshot.events,
      }),
    [
      activeLesson,
      serviceProgress,
      studyEvidence?.evidence,
      code,
      snapshot.executedCode,
      snapshot.status,
      snapshot.events,
    ],
  )

  const localEvidence = useMemo(
    () => activeLesson.difficulty === 'beginner'
      ? evaluateEssentialsTasks(activeLesson, { code, executedCode: snapshot.executedCode, status: snapshot.status, events: snapshot.events })
      : null,
    [activeLesson, code, snapshot.executedCode, snapshot.status, snapshot.events],
  )
  const localTasksDone = useMemo(() => lessonView.tasks.map((task) => task.status === 'done'), [lessonView.tasks])
  const goalChecks = useJevGoalCheck({
    lesson: activeLesson,
    code,
    freshSuccess: snapshot.status === 'success' && snapshot.executedCode === code,
    events: snapshot.events,
    localTasksDone,
    localGoalMet: goalProgress.met,
    localEvidence,
    enabled: !refresherDay && !freePlay && !serviceProgress && !hasStudyEvidence && !aiBlocked,
    attempt,
  })
  const runSettled = quietStart || (snapshot.status !== 'running' && snapshot.status !== 'booting' && snapshot.executedCode === code)
  const attemptKey = `${lessonId}:${attempt}`
  const settledGoalChecks = useSettledValue(goalChecks, runSettled, attemptKey)
  const settledEvidence = useSettledValue(evidenceLine, runSettled, attemptKey)
  const liveLessonView = useMemo(() => {
    if (goalChecks?.source !== 'Jev') return lessonView
    const tasks = lessonView.tasks.map((task, index) => {
      const row = goalChecks.rows[index]
      return row && row.status !== 'checking' ? { ...task, status: row.status === 'pass' ? 'done' as const : 'todo' as const } : task
    })
    return { ...lessonView, tasks, allTasksDone: tasks.every((task) => task.status === 'done') }
  }, [lessonView, goalChecks])
  const shownLessonView = useSettledValue(liveLessonView, runSettled, attemptKey)

  useEffect(() => {
    if (snapshot.executedCode !== code) return
    if (exerciseId && snapshot.exerciseId !== exerciseId) return
    if (!['success', 'error', 'timeout', 'stopped'].includes(snapshot.status)) return
    if (refresherDay) {
      if (!checkingRefresher || snapshot.contextKey !== checkContextKey) return
      verifyStudy({ dayId: refresherDay.id, stage: verificationStage, code, contextKey: checkContextKey, passed: studyEvidence?.met === true })
    } else recordVerification(lessonId, code, goalProgress.met)
  }, [snapshot.executedCode, snapshot.exerciseId, snapshot.contextKey, snapshot.status, exerciseId, lessonId, code, goalProgress.met, recordVerification, refresherDay, checkingRefresher, checkContextKey, verificationStage, verifyStudy, studyEvidence?.met])

  // Pulse lines + incomplete-run counter + previous-run memory + coaching.
  useEffect(() => {
    if (!snapshot.runId || snapshot.runId === lastRunId.current) return
    if (
      snapshot.status === 'running' ||
      snapshot.status === 'booting' ||
      snapshot.status === 'idle'
    ) {
      return
    }
    lastRunId.current = snapshot.runId

    // Keep prior finished stream for ghost / diff (skip first run).
    const before = prevEventsRef.current
    if (before.length > 0) {
      setPreviousEvents(before)
    }
    prevEventsRef.current = snapshot.events

    // Pulse only the lines whose result is new or changed; an unchanged re-run stays still.
    const changed = before.length > 0
      ? [...updatedEventIndices(snapshot.events, before)].map((index) => snapshot.events[index])
      : snapshot.events
    const lines = linesFromEvents(changed)
    if (lines.length) pulseSourceLines(editorView, lines)

    if (isIncompleteAttempt(snapshot.status, goalProgress)) {
      setIncompleteRuns((n) => n + 1)
    }

    if (snapshot.status === 'success' && !seenSuccess) {
      setSeenSuccess(true)
      writePreference(COACH_KEY, '1')
    }
  }, [
    snapshot.runId,
    snapshot.status,
    snapshot.events,
    editorView,
    goalProgress,
    seenSuccess,
  ])

  const updatedIndices = useMemo(
    () => updatedEventIndices(snapshot.events, previousEvents),
    [snapshot.events, previousEvents],
  )

  // Keyboard: Run / Stop / help
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        void runNow()
        return
      }
      if (e.key === 'Escape') {
        if (editorView && currentHintBubble(editorView)) {
          closeHintBubble(editorView)
          return
        }
        if (solutionFor) {
          setSolutionFor(null)
          return
        }
        if (showHelp) {
          setShowHelp(false)
          return
        }
        stop()
        return
      }
      if (
        e.key === '?' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target as HTMLElement | null)?.closest?.('.cm-editor')
      ) {
        e.preventDefault()
        setShowHelp((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [runNow, stop, showHelp, editorView, solutionFor])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  const onGeometryChange = useCallback(() => {
    setGeometryKey((k) => k + 1)
  }, [])

  const toggleLessonDetails = useCallback(() => {
    setLessonDetailsOpen((open) => !open)
    setGeometryKey((key) => key + 1)
  }, [])

  const onCoachAsk = useCallback(
    async (question: string) => {
      if (coachBusy || aiBlocked) return
      const generation = coachGeneration.current
      const userMsg: CoachUiMessage = {
        id: nextCoachId('u'),
        role: 'user',
        text: question,
      }
      setCoachUi((prev) => [...prev, userMsg])
      setCoachBusy(true)
      try {
        const contextPack = buildLessonContextPack({
          lesson: activeLesson,
          code,
          progress: goalProgress,
          view: lessonView,
          events: snapshot.events,
        })
        const result = await askLessonCoach({
          baseUrl: appSettings.llmBaseUrl,
          apiKey: appSettings.apiKey,
          model: appSettings.llmModel,
          contextPack,
          history: coachHistory,
          question,
        })
        if (generation !== coachGeneration.current || aiBlockedRef.current) return
        if (result.ok) {
          setCoachUi((prev) => [
            ...prev,
            { id: nextCoachId('a'), role: 'assistant', text: result.text },
          ])
          setCoachHistory((prev) => [
            ...prev,
            { role: 'user', text: question },
            { role: 'assistant', text: result.text },
          ])
        } else {
          setCoachUi((prev) => [
            ...prev,
            { id: nextCoachId('n'), role: 'note', text: result.error },
          ])
        }
      } finally {
        if (generation === coachGeneration.current) setCoachBusy(false)
      }
    },
    [
      coachBusy,
      aiBlocked,
      activeLesson,
      code,
      goalProgress,
      lessonView,
      snapshot.events,
      appSettings.llmBaseUrl,
      appSettings.apiKey,
      appSettings.llmModel,
      coachHistory,
    ],
  )

  const pathNames = useMemo(() => {
    if (activeResult == null || !editorView) return [] as string[]
    const event = snapshot.events[activeResult]
    if (!event || event.line == null) return []
    try {
      return namesOnSourceLine(editorView.state, event.line)
    } catch {
      return []
    }
  }, [activeResult, snapshot.events, editorView, code])

  const pathKind =
    activeResult != null
      ? (snapshot.events[activeResult]?.kind ?? null)
      : null

  const freshRun = snapshot.executedCode === code
  const freshError = useMemo(() => {
    if (!freshRun || (snapshot.status !== 'error' && snapshot.status !== 'timeout')) return null
    const event = [...snapshot.events].reverse().find((entry) => entry.kind === 'error')
    return event?.kind === 'error'
      ? { message: event.message, line: event.line, column: event.column, endColumn: event.endColumn, frames: event.frames }
      : null
  }, [freshRun, snapshot.status, snapshot.events])
  const failedCheck = useMemo(() => {
    if (!freshRun || snapshot.status !== 'success') return null
    const failed = (studyEvidence?.fresh ? studyEvidence.checks : snapshot.checks ?? []).find((entry) => !entry.passed)
    return failed ? { label: failed.label, detail: failed.detail } : null
  }, [freshRun, snapshot.status, snapshot.checks, studyEvidence?.fresh, studyEvidence?.checks])
  const jev = useJevPinpoint({
    view: editorView, code, error: freshError, timedOut: freshRun && snapshot.status === 'timeout', failedCheck, enabled: errorAiAllowed,
  })
  const showAiSuggestion = useCallback((advice: ErrorAdvice, line: number | undefined) => {
    if (!editorView || !line || line > editorView.state.doc.lines) return
    const text = editorView.state.doc.line(line).text
    showProblemMark(editorView, {
      source: 'AI', line, from: text.length - text.trimStart().length, to: text.trimEnd().length,
      message: `${advice.explanation} ${advice.hint}`, ...(advice.example ? { snippet: advice.example } : {}),
    })
  }, [editorView])

  const hintLevelsSeen = useRef(new Map<string, number>())
  const showNextHint = useCallback(() => {
    if (!editorView) return
    const hints = blankHints(activeLesson, editorView.state.doc.toString())
    if (!hints.length) return
    const open = currentHintBubble(editorView)
    const head = editorView.state.selection.main.head
    const target = hints.find((hint) => hint.from === open?.from)
      ?? hints.find((hint) => head >= hint.from && head <= hint.to)
      ?? hints[0]
    const key = `${activeLesson.id}:${target.starterIndex}`
    const seen = hintLevelsSeen.current.get(key) ?? 0
    const levels = hintLevels(target)
    const level = Math.min(levels, open?.from === target.from ? seen + 1 : Math.max(1, seen))
    hintLevelsSeen.current.set(key, level)
    const answer = level > target.steps.length ? target.answer : undefined
    const step = target.steps[level - 1]
    showHintBubble(editorView, {
      from: target.from, to: target.to, level, levels, text: step?.text ?? '', onMore: showNextHint,
      nextIsAnswer: Boolean(target.answer) && level === target.steps.length,
      ...(step?.detail ? { detail: step.detail } : {}),
      ...(step?.kicker ? { kicker: step.kicker } : {}),
      ...(answer ? { answer } : {}),
    })
  }, [editorView, activeLesson])

  const solutionAnswers = refresherDay ? undefined : BLANK_ANSWERS[activeLesson.id]
  const solutionOpen = solutionFor === activeLesson.id

  const showConceptPills =Boolean(refresherDay && refresherDay.kind !== 'mock' &&
    (study.stage === 'explain' || study.stage === 'guided'))

  return (
    <div className="app-shell">
      <Toolbar
        section={section}
        onSelectSection={onSelectSection}
        lessons={trackLessons}
        activeLessonId={lessonId}
        activeLesson={activeLesson}
        onSelectLesson={onSelectLesson}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setSettingsOpen(true)}
        completedIds={completedIds}
        isLessonLocked={isLocked}
      />

      <SettingsModal
        open={settingsOpen}
        allowModelTest={errorAiAllowed}
        onClose={() => setSettingsOpen(false)}
        onSaved={(s) => setAppSettings(s)}
      />

      <LocalApiStrip
        enabled={difficulty === 'api'}
        settings={appSettings}
        onInsertSnippet={(snippet) =>
          setCode((prev) => {
            const base = prev.endsWith('\n') ? prev : `${prev}\n`
            return `${base}\n${snippet}`
          })
        }
      />

      <main
        className="workspace"
        ref={workspaceRef}
        data-path-kind={pathKind ?? undefined}
      >
        <div className="pane pane-editor">
          <div className="pane-head">
            <div className="pane-label">Python</div>
            {refresherDay || freePlay ? null : <LessonGoal
              lesson={activeLesson}
              progress={goalProgress}
              view={shownLessonView}
              onRevealStuck={() => setStuckRevealed(true)}
              code={code}
              expanded={lessonDetailsOpen}
              onToggleExpanded={toggleLessonDetails}
              onRestart={restartLesson}
              onRestore={learning.restore}
              canRestore={learning.canRestore}
              recoveryMessage={learning.recoveryMessage}
            >
              {!aiBlocked && lessonDetailsOpen && activeLesson.runWithModel ? (
                <ModelRunBar
                  events={snapshot.events}
                  settings={appSettings}
                  onOpenSettings={() => setSettingsOpen(true)}
                  fallbackPrompt={activeLesson.modelPromptFallback}
                />
              ) : null}
            </LessonGoal>}
            {refresherDay ? <RefresherPanel
              day={refresherDay}
              session={study}
              checks={studyEvidence?.checks ?? []}
              checksFresh={studyEvidence?.fresh ?? false}
              executionStatus={snapshot.status}
              onRun={() => void runNow()}
            /> : null}
          </div>
          {(showConceptPills && refresherDay) || jev.state.status !== 'off' || learning.starterUpdated || sharedNotRun || learning.skippedLink || blankCount > 0 || solutionAnswers ? <div className="editor-pills">
            {blankCount > 0 ? <HintPill blanks={blankCount} onClick={showNextHint} /> : null}
            {solutionAnswers ? <SolutionPill starter={activeLesson.code} answers={solutionAnswers} open={solutionOpen} onToggle={() => setSolutionFor(solutionOpen ? null : activeLesson.id)} /> : null}
            {sharedNotRun ? <SharedCodePill onRun={() => void runNow()} /> : null}
            {learning.skippedLink ? <SharedLinkSkippedPill onDismiss={learning.dismissSkippedLink} /> : null}
            {learning.starterUpdated ? <StarterUpdatedPill onRestart={restartLesson} onKeep={learning.keepDraft} /> : null}
            {jev.state.status !== 'off' ? <JevPill state={jev.state} onRecheck={jev.recheck} onShow={jev.show} /> : null}
            {showConceptPills && refresherDay ? <ConceptPills key={refresherDay.id} concepts={refresherDay.concepts} /> : null}
          </div> : null}
          <CodeEditor
            value={code}
            readOnly={Boolean(refresherDay && (study.isReadOnly || study.stage === 'review'))}
            onChange={onEditorChange}
            theme={theme}
            onViewReady={setEditorView}
            onGeometryChange={onGeometryChange}
            pathNames={pathNames}
          />
          {showInputs ? <InputsField value={inputsText} onChange={setInputsText} /> : null}
        </div>

        <div className="split" aria-hidden="true" />

        <div className={`pane pane-results${lessonFullstack ? ' has-fullstack' : ''}`}>
          {lessonFullstack ? <FullstackTabs tab={activeFsTab} onChange={(tab) => { setFsTab(tab); onGeometryChange() }} payload={snapshot.fullstack} /> : null}
          {activeFsTab !== 'results' ? <FullstackPanel
            tab={activeFsTab}
            payload={snapshot.fullstack}
            status={snapshot.status}
            calls={fullstackCalls}
            onCallsChange={(calls) => setCallEdits({ lessonId, calls })}
            seed={seed}
            onShuffle={() => setSeed((value) => value + 1)}
            onResetSeed={() => setSeed(1)}
            view={lessonFullstack?.view}
            datasets={chosenDatasets}
            onDatasetsChange={chooseDatasets}
          /> : null}
          <div className="results-tab-body" hidden={activeFsTab !== 'results'}>
          <ResultsPanel
            events={displayEvents}
            status={snapshot.status}
            durationMs={snapshot.durationMs}
            taskEvidence={settledEvidence}
            goalChecks={settledGoalChecks}
            activeIndex={activeResult}
            onHoverResult={setActiveResult}
            onGeometryChange={onGeometryChange}
            showCoaching={!seenSuccess && !aiBlocked && !freePlay}
            placeholder={quietStart ? `Fill the ${blankCount === 1 ? '???' : `${blankCount} ??? blanks`} and results appear here as you type.` : undefined}
            editorView={editorView}
            geometryKey={geometryKey}
            alignMode={isWide ? 'full' : 'soft'}
            previousEvents={previousEvents}
            updatedIndices={updatedIndices}
            showPrevious={showPrevious}
            onTogglePrevious={() => setShowPrevious((v) => !v)}
            coachMessages={aiBlocked ? [] : coachUi}
            coachBusy={!aiBlocked && coachBusy}
            coachConfigured={coachConfigured}
            onCoachAsk={aiBlocked ? undefined : (text) => void onCoachAsk(text)}
            onOpenSettings={() => setSettingsOpen(true)}
            errorHelp={{
              code,
              contextId: `${lessonId}/${checkContextKey}/${snapshot.runId ?? ''}`,
              lessonTitle: activeLesson.topic,
              settings: appSettings,
              allowed: errorAiAllowed,
              fresh: snapshot.executedCode === code && snapshot.status === 'error',
              onOpenSettings: () => setSettingsOpen(true),
              onSuggest: showAiSuggestion,
            }}
          />
          </div>
        </div>

        <ResultConnectors
          workspaceRef={workspaceRef}
          editorView={editorView}
          events={snapshot.events}
          activeIndex={activeResult}
          // Draw whenever geometry allows (side-by-side). Stacked layouts
          // naturally yield null from measure — no forced wide-only gate.
          enabled={activeFsTab === 'results'}
          geometryKey={geometryKey}
        />
      </main>

      <footer className="app-footer">
        <span role="status" aria-label="Learning progress" className="footer-status">
          <span className={`footer-dot is-${saveStatus}`} aria-hidden="true" />
          {saveStatus === 'saved'
            ? 'Code and progress saved on this device'
            : saveStatus === 'saving'
              ? 'Saving on this device'
              : saveStatus === 'history-full'
                ? 'Saved history is full. Existing work is preserved.'
              : saveStatus === 'too-large'
                ? 'Not saved: local draft storage is full. Copy your code before leaving.'
              : saveStatus === 'blocked'
                ? 'Not saved yet: download your earlier progress first so it is not replaced.'
                : 'Not saved: browser storage is unavailable. Copy your code before leaving.'}
          {difficulty === 'refresher' && ` · ${study.completedDayIds.size}/14 days complete`}
          {difficulty === 'service' && ` · ${SERVICE_EXERCISE_IDS.filter((id) => completedIds.has(id)).length}/3 exercises complete`}
          {difficulty === 'genai' && ` · ${GENAI_EXERCISE_IDS.filter((id) => completedIds.has(id)).length}/${GENAI_EXERCISE_IDS.length} exercises complete`}
        </span>
        {learning.damagedNotice ? (
          <DamagedProgressNotice what="lesson" notice={learning.damagedNotice} onDownload={learning.downloadDamaged} />
        ) : null}
        {study.damagedNotice ? (
          <DamagedProgressNotice what="refresher" notice={study.damagedNotice} onDownload={study.downloadDamaged} />
        ) : null}
        <span className="footer-hint">
          Code runs automatically after a short pause ·{' '}
          <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>Enter</kbd> run · <kbd>Esc</kbd>{' '}
          stop · <kbd>?</kbd> shortcuts
        </span>
      </footer>

      {showHelp && (
        <div
          className="help-overlay"
          role="dialog"
          aria-label="Keyboard shortcuts"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="help-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="help-title">Shortcuts</h2>
            <ul className="help-list">
              <li>
                <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>Enter</kbd> Run now
              </li>
              <li>
                <kbd>Esc</kbd> Stop / close this help
              </li>
              <li>
                <kbd>?</kbd> Toggle shortcuts
              </li>
            </ul>
            <p className="help-note">{HELP_HINT}</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowHelp(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
