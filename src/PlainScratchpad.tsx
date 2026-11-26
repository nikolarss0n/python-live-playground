import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { ResizableWorkspace } from './components/ResizableWorkspace'
import { CodeEditor } from './components/CodeEditor'
import { ResultsPanel } from './components/ResultsPanel'
import { ResultConnectors } from './components/ResultConnectors'
import { ToolbarIcon } from './components/ToolbarIcon'
import { ShortcutsModal } from './components/ShortcutsModal'
import { InputsField } from './components/InputsField'
import { FullstackPanel, FullstackTabs, type FullstackTab } from './components/FullstackPanel'
import { ApiRequests } from './components/ApiRequests'
import { useApiRequests } from './components/useApiRequests'
import { JevPill } from './jev/JevPill'
import { useJevPinpoint } from './jev/useJevPinpoint'
import { useWideLayout } from './useWideLayout'
import { usePythonExecution } from './execution/usePythonExecution'
import { namesOnSourceLine } from './editor/variableColors'
import { linesFromEvents, pulseSourceLines, revealSourceLine } from './editor/runPulse'
import { showProblemMark } from './editor/problemMark'
import { updatedEventIndices } from './resultDiff'
import type { ResultEvent } from './execution/protocol'
import type { AppSettings } from './settings'
import type { ErrorAdvice } from './errorAdvice'
import { usesInput } from './usesInput'
import { routeKey } from './apiRequests'
import { readPreference, writePreference } from './preferences'
import type { ThemeMode } from './theme'
import { installMacHost, postHostEvent, type DiskFolderPayload, type HostActions } from './host/macHost'
import { PLAYGROUND_LESSON_ID } from './curriculum/playgroundLessons'
import {
  PLAYGROUND_STARTER,
  loadPlaygroundDraft,
  savePlaygroundDraft,
  type PlaygroundSaveStatus,
} from './playgroundDraft'

const HELP_HINT = 'Shortcuts: ⌘/Ctrl+Enter Run · Esc Stop · ? help'
const PROJECT_DATASETS_KEY = 'plp-project-datasets'
const FULLSTACK = PLAYGROUND_STARTER.fullstack!

function readProjectDatasets(): string[] | null {
  try {
    const parsed: unknown = JSON.parse(readPreference(PROJECT_DATASETS_KEY) ?? 'null')
    return Array.isArray(parsed) && parsed.every((name) => typeof name === 'string') ? parsed : null
  } catch {
    return null
  }
}

export type PlainScratchpadProps = {
  onOpenProject: () => void
  onOpenDiskFolder: (folder: DiskFolderPayload) => void
  takeOpenedFile: () => string | null
  theme: ThemeMode
  onToggleTheme: () => void
  appSettings: AppSettings
  onOpenSettings: () => void
}

/**
 * Default plain-editor Python scratchpad. Loads without the opt-in curriculum catalog so startup
 * stays fast when all learning sections are switched off.
 */
export function PlainScratchpad({
  onOpenProject,
  onOpenDiskFolder,
  takeOpenedFile,
  theme,
  onToggleTheme,
  appSettings,
  onOpenSettings,
}: PlainScratchpadProps) {
  const [initial] = useState(() => loadPlaygroundDraft())
  const [code, setCode] = useState(initial.code)
  const [saveStatus, setSaveStatus] = useState<PlaygroundSaveStatus | 'saving'>(initial.blocked ? 'blocked' : 'saving')
  const [editorView, setEditorView] = useState<EditorView | null>(null)
  const [geometryKey, setGeometryKey] = useState(0)
  const [activeResult, setActiveResult] = useState<number | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [showPrevious, setShowPrevious] = useState(false)
  const [previousEvents, setPreviousEvents] = useState<ResultEvent[] | null>(null)
  const [fsTab, setFsTab] = useState<FullstackTab>('results')
  const [seed, setSeed] = useState(1)
  const [calls, setCalls] = useState<string[]>(() => FULLSTACK.calls ?? [])
  const [projectDatasets, setProjectDatasets] = useState<string[] | null>(readProjectDatasets)
  const [inputsText, setInputsText] = useState('')
  const [savedNativeCode, setSavedNativeCode] = useState<string | null>(null)
  const [fileDiskConflict, setFileDiskConflict] = useState(false)
  const workspaceRef = useRef<HTMLElement>(null)
  const lastRunId = useRef<string | null>(null)
  const prevEventsRef = useRef<ResultEvent[]>([])
  const isWide = useWideLayout()

  const chosenDatasets = FULLSTACK.datasets ? projectDatasets ?? FULLSTACK.datasets : undefined
  const chooseDatasets = useCallback((next: string[]) => {
    setProjectDatasets(next)
    writePreference(PROJECT_DATASETS_KEY, JSON.stringify(next))
  }, [])

  const showInputs = usesInput(code)
  const stdinOption = showInputs ? { stdin: inputsText } : {}
  const { snapshot, runNow, stop, invoke } = usePythonExecution(code, {
    autoRun: true,
    checkOptions: {
      fullstack: { seed, calls, ...(chosenDatasets ? { datasets: chosenDatasets } : {}) },
      ...stdinOption,
    },
  })

  useEffect(() => {
    if (initial.blocked) {
      setSaveStatus('blocked')
      return
    }
    setSaveStatus(savePlaygroundDraft(code))
  }, [code, initial.blocked])

  const apiStale = snapshot.executedCode !== null && snapshot.executedCode !== code
  const api = useApiRequests(snapshot.routes, snapshot, invoke, {
    stale: apiStale,
    autoRun: true,
    active: fsTab === 'api',
    runBeforeSend: () => runNow(),
  })
  const apiRoutes = api.routes.length > 0

  const viewResults = useMemo(() => {
    const sent = api.routes.flatMap((route) => {
      const response = api.responses[routeKey(route)]
      return response?.kind === 'response'
        ? [{ method: route.method, path: response.path, status: response.status, body: response.body }]
        : []
    })
    if (!sent.length) return undefined
    const again = new Set(sent.map((call) => `${call.method} ${call.path}`))
    return [...sent, ...(snapshot.fullstack?.calls ?? []).filter((call) => !again.has(`${call.method} ${call.path}`))]
  }, [api.routes, api.responses, snapshot.fullstack])

  useEffect(() => {
    if (snapshot.status === 'running' || snapshot.status === 'idle' || snapshot.status === 'booting') {
      setActiveResult(null)
    }
  }, [snapshot.status, snapshot.runId])

  useEffect(() => {
    if (!snapshot.runId || snapshot.runId === lastRunId.current) return
    if (snapshot.status === 'running' || snapshot.status === 'booting' || snapshot.status === 'idle') return
    lastRunId.current = snapshot.runId
    const before = prevEventsRef.current
    if (before.length > 0) setPreviousEvents(before)
    prevEventsRef.current = snapshot.events
    const changed = before.length > 0
      ? [...updatedEventIndices(snapshot.events, before)].map((index) => snapshot.events[index])
      : snapshot.events
    const lines = linesFromEvents(changed)
    if (lines.length) pulseSourceLines(editorView, lines)
  }, [snapshot.runId, snapshot.status, snapshot.events, editorView])

  const updatedIndices = useMemo(
    () => updatedEventIndices(snapshot.events, previousEvents),
    [snapshot.events, previousEvents],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
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
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [runNow, stop, showHelp])

  const openNativeFile = useCallback((fileCode: string) => {
    setCode(fileCode)
    setSavedNativeCode(fileCode)
    setFileDiskConflict(false)
  }, [])
  useEffect(() => {
    const fileCode = takeOpenedFile()
    if (fileCode !== null) openNativeFile(fileCode)
  }, [takeOpenedFile, openNativeFile])
  useEffect(() => {
    postHostEvent({
      type: 'dirty',
      dirty: savedNativeCode !== null && code !== savedNativeCode,
    })
  }, [code, savedNativeCode])

  const hostActions = useRef<HostActions | null>(null)
  hostActions.current = {
    run: () => void runNow(),
    stop,
    getCode: () => editorView?.state.doc.toString() ?? code,
    openFile: (_name, fileCode) => openNativeFile(fileCode),
    markSaved: (savedCode) => {
      setSavedNativeCode(savedCode)
      setFileDiskConflict(false)
    },
    onFileConflict: () => setFileDiskConflict(true),
    openFolder: (folder) => onOpenDiskFolder(folder),
  }
  useEffect(() => installMacHost(() => hostActions.current!), [])

  const onGeometryChange = useCallback(() => {
    setGeometryKey((k) => k + 1)
  }, [])

  const pathNames = useMemo(() => {
    if (activeResult == null || !editorView || !code) return [] as string[]
    const event = snapshot.events[activeResult]
    if (!event || event.line == null) return []
    try {
      return namesOnSourceLine(editorView.state, event.line)
    } catch {
      return []
    }
  }, [activeResult, snapshot.events, editorView, code])

  const pathKind = activeResult != null ? (snapshot.events[activeResult]?.kind ?? null) : null
  const freshRun = snapshot.executedCode === code
  const freshError = useMemo(() => {
    if (!freshRun || (snapshot.status !== 'error' && snapshot.status !== 'timeout')) return null
    const event = [...snapshot.events].reverse().find((entry) => entry.kind === 'error')
    return event?.kind === 'error'
      ? { message: event.message, line: event.line, column: event.column, endColumn: event.endColumn, frames: event.frames }
      : null
  }, [freshRun, snapshot.status, snapshot.events])

  const jev = useJevPinpoint({
    view: editorView,
    code,
    error: freshError,
    timedOut: freshRun && snapshot.status === 'timeout',
    failedCheck: null,
    enabled: true,
  })

  const showAiSuggestion = useCallback((advice: ErrorAdvice, line: number | undefined) => {
    if (!editorView || !line || line > editorView.state.doc.lines) return
    const text = editorView.state.doc.line(line).text
    showProblemMark(editorView, {
      source: 'AI',
      line,
      from: text.length - text.trimStart().length,
      to: text.trimEnd().length,
      message: `${advice.explanation} ${advice.hint}`,
      ...(advice.example ? { snippet: advice.example } : {}),
    })
  }, [editorView])

  return (
    <div className="app-shell">
      <header className="toolbar">
        <h1 className="sr-only">Python Live</h1>
        <div className="toolbar-lesson toolbar-plain">
          <span className="brand-lesson-title">Python</span>
        </div>
        <div className="toolbar-utilities" role="group" aria-label="Utilities">
          <button
            type="button"
            className="btn project-launch"
            onClick={onOpenProject}
            title="Open projects"
            aria-label="Open projects"
          >
            <ToolbarIcon name="folder" /><span>Projects</span>
          </button>
          <button
            type="button"
            className="btn btn-icon"
            onClick={onOpenSettings}
            title="Settings: API key, companion URL, optional LLM"
            aria-label="Open settings"
          >
            <ToolbarIcon name="settings" />
          </button>
          <button
            type="button"
            className="btn btn-icon"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          >
            <ToolbarIcon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
        </div>
      </header>

      <ResizableWorkspace
        workspaceRef={workspaceRef}
        pathKind={pathKind ?? undefined}
        editor={<div id="workspace-code" className="pane pane-editor">
          <div className="pane-head">
            <div className="pane-label">Python</div>
          </div>
          <div className="editor-stage">
            <CodeEditor
              value={code}
              onChange={setCode}
              theme={theme}
              onViewReady={setEditorView}
              onGeometryChange={onGeometryChange}
              pathNames={pathNames}
            />
            {jev.state.status !== 'off' ? (
              <div className="editor-float">
                <JevPill state={jev.state} onRecheck={jev.recheck} onShow={jev.show} />
              </div>
            ) : null}
          </div>
          {showInputs ? <InputsField value={inputsText} onChange={setInputsText} /> : null}
        </div>}
      >
        <div className="pane pane-results has-fullstack">
          <FullstackTabs
            tab={fsTab}
            onChange={(tab) => { setFsTab(tab); onGeometryChange() }}
            payload={snapshot.fullstack}
            apiCount={apiRoutes ? api.routes.length : undefined}
          />
          {fsTab !== 'results' ? (
            <FullstackPanel
              tab={fsTab}
              payload={snapshot.fullstack}
              status={snapshot.status}
              calls={calls}
              onCallsChange={setCalls}
              seed={seed}
              onShuffle={() => setSeed((value) => value + 1)}
              onResetSeed={() => setSeed(1)}
              view={FULLSTACK.view}
              datasets={chosenDatasets}
              onDatasetsChange={chooseDatasets}
              api={apiRoutes ? (
                <ApiRequests
                  api={api}
                  stopped={snapshot.status === 'timeout' || snapshot.status === 'stopped'}
                  onShowLine={(line) => revealSourceLine(editorView, line)}
                  onShowResults={() => { setFsTab('results'); onGeometryChange() }}
                />
              ) : undefined}
              viewResults={viewResults}
            />
          ) : null}
          <div className="results-tab-body" hidden={fsTab !== 'results'}>
            <ResultsPanel
              events={snapshot.events}
              sourceCode={snapshot.executedCode}
              status={snapshot.status}
              durationMs={snapshot.durationMs}
              activeIndex={activeResult}
              onHoverResult={setActiveResult}
              onGeometryChange={onGeometryChange}
              showCoaching={false}
              editorView={editorView}
              geometryKey={geometryKey}
              alignMode={isWide ? 'full' : 'soft'}
              previousEvents={previousEvents}
              updatedIndices={updatedIndices}
              showPrevious={showPrevious}
              onTogglePrevious={() => setShowPrevious((v) => !v)}
              onOpenSettings={onOpenSettings}
              errorHelp={{
                code,
                contextId: `${PLAYGROUND_LESSON_ID}//${snapshot.runId ?? ''}`,
                lessonTitle: PLAYGROUND_STARTER.topic,
                settings: appSettings,
                allowed: true,
                fresh: snapshot.executedCode === code && snapshot.status === 'error',
                onOpenSettings,
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
          enabled={fsTab === 'results'}
          geometryKey={geometryKey}
        />
      </ResizableWorkspace>

      <footer className="app-footer">
        <span role="status" aria-label="Learning progress" className="footer-status">
          <span className={`footer-dot is-${fileDiskConflict ? 'too-large' : saveStatus}`} aria-hidden="true" />
          {fileDiskConflict ? (
            <>
              Changed on disk —{' '}
              <button type="button" className="linkish footer-conflict-btn" onClick={() => postHostEvent({ type: 'refreshDisk' })}>
                Reload from Disk
              </button>
            </>
          ) : saveStatus === 'saved'
            ? 'Code and progress saved on this device'
            : saveStatus === 'saving'
              ? 'Saving on this device'
              : saveStatus === 'too-large'
                ? 'Not saved: local draft storage is full. Copy your code before leaving.'
                : saveStatus === 'blocked'
                  ? 'Not saved yet: earlier progress could not be read and is preserved.'
                  : 'Not saved: browser storage is unavailable. Copy your code before leaving.'}
        </span>
        <span className="footer-hint">
          Code runs automatically after a short pause ·{' '}
          <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>Enter</kbd> run · <kbd>Esc</kbd>{' '}
          stop · <button type="button" className="footer-shortcuts" aria-label="Open shortcuts" onClick={() => setShowHelp(true)}><kbd>?</kbd> shortcuts</button>
        </span>
      </footer>

      <ShortcutsModal open={showHelp} onClose={() => setShowHelp(false)} hint={HELP_HINT} />
    </div>
  )
}
