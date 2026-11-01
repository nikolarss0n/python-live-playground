import type { Lesson, Section } from '../examples'
import {
  SECTIONS,
  lessonHeading,
  lessonLabel,
  lessonsByChapter,
  isSection,
} from '../examples'

type ThemeMode = 'light' | 'dark'

const ICONS = {
  prev: 'M10 3.5 5.5 8l4.5 4.5',
  next: 'M6 3.5 10.5 8 6 12.5',
  settings: 'M8 5.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8ZM6.9 1.5h2.2l.35 1.7 1.2.7 1.65-.55 1.1 1.9-1.3 1.15v1.4l1.3 1.15-1.1 1.9-1.65-.55-1.2.7-.35 1.7H6.9l-.35-1.7-1.2-.7-1.65.55-1.1-1.9 1.3-1.15v-1.4L2.6 5.25l1.1-1.9 1.65.55 1.2-.7Z',
  sun: 'M8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06',
  moon: 'M13.5 9.6A5.5 5.5 0 0 1 6.4 2.5a5.5 5.5 0 1 0 7.1 7.1Z',
} as const

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg className="toolbar-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d={ICONS[name]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

type ToolbarProps = {
  section: Section
  onSelectSection: (section: Section) => void
  lessons: Lesson[]
  activeLessonId: string
  activeLesson: Lesson
  onSelectLesson: (id: string) => void
  theme: ThemeMode
  onToggleTheme: () => void
  onOpenSettings?: () => void
  completedIds?: ReadonlySet<string>
  isLessonLocked?: (id: string) => boolean
}

export function Toolbar({
  section,
  onSelectSection,
  lessons,
  activeLessonId,
  activeLesson,
  onSelectLesson,
  theme,
  onToggleTheme,
  onOpenSettings,
  completedIds,
  isLessonLocked,
}: ToolbarProps) {
  const chapters = lessonsByChapter(section)
  const serviceSteps = lessons.filter((lesson) => lesson.difficulty === 'service')
  const lessonIndex = lessons.findIndex((l) => l.id === activeLessonId)
  const prevLesson = lessonIndex > 0 ? lessons[lessonIndex - 1] : null
  const nextLesson =
    lessonIndex >= 0 && lessonIndex < lessons.length - 1
      ? lessons[lessonIndex + 1]
      : null
  const nextLocked = nextLesson ? isLessonLocked?.(nextLesson.id) === true : false

  return (
    <header className="toolbar">
      <h1 className="sr-only">Python Live</h1>

      <div className="toolbar-lesson" aria-label="Current lesson">
        <span className="brand-chapter">{activeLesson.chapter}</span>
        <span className="brand-lesson-title">
          {activeLesson.difficulty === 'service'
            ? `Project step ${serviceSteps.findIndex((lesson) => lesson.id === activeLesson.id) + 1} of ${serviceSteps.length} · ${activeLesson.topic}`
            : lessonHeading(activeLesson)}
        </span>
      </div>

      <div
        className="toolbar-nav"
        role="group"
        aria-label="Lesson navigation"
      >
        <label className="examples-label">
          <span className="sr-only">Learning track</span>
          <select
            className="examples-select difficulty-select"
            value={section}
            onChange={(e) => {
              if (isSection(e.target.value)) onSelectSection(e.target.value)
            }}
            aria-label="Choose learning track"
          >
            {SECTIONS.map((opt) => (
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
                  <option key={lesson.id} value={lesson.id} disabled={isLessonLocked?.(lesson.id)}>
                    {lessonLabel(lesson)}{completedIds?.has(lesson.id) ? ' · Complete' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <div className="lesson-nav">
          <button
            type="button"
            className="btn btn-icon lesson-nav-btn"
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
            <Icon name="prev" />
          </button>
          <button
            type="button"
            className="btn btn-icon lesson-nav-btn"
            onClick={() => nextLesson && onSelectLesson(nextLesson.id)}
            disabled={!nextLesson || nextLocked}
            title={
              nextLocked ? 'Complete this exercise to continue with your code' : nextLesson
                ? `Next: ${lessonLabel(nextLesson)}`
                : 'No next lesson'
            }
            aria-label={
              nextLesson
                ? `Next lesson: ${lessonLabel(nextLesson)}`
                : 'Next lesson (unavailable)'
            }
          >
            <Icon name="next" />
          </button>
        </div>
      </div>

      <div
        className="toolbar-utilities"
        role="group"
        aria-label="Utilities"
      >
        {onOpenSettings && (
          <button
            type="button"
            className="btn btn-icon"
            onClick={onOpenSettings}
            title="Settings: API key, companion URL, optional LLM"
            aria-label="Open settings"
          >
            <Icon name="settings" />
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
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </div>
    </header>
  )
}
