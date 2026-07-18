import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LOCAL_API_SAMPLES,
  checkLocalApiHealth,
  probeLocalApi,
  type LocalApiProbeResult,
  type LocalApiSample,
} from '../localApi'
import { HttpResponseCard } from './HttpResponseCard'
import type { HttpResponseView } from '../httpResponse'
import type { AppSettings } from '../settings'
import {
  fetchOpenApiDocument,
  operationToSample,
  pythonSnippetForOperation,
  type OpenApiOperation,
} from '../openapiImport'

type LocalApiStripProps = {
  enabled: boolean
  settings: AppSettings
  /** Append a generated request-dict snippet into the editor. */
  onInsertSnippet?: (snippet: string) => void
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
    401: 'Unauthorized',
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
 * Can import routes from /openapi.json into probes + Python snippets.
 */
export function LocalApiStrip({
  enabled,
  settings,
  onInsertSnippet,
}: LocalApiStripProps) {
  const [online, setOnline] = useState<boolean | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [last, setLast] = useState<LocalApiProbeResult | null>(null)
  const [operations, setOperations] = useState<OpenApiOperation[] | null>(null)
  const [openApiNote, setOpenApiNote] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const opts = useMemo(
    () => ({
      baseUrl: settings.companionBaseUrl,
      apiKey: settings.apiKey,
    }),
    [settings.companionBaseUrl, settings.apiKey],
  )

  const samples: LocalApiSample[] = useMemo(() => {
    if (operations?.length) {
      return operations
        .filter((o) => o.method === 'GET' || o.method === 'POST')
        .map(operationToSample)
    }
    return LOCAL_API_SAMPLES
  }, [operations])

  const refreshHealth = useCallback(async () => {
    if (!enabled) return
    const ok = await checkLocalApiHealth(opts)
    setOnline(ok)
  }, [enabled, opts])

  useEffect(() => {
    if (!enabled) {
      setOnline(null)
      setLast(null)
      setOperations(null)
      setOpenApiNote(null)
      return
    }
    void refreshHealth()
    const id = window.setInterval(() => void refreshHealth(), 8000)
    return () => window.clearInterval(id)
  }, [enabled, refreshHealth])

  const runSample = async (sample: LocalApiSample) => {
    setBusyId(sample.id)
    try {
      const result = await probeLocalApi(sample, opts)
      setLast(result)
      if (result.ok && (result.status === 200 || result.status === 201)) {
        setOnline(true)
      } else if (result.ok && result.status === 401) {
        setOnline(true)
      } else if (!result.ok && /Offline/i.test(result.error)) {
        setOnline(false)
      }
    } finally {
      setBusyId(null)
    }
  }

  const importOpenApi = async () => {
    setImporting(true)
    setOpenApiNote(null)
    try {
      const result = await fetchOpenApiDocument(
        settings.companionBaseUrl,
        settings.apiKey,
      )
      if (!result.ok) {
        setOpenApiNote(result.error)
        setOperations(null)
        return
      }
      setOperations(result.operations)
      setOnline(true)
      setOpenApiNote(
        `Imported ${result.operations.length} operations from /openapi.json`,
      )
    } finally {
      setImporting(false)
    }
  }

  const insertOp = (op: OpenApiOperation) => {
    onInsertSnippet?.(pythonSnippetForOperation(op))
    setOpenApiNote(`Inserted snippet for ${op.method} ${op.pathTemplate}`)
  }

  if (!enabled) return null

  const httpView = last ? toHttpView(last) : null
  const hostLabel = settings.companionBaseUrl.replace(/^https?:\/\//, '')

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
            ? `online · ${hostLabel}`
            : online === false
              ? 'offline'
              : 'checking…'}
        </span>
        <span className="local-api-hint">
          Real HTTP via companion · OpenAPI import · key in Settings if required
        </span>
        <button
          type="button"
          className="linkish local-api-refresh"
          onClick={() => void refreshHealth()}
        >
          Refresh
        </button>
        <button
          type="button"
          className="linkish local-api-refresh"
          disabled={importing}
          onClick={() => void importOpenApi()}
        >
          {importing ? 'Importing…' : 'Import OpenAPI'}
        </button>
      </div>

      <div className="local-api-actions">
        {samples.map((sample) => (
          <button
            key={sample.id}
            type="button"
            className="local-api-btn"
            disabled={busyId != null}
            onClick={() => void runSample(sample)}
            title={sample.label}
          >
            {busyId === sample.id ? '…' : sample.label}
          </button>
        ))}
      </div>

      {operations && operations.length > 0 && onInsertSnippet ? (
        <div className="local-api-openapi">
          <span className="local-api-openapi-label">Insert Python request</span>
          <div className="local-api-actions">
            {operations.slice(0, 12).map((op) => (
              <button
                key={`ins-${op.id}`}
                type="button"
                className="local-api-btn local-api-btn-insert"
                onClick={() => insertOp(op)}
                title={op.summary}
              >
                + {op.method} {op.pathTemplate}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {openApiNote ? (
        <p className="local-api-openapi-note" role="status">
          {openApiNote}
        </p>
      ) : null}

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
              {last.status === 401 ? ' · check API key in Settings' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
