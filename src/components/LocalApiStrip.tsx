import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_LOCAL_API_BASE,
  LOCAL_API_SAMPLES,
  checkLocalApiHealth,
  probeLocalApi,
  type LocalApiProbeResult,
  type LocalApiSample,
} from '../localApi'
import { HttpResponseCard } from './HttpResponseCard'
import type { HttpResponseView } from '../httpResponse'

type LocalApiStripProps = {
  /** When false, do not poll (e.g. not on Web APIs track). */
  enabled: boolean
}

function toHttpView(result: LocalApiProbeResult): HttpResponseView | null {
  if (!result.ok) return null
  let bodyPreview = result.bodyText
  try {
    bodyPreview = JSON.stringify(JSON.parse(result.bodyText))
  } catch {
    // keep raw
  }
  if (bodyPreview.length > 160) {
    bodyPreview = `${bodyPreview.slice(0, 159)}…`
  }
  const labels: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    404: 'Not Found',
    405: 'Method Not Allowed',
    422: 'Unprocessable',
    500: 'Server Error',
  }
  return {
    status: result.status,
    statusLabel: labels[result.status] ?? (result.statusText || 'HTTP'),
    bodyPreview,
  }
}

/**
 * Quiet strip: optional real HTTP against the local FastAPI companion.
 * Hidden entirely when `enabled` is false.
 */
export function LocalApiStrip({ enabled }: LocalApiStripProps) {
  const [online, setOnline] = useState<boolean | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [last, setLast] = useState<LocalApiProbeResult | null>(null)

  const refreshHealth = useCallback(async () => {
    if (!enabled) return
    const ok = await checkLocalApiHealth()
    setOnline(ok)
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      setOnline(null)
      setLast(null)
      return
    }
    void refreshHealth()
    const id = window.setInterval(() => void refreshHealth(), 8000)
    return () => window.clearInterval(id)
  }, [enabled, refreshHealth])

  const runSample = async (sample: LocalApiSample) => {
    setBusyId(sample.id)
    try {
      const result = await probeLocalApi(sample)
      setLast(result)
      if (result.ok) setOnline(true)
      else if (!result.ok && /Offline/i.test(result.error)) setOnline(false)
    } finally {
      setBusyId(null)
    }
  }

  if (!enabled) return null

  const httpView = last ? toHttpView(last) : null

  return (
    <div className="local-api-strip" role="region" aria-label="Local API">
      <div className="local-api-head">
        <span className="local-api-title">Local API</span>
        <span
          className={`local-api-badge${
            online === true ? ' is-on' : online === false ? ' is-off' : ''
          }`}
        >
          {online === true
            ? 'online · 8000'
            : online === false
              ? 'offline'
              : 'checking…'}
        </span>
        <span className="local-api-hint">
          Optional real HTTP —{' '}
          <code>companion/README.md</code> · {DEFAULT_LOCAL_API_BASE}
        </span>
        <button
          type="button"
          className="linkish local-api-refresh"
          onClick={() => void refreshHealth()}
        >
          Refresh
        </button>
      </div>

      <div className="local-api-actions">
        {LOCAL_API_SAMPLES.map((sample) => (
          <button
            key={sample.id}
            type="button"
            className="local-api-btn"
            disabled={busyId != null}
            onClick={() => void runSample(sample)}
          >
            {busyId === sample.id ? '…' : sample.label}
          </button>
        ))}
      </div>

      {last && (
        <div className="local-api-result">
          {httpView ? (
            <HttpResponseCard view={httpView} />
          ) : !last.ok ? (
            <p className="local-api-error">{last.error}</p>
          ) : null}
          {last.ok && (
            <p className="local-api-meta">
              {last.method} {last.path} · {last.durationMs} ms
            </p>
          )}
        </div>
      )}
    </div>
  )
}
