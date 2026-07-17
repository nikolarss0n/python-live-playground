import { useCallback, useEffect, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { CodeEditor } from './components/CodeEditor'
import { ResultsPanel } from './components/ResultsPanel'
import { ResultConnectors } from './components/ResultConnectors'
import { Toolbar } from './components/Toolbar'
import { EXAMPLES, getExample, DEFAULT_EXAMPLE_ID } from './examples'
import { usePythonExecution } from './execution/usePythonExecution'
import './App.css'

type ThemeMode = 'light' | 'dark'

function preferredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem('plp-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
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

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(preferredTheme)
  const [exampleId, setExampleId] = useState(DEFAULT_EXAMPLE_ID)
  const [code, setCode] = useState(() => getExample(DEFAULT_EXAMPLE_ID).code)
  const [editorView, setEditorView] = useState<EditorView | null>(null)
  const [geometryKey, setGeometryKey] = useState(0)
  const [activeResult, setActiveResult] = useState<number | null>(null)
  const workspaceRef = useRef<HTMLElement>(null)
  const isWide = useWideLayout()

  const { snapshot, runNow, stop, isBooting, isRunning } =
    usePythonExecution(code)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('plp-theme', theme)
  }, [theme])

  const onSelectExample = useCallback((id: string) => {
    setExampleId(id)
    setCode(getExample(id).code)
    setActiveResult(null)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  const onGeometryChange = useCallback(() => {
    setGeometryKey((k) => k + 1)
  }, [])

  return (
    <div className="app-shell">
      <Toolbar
        examples={EXAMPLES}
        activeExampleId={exampleId}
        onSelectExample={onSelectExample}
        onRun={() => void runNow()}
        onStop={stop}
        isRunning={isRunning}
        isBooting={isBooting}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="workspace" ref={workspaceRef}>
        <div className="pane pane-editor">
          <div className="pane-label">Python</div>
          <CodeEditor
            value={code}
            onChange={setCode}
            theme={theme}
            onViewReady={setEditorView}
            onGeometryChange={onGeometryChange}
          />
        </div>

        <div className="split" aria-hidden="true" />

        <div className="pane pane-results">
          <div className="pane-label">Results</div>
          <ResultsPanel
            events={snapshot.events}
            status={snapshot.status}
            durationMs={snapshot.durationMs}
            activeIndex={activeResult}
            onHoverResult={setActiveResult}
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
          Code runs automatically after a short pause ·{' '}
          <kbd>Run</kbd> anytime · <kbd>Stop</kbd> cancels loops
        </span>
      </footer>
    </div>
  )
}
