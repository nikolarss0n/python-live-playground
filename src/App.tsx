import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { CodeEditor } from './components/CodeEditor'
import { ResultsPanel } from './components/ResultsPanel'
import { ResultConnectors } from './components/ResultConnectors'
import { Toolbar } from './components/Toolbar'
import { LessonGoal } from './components/LessonGoal'
import { PredictPrompt } from './components/PredictPrompt'
import {
  getLesson,
  firstLessonId,
  lessonsForDifficulty,
  DEFAULT_DIFFICULTY,
  isDifficulty,
  type Difficulty,
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
import {
  copyShareUrl,
  readSnapshotFromLocation,
} from './shareSnapshot'
import { LocalApiStrip } from './components/LocalApiStrip'
import { SettingsModal } from './components/SettingsModal'
import { ModelRunBar } from './components/ModelRunBar'
import { loadSettings, type AppSettings } from './settings'
import './App.css'

type ThemeMode = 'light' | 'dark'

const COACH_KEY = 'plp-seen-success'
const HELP_HINT =
  'Shortcuts: ⌘/Ctrl+Enter Run · Esc Stop · ? help'

function preferredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem('plp-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function preferredDifficulty(): Difficulty {
  if (typeof window === 'undefined') return DEFAULT_DIFFICULTY
  const stored = window.localStorage.getItem('plp-difficulty')
  if (stored && isDifficulty(stored)) return stored
  return DEFAULT_DIFFICULTY
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

function initialFromShare(): {
  difficulty: Difficulty
  lessonId: string
  code: string
  predictDone: boolean
} {
  const snap = typeof window !== 'undefined' ? readSnapshotFromLocation() : null
  if (snap) {
    const lesson = getLesson(snap.lessonId)
    const difficulty =
      snap.difficulty === lesson.difficulty ? snap.difficulty : lesson.difficulty
    return {
      difficulty,
      lessonId: lesson.id,
      code: snap.code,
      predictDone: true,
    }
  }
  const difficulty = preferredDifficulty()
  const lessonId = firstLessonId(difficulty)
  return {
    difficulty,
    lessonId,
    code: getLesson(lessonId).code,
    predictDone: false,
  }
}

export default function App() {
  const boot = useMemo(() => initialFromShare(), [])
  const [theme, setTheme] = useState<ThemeMode>(preferredTheme)
  const [difficulty, setDifficulty] = useState<Difficulty>(boot.difficulty)
  const [lessonId, setLessonId] = useState(boot.lessonId)
  const [code, setCode] = useState(boot.code)
  const [editorView, setEditorView] = useState<EditorView | null>(null)
  const [geometryKey, setGeometryKey] = useState(0)
  const [activeResult, setActiveResult] = useState<number | null>(null)
  const [stuckRevealed, setStuckRevealed] = useState(false)
  const [incompleteRuns, setIncompleteRuns] = useState(0)
  const [predictDone, setPredictDone] = useState(boot.predictDone)
  const [showHelp, setShowHelp] = useState(false)
  const [showPrevious, setShowPrevious] = useState(false)
  const [previousEvents, setPreviousEvents] = useState<ResultEvent[] | null>(
    null,
  )
  const [shareNote, setShareNote] = useState<string | null>(null)
  const [shareBusy, setShareBusy] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [appSettings, setAppSettings] = useState<AppSettings>(() =>
    loadSettings(),
  )
  const [seenSuccess, setSeenSuccess] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(COACH_KEY) === '1'
  })
  const workspaceRef = useRef<HTMLElement>(null)
  const lastRunId = useRef<string | null>(null)
  const prevEventsRef = useRef<ResultEvent[]>([])
  const isWide = useWideLayout()

  const { snapshot, runNow, stop, isBooting, isRunning } =
    usePythonExecution(code)

  const trackLessons = useMemo(
    () => lessonsForDifficulty(difficulty),
    [difficulty],
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('plp-theme', theme)
  }, [theme])

  useEffect(() => {
    window.localStorage.setItem('plp-difficulty', difficulty)
  }, [difficulty])

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
    setLessonId(id)
    setCode(getLesson(id).code)
    setActiveResult(null)
    setStuckRevealed(false)
    setIncompleteRuns(0)
    setPredictDone(false)
    setPreviousEvents(null)
    setShowPrevious(false)
    prevEventsRef.current = []
  }, [])

  const onSelectDifficulty = useCallback((d: Difficulty) => {
    setDifficulty(d)
    const firstId = firstLessonId(d)
    setLessonId(firstId)
    setCode(getLesson(firstId).code)
    setActiveResult(null)
    setStuckRevealed(false)
    setIncompleteRuns(0)
    setPredictDone(false)
    setPreviousEvents(null)
    setShowPrevious(false)
    prevEventsRef.current = []
  }, [])

  const activeLesson = useMemo(() => getLesson(lessonId), [lessonId])

  const goalProgress = useMemo(
    () =>
      evaluateLessonGoal(
        activeLesson,
        code,
        snapshot.events,
        snapshot.status,
        snapshot.executedCode,
      ),
    [
      activeLesson,
      code,
      snapshot.events,
      snapshot.status,
      snapshot.executedCode,
    ],
  )

  const lessonView = useMemo(
    () =>
      buildLessonProgress(
        activeLesson,
        code,
        goalProgress,
        snapshot.status,
        snapshot.events,
        {
          stuckRevealed,
          incompleteRunCount: incompleteRuns,
        },
      ),
    [
      activeLesson,
      code,
      goalProgress,
      snapshot.status,
      snapshot.events,
      stuckRevealed,
      incompleteRuns,
    ],
  )

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
    if (prevEventsRef.current.length > 0) {
      setPreviousEvents(prevEventsRef.current)
    }
    prevEventsRef.current = snapshot.events

    const lines = linesFromEvents(snapshot.events)
    if (lines.length) pulseSourceLines(editorView, lines)

    if (isIncompleteAttempt(snapshot.status, goalProgress)) {
      setIncompleteRuns((n) => n + 1)
    }

    if (snapshot.status === 'success' && !seenSuccess) {
      setSeenSuccess(true)
      window.localStorage.setItem(COACH_KEY, '1')
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
        void runNow()
        return
      }
      if (e.key === 'Escape') {
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
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [runNow, stop, showHelp])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  const onShare = useCallback(async () => {
    setShareBusy(true)
    try {
      await copyShareUrl({
        v: 1,
        lessonId,
        difficulty,
        code,
      })
      setShareNote('Link copied — lesson and code are in the URL.')
      window.setTimeout(() => setShareNote(null), 2800)
    } catch {
      setShareNote('Could not copy — try again.')
      window.setTimeout(() => setShareNote(null), 2800)
    } finally {
      setShareBusy(false)
    }
  }, [lessonId, difficulty, code])

  const onGeometryChange = useCallback(() => {
    setGeometryKey((k) => k + 1)
  }, [])

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

  const showPredict =
    activeLesson.predict != null &&
    !predictDone &&
    snapshot.executedCode == null &&
    snapshot.status !== 'running' &&
    snapshot.status !== 'booting'

  return (
    <div className="app-shell">
      <Toolbar
        difficulty={difficulty}
        onSelectDifficulty={onSelectDifficulty}
        lessons={trackLessons}
        activeLessonId={lessonId}
        onSelectLesson={onSelectLesson}
        onRun={() => void runNow()}
        onStop={stop}
        isRunning={isRunning}
        isBooting={isBooting}
        theme={theme}
        onToggleTheme={toggleTheme}
        onShare={() => void onShare()}
        shareBusy={shareBusy}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {shareNote ? (
        <p className="share-toast" role="status">
          {shareNote}
        </p>
      ) : null}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={(s) => setAppSettings(s)}
      />

      <LessonGoal
        lesson={activeLesson}
        progress={goalProgress}
        view={lessonView}
        onRevealStuck={() => setStuckRevealed(true)}
        onSelectLesson={onSelectLesson}
        code={code}
      />

      {showPredict && activeLesson.predict ? (
        <PredictPrompt
          predict={activeLesson.predict}
          onResolved={() => setPredictDone(true)}
        />
      ) : null}

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

      {activeLesson.runWithModel ? (
        <ModelRunBar
          events={snapshot.events}
          settings={appSettings}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : null}

      <main
        className="workspace"
        ref={workspaceRef}
        data-path-kind={pathKind ?? undefined}
      >
        <div className="pane pane-editor">
          <div className="pane-label">Python</div>
          <CodeEditor
            value={code}
            onChange={setCode}
            theme={theme}
            onViewReady={setEditorView}
            onGeometryChange={onGeometryChange}
            pathNames={pathNames}
          />
        </div>

        <div className="split" aria-hidden="true" />

        <div className="pane pane-results">
          <ResultsPanel
            events={snapshot.events}
            status={snapshot.status}
            durationMs={snapshot.durationMs}
            activeIndex={activeResult}
            onHoverResult={setActiveResult}
            onGeometryChange={onGeometryChange}
            showCoaching={!seenSuccess}
            editorView={editorView}
            geometryKey={geometryKey}
            align={isWide}
            previousEvents={previousEvents}
            updatedIndices={updatedIndices}
            showPrevious={showPrevious}
            onTogglePrevious={() => setShowPrevious((v) => !v)}
          />
        </div>

        <ResultConnectors
          workspaceRef={workspaceRef}
          editorView={editorView}
          events={snapshot.events}
          activeIndex={activeResult}
          enabled={isWide}
          geometryKey={geometryKey}
        />
      </main>

      <footer className="app-footer">
        <span>Runs entirely in your browser · no account · no setup</span>
        <span className="footer-hint">
          Code runs automatically after a short pause · <kbd>Run</kbd> anytime ·{' '}
          <kbd>Stop</kbd> cancels loops · press <kbd>?</kbd> for shortcuts
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
