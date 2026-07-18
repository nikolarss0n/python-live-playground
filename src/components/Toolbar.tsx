import type { Difficulty, Lesson } from '../examples'
import { DIFFICULTY_OPTIONS, lessonLabel } from '../examples'

type ThemeMode = 'light' | 'dark'

type ToolbarProps = {
  difficulty: Difficulty
  onSelectDifficulty: (d: Difficulty) => void
  lessons: Lesson[]
  activeLessonId: string
  onSelectLesson: (id: string) => void
  onRun: () => void
  onStop: () => void
  isRunning: boolean
  isBooting: boolean
  theme: ThemeMode
  onToggleTheme: () => void
}

export function Toolbar({
  difficulty,
  onSelectDifficulty,
  lessons,
  activeLessonId,
  onSelectLesson,
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
          <span className="sr-only">Difficulty</span>
          <select
            className="examples-select difficulty-select"
            value={difficulty}
            onChange={(e) =>
              onSelectDifficulty(e.target.value as Difficulty)
            }
            aria-label="Choose difficulty"
          >
            {DIFFICULTY_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="examples-label">
          <span className="sr-only">Lesson</span>
          <select
            className="examples-select lessons-select"
            value={activeLessonId}
            onChange={(e) => onSelectLesson(e.target.value)}
            aria-label="Choose a lesson"
          >
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lessonLabel(lesson)}
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
