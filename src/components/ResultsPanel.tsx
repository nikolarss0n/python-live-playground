import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import type { ExecutionStatus, ResultEvent } from '../execution/protocol'
import { explainError } from '../execution/errorExplain'
import { isCollectionRoot } from '../execution/collectionStructure'
import { inferTypeLabel } from '../valueType'
import { computeStackedTops } from './resultAlignment'
import { CollectionTree } from './CollectionTree'

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
  /** Align rows beside source lines (wide layout). */
  editorView?: EditorView | null
  geometryKey?: number
  align?: boolean
  /** Previous run — faded ghost + baseline for “updated” marks. */
  previousEvents?: ResultEvent[] | null
  /** Indices that differ from the previous run. */
  updatedIndices?: ReadonlySet<number>
  /** Show previous-run ghost layer. */
  showPrevious?: boolean
  onTogglePrevious?: () => void
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
}: {
  event: ResultEvent
  index: number
  active: boolean
  onHover?: (index: number | null) => void
  onLayout?: () => void
  dimmed?: boolean
  updated?: boolean
  ghost?: boolean
}) {
  const [showTrace, setShowTrace] = useState(false)
  const [showExample, setShowExample] = useState(false)
  const [showExplain, setShowExplain] = useState(
    event.kind === 'error' && !ghost,
  )
  const linked = !ghost && event.line != null && event.line > 0
  const className = [
    'result-row',
    `result-${event.kind === 'error' ? 'error' : event.kind}`,
    linked ? 'is-linked' : '',
    active ? 'is-active' : '',
    dimmed ? 'is-dimmed' : '',
    updated ? 'is-updated' : '',
    ghost ? 'is-ghost' : '',
  ]
    .filter(Boolean)
    .join(' ')

  useEffect(() => {
    if (!ghost) onLayout?.()
  }, [showExplain, showTrace, showExample, onLayout, ghost])

  const hoverProps =
    linked && onHover
      ? {
          onMouseEnter: () => onHover(index),
          onMouseLeave: () => onHover(null),
        }
      : {}

  const lineSpan = (
    <span className="result-line" aria-hidden="true">
      {event.line ?? ''}
    </span>
  )

  if (event.kind === 'print') {
    return (
      <div
        className={className}
        data-result-index={ghost ? undefined : index}
        data-source-line={event.line ?? undefined}
        {...hoverProps}
      >
        {lineSpan}
        {isCollectionRoot(event.structure) ? (
          <div className="result-collection">
            <CollectionTree node={event.structure} tone="print" />
          </div>
        ) : (
          <PlainValue text={event.text} tone="print" />
        )}
      </div>
    )
  }

  if (event.kind === 'expr') {
    return (
      <div
        className={className}
        data-result-index={ghost ? undefined : index}
        data-source-line={event.line}
        {...hoverProps}
      >
        {lineSpan}
        {isCollectionRoot(event.structure) ? (
          <div className="result-collection">
            <CollectionTree node={event.structure} tone="expr" />
          </div>
        ) : (
          <PlainValue text={event.value} tone="expr" />
        )}
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
        <div className={`error-card${showExplain ? ' is-expanded' : ''}`}>
          <pre className="error-card-raw" data-error-anchor>
            {rawMessage}
          </pre>
          {event.line != null && (
            <p className="error-card-meta">line {event.line}</p>
          )}

          <p className="error-card-tip-inline">
            <span className="error-card-tip-label">What to fix</span>
            {explanation.tip}
          </p>

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
                className="linkish"
                onClick={() => setShowTrace((v) => !v)}
                aria-expanded={showTrace}
              >
                {showTrace ? 'Hide traceback' : 'Traceback'}
              </button>
            )}
          </div>

          {showExplain && (
            <div className="error-card-explain">
              <p className="error-card-plain-title">{explanation.title}</p>
              <p className="error-card-summary">
                <span className="error-card-section-label">What this means</span>
                {explanation.summary}
              </p>

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

function useLoopTrace(events: ResultEvent[]) {
  return useMemo(() => {
    const prints = events
      .map((e, index) => ({ e, index }))
      .filter(({ e }) => e.kind === 'print')
    if (prints.length < 3) return null
    return prints
  }, [events])
}

export function ResultsPanel({
  events,
  status,
  durationMs,
  activeIndex = null,
  onHoverResult,
  onGeometryChange,
  showCoaching = false,
  editorView = null,
  geometryKey = 0,
  align = false,
  previousEvents = null,
  updatedIndices,
  showPrevious = false,
  onTogglePrevious,
}: ResultsPanelProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const empty =
    events.length === 0 &&
    (status === 'ready' || status === 'idle' || status === 'booting')

  const label = statusLabel(status)
  const showStatus = label != null
  const showDuration =
    durationMs != null && status !== 'running' && status !== 'booting'

  const loopTrace = useLoopTrace(events)
  const [step, setStep] = useState<number | 'all'>('all')

  useEffect(() => {
    setStep('all')
  }, [events])

  useEffect(() => {
    const body = bodyRef.current
    if (!body || !onGeometryChange) return
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => onGeometryChange())
    ro.observe(body)
    return () => ro.disconnect()
  }, [onGeometryChange])

  // Align each result row with the source line that produced it (wide only).
  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body) return

    const rows = () =>
      Array.from(body.querySelectorAll<HTMLElement>('[data-result-index]'))

    if (!align || !editorView) {
      for (const row of rows()) row.style.marginTop = ''
      return
    }

    const applyAlignment = () => {
      const measured = rows()
      if (measured.length !== events.length) return
      for (const row of measured) row.style.marginTop = ''

      const bodyRect = body.getBoundingClientRect()
      const targets = events.map((event) => {
        if (event.line == null || event.line < 1) return null
        try {
          const line = editorView.state.doc.line(event.line)
          const coords = editorView.coordsAtPos(line.from)
          if (!coords) return null
          return coords.top - bodyRect.top + body.scrollTop
        } catch {
          return null
        }
      })
      const naturalTops = measured.map(
        (row) =>
          row.getBoundingClientRect().top - bodyRect.top + body.scrollTop,
      )
      const heights = measured.map((row) => row.getBoundingClientRect().height)
      const stacked = computeStackedTops(targets, heights, 2)
      measured.forEach((row, i) => {
        const naturalGap =
          i === 0 ? naturalTops[0] : naturalTops[i] - naturalTops[i - 1]
        const desiredGap = i === 0 ? stacked[0] : stacked[i] - stacked[i - 1]
        const margin = Math.max(0, desiredGap - naturalGap)
        const next = margin > 0.5 ? `${margin.toFixed(1)}px` : ''
        if (row.style.marginTop !== next) row.style.marginTop = next
      })
    }

    const raf = requestAnimationFrame(applyAlignment)
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            requestAnimationFrame(applyAlignment)
          })
        : null
    ro?.observe(body)
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
    }
  }, [align, editorView, events, geometryKey])

  const focusIndex =
    step === 'all' || !loopTrace ? null : (loopTrace[step]?.index ?? null)

  const hasPrevious = (previousEvents?.length ?? 0) > 0

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
              <span className="status-label">{label}</span>
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

      {loopTrace && (
        <div className="loop-trace" role="group" aria-label="Loop steps">
          <span className="loop-trace-label">Steps</span>
          <button
            type="button"
            className={`loop-trace-btn${step === 'all' ? ' is-active' : ''}`}
            onClick={() => setStep('all')}
          >
            All
          </button>
          {loopTrace.map(({ e }, i) => {
            const preview =
              e.kind === 'print'
                ? e.text.trim().slice(0, 14) || `·${i + 1}`
                : `${i + 1}`
            const label =
              preview.length >= 14 ? `${preview.slice(0, 13)}…` : preview
            return (
              <button
                key={i}
                type="button"
                className={`loop-trace-btn${step === i ? ' is-active' : ''}`}
                onClick={() => setStep(i)}
                aria-label={`Step ${i + 1}: ${e.kind === 'print' ? e.text : ''}`}
                title={e.kind === 'print' ? e.text : `Step ${i + 1}`}
              >
                <span className="loop-trace-num">{i + 1}</span>
                <span className="loop-trace-preview">{label}</span>
              </button>
            )
          })}
        </div>
      )}

      <div
        className={`results-body${align && editorView ? ' is-aligned' : ''}`}
        ref={bodyRef}
      >
        {empty && (
          <p className="results-placeholder">
            {status === 'booting'
              ? 'Starting the in-browser Python engine…'
              : showCoaching
                ? 'Edit a print — output appears here next to that line.'
                : 'Results will appear here as you write code.'}
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
            key={`${event.kind}-${index}-${event.line ?? 0}-${
              event.kind === 'print'
                ? event.text
                : event.kind === 'expr'
                  ? event.value
                  : event.kind === 'error'
                    ? event.message
                    : event.text
            }`}
            event={event}
            index={index}
            active={activeIndex === index}
            onHover={onHoverResult}
            onLayout={onGeometryChange}
            dimmed={focusIndex != null && index !== focusIndex}
            updated={updatedIndices?.has(index)}
          />
        ))}
      </div>
    </section>
  )
}
