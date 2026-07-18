import type { HttpResponseView } from '../httpResponse'

type HttpResponseCardProps = {
  view: HttpResponseView
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
  return (
    <div className={`http-card http-card-${tone}`} aria-label="HTTP response">
      <div className="http-card-status">
        <span className="http-card-code">{view.status}</span>
        <span className="http-card-label">{view.statusLabel}</span>
      </div>
      <pre className="http-card-body">{view.bodyPreview}</pre>
      {view.headersPreview ? (
        <p className="http-card-headers">
          <span className="http-card-headers-label">headers</span>
          {view.headersPreview}
        </p>
      ) : null}
    </div>
  )
}
