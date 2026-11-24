import type { Lesson, Section } from '../examples'
import {
  SECTIONS,
  lessonHeading,
  lessonLabel,
  lessonsByChapter,
  isSection,
} from '../examples'

type ThemeMode = 'light' | 'dark'

import { ToolbarIcon } from './ToolbarIcon'
export { ToolbarIcon }

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
  /** The track menu's sections; defaults to all of them. */
  sections?: readonly { id: Section; label: string }[]
  /** Every learning section is off: show a plain editor bar without tracks or lessons. */
  onOpenProject?: () => void
  plain?: boolean
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
  sections = SECTIONS,
  plain = false,
  onOpenProject,
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

      {plain ? (
        <div className="toolbar-lesson toolbar-plain">
          <span className="brand-lesson-title">Python</span>
        </div>
      ) : <>
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
            {sections.map((opt) => (
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
            <ToolbarIcon name="prev" />
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
            <ToolbarIcon name="next" />
          </button>
        </div>
      </div>
      </>}

      <div
        className="toolbar-utilities"
        role="group"
        aria-label="Utilities"
      >
        {onOpenProject && <button type="button" className="btn project-launch" onClick={onOpenProject}
          title="Open projects" aria-label="Open projects">
          <ToolbarIcon name="folder" /><span>Projects</span>
        </button>}
        {onOpenSettings && (
          <button
            type="button"
            className="btn btn-icon"
            onClick={onOpenSettings}
            title="Settings: API key, companion URL, optional LLM"
            aria-label="Open settings"
          >
            <ToolbarIcon name="settings" />
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
          <ToolbarIcon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </div>
    </header>
  )
}
