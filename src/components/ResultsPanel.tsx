import { useEffect, useMemo, useRef, useState } from 'react'
import type { ExecutionStatus, ResultEvent } from '../execution/protocol'
import { explainError } from '../execution/errorExplain'
import { isCollectionRoot } from '../execution/collectionStructure'
import { inferTypeLabel } from '../valueType'
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
}: {
  event: ResultEvent
  index: number
  active: boolean
  onHover?: (index: number | null) => void
  onLayout?: () => void
  dimmed?: boolean
}) {
  const [showTrace, setShowTrace] = useState(false)
  const [showExample, setShowExample] = useState(false)
  // Error lessons: open the teaching card by default (still calm, optional hide).
  const [showExplain, setShowExplain] = useState(event.kind === 'error')
  const linked = event.line != null && event.line > 0
  const className = [
    'result-row',
    `result-${event.kind === 'error' ? 'error' : event.kind}`,
    linked ? 'is-linked' : '',
    active ? 'is-active' : '',
    dimmed ? 'is-dimmed' : '',
  ]
    .filter(Boolean)
    .join(' ')

  useEffect(() => {
    onLayout?.()
  }, [showExplain, showTrace, showExample, onLayout])

  const hoverProps = linked
    ? {
        onMouseEnter: () => onHover?.(index),
        onMouseLeave: () => onHover?.(null),
      }
    : {}

  if (event.kind === 'print') {
    return (
      <div
        className={className}
        data-result-index={index}
        data-source-line={event.line ?? undefined}
        {...hoverProps}
      >
        <span className="result-line" aria-hidden="true">
          {event.line ?? ''}
        </span>
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
        data-result-index={index}
        data-source-line={event.line}
        {...hoverProps}
      >
        <span className="result-line" aria-hidden="true">
          {event.line}
        </span>
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
        data-result-index={index}
        data-source-line={event.line ?? undefined}
        {...hoverProps}
      >
        <span className="result-line" aria-hidden="true">
          {event.line ?? ''}
        </span>
        <PlainValue text={event.text} tone="warning" />
      </div>
    )
  }

  const explanation = event.explanation ?? explainError(event.message)
  const rawMessage =
    event.message || `${explanation.name}: ${explanation.detail}`

  return (
    <div
      className={`${className} result-error-card`}
      data-result-index={index}
      data-source-line={event.line ?? undefined}
      {...hoverProps}
    >
      <span className="result-line" aria-hidden="true">
        {event.line ?? ''}
      </span>
      <div className="result-error-body">
        <div className={`error-card${showExplain ? ' is-expanded' : ''}`}>
          <pre className="error-card-raw" data-error-anchor>
            {rawMessage}
          </pre>
          {event.line != null && (
            <p className="error-card-meta">line {event.line}</p>
          )}

          {/* Always-visible tip strip — expand for full lesson. */}
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

/** Group of print steps that look like a loop (3+ prints). */
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
}: ResultsPanelProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const empty =
    events.length === 0 &&
    (status === 'ready' || status === 'idle' || status === 'booting')

  const label = statusLabel(status)
  const showStatus = label != null
  const showDuration =
    durationMs != null && status !== 'running' && status !== 'booting'
  const showHeader = showStatus || showDuration

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

  const focusIndex =
    step === 'all' || !loopTrace ? null : (loopTrace[step]?.index ?? null)

  return (
    <section className="results-panel" aria-label="Results" aria-live="polite">
      {showHeader && (
        <header className="results-header">
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
        </header>
      )}

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
          {loopTrace.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`loop-trace-btn${step === i ? ' is-active' : ''}`}
              onClick={() => setStep(i)}
              aria-label={`Step ${i + 1}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      <div className="results-body" ref={bodyRef}>
        {empty && (
          <p className="results-placeholder">
            {status === 'booting'
              ? 'Starting the in-browser Python engine…'
              : showCoaching
                ? 'Edit a print — output appears here next to that line.'
                : 'Results will appear here as you write code.'}
          </p>
        )}

        {events.map((event, index) => (
          <EventRow
            key={`${event.kind}-${index}-${event.line ?? 0}`}
            event={event}
            index={index}
            active={activeIndex === index}
            onHover={onHoverResult}
            onLayout={onGeometryChange}
            dimmed={focusIndex != null && index !== focusIndex}
          />
        ))}
      </div>
    </section>
  )
}
