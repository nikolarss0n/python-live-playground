/**
 * Optional probe of the local FastAPI companion.
 * Pure helpers — UI decides when to call.
 */

export const DEFAULT_LOCAL_API_BASE = 'http://127.0.0.1:8000'

export type LocalApiProbeResult =
  | {
      ok: true
      status: number
      statusText: string
      path: string
      method: string
      bodyText: string
      durationMs: number
    }
  | {
      ok: false
      path: string
      method: string
      error: string
      durationMs: number
    }

export type LocalApiSample = {
  id: string
  label: string
  method: 'GET' | 'POST'
  path: string
  body?: unknown
}

export type LocalApiOptions = {
  baseUrl?: string
  /** Sent as X-API-Key (and Authorization Bearer) when non-empty */
  apiKey?: string
  fetchImpl?: typeof fetch
}

export const LOCAL_API_SAMPLES: LocalApiSample[] = [
  { id: 'health', label: 'GET /health', method: 'GET', path: '/health' },
  { id: 'hello', label: 'GET /hello', method: 'GET', path: '/hello' },
  {
    id: 'greet',
    label: 'GET /greet?name=Ada',
    method: 'GET',
    path: '/greet?name=Ada',
  },
  {
    id: 'item',
    label: 'GET /items/a1',
    method: 'GET',
    path: '/items/a1',
  },
  {
    id: 'item-missing',
    label: 'GET /items/nope',
    method: 'GET',
    path: '/items/nope',
  },
  {
    id: 'user',
    label: 'POST /users',
    method: 'POST',
    path: '/users',
    body: { name: 'Ada' },
  },
]

function buildHeaders(
  sample: LocalApiSample,
  apiKey: string | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {
    accept: 'application/json',
  }
  if (sample.body != null) {
    headers['content-type'] = 'application/json'
  }
  const key = apiKey?.trim()
  if (key) {
    headers['x-api-key'] = key
    headers.authorization = `Bearer ${key}`
  }
  return headers
}

export async function probeLocalApi(
  sample: LocalApiSample,
  options: LocalApiOptions | string = {},
  // backward-compat: old signature (sample, baseUrl, fetch)
  fetchLegacy?: typeof fetch,
): Promise<LocalApiProbeResult> {
  let baseUrl = DEFAULT_LOCAL_API_BASE
  let apiKey = ''
  let fetchImpl: typeof fetch = fetch

  if (typeof options === 'string') {
    baseUrl = options
    fetchImpl = fetchLegacy ?? fetch
  } else {
    baseUrl = options.baseUrl ?? DEFAULT_LOCAL_API_BASE
    apiKey = options.apiKey ?? ''
    fetchImpl = options.fetchImpl ?? fetch
  }

  const url = baseUrl.replace(/\/$/, '') + sample.path
  const started = performance.now()
  try {
    const init: RequestInit = {
      method: sample.method,
      headers: buildHeaders(sample, apiKey),
    }
    if (sample.body != null) {
      init.body = JSON.stringify(sample.body)
    }
    const res = await fetchImpl(url, init)
    const bodyText = await res.text()
    return {
      ok: true,
      status: res.status,
      statusText: res.statusText,
      path: sample.path,
      method: sample.method,
      bodyText: bodyText.slice(0, 2000),
      durationMs: Math.round(performance.now() - started),
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not reach local API'
    return {
      ok: false,
      path: sample.path,
      method: sample.method,
      error:
        /Failed to fetch|NetworkError|Load failed/i.test(message)
          ? 'Offline — start companion (see companion/README.md) or check Settings URL'
          : message,
      durationMs: Math.round(performance.now() - started),
    }
  }
}

export async function checkLocalApiHealth(
  options: LocalApiOptions | string = {},
  fetchLegacy?: typeof fetch,
): Promise<boolean> {
  const result = await probeLocalApi(
    { id: 'health', label: 'health', method: 'GET', path: '/health' },
    options,
    fetchLegacy,
  )
  return result.ok && result.status === 200
}
