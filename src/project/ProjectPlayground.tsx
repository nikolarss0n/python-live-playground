import { ResizableWorkspace } from '../components/ResizableWorkspace'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { EditorView } from '@codemirror/view'
import { ApiRequests } from '../components/ApiRequests'
import { CodeEditor } from '../components/CodeEditor'
import { InputsField } from '../components/InputsField'
import { ResultsPanel } from '../components/ResultsPanel'
import { ToolbarIcon } from '../components/Toolbar'
import { useApiRequests } from '../components/useApiRequests'
import { useModalFocus } from '../components/useModalFocus'
import { usePythonExecution } from '../execution/usePythonExecution'
import { installMacHost, postHostEvent, type HostActions } from '../host/macHost'
import { preferredTheme, applyTheme } from '../theme'
import { readPreference, writePreference } from '../useLearningSession'
import { usesInput } from '../usesInput'
import { PatternReviewDialog } from './PatternReviewDialog'
import { ProjectExplorer, ProjectFileBar } from './ProjectNavigation'
import type { ProjectWorkspace } from './useProjectWorkspace'
import './projectPlayground.css'

function NewProjectDialog({ workspace, onClose }: { workspace: ProjectWorkspace; onClose: () => void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const dialog = useModalFocus(true, onClose)
  return createPortal(<div className="help-overlay" onClick={onClose}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="new-project-title"
      className="help-card project-dialog" onClick={event => event.stopPropagation()}>
      <h2 id="new-project-title" className="help-title">New project</h2>
      <form onSubmit={event => {
        event.preventDefault()
        const problem = workspace.createProject(name)
        if (problem) setError(problem)
        else onClose()
      }}>
        <label htmlFor="new-project-name">Project name</label>
        <input id="new-project-name" value={name} required autoComplete="off"
          aria-invalid={Boolean(error)} aria-describedby={error ? 'new-project-error' : undefined}
          onChange={event => { setName(event.target.value); setError(null) }} />
        {error && <p id="new-project-error" role="alert">{error}</p>}
        <div className="project-dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Create project</button>
        </div>
      </form>
    </div>
  </div>, document.body)
}

function sameProjectSource(
  executed: { entry: string; folders?: readonly string[]; files: Readonly<Record<string, string>> } | undefined,
  current: { entry: string; folders: readonly string[]; files: Readonly<Record<string, string>> },
): boolean {
  if (!executed || executed.entry !== current.entry) return false
  const aKeys = Object.keys(executed.files)
  const bKeys = Object.keys(current.files)
  if (aKeys.length !== bKeys.length) return false
  for (const key of bKeys) {
    if (!Object.hasOwn(executed.files, key) || executed.files[key] !== current.files[key]) return false
  }
  const aFolders = executed.folders ?? []
  if (aFolders.length !== current.folders.length) return false
  return current.folders.every((folder, index) => aFolders[index] === folder)
}

export function ProjectPlayground({ workspace, onExit }: {
  workspace: ProjectWorkspace
  onExit: (openedFile?: string) => void
}) {
  const { project, saveError } = workspace
  const { files, entry, activePath } = project
  const [theme, setTheme] = useState(preferredTheme)
  const [autoRun, setAutoRun] = useState(() => readPreference('plp-project-auto-run') !== 'off')
  const [slowRun, setSlowRun] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [creatingProject, setCreatingProject] = useState(false)
  const [stdin, setStdin] = useState('')
  const [resultsTab, setResultsTab] = useState<'results' | 'api'>('results')
  const showInputs = useMemo(() => Object.entries(files).some(([path, source]) =>
    path.endsWith('.py') && usesInput(source)), [files])
  const { snapshot, runNow, stop, invoke, isRunning, isBooting } = usePythonExecution(files[entry], {
    autoRun,
    checkOptions: { project: { entry, files, folders: project.folders }, ...(showInputs ? { stdin } : {}) },
  })
  const apiStale = Boolean(snapshot.executedProject && !sameProjectSource(snapshot.executedProject, { entry, files, folders: project.folders }))
  const api = useApiRequests(snapshot.routes, snapshot, invoke, {
    stale: apiStale,
    runBeforeSend: () => runNow(),
  })
  const hasRoutes = api.routes.length > 0
  const activeTab = hasRoutes ? resultsTab : 'results'
  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const next = activeTab === 'results' ? 'api' : 'results'
    setResultsTab(next)
    document.getElementById(`project-tab-${next}`)?.focus()
  }
  useEffect(() => {
    if (!isRunning) { setSlowRun(false); return }
    const timer = window.setTimeout(() => setSlowRun(true), 500)
    return () => window.clearTimeout(timer)
  }, [isRunning])
  const counts = useMemo(() => {
    const totals: Record<string, { results: number; errors: number }> = Object.create(null)
    for (const event of snapshot.events) {
      if (!event.file || !Object.hasOwn(files, event.file)) continue
      const file = totals[event.file] ??= { results: 0, errors: 0 }
      if (event.kind === 'error') file.errors++
      else file.results++
    }
    return totals
  }, [snapshot.events, files])

  const view = useRef<EditorView | null>(null)
  const pendingLine = useRef<number | null>(null)
  function revealLine(editor: EditorView, line: number) {
    const position = editor.state.doc.line(Math.max(1, Math.min(line, editor.state.doc.lines))).from
    editor.dispatch({ selection: { anchor: position }, scrollIntoView: true })
    editor.focus()
  }
  const onViewReady = useCallback((editor: EditorView | null) => {
    view.current = editor
    if (editor && pendingLine.current !== null) {
      revealLine(editor, pendingLine.current)
      pendingLine.current = null
    }
  }, [])
  function openSource(path: string, line: number | null) {
    if (!Object.hasOwn(files, path)) return
    const targetLine = snapshot.executedProject?.files[path] === files[path] ? line ?? 1 : 1
    if (path === activePath && view.current) revealLine(view.current, targetLine)
    else {
      pendingLine.current = targetLine
      workspace.openFile(path)
    }
  }

  useEffect(() => {
    applyTheme(theme)
    writePreference('plp-theme', theme)
    postHostEvent({ type: 'theme', theme })
  }, [theme])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || document.querySelector('[aria-modal="true"][open], [role="dialog"][aria-modal="true"]')) return
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        void runNow()
      } else if (event.key === 'Escape') stop()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [runNow, stop])

  const actions = useRef<HostActions>(null)
  actions.current = {
    run: () => void runNow(), stop,
    getCode: () => view.current?.state.doc.toString() ?? files[activePath],
    projectDocument: () => {
      const name = activePath.split('/').at(-1) ?? activePath
      if (workspace.isDiskBacked) {
        const currentText = view.current?.state.doc.toString() ?? files[activePath]
        const dirtyFiles = { ...workspace.dirtyFiles }
        if (currentText !== files[activePath]) dirtyFiles[activePath] = currentText
        return { name, saved: Object.keys(dirtyFiles).length === 0, dirtyFiles }
      }
      return { name, saved: workspace.saveNow() }
    },
    openFile: (_name, source) => onExit(source),
    openFolder: (folder) => workspace.openDiskFolder(folder),
    syncFolder: (folder, force) => workspace.syncDiskFolder(folder, force),
    markFolderSaved: (saved) => workspace.markDiskSaved(saved),
  }
  useEffect(() => installMacHost(() => actions.current!), [])
  useEffect(() => {
    postHostEvent({ type: 'dirty', dirty: workspace.isDiskBacked && workspace.dirtyPaths.size > 0 })
  }, [workspace.isDiskBacked, workspace.dirtyPaths.size])
  const saveLabel = saveError ?? (workspace.isDiskBacked
    ? (workspace.dirtyPaths.size ? 'Unsaved disk edits (⌘S to save)' : 'Synced with disk')
    : (workspace.dirtyPaths.size ? 'Saving project on this device' : 'Project saved on this device'))
  return <div className="app-shell project-shell">
    <header className="toolbar project-toolbar">
      <h1 className="sr-only">Python projects</h1>
      <div className="project-picker">
        <ToolbarIcon name="folder" />
        <select aria-label="Project" value={(workspace.isDiskBacked ? 'disk/' : 'project/') + project.name} onChange={event => {
          const value = event.target.value
          if (value === 'patterns') setReviewOpen(true)
          else if (value === 'reset-starter') workspace.resetStarter()
          else if (value === 'new') setCreatingProject(true)
          else if (value === 'scratchpad') onExit()
          else if (value.startsWith('project/')) workspace.switchProject(value.slice('project/'.length))
        }}>
          {workspace.isDiskBacked && <option value={'disk/' + project.name}>{project.name} (disk)</option>}
          {workspace.projectNames.map(name => <option key={name} value={'project/' + name}>{name}</option>)}
          <option value="patterns">Review design patterns…</option>
          {!workspace.isDiskBacked && project.name === 'mail-tools' && <option value="reset-starter">Reset mail-tools to starter</option>}
          <option value="new">New project…</option>
          <option value="scratchpad">Back to scratchpad</option>
        </select>
      </div>
      <ProjectFileBar workspace={workspace} counts={counts} />
      <div className="toolbar-utilities">
        {workspace.isDiskBacked && (
          <button type="button" className="btn btn-ghost project-run" title="Reload files from disk (⇧⌘R)"
            aria-label="Refresh from disk" onClick={() => postHostEvent({ type: 'refreshDisk' })}>
            Refresh
          </button>
        )}
        {(!autoRun || (isRunning && slowRun)) &&
          <button type="button" className="btn btn-ghost project-run" disabled={isBooting}
            onClick={() => isRunning ? stop() : void runNow()}>{isRunning ? 'Stop' : 'Run'}</button>}
        <button type="button" role="switch" aria-checked={autoRun} className="learning-switch project-auto-run"
          title="Run the project after edits" onClick={() => {
            writePreference('plp-project-auto-run', autoRun ? 'off' : 'on')
            setAutoRun(!autoRun)
          }}>
          Auto-run <span className="learning-switch-track" aria-hidden="true"><span className="learning-switch-thumb" /></span>
        </button>
        <button type="button" className="btn btn-icon" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          <ToolbarIcon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </div>
    </header>
    <ResizableWorkspace files={<ProjectExplorer workspace={workspace} counts={counts} />} editor={
      <section id="workspace-code" className="pane pane-editor" aria-label="Project editor">
        <div className="project-breadcrumb" aria-label="Current file" title={project.name + '/' + activePath}>
          <span>{project.name}</span>
          {activePath.split('/').map((part, index) => <span key={index}><i aria-hidden="true">›</i>{part}</span>)}
        </div>
        <div className="editor-stage" id="project-editor-panel" role="tabpanel" aria-label={activePath}>
          <CodeEditor key={activePath} value={files[activePath]} onChange={source => workspace.editFile(activePath, source)}
            ariaLabel={`Edit ${activePath}`} language={activePath.endsWith('.py') ? 'python' : 'text'} theme={theme} onViewReady={onViewReady} />
        </div>
        {showInputs && <InputsField value={stdin} onChange={setStdin} />}
      </section>
    }>
      <div className="pane pane-results">
        {hasRoutes ? (
          <div className="fullstack-tabs" role="tablist" aria-label="Project output views" onKeyDown={onTabKeyDown}>
            <button
              id="project-tab-results"
              type="button"
              role="tab"
              aria-selected={activeTab === 'results'}
              aria-controls="project-results-panel"
              tabIndex={activeTab === 'results' ? 0 : -1}
              className={`fullstack-tab${activeTab === 'results' ? ' is-active' : ''}`}
              onClick={() => setResultsTab('results')}
            >
              Results
            </button>
            <button
              id="project-tab-api"
              type="button"
              role="tab"
              aria-selected={activeTab === 'api'}
              aria-controls="project-api-panel"
              tabIndex={activeTab === 'api' ? 0 : -1}
              className={`fullstack-tab${activeTab === 'api' ? ' is-active' : ''}`}
              onClick={() => setResultsTab('api')}
            >
              API<span className="fullstack-tab-count">{api.routes.length}</span>
            </button>
          </div>
        ) : null}
        {activeTab === 'api' ? (
          <section id="project-api-panel" className="fullstack-panel" role="tabpanel" aria-labelledby="project-tab-api">
            <ApiRequests
              api={api}
              stopped={snapshot.status === 'timeout' || snapshot.status === 'stopped'}
              onShowLine={(line, file) => openSource(file ?? entry, line)}
              onShowResults={() => setResultsTab('results')}
            />
          </section>
        ) : null}
        <div id="project-results-panel" className="results-tab-body" hidden={activeTab !== 'results'}>
          <ResultsPanel events={snapshot.events} status={snapshot.status} durationMs={snapshot.durationMs}
            placeholder={autoRun ? undefined : 'Choose Run to execute the project.'}
            projectFiles={snapshot.executedProject?.files} onOpenSource={openSource} alignMode="off" />
        </div>
      </div>
    </ResizableWorkspace>
    <footer className="app-footer">
      <span role="status" className="footer-status">
        <span className={`footer-dot is-${saveError ? 'error' : workspace.dirtyPaths.size ? 'saving' : 'saved'}`} />{saveLabel}
      </span>
      <span className="footer-hint">{autoRun ? entry + ' runs after edits' : 'Manual run'} · ⌘/Ctrl+Enter to run · Esc to stop</span>
    </footer>
    {reviewOpen && <PatternReviewDialog files={files} close={() => setReviewOpen(false)} open={({ path, line }) => {
      setReviewOpen(false)
      if (path === activePath && view.current) {
        const editor = view.current
        requestAnimationFrame(() => revealLine(editor, line))
      } else {
        pendingLine.current = line
        workspace.openFile(path)
      }
    }} />}
    {creatingProject && <NewProjectDialog workspace={workspace} onClose={() => setCreatingProject(false)} />}
  </div>
}
