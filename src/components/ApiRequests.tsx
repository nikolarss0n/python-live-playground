import { useId, type SyntheticEvent } from 'react'
import { routeKey, routeTakesBody, sameField, type Refusal, type RequestDraft, type SentResponse } from '../apiRequests'
import type { RouteField } from '../execution/protocol'
import { jsonToNode, statusTone } from '../fullstack'
import { statusLabel } from '../httpResponse'
import { CollectionTree } from './CollectionTree'
import type { ApiRequests as ApiRequestsState } from './useApiRequests'

type FieldsProps = {
  label: string
  fields: readonly RouteField[]
  values: Record<string, string>
  onChange: (values: Record<string, string>) => void
  refused: readonly Refusal[]
}

function Fields({ label, fields, values, onChange, refused }: FieldsProps) {
  if (!fields.length) return null
  return (
    <>
      <span className="api-request-label">{label}</span>
      <div className="api-request-pairs" role="group" aria-label={label}>
        {fields.map((field) => {
          const value = values[field.name] ?? ''
          const problem = refused.find((each) => sameField(each.field, field.name))
          return (
            <label key={field.name} className={`api-pair${problem ? ' is-refused' : ''}`} title={problem?.message}>
              <span className="api-pair-name">
                {field.name}
                {field.required ? <span className="api-pair-required" aria-hidden="true">*</span> : null}
              </span>
              <input
                className="api-pair-value"
                value={value}
                size={Math.min(Math.max(value.length, 8), 28)}
                placeholder="not sent"
                aria-required={field.required}
                aria-invalid={problem ? true : undefined}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                onChange={(event) => onChange({ ...values, [field.name]: event.target.value })}
              />
            </label>
          )
        })}
      </div>
    </>
  )
}

function Response({ response, onShowLine }: { response: SentResponse | undefined; onShowLine?: (line: number) => void }) {
  if (!response) return <p className="fullstack-empty api-response-empty">Not sent yet.</p>
  if (response.kind === 'failed') return <p className="api-request-error">{response.message}</p>
  const empty = response.status === 204 || response.body === null
  return (
    <>
      <div className="api-response-head">
        <span className={`api-status ${statusTone(response.status)}`}>{response.status}</span>
        <span className="api-response-note">
          {statusLabel(response.status)}
          {response.durationMs === null ? '' : ` · ${response.durationMs} ms`}
        </span>
        {response.line && onShowLine ? (
          <button type="button" className="linkish api-response-line" onClick={() => onShowLine(response.line!)}>
            Crashed on line {response.line}
          </button>
        ) : null}
      </div>
      {empty ? <p className="fullstack-empty api-response-empty">No content.</p> : (
        // A refused request opens fully: the reason sits a few levels inside the 422 detail.
        <div className="api-call-body"><CollectionTree key={response.status >= 400 ? 'open' : 'root'} node={jsonToNode(response.body)} tone="expr" openDepth={response.status >= 400 ? 4 : 1} /></div>
      )}
    </>
  )
}

/** The API tab for a file that defines routes: every route listed, and the picked one's request ready to send. */
export function ApiRequests({ api, stopped, onShowLine }: { api: ApiRequestsState; stopped: boolean; onShowLine?: (line: number) => void }) {
  const { routes, selected, draft } = api
  const bodyId = useId()
  if (!selected) return null
  const selectedKey = routeKey(selected)
  const change = (part: Partial<RequestDraft>) => api.edit(part)
  const onSubmit = (event: SyntheticEvent) => {
    event.preventDefault()
    api.send()
  }
  const takesBody = routeTakesBody(selected)
  const refusedIn = (where: Refusal['where']) => api.refused.filter((each) => each.where === where)
  const pathRefused = refusedIn('path').length > 0
  const bodyRefused = refusedIn('body').length > 0
  const hasFields = Boolean(selected.query?.length || selected.headers?.length || takesBody)
  return (
    <>
      <div className="fullstack-toolbar">
        <span className="fullstack-toolbar-note">
          {stopped ? 'Your app stopped. Run the code to start it again.' : 'Pick a route from your file. Its request is ready to send.'}
        </span>
      </div>
      <ul className="api-routes" aria-label="Routes">
        {routes.map((route) => {
          const key = routeKey(route)
          const response = api.responses[key]
          return (
            <li key={key}>
              <button type="button" className={`api-route${key === selectedKey ? ' is-current' : ''}`} aria-current={key === selectedKey ? 'true' : undefined} onClick={() => api.select(route)}>
                <span className="api-method">{route.method}</span>
                <span className="api-route-path">{route.path}</span>
                {route.name ? <span className="api-route-name">{route.name}</span> : null}
                {response?.kind === 'response' ? <span className={`api-status ${statusTone(response.status)}`}>{response.status}</span> : null}
                {response?.kind === 'failed' ? <span className="api-status is-error">failed</span> : null}
              </button>
            </li>
          )
        })}
      </ul>
      <form className="api-call api-request" aria-label={`Request to ${selectedKey}`} onSubmit={onSubmit}>
        <div className="api-call-head">
          <span className="api-method">{selected.method}</span>
          <input className={`api-path${pathRefused ? ' is-refused' : ''}`} aria-label="Request path" aria-invalid={pathRefused ? true : undefined} value={draft.path} spellCheck={false} autoCapitalize="off" autoComplete="off" onChange={(event) => change({ path: event.target.value })} />
          <button type="submit" className="fullstack-button is-primary" disabled={!api.canSend}>{api.sending ? 'Sending' : 'Send'}</button>
        </div>
        {hasFields ? (
          <div className="api-request-fields">
            <Fields label="Query" fields={selected.query ?? []} values={draft.query} onChange={(query) => change({ query })} refused={refusedIn('query')} />
            <Fields label="Headers" fields={selected.headers ?? []} values={draft.headers} onChange={(headers) => change({ headers })} refused={refusedIn('header')} />
            {takesBody ? (
              <>
                <label className="api-request-label" htmlFor={bodyId}>Body</label>
                <textarea
                  id={bodyId}
                  className={`api-request-body${bodyRefused ? ' is-refused' : ''}`}
                  aria-invalid={bodyRefused ? true : undefined}
                  value={draft.body}
                  rows={Math.min(Math.max(draft.body.split('\n').length, 3), 14)}
                  placeholder="JSON"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoComplete="off"
                  onChange={(event) => change({ body: event.target.value })}
                />
              </>
            ) : null}
          </div>
        ) : null}
        {api.formError ? <p className="api-request-error" role="alert">{api.formError}</p> : null}
        {api.refused.length ? (
          <ul className="api-refusals" aria-label="What the route refused">
            {api.refused.map((each, index) => (
              <li key={index}><span className="api-refusal-name">{each.name || each.where}</span> {each.message}</li>
            ))}
          </ul>
        ) : null}
        <div className="api-response" role="status" aria-label="Response">
          <Response response={api.responses[selectedKey]} onShowLine={onShowLine} />
        </div>
      </form>
    </>
  )
}
