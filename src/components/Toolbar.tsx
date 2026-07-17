import type { Example } from '../examples'

type ThemeMode = 'light' | 'dark'

type ToolbarProps = {
  examples: Example[]
  activeExampleId: string
  onSelectExample: (id: string) => void
  onRun: () => void
  onStop: () => void
  isRunning: boolean
  isBooting: boolean
  theme: ThemeMode
  onToggleTheme: () => void
}

export function Toolbar({
  examples,
  activeExampleId,
  onSelectExample,
  onRun,
  onStop,
  isRunning,
  isBooting,
  theme,
  onToggleTheme,
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <span className="brand-mark" aria-hidden="true" />
        <div className="brand-text">
          <h1 className="brand-title">Python Live</h1>
          <p className="brand-subtitle">Write a little. See it run.</p>
        </div>
      </div>

      <div className="toolbar-actions">
        <label className="examples-label">
          <span className="sr-only">Examples</span>
          <select
            className="examples-select"
            value={activeExampleId}
            onChange={(e) => onSelectExample(e.target.value)}
            aria-label="Load an example"
          >
            {examples.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="btn btn-primary"
          onClick={onRun}
          disabled={isBooting}
          title="Run now (also runs automatically as you type)"
        >
          Run
        </button>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={onStop}
          disabled={!isRunning && !isBooting}
          title="Stop execution and reset the runner"
        >
          Stop
        </button>

        <button
          type="button"
          className="btn btn-icon"
          onClick={onToggleTheme}
          aria-label={
            theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
          }
          title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>
    </header>
  )
}
