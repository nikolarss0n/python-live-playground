import type { Lesson } from '../examples'
import { lessonHeading, lessonsForDifficulty } from '../examples'
import type { GoalProgress } from '../goalCheck'
import type { LessonProgressView } from '../lessonProgress'

type LessonGoalProps = {
  lesson: Lesson
  progress: GoalProgress
  view: LessonProgressView
  onRevealStuck: () => void
  onSelectLesson: (id: string) => void
}

/**
 * Goal strip: goal, soft task checks, lesson map, Next + optional stuck hint.
 * No green “Done” badge.
 */
export function LessonGoal({
  lesson,
  progress,
  view,
  onRevealStuck,
  onSelectLesson,
}: LessonGoalProps) {
  const track = lessonsForDifficulty(lesson.difficulty)

  return (
    <div className="lesson-goal" role="region" aria-label="Lesson goal">
      <div className="lesson-goal-main">
        <span className="lesson-goal-label">{lessonHeading(lesson)}</span>
        <nav className="lesson-map" aria-label="Lesson path">
          {track.map((l) => {
            const current = l.id === lesson.id
            return (
              <button
                key={l.id}
                type="button"
                className={`lesson-map-dot${current ? ' is-current' : ''}${
                  l.number < lesson.number ? ' is-past' : ''
                }`}
                title={lessonHeading(l)}
                aria-label={`Lesson ${l.number}: ${l.topic}`}
                aria-current={current ? 'step' : undefined}
                onClick={() => onSelectLesson(l.id)}
              />
            )
          })}
        </nav>
      </div>

      <p className="lesson-goal-text">
        <strong className="lesson-goal-kicker">Goal</strong>{' '}
        <span className="lesson-goal-statement">{lesson.goal}</span>
      </p>

      {view.tasks.length > 0 && (
        <ol className="lesson-tasks">
          {view.tasks.map((task) => (
            <li
              key={task.text}
              className={
                task.status === 'done' ? 'lesson-task is-done' : 'lesson-task'
              }
            >
              <span className="lesson-task-mark" aria-hidden="true">
                {task.status === 'done' ? '✓' : '○'}
              </span>
              <span>{task.text}</span>
            </li>
          ))}
        </ol>
      )}

      {view.next ? (
        <p className="lesson-goal-next">
          <strong className="lesson-goal-kicker">Next</strong>{' '}
          <span>{view.next}</span>
          {progress.missing.length > 1 && !view.extraHint
            ? ` (+${progress.missing.length - 1} more)`
            : ''}
        </p>
      ) : null}

      {view.showStuckControl ? (
        <p className="lesson-goal-stuck">
          <button type="button" className="linkish" onClick={onRevealStuck}>
            Stuck? Show another hint
          </button>
        </p>
      ) : null}

      {view.extraHint ? (
        <p className="lesson-goal-hint">
          <strong className="lesson-goal-kicker">Hint</strong>{' '}
          <span>{view.extraHint}</span>
        </p>
      ) : null}
    </div>
  )
}
