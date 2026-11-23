import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildRequest, preparedDraft, refusals, responseFromEvents, routeKey, type Refusal, type RequestDraft, type SentResponse } from '../apiRequests'
import type { DiscoveredRoute, ExecutionStatus, InvokeRequest, ResultEvent } from '../execution/protocol'

type Snapshot = { status: ExecutionStatus; runId: string | null; events: ResultEvent[]; durationMs: number | null }

export type ApiRequests = {
  routes: readonly DiscoveredRoute[]
  selected: DiscoveredRoute | null
  select: (route: DiscoveredRoute) => void
  draft: RequestDraft
  edit: (change: Partial<RequestDraft>) => void
  send: () => void
  /** False while Python is busy or after the app was stopped: there is nothing to call until the code runs again. */
  canSend: boolean
  sending: boolean
  responses: Readonly<Record<string, SentResponse>>
  /** What the last response refused in the picked request, until that request is edited. */
  refused: readonly Refusal[]
  formError: string | null
}

const isInvoke = (runId: string | null) => runId?.startsWith('invoke-') ?? false
const EMPTY: RequestDraft = { path: '', query: {}, headers: {}, body: '' }

/**
 * The API tab's state: which route is picked, each route's edited request, and the last response per route.
 * A request stays as edited until the route's signature changes; responses clear when the code runs again,
 * because that starts the app afresh.
 */
export function useApiRequests(routes: readonly DiscoveredRoute[], snapshot: Snapshot, invoke: (request: InvokeRequest) => Promise<void>): ApiRequests {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, { basis: string; draft: RequestDraft }>>({})
  const [responses, setResponses] = useState<Record<string, SentResponse>>({})
  /** Each route's request as it was sent, to tell whether its response still describes the form. */
  const [sentDrafts, setSentDrafts] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const pendingKey = useRef<string | null>(null)
  const codeRunId = useRef<string | null>(null)

  const selected = routes.find((route) => routeKey(route) === selectedKey) ?? routes[0] ?? null
  const basis = selected ? JSON.stringify(selected) : ''
  const saved = selected ? drafts[routeKey(selected)] : undefined
  const draft = useMemo(
    () => (!selected ? EMPTY : saved?.basis === basis ? saved.draft : preparedDraft(selected)),
    [selected, saved, basis],
  )

  const { status, runId, events, durationMs } = snapshot
  useEffect(() => {
    if (!runId || status === 'running' || status === 'booting') return
    if (!isInvoke(runId)) {
      if (codeRunId.current !== runId) {
        codeRunId.current = runId
        pendingKey.current = null
        setResponses({})
      }
      return
    }
    const key = pendingKey.current
    if (!key) return
    pendingKey.current = null
    const response = responseFromEvents(events, durationMs)
    if (response) setResponses((before) => ({ ...before, [key]: response }))
  }, [status, runId, events, durationMs])

  const select = useCallback((route: DiscoveredRoute) => {
    setSelectedKey(routeKey(route))
    setFormError(null)
  }, [])

  const edit = useCallback((change: Partial<RequestDraft>) => {
    if (!selected) return
    setFormError(null)
    setDrafts((before) => ({ ...before, [routeKey(selected)]: { basis, draft: { ...draft, ...change } } }))
  }, [selected, basis, draft])

  const canSend = selected !== null && (status === 'success' || status === 'error')
  const send = useCallback(() => {
    if (!selected || !canSend) return
    try {
      const request = buildRequest(selected, draft)
      setFormError(null)
      const key = routeKey(selected)
      pendingKey.current = key
      setSentDrafts((before) => ({ ...before, [key]: JSON.stringify(draft) }))
      void invoke(request)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The request could not be read.')
    }
  }, [selected, canSend, draft, invoke])

  const key = selected ? routeKey(selected) : ''
  const refused = useMemo(
    () => (sentDrafts[key] === JSON.stringify(draft) ? refusals(responses[key]) : []),
    [sentDrafts, responses, key, draft],
  )

  return { routes, selected, select, draft, edit, send, canSend, sending: status === 'running' && isInvoke(runId), responses, refused, formError }
}
