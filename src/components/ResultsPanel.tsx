import { type MouseEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import type { ExecutionStatus, ResultEvent } from '../execution/protocol'
import { cleanErrorDetail, explainError } from '../execution/errorExplain'
import { loopSlots, type LoopSlot } from './loopSlots'
import { isCollectionRoot } from '../execution/collectionStructure'
import { inferTypeLabel } from '../valueType'
import {
  computeStackedTops,
  stackOptionsForMode,
  type AlignMode,
} from './resultAlignment'
import { CollectionTree } from './CollectionTree'
import { looksLikeTokenList, TokenChips } from './TokenChips'
import { HttpResponseCard } from './HttpResponseCard'
import {
  httpResponseFromHttpEvent,
  httpResponseFromStructure,
  httpResponseFromText,
} from '../httpResponse'
import type { CoachUiMessage } from '../lessonCoach'
import { ErrorHelp, type ErrorHelpContext } from './ErrorHelp'
import { GoalChecks } from './GoalChecks'
import type { GoalChecks as GoalChecksView } from '../jev/useJevGoalCheck'

type ResultsPanelProps = {
  events: ResultEvent[]
  status: ExecutionStatus
  durationMs: number | null
  activeIndex?: number | null
  onHoverResult?: (index: number | null) => void
  /** Notify parent when layout changes (error expand, step scrub). */
  onGeometryChange?: () => void
  /** First-run coaching until the learner has seen success once. */
  showCoaching?: boolean
  /** Replaces the empty-state text, e.g. while an untouched starter waits for its blanks. */
  placeholder?: string
  /** Align rows beside source lines. */
  editorView?: EditorView | null
  geometryKey?: number
  /** full = desktop side-by-side; soft = narrow stacked caps; off = natural flow */
  alignMode?: AlignMode
  /** Previous run — faded ghost + baseline for “updated” marks. */
  previousEvents?: ResultEvent[] | null
  /** Indices that differ from the previous run. */
  updatedIndices?: ReadonlySet<number>
  /** Show previous-run ghost layer. */
  showPrevious?: boolean
  onTogglePrevious?: () => void
  /** Quiet lesson coach trail — print-like lines under results. */
  coachMessages?: readonly CoachUiMessage[]
  coachBusy?: boolean
  coachConfigured?: boolean
  onCoachAsk?: (text: string) => void
  onOpenSettings?: () => void
  /** Python basics: whether the current task advanced, citing this run. */
  taskEvidence?: string | null
  /** Per-task and goal checks for the latest clean run; replaces the evidence line. */
  goalChecks?: GoalChecksView | null
  errorHelp?: ErrorHelpContext
}

function eventContent(event: ResultEvent): string {
  switch (event.kind) {
    case 'print':
    case 'warning':
      return event.text
    case 'expr':
      return event.value
    case 'error':
      return event.message
    case 'http':
      return `${event.method}:${event.path}:${event.status}:${event.body}`
  }
}

/** Keys from content and occurrence, not position, so rows that did not change keep their DOM across re-runs. */
function stableRowKeys(events: readonly ResultEvent[]): string[] {
  const seen = new Map<string, number>()
  return events.map((event) => {
    const base = `${event.kind}|${eventContent(event)}`
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return `${base}|${count}`
  })
}

/** Only surface states that need attention — skip success/ready noise. */
function statusLabel(status: ExecutionStatus): string | null {
  switch (status) {
    case 'booting':
      return 'Loading Python…'
    case 'running':
      return 'Running…'
    case 'error':
      return 'Error'
    case 'timeout':
      return 'Timed out'
    case 'stopped':
      return 'Stopped'
    default:
      return null
  }
}

function TypeChip({ label }: { label: string }) {
  return (
    <span className="result-type-chip" title={`Python type: ${label}`}>
      {label}
    </span>
  )
}

function PlainValue({
  text,
  tone,
}: {
  text: string
  tone: 'print' | 'expr' | 'warning'
}) {
  const typeLabel = tone === 'warning' ? null : inferTypeLabel(text)
  return (
    <div className="result-value-wrap">
      <pre className="result-text">{text}</pre>
      {typeLabel ? <TypeChip label={typeLabel} /> : null}
    </div>
  )
}

function EventRow({
  event,
  index,
  active,
  onHover,
  onLayout,
  dimmed,
  updated,
  ghost,
  errorHelp,
  loop,
  focused,
  onToggleFocus,
}: {
  event: ResultEvent
  index: number
  active: boolean
  onHover?: (index: number | null) => void
  onLayout?: () => void
  dimmed?: boolean
  updated?: boolean
  ghost?: boolean
  errorHelp?: ErrorHelpContext
  loop?: LoopSlot | null
  focused?: boolean
  onToggleFocus?: () => void
}) {
  const [showTrace, setShowTrace] = useState(false)
  const [showExample, setShowExample] = useState(false)
  // Collapsed by default — tip is always visible; explanation is opt-in.
  const [showExplain, setShowExplain] = useState(false)
  const linked = !ghost && event.line != null && event.line > 0
  const className = [
    'result-row',
    `result-${event.kind === 'error' ? 'error' : event.kind}`,
    linked ? 'is-linked' : '',
    active ? 'is-active' : '',
    dimmed ? 'is-dimmed' : '',
    updated ? 'is-updated' : '',
    ghost ? 'is-ghost' : '',
    loop ? 'in-loop' : '',
    loop?.iteration === 1 ? 'loop-first' : '',
    loop && loop.iteration === loop.total ? 'loop-last' : '',
    focused ? 'is-focused' : '',
  ]
    .filter(Boolean)
    .join(' ')

  useEffect(() => {
    if (!ghost) onLayout?.()
  }, [showExplain, showTrace, showExample, onLayout, ghost])

  const hoverProps = {
    ...(linked && onHover
      ? {
          onMouseEnter: () => onHover(index),
          onMouseLeave: () => onHover(null),
        }
      : {}),
    ...(onToggleFocus
      ? {
          onClick: (event: MouseEvent) => {
            if ((event.target as HTMLElement).closest('button, a, summary, input, select, textarea')) return
            onToggleFocus()
          },
        }
      : {}),
  }

  const lineSpan = loop ? (
    <>
      <span className="result-line" aria-hidden="true">
        {loop.iteration === 1 ? (
          <span className="loop-head">
            <span className="loop-head-line">{loop.line}</span>
            <span className="loop-badge">
              <LoopIcon />
              loop · {loop.total}×
            </span>
          </span>
        ) : null}
      </span>
      <span className="loop-iteration">
        <button
          type="button"
          className="loop-iteration-num"
          aria-pressed={focused ?? false}
          aria-label={`Focus loop round ${loop.iteration} of ${loop.total} from line ${loop.line}`}
          title={focused ? 'Show all rounds' : 'Show only this round'}
          onClick={onToggleFocus}
        >
          {loop.iteration}
        </button>
      </span>
    </>
  ) : (
    <span className="result-line" aria-hidden="true">
      {event.line ?? ''}
    </span>
  )

  if (event.kind === 'print') {
    const http =
      httpResponseFromStructure(event.structure) ??
      httpResponseFromText(event.text)
    return (
      <div
        className={className}
        data-result-index={ghost ? undefined : index}
        data-source-line={http ? undefined : event.line ?? undefined}
        {...hoverProps}
      >
        {lineSpan}
        {http ? (
          <div className="result-collection">
            <HttpResponseCard view={http} />
          </div>
        ) : isCollectionRoot(event.structure) ? (
          <div className="result-collection">
            {looksLikeTokenList(event.structure) ? (
              <TokenChips node={event.structure} tone="print" />
            ) : null}
            <CollectionTree node={event.structure} tone="print" />
          </div>
        ) : (
          <PlainValue text={event.text} tone="print" />
        )}
      </div>
    )
  }

  if (event.kind === 'expr') {
    const http =
      httpResponseFromStructure(event.structure) ??
      httpResponseFromText(event.value)
    return (
      <div
        className={className}
        data-result-index={ghost ? undefined : index}
        data-source-line={http ? undefined : event.line}
        {...hoverProps}
      >
        {lineSpan}
        {http ? (
          <div className="result-collection">
            <HttpResponseCard view={http} />
          </div>
        ) : isCollectionRoot(event.structure) ? (
          <div className="result-collection">
            {looksLikeTokenList(event.structure) ? (
              <TokenChips node={event.structure} tone="expr" />
            ) : null}
            <CollectionTree node={event.structure} tone="expr" />
          </div>
        ) : (
          <PlainValue text={event.value} tone="expr" />
        )}
      </div>
    )
  }

  if (event.kind === 'http') {
    const http = httpResponseFromHttpEvent(event)
    return (
      <div
        className={className}
        data-result-index={ghost ? undefined : index}
      >
        {lineSpan}
        <HttpResponseCard view={http} />
      </div>
    )
  }

  if (event.kind === 'warning') {
    return (
      <div
        className={className}
        data-result-index={ghost ? undefined : index}
        data-source-line={event.line ?? undefined}
        {...hoverProps}
      >
        {lineSpan}
        <PlainValue text={event.text} tone="warning" />
      </div>
    )
  }

  const explanation = event.explanation ?? explainError(event.message)
  const displayDetail = cleanErrorDetail(
    explanation.detail || event.message || explanation.name,
  )
  const rawMessage =
    event.message || `${explanation.name}: ${explanation.detail}`

  if (ghost) {
    return (
      <div className={className}>
        {lineSpan}
        <pre className="result-text">{rawMessage}</pre>
      </div>
    )
  }

  return (
    <div
      className={`${className} result-error-card`}
      data-result-index={index}
      data-source-line={event.line ?? undefined}
      {...hoverProps}
    >
      {lineSpan}
      <div className="result-error-body">
        <div
          className={`error-card${showExplain ? ' is-expanded' : ''}${showTrace ? ' is-trace-open' : ''}`}
          role="group"
          aria-label={`${explanation.name} error`}
        >
          <div className="error-card-header">
            <span className="error-card-type">{explanation.name}</span>
            {event.line != null && (
              <span className="error-card-line">Line {event.line}</span>
            )}
          </div>

          <p className="error-card-detail error-card-raw" data-error-anchor>
            {displayDetail}
          </p>

          <div className="error-card-tip">
            <span className="error-card-tip-label">What to fix</span>
            <p className="error-card-tip-text">{explanation.tip}</p>
          </div>

          <div className="error-card-actions">
            <button
              type="button"
              className="btn-explain"
              onClick={() => setShowExplain((v) => !v)}
              aria-expanded={showExplain}
            >
              {showExplain ? 'Hide explanation' : 'What does this mean?'}
            </button>
            {event.traceback && (
              <button
                type="button"
                className="linkish error-card-trace-btn"
                onClick={() => setShowTrace((v) => !v)}
                aria-expanded={showTrace}
              >
                {showTrace ? 'Hide traceback' : 'Traceback'}
              </button>
            )}
          </div>

          {errorHelp ? <ErrorHelp key={`${errorHelp.contextId}/${errorHelp.fresh}/${errorHelp.allowed}`} error={event} context={errorHelp} /> : null}

          {showExplain && (
            <div className="error-card-explain">
              <p className="error-card-plain-title">{explanation.title}</p>
              <p className="error-card-summary">{explanation.summary}</p>

              {explanation.example && (
                <div className="error-card-example-wrap">
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => setShowExample((v) => !v)}
                    aria-expanded={showExample}
                  >
                    {showExample ? 'Hide example' : 'Show a fixed example'}
                  </button>
                  {showExample && (
                    <pre className="error-card-example">
                      {explanation.example}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          {showTrace && event.traceback && (
            <pre className="result-text result-traceback">{event.traceback}</pre>
          )}
        </div>
      </div>
    </div>
  )
}



function isHttpShaped(event: ResultEvent): boolean {
  if (event.kind === 'http') return true
  if (event.kind === 'print') {
    return Boolean(
      httpResponseFromStructure(event.structure) ??
        httpResponseFromText(event.text),
    )
  }
  if (event.kind === 'expr') {
    return Boolean(
      httpResponseFromStructure(event.structure) ??
        httpResponseFromText(event.value),
    )
  }
  return false
}

function LoopIcon() {
  return (
    <svg className="loop-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
      <path d="M3 7.5A4.5 4.5 0 0 1 11.6 5.6M13 8.5a4.5 4.5 0 0 1-8.6 1.9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11.9 2.6v3.2H8.7M4.1 13.4v-3.2h3.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ResultsPanel({
  events,
  status,
  durationMs,
  activeIndex = null,
  onHoverResult,
  onGeometryChange,
  showCoaching = false,
  placeholder,
  editorView = null,
  geometryKey = 0,
  alignMode = 'off',
  previousEvents = null,
  updatedIndices,
  showPrevious = false,
  onTogglePrevious,
  coachMessages = [],
  coachBusy = false,
  coachConfigured = false,
  onCoachAsk,
  onOpenSettings,
  taskEvidence = null,
  goalChecks = null,
  errorHelp,
}: ResultsPanelProps) {
  const [ask, setAsk] = useState('')
  const bodyRef = useRef<HTMLDivElement>(null)
  const empty =
    events.length === 0 &&
    (status === 'ready' || status === 'idle' || status === 'booting')

  const label = statusLabel(status)
  const showStatus = label != null
  const showDuration = durationMs != null && status !== 'booting'

  const [focusIndex, setFocusIndex] = useState<number | null>(null)

  useEffect(() => {
    setFocusIndex(null)
  }, [events])

  useEffect(() => {
    const body = bodyRef.current
    if (!body || !onGeometryChange) return
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => onGeometryChange())
    ro.observe(body)
    return () => ro.disconnect()
  }, [onGeometryChange])

  useEffect(() => {
    if (!coachMessages.length && !coachBusy) return
    const body = bodyRef.current
    if (!body) return
    body.scrollTop = body.scrollHeight
  }, [coachMessages, coachBusy])

  // Align each result row with the source line that produced it.
  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body) return

    const rows = () =>
      Array.from(body.querySelectorAll<HTMLElement>('[data-result-index]'))

    const stackOpts = stackOptionsForMode(alignMode)
    if (!stackOpts || !editorView) {
      for (const row of rows()) row.style.marginTop = ''
      return
    }

    // Side by side, the results body scrolls with the editor, so rows are placed where their line sits unscrolled.
    const scroller = alignMode === 'full' ? editorView.scrollDOM : null
    const applyAlignment = () => {
      const measured = rows()
      if (measured.length !== events.length) return
      for (const row of measured) row.style.marginTop = ''
      body.style.paddingBottom = ''
      const editorScroll = scroller?.scrollTop ?? 0

      const bodyRect = body.getBoundingClientRect()
      // A loop's badge sits just above its card, so the row before the card makes room for it.
      const badgeSpace = measured.map((row) => {
        const badge = row.querySelector('.loop-badge')
        return badge ? row.getBoundingClientRect().top - badge.getBoundingClientRect().top + 2 : 0
      })
      const targets = events.map((event, index) => {
        if (isHttpShaped(event)) return null
        if (event.line == null || event.line < 1) return null
        try {
          const line = editorView.state.doc.line(event.line)
          const coords = editorView.coordsAtPos(line.from)
          if (!coords) return null
          const top = coords.top + editorScroll - bodyRect.top + body.scrollTop
          return index === 0 ? Math.max(top, badgeSpace[0]) : top
        } catch {
          return null
        }
      })
      const naturalTops = measured.map(
        (row) =>
          row.getBoundingClientRect().top - bodyRect.top + body.scrollTop,
      )
      const heights = measured.map((row, i) => row.getBoundingClientRect().height + (badgeSpace[i + 1] ?? 0))
      const stacked = computeStackedTops(targets, heights, 2, stackOpts)
      measured.forEach((row, i) => {
        const naturalGap =
          i === 0 ? naturalTops[0] : naturalTops[i] - naturalTops[i - 1]
        const desiredGap = i === 0 ? stacked[0] : stacked[i] - stacked[i - 1]
        const margin = Math.max(0, desiredGap - naturalGap)
        const next = margin > 0.5 ? `${margin.toFixed(1)}px` : ''
        if (row.style.marginTop !== next) row.style.marginTop = next
      })
      if (scroller) {
        // Room to follow the editor all the way down, even when the last result sits above the last line.
        const last = body.lastElementChild?.getBoundingClientRect().bottom ?? bodyRect.top
        const contentBottom = last - bodyRect.top + body.scrollTop
        const basePadding = parseFloat(getComputedStyle(body).paddingBottom) || 0
        const shortBy = body.clientHeight + scroller.scrollHeight - scroller.clientHeight - contentBottom - basePadding
        if (shortBy > 0) body.style.paddingBottom = `${Math.ceil(basePadding + shortBy)}px`
        body.scrollTop = scroller.scrollTop
      }
    }

    const raf = requestAnimationFrame(applyAlignment)
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            requestAnimationFrame(applyAlignment)
          })
        : null
    ro?.observe(body)
    let following: 'editor' | 'results' | null = null
    const follow = (from: HTMLElement, to: HTMLElement, source: 'editor' | 'results') => () => {
      if (following && following !== source) return
      following = source
      if (Math.abs(to.scrollTop - from.scrollTop) >= 1) to.scrollTop = from.scrollTop
      requestAnimationFrame(() => { following = null })
    }
    const onEditorScroll = scroller ? follow(scroller, body, 'editor') : null
    const onResultsScroll = scroller ? follow(body, scroller, 'results') : null
    if (scroller && onEditorScroll && onResultsScroll) {
      scroller.addEventListener('scroll', onEditorScroll, { passive: true })
      body.addEventListener('scroll', onResultsScroll, { passive: true })
    }
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      if (scroller && onEditorScroll && onResultsScroll) {
        scroller.removeEventListener('scroll', onEditorScroll)
        body.removeEventListener('scroll', onResultsScroll)
      }
      body.style.paddingBottom = ''
    }
  }, [alignMode, editorView, events, geometryKey])

  const hasPrevious = (previousEvents?.length ?? 0) > 0
  const rowKeys = useMemo(() => stableRowKeys(events), [events])
  const loops = useMemo(() => loopSlots(events), [events])

  return (
    <section className="results-panel" aria-label="Results" aria-live="polite">
      <header className="pane-label results-head">
        <span>Results</span>
        <span className="results-status">
          {showStatus && (
            <>
              <span
                className={`status-dot status-${status}`}
                aria-hidden="true"
              />
              <span className={`status-label status-label-${status}`}>{label}</span>
            </>
          )}
          {showDuration && (
            <span className="status-meta">{durationMs} ms</span>
          )}
          {hasPrevious && onTogglePrevious && (
            <button
              type="button"
              className={`linkish results-prev-toggle${showPrevious ? ' is-on' : ''}`}
              onClick={onTogglePrevious}
              aria-pressed={showPrevious}
              title="Show previous run as a faint ghost"
            >
              {showPrevious ? 'Hide previous' : 'Previous'}
            </button>
          )}
        </span>
      </header>

      {goalChecks ? (
        <GoalChecks checks={goalChecks} />
      ) : taskEvidence ? (
        <p
          className={`results-task-evidence${
            /advanced/i.test(taskEvidence) ? ' is-advanced' : ''
          }`}
          role="status"
          aria-label="Task evidence"
        >
          {taskEvidence}
        </p>
      ) : null}

      <div
        className={`results-body${
          alignMode !== 'off' && editorView ? ' is-aligned' : ''
        }${alignMode === 'soft' ? ' is-align-soft' : ''}`}
        ref={bodyRef}
      >
        {empty && (
          <p className="results-placeholder">
            {status === 'booting'
              ? 'Starting the in-browser Python engine…'
              : placeholder ?? (showCoaching
                ? 'Edit a print — output appears here next to that line.'
                : 'Results will appear here as you write code.')}
          </p>
        )}

        {showPrevious &&
          previousEvents?.map((event, index) => (
            <EventRow
              key={`ghost-${event.kind}-${index}-${event.line ?? 0}`}
              event={event}
              index={index}
              active={false}
              ghost
            />
          ))}

        {events.map((event, index) => (
          <EventRow
            key={rowKeys[index]}
            event={event}
            index={index}
            active={activeIndex === index}
            onHover={onHoverResult}
            onLayout={onGeometryChange}
            dimmed={focusIndex != null && index !== focusIndex}
            updated={updatedIndices?.has(index)}
            errorHelp={errorHelp}
            loop={loops[index]}
            focused={focusIndex === index}
            onToggleFocus={loops[index] ? () => setFocusIndex((current) => (current === index ? null : index)) : undefined}
          />
        ))}

        {coachMessages.map((msg) => (
          <div
            key={msg.id}
            className={`coach-line coach-${msg.role}`}
            role={msg.role === 'note' ? 'status' : undefined}
          >
            <span className="coach-gutter" aria-hidden="true">
              {msg.role === 'user' ? '?' : msg.role === 'assistant' ? '›' : '·'}
            </span>
            <pre className="coach-text">{msg.text}</pre>
          </div>
        ))}

        {coachBusy ? (
          <div className="coach-line coach-note" role="status">
            <span className="coach-gutter" aria-hidden="true">
              ›
            </span>
            <pre className="coach-text">thinking…</pre>
          </div>
        ) : null}
      </div>

      {onCoachAsk ? (
        <form
          className="coach-ask"
          onSubmit={(e) => {
            e.preventDefault()
            const text = ask.trim()
            if (!text || coachBusy) return
            if (!coachConfigured) {
              onOpenSettings?.()
              return
            }
            onCoachAsk(text)
            setAsk('')
          }}
        >
          <label className="sr-only" htmlFor="lesson-coach-ask">
            Ask about this lesson
          </label>
          <input
            id="lesson-coach-ask"
            className="coach-ask-input"
            type="text"
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            placeholder={
              coachConfigured
                ? 'Ask about this lesson…'
                : 'Add API key in Settings to ask…'
            }
            disabled={coachBusy}
            autoComplete="off"
            enterKeyHint="send"
          />
        </form>
      ) : null}
    </section>
  )
}
