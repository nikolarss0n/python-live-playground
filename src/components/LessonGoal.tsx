import { useEffect, useRef, type ReactNode } from 'react'
import type { Lesson } from '../examples'
import type { GoalProgress } from '../goalCheck'
import type { LessonProgressView } from '../lessonProgress'
import { CompareSnippet } from './CompareSnippet'
import { PipelineStrip } from './PipelineStrip'
import { ResetPill } from './ResetPill'

type LessonGoalProps = {
  lesson: Lesson
  progress: GoalProgress
  view: LessonProgressView
  onRevealStuck: () => void
  code: string
  expanded: boolean
  onToggleExpanded: () => void
  onRestart?: () => boolean | void
  onRestore?: () => void
  canRestore?: boolean
  recoveryMessage?: string | null
  /** Extra lesson controls shown at the end of the popover. */
  children?: ReactNode
}

/** Avoid “Stretch Stretch: …” when content already starts with the word. */
function stretchBody(text: string): string {
  return text.replace(/^stretch:\s*/i, '').trim()
}

/**
 * Lesson chrome as a small pill in the editor bar; goal, tasks and guidance open in a popover.
 * Chapter/title live in the toolbar and are not repeated here.
 */
export function LessonGoal({
  lesson,
  progress,
  view,
  onRevealStuck,
  code,
  expanded,
  onToggleExpanded,
  onRestart,
  onRestore,
  canRestore,
  recoveryMessage,
  children,
}: LessonGoalProps) {
  const stretchText = lesson.stretch ? stretchBody(lesson.stretch) : ''
  const nextExtra =
    progress.missing.length > 1 && !view.extraHint
      ? ` (+${progress.missing.length - 1} more)`
      : ''
  const currentTaskIndex = view.tasks.findIndex(
    (task) => task.status === 'todo',
  )
  const completedTaskCount = view.tasks.filter(
    (task) => task.status === 'done',
  ).length
  const currentTask =
    currentTaskIndex >= 0 ? view.tasks[currentTaskIndex] : null

  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!expanded) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onToggleExpanded() }
    const onPointer = (event: PointerEvent) => {
      if (root.current && event.target instanceof Node && !root.current.contains(event.target)) onToggleExpanded()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [expanded, onToggleExpanded])

  return (
    <div className="lesson-goal" role="region" aria-label="Lesson goal" ref={root}>
      <button
        type="button"
        className={`lesson-pill${expanded ? ' is-open' : ''}${view.allTasksDone ? ' is-done' : ''}`}
        aria-expanded={expanded}
        aria-controls="lesson-details"
        aria-label={expanded ? 'Hide lesson' : 'Show lesson'}
        aria-describedby={view.tasks.length > 0 ? 'lesson-pill-progress' : undefined}
        title={lesson.goal}
        onClick={onToggleExpanded}
      >
        <span className="lesson-pill-icon" aria-hidden="true">i</span>
        Lesson
        {view.tasks.length > 0 ? (
          <span
            className="lesson-pill-progress"
            id="lesson-pill-progress"
            aria-label={`${completedTaskCount} of ${view.tasks.length} tasks complete`}
            aria-live="polite"
          >
            {completedTaskCount}/{view.tasks.length}
          </span>
        ) : null}
      </button>
      {onRestart ? (
        <ResetPill lessonId={lesson.id} atStarter={code === lesson.code} onReset={onRestart} onUndo={onRestore} canUndo={Boolean(canRestore)} />
      ) : null}

      <div
        className="lesson-goal-details"
        id="lesson-details"
        role="group"
        aria-label="Lesson details"
        hidden={!expanded}
      >
        <div className="lesson-popover-head">
          <span className="lesson-summary-label">Goal</span>
          <p className="lesson-goal-statement">{lesson.goal}</p>
          <button type="button" className="lesson-popover-close" aria-label="Close lesson" onClick={onToggleExpanded}>×</button>
        </div>
        {currentTask ? (
          <p className="lesson-popover-now">
            <span className="lesson-summary-label">Now</span>
            <span>{currentTask.text}</span>
          </p>
        ) : null}
        <div className="lesson-goal-grid">
          <section className="lesson-goal-col lesson-goal-col-goal">
            <h2 className="lesson-goal-col-label">Why it matters</h2>
            {lesson.why ? (
              <p className="lesson-goal-why">{lesson.why}</p>
            ) : (
              <p className="lesson-goal-why">
                This lesson builds the next skill in the current track.
              </p>
            )}
            {lesson.bookChapter ? (
              <p className="lesson-goal-book">
                Taught in the study book:{' '}
                <a
                  className="lesson-goal-book-link"
                  href={`${typeof import.meta !== 'undefined' && import.meta.env?.VITE_STUDY_BOOK_URL ? import.meta.env.VITE_STUDY_BOOK_URL : 'http://127.0.0.1:8765'}/index.html#${lesson.bookChapter}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {lesson.bookChapter} tape →
                </a>
              </p>
            ) : null}
            {lesson.difficulty === 'genai' ? (
              <p className="lesson-goal-book">
                <a
                  className="lesson-goal-book-link"
                  href={`${import.meta.env.BASE_URL}labs/aws-genai.zip`}
                  download="python-genai-aws-lab.zip"
                >
                  Download local AWS lab
                </a>
                {' '}for real pytest, boto3, and LangChain. Start offline; live AWS calls are opt-in.
              </p>
            ) : null}
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
                {view.tasks.map((task, index) => (
                  <li
                    key={task.text}
                    className={`lesson-task${
                      task.status === 'done' ? ' is-done' : ''
                    }${index === currentTaskIndex ? ' is-current' : ''}`}
                  >
                    <span className="lesson-task-mark" aria-hidden="true">
                      {task.status === 'done' ? '✓' : '○'}
                    </span>
                    <span className="lesson-task-copy">
                      <span className="sr-only">
                        {task.status === 'done'
                          ? 'Completed: '
                          : index === currentTaskIndex
                            ? 'Current task: '
                            : 'Upcoming task: '}
                      </span>
                      <span className="lesson-task-text">{task.text}</span>
                      {task.status !== 'done' && task.instruction ? (
                        <span className="lesson-task-instruction">
                          <span className="lesson-task-instruction-label">
                            {index === currentTaskIndex ? 'How' : 'Then'}
                          </span>
                          <span>{task.instruction}</span>
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="lesson-goal-col lesson-goal-col-guide">
            <h2 className="lesson-goal-col-label">Guide</h2>
            <div className="lesson-goal-guide-body">
              {onRestart ? (
                <div className="lesson-recovery">
                  <button type="button" className="linkish" onClick={onRestart}>Restart exercise</button>
                  {canRestore && onRestore ? (
                    <button type="button" className="linkish" onClick={onRestore}>Restore previous draft</button>
                  ) : null}
                  {recoveryMessage ? <p role="status">{recoveryMessage}</p> : null}
                </div>
              ) : null}
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
                  <span>Goal met. Try the stretch or the next lesson.</span>
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
                      ? 'Main goal met. Try the stretch when you like'
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
        {children}
      </div>
    </div>
  )
}
