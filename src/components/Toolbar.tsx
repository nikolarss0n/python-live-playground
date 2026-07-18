import type { Difficulty, Lesson } from '../examples'
import { DIFFICULTY_OPTIONS, lessonLabel, lessonsByChapter } from '../examples'

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
  onShare?: () => void
  shareBusy?: boolean
  onOpenSettings?: () => void
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
  onShare,
  shareBusy,
  onOpenSettings,
}: ToolbarProps) {
  const chapters = lessonsByChapter(difficulty)
  // Keep select valid if lessons prop is a flat list
  void lessons

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
            {chapters.map((group) => (
              <optgroup key={group.chapter} label={group.chapter}>
                {group.lessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lessonLabel(lesson)}
                  </option>
                ))}
              </optgroup>
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

        {onShare && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onShare}
            disabled={shareBusy}
            title="Copy a link with this lesson and your code"
          >
            Share
          </button>
        )}

        {onOpenSettings && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onOpenSettings}
            title="API key, companion URL, optional LLM"
            aria-label="Open settings"
          >
            Settings
          </button>
        )}

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
