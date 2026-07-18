import type { Lesson } from '../examples'
import { lessonsForDifficulty } from '../examples'
import type { GoalProgress } from '../goalCheck'
import type { LessonProgressView } from '../lessonProgress'
import { CompareSnippet } from './CompareSnippet'
import { PipelineStrip } from './PipelineStrip'

type LessonGoalProps = {
  lesson: Lesson
  progress: GoalProgress
  view: LessonProgressView
  onRevealStuck: () => void
  onSelectLesson: (id: string) => void
  code: string
}

/** Avoid “Stretch Stretch: …” when content already starts with the word. */
function stretchBody(text: string): string {
  return text.replace(/^stretch:\s*/i, '').trim()
}

/**
 * Calm multi-column lesson chrome: goal · tasks · guidance.
 * Chapter/title live in the toolbar — not repeated here.
 */
export function LessonGoal({
  lesson,
  progress,
  view,
  onRevealStuck,
  onSelectLesson,
  code,
}: LessonGoalProps) {
  const track = lessonsForDifficulty(lesson.difficulty)
  const stretchText = lesson.stretch ? stretchBody(lesson.stretch) : ''
  const nextExtra =
    progress.missing.length > 1 && !view.extraHint
      ? ` (+${progress.missing.length - 1} more)`
      : ''

  return (
    <div className="lesson-goal" role="region" aria-label="Lesson goal">
      <div className="lesson-goal-grid">
        <section className="lesson-goal-col lesson-goal-col-goal">
          <h2 className="lesson-goal-col-label">Goal</h2>
          <p className="lesson-goal-statement">{lesson.goal}</p>
          {lesson.pipeline && lesson.pipeline.length > 0 ? (
            <div className="lesson-goal-pipeline">
              <PipelineStrip stages={lesson.pipeline} code={code} />
            </div>
          ) : null}
        </section>

        {view.tasks.length > 0 ? (
          <section className="lesson-goal-col lesson-goal-col-tasks">
            <h2 className="lesson-goal-col-label">Tasks</h2>
            <ol className="lesson-tasks">
              {view.tasks.map((task) => (
                <li
                  key={task.text}
                  className={
                    task.status === 'done'
                      ? 'lesson-task is-done'
                      : 'lesson-task'
                  }
                >
                  <span className="lesson-task-mark" aria-hidden="true">
                    {task.status === 'done' ? '✓' : '○'}
                  </span>
                  <span className="lesson-task-text">{task.text}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section className="lesson-goal-col lesson-goal-col-guide">
          <h2 className="lesson-goal-col-label">Guide</h2>
          <div className="lesson-goal-guide-body">
            {view.next ? (
              <p className="lesson-goal-next">
                <span className="lesson-goal-kicker">Next</span>
                <span>
                  {view.next}
                  {nextExtra}
                </span>
              </p>
            ) : progress.met ? (
              <p className="lesson-goal-next is-met">
                <span className="lesson-goal-kicker">Next</span>
                <span>Goal met — try the stretch or the next lesson.</span>
              </p>
            ) : null}

            {view.showStuckControl ? (
              <p className="lesson-goal-stuck">
                <button
                  type="button"
                  className="linkish"
                  onClick={onRevealStuck}
                >
                  Stuck? Show another hint
                </button>
              </p>
            ) : null}

            {view.extraHint ? (
              <p className="lesson-goal-hint">
                <span className="lesson-goal-kicker">Hint</span>
                <span>{view.extraHint}</span>
              </p>
            ) : null}

            {stretchText ? (
              <p
                className={`lesson-stretch${progress.met ? ' is-ready' : ''}`}
                title={
                  progress.met
                    ? 'Main goal met — try the stretch when you like'
                    : 'Optional after you finish the goal'
                }
              >
                <span className="lesson-goal-kicker">Stretch</span>
                <span>{stretchText}</span>
              </p>
            ) : null}

            {lesson.compare ? (
              <div className="lesson-goal-compare">
                <CompareSnippet compare={lesson.compare} />
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <footer className="lesson-goal-footer">
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
                title={`${l.chapter} · Lesson ${l.number} · ${l.topic}`}
                aria-label={`Lesson ${l.number}: ${l.topic}`}
                aria-current={current ? 'step' : undefined}
                onClick={() => onSelectLesson(l.id)}
              />
            )
          })}
        </nav>
      </footer>
    </div>
  )
}
