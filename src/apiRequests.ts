import type { DiscoveredRoute, InvokeRequest, ResultEvent, RouteField } from './execution/protocol'
import { parseJsonBody, routeNeedsBody } from './simApiCall'

/** One route's request as the learner sees and edits it. Starts from what the handler's signature asks for. */
export type RequestDraft = {
  path: string
  query: Record<string, string>
  headers: Record<string, string>
  body: string
}

export type SentResponse =
  | {
      kind: 'response'
      path: string
      status: number
      body: unknown
      durationMs: number | null
      /** Where a handler crashed, for a 500. */
      file?: string
      line?: number
      /** Lines printed by the route handler or its dependencies during this request. */
      logs?: string[]
    }
  | { kind: 'failed'; message: string }

export function routeKey(route: DiscoveredRoute): string {
  return `${route.method} ${route.path}`
}

const values = (fields: readonly RouteField[] = []) => Object.fromEntries(fields.map((field) => [field.name, field.value]))

export function preparedDraft(route: DiscoveredRoute): RequestDraft {
  return { path: route.callPath ?? route.path, query: values(route.query), headers: values(route.headers), body: route.body ?? '' }
}

export function routeTakesBody(route: DiscoveredRoute): boolean {
  return route.body !== undefined || routeNeedsBody(route.method)
}

const filled = (record: Record<string, string>) => {
  const entries = Object.entries(record).filter(([, value]) => value.trim() !== '')
  return entries.length ? Object.fromEntries(entries.map(([name, value]) => [name, value.trim()])) : undefined
}

/** The request to send. An empty field is left out; a body that is not JSON throws with a message for the form. */
export function buildRequest(route: DiscoveredRoute, draft: RequestDraft): InvokeRequest {
  const request: InvokeRequest = { method: route.method, path: draft.path.trim() || route.callPath || route.path }
  const query = filled(draft.query)
  const headers = filled(draft.headers)
  const body = routeTakesBody(route) ? parseJsonBody(draft.body) : undefined
  if (query) request.query = query
  if (headers) request.headers = headers
  if (body !== undefined) request.body = body
  return request
}

/** What a Send produced: the route's response, or the reason the simulator could not call it. */
export function responseFromEvents(events: readonly ResultEvent[], durationMs: number | null): SentResponse | null {
  const last = events.at(-1)
  if (last?.kind === 'error') return { kind: 'failed', message: last.message }
  const http = events.findLast((event) => event.kind === 'http')
  if (http?.kind !== 'http') return null
  let body: unknown = http.body
  try {
    body = JSON.parse(http.body)
  } catch {
    // Keep the raw text.
  }
  const logs = events.flatMap((event) => (event.kind === 'print' || event.kind === 'warning' ? [event.text] : []))
  return {
    kind: 'response',
    path: http.path,
    status: http.status,
    body,
    durationMs,
    ...(http.file ? { file: http.file } : {}),
    ...(http.line ? { line: http.line } : {}),
    ...(logs.length ? { logs } : {}),
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

/** A copy-pasteable curl command for running this exact request against a real local uvicorn server. */
export function formatCurl(route: DiscoveredRoute, draft: RequestDraft, baseUrl = 'http://127.0.0.1:8000'): string {
  const request = buildRequest(route, draft)
  const path = request.path.startsWith('/') ? request.path : `/${request.path}`
  const search = request.query ? new URLSearchParams(request.query).toString() : ''
  const url = `${baseUrl.replace(/\/+$/, '')}${path}${search ? `?${search}` : ''}`
  const parts = ['curl']
  if (request.method !== 'GET') parts.push('-X', request.method)
  parts.push(shellQuote(url))
  for (const [name, value] of Object.entries(request.headers ?? {})) {
    parts.push('-H', shellQuote(`${name}: ${value}`))
  }
  if (request.body !== undefined) {
    const hasContentType = Object.keys(request.headers ?? {}).some((name) => name.toLowerCase() === 'content-type')
    if (!hasContentType) parts.push('-H', shellQuote('Content-Type: application/json'))
    parts.push('-d', shellQuote(JSON.stringify(request.body)))
  }
  return parts.join(' ')
}

/** One thing a 422 response says is wrong with the request. `field` is the parameter; `name` goes on to the item inside it. */
export type Refusal = { where: 'path' | 'query' | 'header' | 'body'; field: string; name: string; message: string }

const MAX_REFUSALS = 20

const PLACES = new Set(['path', 'query', 'header', 'body'])

/** The fields a refused request names, read from FastAPI's `{"detail": [{"loc": [...], "msg": ...}]}`. */
export function refusals(response: SentResponse | undefined): Refusal[] {
  if (response?.kind !== 'response' || response.status !== 422) return []
  const detail = (response.body as { detail?: unknown } | null)?.detail
  if (!Array.isArray(detail)) return []
  return detail.slice(0, MAX_REFUSALS).flatMap((entry: unknown) => {
    const { loc, msg } = (entry ?? {}) as { loc?: unknown; msg?: unknown }
    if (!Array.isArray(loc) || typeof loc[0] !== 'string' || !PLACES.has(loc[0]) || typeof msg !== 'string') return []
    return [{ where: loc[0] as Refusal['where'], field: String(loc[1] ?? ''), name: loc.slice(1).map(String).join('.'), message: msg }]
  })
}

/** Header names reach a handler as `x_token` and a request as `x-token`; both mean the same field. */
export function sameField(a: string, b: string): boolean {
  const plain = (name: string) => name.toLowerCase().replaceAll('_', '-')
  return plain(a) === plain(b)
}
