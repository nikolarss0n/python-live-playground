import { useMemo, useState } from 'react'
import type { DiscoveredRoute, InvokeRequest } from '../execution/protocol'
import {
  isBlankJsonBody,
  parseHeadersText,
  parseJsonBody,
  parseQueryText,
  routeNeedsBody,
} from '../simApiCall'

type SimulatedRouteListProps = {
  routes: readonly DiscoveredRoute[]
  onCall?: (request: InvokeRequest) => void
  disabled?: boolean
}

type RouteDraft = {
  path: string
  query: string
  body: string
  headers: string
  extrasOpen: boolean
  error: string | null
}

function routeKey(route: DiscoveredRoute): string {
  return `${route.method}:${route.path}`
}

function defaultDraft(route: DiscoveredRoute): RouteDraft {
  return {
    path: route.callPath ?? route.path,
    query: '',
    body: '',
    headers: '',
    extrasOpen: false,
    error: null,
  }
}

function compactRequest(
  method: string,
  path: string,
  query: ReturnType<typeof parseQueryText>,
  headers: ReturnType<typeof parseHeadersText>,
  body: unknown,
): InvokeRequest {
  const request: InvokeRequest = { method, path }
  if (query) request.query = query
  if (headers) request.headers = headers
  if (body !== undefined) request.body = body
  return request
}

export function SimulatedRouteList({
  routes,
  onCall,
  disabled,
}: SimulatedRouteListProps) {
  const [drafts, setDrafts] = useState<Record<string, RouteDraft>>({})

  const resolved = useMemo(
    () =>
      routes.map((route) => {
        const key = routeKey(route)
        return { route, key, draft: drafts[key] ?? defaultDraft(route) }
      }),
    [routes, drafts],
  )

  if (!routes.length) return null

  const patch = (key: string, route: DiscoveredRoute, next: Partial<RouteDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? defaultDraft(route)), ...next },
    }))
  }

  const send = (route: DiscoveredRoute, key: string, draft: RouteDraft) => {
    const path = draft.path.trim() || route.path
    try {
      const query = parseQueryText(draft.query)
      const headers = parseHeadersText(draft.headers)
      if (routeNeedsBody(route.method) && isBlankJsonBody(draft.body)) {
        throw new Error('Add a JSON body, then Call')
      }
      const body = draft.body.trim() ? parseJsonBody(draft.body) : undefined
      patch(key, route, { error: null })
      onCall?.(compactRequest(route.method, path, query, headers, body))
    } catch (err) {
      patch(key, route, {
        error: err instanceof Error ? err.message : 'Could not parse request',
      })
    }
  }

  return (
    <div className="sim-api-routes" role="group" aria-label="Simulated API routes">
      <p className="sim-api-caption">Simulated FastAPI</p>
      <ul className="sim-api-list">
        {resolved.map(({ route, key, draft }) => {
          const showBody = routeNeedsBody(route.method)
          return (
            <li key={key} className="sim-api-item">
              <div className="sim-api-row">
                <span className="sim-api-method">{route.method}</span>
                <input
                  className="sim-api-path-input"
                  value={draft.path}
                  disabled={disabled}
                  spellCheck={false}
                  aria-label={`Path for ${route.method} ${route.path}`}
                  onChange={(event) =>
                    patch(key, route, { path: event.target.value, error: null })
                  }
                />
                <button
                  type="button"
                  className="sim-api-call"
                  disabled={disabled}
                  onClick={() => send(route, key, draft)}
                  aria-label={`Call ${route.method} ${route.path}`}
                >
                  Call
                </button>
              </div>
              {showBody ? (
                <label className="sim-api-field">
                  <span className="sim-api-field-label">JSON body</span>
                  <textarea
                    className="sim-api-textarea"
                    rows={3}
                    spellCheck={false}
                    disabled={disabled}
                    value={draft.body}
                    placeholder='{"name": "Ada"}'
                    aria-label={`JSON body for ${route.method} ${route.path}`}
                    onChange={(event) =>
                      patch(key, route, { body: event.target.value, error: null })
                    }
                  />
                </label>
              ) : null}
              <div className="sim-api-more">
                <button
                  type="button"
                  className="linkish"
                  disabled={disabled}
                  aria-expanded={draft.extrasOpen}
                  aria-label={`Query & headers for ${route.method} ${route.path}`}
                  onClick={() =>
                    patch(key, route, { extrasOpen: !draft.extrasOpen })
                  }
                >
                  Query &amp; headers
                </button>
              </div>
              {draft.extrasOpen ? (
                <div className="sim-api-fields">
                  <label className="sim-api-field">
                    <span className="sim-api-field-label">Query</span>
                    <textarea
                      className="sim-api-textarea"
                      rows={2}
                      spellCheck={false}
                      disabled={disabled}
                      placeholder="name=Ada"
                      value={draft.query}
                      aria-label={`Query for ${route.method} ${route.path}`}
                      onChange={(event) =>
                        patch(key, route, {
                          query: event.target.value,
                          error: null,
                        })
                      }
                    />
                  </label>
                  <label className="sim-api-field">
                    <span className="sim-api-field-label">Headers</span>
                    <textarea
                      className="sim-api-textarea"
                      rows={2}
                      spellCheck={false}
                      disabled={disabled}
                      placeholder="Authorization: Bearer secret"
                      value={draft.headers}
                      aria-label={`Headers for ${route.method} ${route.path}`}
                      onChange={(event) =>
                        patch(key, route, {
                          headers: event.target.value,
                          error: null,
                        })
                      }
                    />
                  </label>
                </div>
              ) : null}
              {draft.error ? (
                <p className="sim-api-error" role="alert">
                  {draft.error}
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
