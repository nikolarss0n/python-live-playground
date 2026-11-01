import { useEffect, useRef, useState } from 'react'
import type { ExerciseCheck } from '../serviceExercise'
import type { ExecutionStatus } from '../execution/protocol'
import { getRefresherDay, REFRESHER_DAYS, refresherChecksFor } from './catalog'
import { isPracticeDayId, STUDY_STAGES, type PracticeDay, type PracticeDayId, type RefresherDay, type StudyStage } from './types'
import type { Mistake, Rubric, SaveStatus } from './sessionStore'
import type { useRefresherSession } from './useRefresherSession'
import './refresher.css'

type Session = ReturnType<typeof useRefresherSession>
type RefresherPanelProps = {
  day: RefresherDay
  session: Session
  checks: readonly ExerciseCheck[]
  checksFresh: boolean
  executionStatus: ExecutionStatus
  onRun: () => void
}

const STAGE_LABELS: Record<StudyStage, string> = {
  recall: 'Recall', explain: 'Explain', guided: 'Guided', independent: 'Independent', review: 'Review',
}
const PRACTICE_BUDGET: Record<StudyStage, number> = { recall: 10, explain: 15, guided: 20, independent: 20, review: 10 }
const LIGHT_BUDGET: Record<StudyStage, number> = { recall: 5, explain: 5, guided: 5, independent: 30, review: 15 }
const PRACTICE_DAYS = REFRESHER_DAYS.filter((day): day is PracticeDay => day.kind === 'practice')

function storageMessage(status: SaveStatus): string | null {
  if (status === 'saved') return null
  if (status === 'unavailable') return 'Browser storage is unavailable. Changes may only last for this session; copy your work before leaving.'
  if (status === 'history-full') return 'Local history is full. Existing drafts and backups were kept; this action could not add another entry.'
  return 'This change exceeds local storage limits. Existing saved work was kept; copy your current text before leaving.'
}

function timeLabel(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function CheckResults({ day, session, checks, checksFresh, executionStatus }: Omit<RefresherPanelProps, 'onRun'>) {
  const definitions = refresherChecksFor(day.id, session.context)
  return <div className="refresher-checks" aria-label="Exercise checks">
    {executionStatus === 'error' || executionStatus === 'timeout'
      ? <p className="refresher-notice">The run could not finish. Read the execution error in Results, then check your submitted code again.</p>
      : null}
    <ul>
      {definitions.map((definition) => {
        const matches = checksFresh ? checks.filter((check) => check.id === definition.id) : []
        const check = matches.length === 1 ? matches[0] : undefined
        return <li key={definition.id}>
          <span className={check?.passed ? 'refresher-check-state is-passed' : 'refresher-check-state'}>
            {check ? check.passed ? 'Passed' : 'Needs work' : 'Not checked'}
          </span>
          <span>{definition.label}{check && !check.passed ? <small>{check.detail}</small> : null}</span>
        </li>
      })}
    </ul>
  </div>
}

function SavedNote({ label, value, save, rows = 2 }: {
  label: string; value: string; save: (value: string) => boolean; rows?: number
}) {
  const [text, setText] = useState(value)
  const [failed, setFailed] = useState(false)
  useEffect(() => { setText(value) }, [value])
  const persist = () => { setFailed(!save(text)) }
  return <div className="refresher-note">
    <label>{label}<textarea aria-label={label} rows={rows} value={text} onChange={(event) => {
      setText(event.target.value); setFailed(!save(event.target.value))
    }} onBlur={persist} /></label>
    <button type="button" className="btn btn-ghost" onClick={persist}>Save note</button>
    {failed ? <p role="alert" className="refresher-notice">The note could not be saved. Keep a copy of your text.</p> : null}
  </div>
}

function MistakeLog({ day, session }: Pick<RefresherPanelProps, 'day' | 'session'>) {
  const [editing, setEditing] = useState<Mistake | null>(null)
  const [error, setError] = useState('')
  const [cause, setCause] = useState('')
  const [pattern, setPattern] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const reset = () => { setEditing(null); setError(''); setCause(''); setPattern(''); setMessage(null) }
  const edit = (entry: Mistake) => {
    setEditing(entry); setError(entry.error); setCause(entry.cause); setPattern(entry.correctPattern); setMessage(null)
  }
  return <details className="refresher-detail">
    <summary>Mistake log ({session.mistakes.filter((entry) => !entry.resolved).length} open)</summary>
    <form onSubmit={(event) => {
      event.preventDefault()
      if (![error, cause, pattern].every((value) => value.trim())) { setMessage('Record the error, its cause, and the correct pattern.'); return }
      const values = { error, cause, correctPattern: pattern }
      const saved = editing ? session.editMistake(editing.id, values) : session.addMistake({ dayId: day.id, ...values })
      if (saved) reset()
      else setMessage('The mistake could not be saved. Your text is still in the form.')
    }}>
      <div className="refresher-field-grid">
        <label>Error<textarea aria-label="Error" required maxLength={2000} rows={2} value={error} onChange={(event) => setError(event.target.value)} /></label>
        <label>Cause<textarea aria-label="Cause" required maxLength={2000} rows={2} value={cause} onChange={(event) => setCause(event.target.value)} /></label>
        <label>Correct pattern<textarea aria-label="Correct pattern" required maxLength={2000} rows={2} value={pattern} onChange={(event) => setPattern(event.target.value)} /></label>
      </div>
      <div className="refresher-actions">
        <button type="submit" className="btn btn-ghost">{editing ? 'Save mistake changes' : 'Save mistake'}</button>
        {editing ? <button type="button" className="btn btn-ghost" onClick={reset}>Cancel edit</button> : null}
      </div>
      {message ? <p role="alert" className="refresher-notice">{message}</p> : null}
    </form>
    {session.mistakes.length === 0 ? <p className="refresher-muted">No mistakes recorded yet. Keep the cause and correction concrete.</p> : <ul className="refresher-mistakes">
      {session.mistakes.map((entry) => <li key={entry.id}>
        <p><strong>Day {Number(entry.dayId.slice(-2))}: {entry.error}</strong>{entry.resolved ? ' · Resolved' : ''}</p>
        <p><span className="refresher-muted">Cause:</span> {entry.cause}</p>
        <p><span className="refresher-muted">Correct pattern:</span> <code>{entry.correctPattern}</code></p>
        <div className="refresher-actions">
          <button type="button" className="btn btn-ghost" onClick={() => edit(entry)} aria-label={`Edit mistake: ${entry.error}`}>Edit</button>
          <button type="button" className="btn btn-ghost" onClick={() => {
            if (!session.resolveMistake(entry.id, !entry.resolved)) setMessage('The mistake status could not be changed.')
          }}>{entry.resolved ? 'Reopen' : 'Mark resolved'}</button>
        </div>
      </li>)}
    </ul>}
  </details>
}

function ConsolidationChoices({ session }: Pick<RefresherPanelProps, 'session'>) {
  const [pair, setPair] = useState<readonly [PracticeDayId, PracticeDayId]>(session.selectedDays)
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => { setPair(session.selectedDays) }, [session.selectedDays])
  return <details className="refresher-detail" open={session.stage === 'recall'}>
    <summary>Two functions to revisit</summary>
    <p>Suggested from your mistake history. Choose two different functions; existing drafts for each pair stay available.</p>
    <form onSubmit={(event) => {
      event.preventDefault()
      setMessage(session.selectDays(pair) ? null : 'Choose two different practice days. If saving failed, the previous pair and its drafts were kept.')
    }}>
      <div className="refresher-field-grid">
        {[0, 1].map((position) => <label key={position}>Function {position + 1}
          <select aria-label={`Function ${position + 1}`} value={pair[position]} onChange={(event) => {
            const id = event.target.value
            if (isPracticeDayId(id)) setPair(position === 0 ? [id, pair[1]] : [pair[0], id])
          }}>
            {PRACTICE_DAYS.map((entry) => <option key={entry.id} value={entry.id}>Day {entry.day}: {entry.consolidation.functionName}</option>)}
          </select>
        </label>)}
      </div>
      <button type="submit" className="btn btn-ghost" disabled={pair[0] === pair[1]}>Use these two exercises</button>
      {pair[0] === pair[1] ? <p className="refresher-notice">Choose two different days.</p> : null}
      {message ? <p role="alert" className="refresher-notice">{message}</p> : null}
    </form>
    {session.mistakes.some((entry) => !entry.resolved) ? <div>
      <p className="refresher-muted">Unresolved mistakes</p>
      <ul>{session.mistakes.filter((entry) => !entry.resolved).map((entry) => <li key={entry.id}>Day {Number(entry.dayId.slice(-2))}: {entry.error}</li>)}</ul>
    </div> : <p className="refresher-muted">No unresolved mistakes. Choose the functions you found least fluent.</p>}
  </details>
}

function RubricReview({ session }: Pick<RefresherPanelProps, 'session'>) {
  const fields: { key: Exclude<keyof Rubric, 'notes'>; label: string }[] = [
    { key: 'readability', label: 'Readability: names, small functions, and clear flow' },
    { key: 'edgeCases', label: 'Edge cases: empty, malformed, and boundary inputs' },
    { key: 'debugging', label: 'Debugging: isolate a failure and test the correction' },
    { key: 'communication', label: 'Communication: explain assumptions and trade-offs' },
  ]
  const [failed, setFailed] = useState(false)
  return <fieldset className="refresher-rubric">
    <legend>Review your approach</legend>
    <p className="refresher-muted">Mark each area after reviewing evidence. These are self-review acknowledgements, not automated quality scores.</p>
    {fields.map((field) => <label className="refresher-checkbox" key={field.key}>
      <input type="checkbox" checked={session.rubric?.[field.key] ?? false} onChange={(event) => {
        setFailed(!session.setRubric({ [field.key]: event.target.checked }))
      }} />{field.label}
    </label>)}
    <SavedNote label="Evidence for this review" value={session.rubric?.notes ?? ''} save={(notes) => session.setRubric({ notes })} />
    {failed ? <p role="alert" className="refresher-notice">The review acknowledgement could not be saved.</p> : null}
  </fieldset>
}

function PracticeStage(props: RefresherPanelProps) {
  const { day, session, onRun } = props
  const stage = session.stage
  const [note, setNote] = useState(session.notes[stage])
  const [acknowledged, setAcknowledged] = useState(session.completedStages[stage])
  const [message, setMessage] = useState<string | null>(null)
  const storedNote = session.notes[stage]
  useEffect(() => { setNote(storedNote) }, [storedNote])
  const saveNote = () => {
    const saved = session.setNote(note, stage)
    if (!saved) setMessage('The note could not be saved. Keep a copy before changing stages.')
    return saved
  }
  const planning = day.kind === 'consolidation' && stage === 'guided'
  const coding = (stage === 'guided' || stage === 'independent') && !planning
  const reviewedRubric = day.kind !== 'mock' || Boolean(session.rubric?.readability && session.rubric.edgeCases && session.rubric.debugging && session.rubric.communication)
  const ready = coding ? session.completedStages[stage]
    : stage === 'explain' ? acknowledged
      : stage === 'review' ? acknowledged && Boolean(note.trim()) && reviewedRubric
        : Boolean(note.trim())
  const advance = () => {
    if (!ready || !saveNote()) return
    if (!coding && !session.completeStage(stage)) { setMessage('This stage could not be marked complete. Check the note and local storage status.'); return }
    const next = STUDY_STAGES[STUDY_STAGES.indexOf(stage) + 1]
    if (next && !session.changeStage(next)) setMessage('The next stage is not available yet. Your current work was kept.')
  }
  const contracts = day.kind === 'consolidation'
    ? session.selectedDays.map((id) => getRefresherDay(id)).filter((entry): entry is RefresherDay => entry !== null)
    : [day]
  return <div className="refresher-stage-body">
    {stage === 'recall' ? <p>{day.recall}</p> : null}
    {planning ? <>
      <p>Plan the two selected functions before rebuilding them once in Independent. Note the inputs, outputs, and one edge case for each.</p>
      <p>Check the environment: edit and run a small example, confirm Stop works, and locate the source line in a traceback. If the interview uses local Python, check the agreed interpreter and test command.</p>
      <p className="refresher-muted">Keep this final session light: 5 min recall, 5 min contracts, 5 min planning/environment, 30 min rebuilding, and 15 min testing/review.</p>
    </> : null}
    {stage === 'explain' ? <>
      <p>The editor contains a worked example. Run it, then explain the syntax before continuing. Open the syntax hints above the code when you need them.</p>
      <button type="button" className="btn btn-ghost" onClick={onRun}>Run worked example</button>
    </> : null}
    {coding ? <>
      {stage === 'independent' ? <p className="refresher-muted">Write from memory. This draft is separate from Guided. Return to that stage explicitly if you need the walkthrough.</p> : null}
      {contracts.map((entry) => <div key={entry.id}>
        {day.kind === 'consolidation' && entry.kind === 'practice' ? <h3>Day {entry.day}: {entry.consolidation.functionName}</h3> : null}
        <p>{day.kind === 'consolidation' && entry.kind === 'practice' ? entry.consolidation.problem : entry.problem}</p>
        <ul>{(day.kind === 'consolidation' && entry.kind === 'practice' ? entry.consolidation.checks.map((check) => check.label) : entry.acceptance).map((item) => <li key={item}>{item}</li>)}</ul>
      </div>)}
      {stage === 'guided' && day.kind === 'practice' && day.hints.length ? <details className="refresher-detail" open={day.support === 'worked'}>
        <summary>{day.support === 'worked' ? 'Walkthrough guidance' : day.support === 'partial' ? 'Show a hint' : 'Show one hint after trying'}</summary>
        {(day.support === 'worked' ? day.hints : day.hints.slice(0, 1)).map((hint) => <p key={hint}>{hint}</p>)}
      </details> : null}
      <CheckResults {...props} />
      <button type="button" className="btn btn-ghost" onClick={onRun}>Run checks</button>
    </> : null}
    {stage === 'review' ? <>
      <CheckResults {...props} />
      <ul>{day.reviewPrompts.map((prompt) => <li key={prompt}>{prompt}</li>)}</ul>
      {day.kind === 'mock' ? <RubricReview session={session} /> : null}
    </> : null}
    <label className="refresher-note-label">
      {stage === 'recall' ? 'Recall note' : stage === 'review' ? 'Reflection' : 'Working note'}
      <textarea aria-label={stage === 'recall' ? 'Recall note' : stage === 'review' ? 'Reflection' : 'Working note'} rows={2} value={note} onChange={(event) => {
        setNote(event.target.value)
        if (!session.setNote(event.target.value, stage)) setMessage('The note could not be saved. Keep a copy before leaving.')
      }} onBlur={saveNote} />
    </label>
    {stage === 'explain' || stage === 'review' ? <label className="refresher-checkbox">
      <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
      {stage === 'explain' ? 'I can explain the examples in my own words' : 'I reviewed my mistakes and recorded a correction'}
    </label> : null}
    <div className="refresher-actions">
      <button type="button" className="btn btn-ghost" onClick={saveNote}>Save note</button>
      <button type="button" className="btn btn-primary" disabled={!ready} onClick={advance}>
        {stage === 'review' ? session.completedStages.review ? 'Review complete' : 'Mark review complete' : 'Continue'}
      </button>
      {coding && !ready ? <span className="refresher-muted">Pass the current checks to continue, or choose another stage to review your attempt.</span> : null}
    </div>
    {message ? <p role="alert" className="refresher-notice">{message}</p> : null}
    {stage !== 'independent' && (day.kind !== 'mock' || stage === 'review') ? <MistakeLog day={day} session={session} /> : null}
    {(stage === 'explain' || stage === 'review') && day.kind !== 'mock' ? <p className="refresher-resources">
      {day.resources.map((resource) => <a key={resource.url} href={resource.url} target="_blank" rel="noreferrer">{resource.label}</a>)}
      {[7, 8, 14].includes(day.day) ? <a href={`${import.meta.env.BASE_URL}labs/python-refresher.zip`} download="python-refresher.zip">Download local Python practice</a> : null}
    </p> : null}
  </div>
}

function MockContent(props: RefresherPanelProps) {
  const { day, session, checksFresh, executionStatus, onRun } = props
  const [message, setMessage] = useState<string | null>(null)
  if (day.kind !== 'mock') return null
  const attempt = session.mock
  const anotherMock = session.hasRunningMock && session.runningMockDayId !== day.id
  const start = () => { setMessage(session.startMock() ? null : anotherMock
    ? `Day ${Number(session.runningMockDayId?.slice(-2))} has a running mock. Return to that day and finish it first.`
    : 'The mock could not start safely. Check local storage; no new attempt was started.') }
  if (!attempt) return <div className="refresher-stage-body">
    <p>{day.problem}</p>
    <p>The real interview format is still unconfirmed. This is a 60-minute practice attempt without AI assistance.</p>
    <p className="refresher-muted">5 min clarify · 5 min plan · 30 min implement · 15 min test/debug · 5 min explain</p>
    {anotherMock ? <p className="refresher-notice">Day {Number(session.runningMockDayId?.slice(-2))} has a running mock. Return to that day and finish it before starting another.</p> : null}
    <button type="button" className="btn btn-primary" onClick={start} disabled={anotherMock}>Start 60-minute mock</button>
    {message ? <p role="alert" className="refresher-notice">{message}</p> : null}
  </div>
  const variant = day.variants.find((entry) => entry.id === attempt.variantId)
  if (!variant) return <p role="alert">The saved problem variant is unavailable. Your stored attempt has been kept.</p>
  if (session.stage === 'review' && !attempt.active) return <>
    <PracticeStage key={session.contextKey} {...props} />
    <button type="button" className="btn btn-ghost" onClick={start}>{attempt.retake ? 'Start another retake' : 'Start another attempt'}</button>
    {message ? <p role="alert" className="refresher-notice">{message}</p> : null}
  </>
  const canReview = !attempt.active && (checksFresh || executionStatus === 'error' || executionStatus === 'timeout')
  return <div className="refresher-stage-body">
    <h3>{variant.title}</h3>
    <p>{variant.prompt}</p><ul>{variant.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul>
    {attempt.followUp && variant.followUp ? <section className="refresher-follow-up" aria-label="Requirement change">
      <h3>Minute 30: requirement change</h3><p>{variant.followUp.prompt}</p>
      <ul>{variant.followUp.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul>
    </section> : null}
    {attempt.active ? <>
      <p className="refresher-muted">Current phase: {attempt.phase}. Use your own notes and tests; automated exercise checks are shown after submission.</p>
      <SavedNote label="Interview working notes" value={session.notes.independent} save={(note) => session.setNote(note, 'independent')} />
      <div className="refresher-actions">
        <button type="button" className="btn btn-ghost" onClick={onRun}>Run code</button>
        <button type="button" className="btn btn-primary" onClick={() => {
          setMessage(session.finishMock() ? null : 'The attempt could not be submitted. Keep a copy of your code and check local storage.')
        }}>Submit attempt</button>
      </div>
    </> : <>
      <p>Submitted code is frozen for this attempt.</p>
      {day.day === 13 && !attempt.followUp ? <p className="refresher-notice">Partial attempt: submitted before the minute-30 requirement change. Review it as practice; it cannot complete the full mock.</p> : null}
      <CheckResults {...props} />
      <div className="refresher-actions">
        <button type="button" className="btn btn-ghost" onClick={onRun}>Check submitted code</button>
        <button type="button" className="btn btn-primary" disabled={!canReview} onClick={() => {
          if (!session.changeStage('review')) setMessage('The review could not be opened. Your submission was kept.')
        }}>Review attempt</button>
      </div>
    </>}
    {message ? <p role="alert" className="refresher-notice">{message}</p> : null}
  </div>
}

function SessionPanel(props: RefresherPanelProps) {
  const { day, session } = props
  const [expanded, setExpanded] = useState(session.stage === 'recall' || day.kind === 'mock')
  const panelRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!expanded) return
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target)) setExpanded(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [expanded])
  const [message, setMessage] = useState<string | null>(null)
  const budget = day.kind === 'consolidation' ? LIGHT_BUDGET : PRACTICE_BUDGET
  const completed = STUDY_STAGES.filter((stage) => session.completedStages[stage]).length
  const storageWarning = storageMessage(session.saveStatus)
  const changeStage = (stage: StudyStage) => {
    if (session.changeStage(stage)) { setExpanded(true); setMessage(null) }
    else setMessage('This stage is not available during the current attempt.')
  }
  return <section className="refresher-panel" aria-label="Daily practice" ref={panelRef}>
    <div className="refresher-summary">
      {day.kind === 'mock' && session.mock ? <output className="refresher-clock" aria-label={session.mock.active ? 'Mock time remaining' : 'Mock time used'}>
        {timeLabel(session.mock.active ? session.mock.remainingMs : session.mock.elapsedMs)}
      </output> : null}
      {day.kind !== 'mock' ? <nav className="refresher-stages" aria-label="Session stages">
        {STUDY_STAGES.map((stage) => <button type="button" key={stage} aria-current={session.stage === stage ? 'step' : undefined}
          onClick={() => changeStage(stage)} aria-label={`${STAGE_LABELS[stage]}${session.completedStages[stage] ? ', complete' : ''}`}>
          {session.completedStages[stage] ? <span className="refresher-stage-done" aria-hidden="true">✓</span> : null}
          {STAGE_LABELS[stage]}<span>{budget[stage]}m</span>
        </button>)}
      </nav> : null}
      <button type="button" className="btn btn-ghost refresher-toggle" aria-expanded={expanded} aria-controls="refresher-session-content" onClick={() => setExpanded((value) => !value)}>
        Task<span aria-hidden="true">{expanded ? ' ↑' : ' ↓'}</span>
      </button>
    </div>
    {storageWarning ? <p role="status" className="refresher-notice refresher-storage">{storageWarning}</p> : null}
    {session.loadStatus === 'invalid' ? <p role="status" className="refresher-notice refresher-storage">Saved refresher data could not be read. This session starts with fresh drafts.</p> : null}
    {message ? <p role="alert" className="refresher-notice refresher-storage">{message}</p> : null}
    <div id="refresher-session-content" className="refresher-content" role="region" aria-labelledby="refresher-card-title" hidden={!expanded}>
      <header className="refresher-card-head">
        <div>
          <strong id="refresher-card-title">Day {day.day} · {day.title}</strong>
          <span className="refresher-muted">
            {day.kind === 'mock'
              ? session.mock ? `${session.mock.active ? session.mock.phase : 'Submitted'} · ${session.mock.retake ? 'Seen variant: practice retake' : 'Unseen on first start'}` : '60-minute mock · problem hidden until start'
              : `${STAGE_LABELS[session.stage]} · ${day.minutes} min day · ${completed}/5 stages done`}
          </span>
        </div>
        <button type="button" className="refresher-card-close" aria-label="Close task" onClick={() => setExpanded(false)}>×</button>
      </header>
      {day.kind === 'consolidation' ? <ConsolidationChoices session={session} /> : null}
      {day.kind === 'mock' ? <MockContent key={session.mock?.startedAt ?? 'not-started'} {...props} />
        : <PracticeStage key={session.contextKey} {...props} />}
      {day.kind !== 'mock' ? <div className="refresher-reset">
        <button type="button" className="btn btn-ghost" onClick={() => {
          setMessage(session.restart() ? null : 'Restart was not saved safely. Your current draft was kept.')
        }}>Restart current stage</button>
        <button type="button" className="btn btn-ghost" disabled={!session.canRestore} onClick={() => {
          setMessage(session.restore() ? null : 'The backup could not be restored safely. Your current draft was kept.')
        }}>Restore previous draft</button>
        <span className="refresher-muted">Restart keeps a recoverable local backup.</span>
      </div> : null}
    </div>
  </section>
}

export function RefresherPanel(props: RefresherPanelProps) {
  return <SessionPanel key={props.day.id} {...props} />
}
