import { useState } from 'react'
import type { ExecutionStatus, ResultEvent } from '../execution/protocol'
import { explainError } from '../execution/errorExplain'

type ResultsPanelProps = {
  events: ResultEvent[]
  status: ExecutionStatus
  durationMs: number | null
  activeIndex?: number | null
  onHoverResult?: (index: number | null) => void
}

function statusLabel(status: ExecutionStatus): string {
  switch (status) {
    case 'booting':
      return 'Loading Python…'
    case 'ready':
      return 'Ready'
    case 'running':
      return 'Running…'
    case 'success':
      return 'Done'
    case 'error':
      return 'Error'
    case 'timeout':
      return 'Timed out'
    case 'stopped':
      return 'Stopped'
    case 'idle':
      return 'Empty'
    default:
      return ''
  }
}

function EventRow({
  event,
  index,
  active,
  onHover,
}: {
  event: ResultEvent
  index: number
  active: boolean
  onHover?: (index: number | null) => void
}) {
  const [showTrace, setShowTrace] = useState(false)
  const [showExample, setShowExample] = useState(false)
  const [showExplain, setShowExplain] = useState(false)
  const linked = event.line != null && event.line > 0
  const className = [
    'result-row',
    `result-${event.kind === 'error' ? 'error' : event.kind}`,
    linked ? 'is-linked' : '',
    active ? 'is-active' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const hoverProps = linked
    ? {
        onMouseEnter: () => onHover?.(index),
        onMouseLeave: () => onHover?.(null),
        onFocus: () => onHover?.(index),
        onBlur: () => onHover?.(null),
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
        <pre className="result-text">{event.text}</pre>
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
        <pre className="result-text">{event.value}</pre>
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
        <pre className="result-text">{event.text}</pre>
      </div>
    )
  }

  const explanation = event.explanation ?? explainError(event.message)
  const rawMessage = event.message || `${explanation.name}: ${explanation.detail}`

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
          {/* Real Python error first — what the language actually said */}
          <pre className="error-card-raw" data-error-anchor>
            {rawMessage}
          </pre>
          {event.line != null && (
            <p className="error-card-meta">line {event.line}</p>
          )}

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

              <div className="error-card-tip">
                <span className="error-card-tip-label">What to fix</span>
                <p className="error-card-tip-text">{explanation.tip}</p>
              </div>

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
                    <pre className="error-card-example">{explanation.example}</pre>
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

export function ResultsPanel({
  events,
  status,
  durationMs,
  activeIndex = null,
  onHoverResult,
}: ResultsPanelProps) {
  const empty =
    events.length === 0 &&
    (status === 'ready' || status === 'idle' || status === 'booting')

  return (
    <section className="results-panel" aria-label="Results" aria-live="polite">
      <header className="results-header">
        <span className={`status-dot status-${status}`} aria-hidden="true" />
        <span className="status-label">{statusLabel(status)}</span>
        {durationMs != null && status !== 'running' && status !== 'booting' && (
          <span className="status-meta">{durationMs} ms</span>
        )}
      </header>

      <div className="results-body">
        {empty && (
          <p className="results-placeholder">
            {status === 'booting'
              ? 'Starting the in-browser Python engine…'
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
          />
        ))}
      </div>
    </section>
  )
}
