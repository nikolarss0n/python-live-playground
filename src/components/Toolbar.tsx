import type { Difficulty, Lesson } from '../examples'
import {
  DIFFICULTY_OPTIONS,
  lessonHeading,
  lessonLabel,
  lessonsByChapter,
} from '../examples'

type ThemeMode = 'light' | 'dark'

type ToolbarProps = {
  difficulty: Difficulty
  onSelectDifficulty: (d: Difficulty) => void
  lessons: Lesson[]
  activeLessonId: string
  activeLesson: Lesson
  onSelectLesson: (id: string) => void
  theme: ThemeMode
  onToggleTheme: () => void
  onOpenSettings?: () => void
}

export function Toolbar({
  difficulty,
  onSelectDifficulty,
  lessons,
  activeLessonId,
  activeLesson,
  onSelectLesson,
  theme,
  onToggleTheme,
  onOpenSettings,
}: ToolbarProps) {
  const chapters = lessonsByChapter(difficulty)
  const lessonIndex = lessons.findIndex((l) => l.id === activeLessonId)
  const prevLesson = lessonIndex > 0 ? lessons[lessonIndex - 1] : null
  const nextLesson =
    lessonIndex >= 0 && lessonIndex < lessons.length - 1
      ? lessons[lessonIndex + 1]
      : null

  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <span className="brand-mark" aria-hidden="true" />
        <div className="brand-text">
          <h1 className="brand-title">Python Live</h1>
          <p className="brand-subtitle">Write a little. See it run.</p>
        </div>
        <div
          className="brand-lesson"
          aria-label="Current lesson"
        >
          <span className="brand-chapter">{activeLesson.chapter}</span>
          <span className="brand-lesson-title">
            {lessonHeading(activeLesson)}
          </span>
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

        <div className="lesson-nav" role="group" aria-label="Lesson navigation">
          <button
            type="button"
            className="btn btn-ghost lesson-nav-btn"
            onClick={() => prevLesson && onSelectLesson(prevLesson.id)}
            disabled={!prevLesson}
            title={
              prevLesson
                ? `Previous: ${lessonLabel(prevLesson)}`
                : 'No previous lesson'
            }
            aria-label={
              prevLesson
                ? `Previous lesson: ${lessonLabel(prevLesson)}`
                : 'Previous lesson (unavailable)'
            }
          >
            Prev
          </button>
          <button
            type="button"
            className="btn btn-ghost lesson-nav-btn"
            onClick={() => nextLesson && onSelectLesson(nextLesson.id)}
            disabled={!nextLesson}
            title={
              nextLesson
                ? `Next: ${lessonLabel(nextLesson)}`
                : 'No next lesson'
            }
            aria-label={
              nextLesson
                ? `Next lesson: ${lessonLabel(nextLesson)}`
                : 'Next lesson (unavailable)'
            }
          >
            Next
          </button>
        </div>
      </div>
    </header>
  )
}
