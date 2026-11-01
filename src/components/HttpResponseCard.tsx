import type { ReactNode } from 'react'
import type { HttpResponseView } from '../httpResponse'

type HttpResponseCardProps = {
  view: HttpResponseView
}

const JSON_TOKEN =
  /("(?:\\.|[^"\\])*")\s*:|("(?:\\.|[^"\\])*")|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g

function JsonPreview({ text }: { text: string }) {
  const looksJson = text.startsWith('{') || text.startsWith('[')
  if (!looksJson) {
    return <pre className="http-card-body">{text}</pre>
  }
  const parts: ReactNode[] = []
  let last = 0
  let key = 0
  for (const match of text.matchAll(JSON_TOKEN)) {
    const index = match.index ?? 0
    if (index > last) parts.push(text.slice(last, index))
    if (match[1]) {
      parts.push(
        <span key={key++} className="json-key">
          {match[1]}
        </span>,
      )
      parts.push(match[0].slice(match[1].length))
    } else if (match[2]) {
      parts.push(
        <span key={key++} className="json-string">
          {match[2]}
        </span>,
      )
    } else if (match[3]) {
      parts.push(
        <span key={key++} className="json-literal">
          {match[3]}
        </span>,
      )
    } else {
      parts.push(
        <span key={key++} className="json-number">
          {match[0]}
        </span>,
      )
    }
    last = index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <pre className="http-card-body">{parts}</pre>
}

function toneForStatus(status: number): string {
  if (status >= 500) return 'server'
  if (status >= 400) return 'client'
  if (status >= 300) return 'redirect'
  if (status >= 200) return 'ok'
  return 'info'
}

/**
 * Quiet HTTP response summary for Web API lessons.
 */
export function HttpResponseCard({ view }: HttpResponseCardProps) {
  const tone = toneForStatus(view.status)
  const endpoint =
    view.method && view.path ? `${view.method} ${view.path}` : null
  return (
    <div className={`http-card http-card-${tone}`} aria-label="HTTP response">
      {endpoint ? (
        <p className="http-card-endpoint">
          <span className="http-card-endpoint-line">{endpoint}</span>
          {view.simulated ? (
            <span className="http-card-simulated">simulated</span>
          ) : null}
        </p>
      ) : view.simulated ? (
        <p className="http-card-endpoint">
          <span className="http-card-simulated">simulated</span>
        </p>
      ) : null}
      <div className="http-card-status">
        <span className="http-card-code">{view.status}</span>
        <span className="http-card-label">{view.statusLabel}</span>
      </div>
      <JsonPreview text={view.bodyPreview} />
      {view.headersPreview ? (
        <p className="http-card-headers">
          <span className="http-card-headers-label">headers</span>
          {view.headersPreview}
        </p>
      ) : null}
    </div>
  )
}
