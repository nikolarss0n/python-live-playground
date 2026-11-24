import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildRequest, preparedDraft, refusals, responseFromEvents, routeKey, type Refusal, type RequestDraft, type SentResponse } from '../apiRequests'
import type { DiscoveredRoute, ExecutionStatus, InvokeRequest, ResultEvent } from '../execution/protocol'

type Snapshot = { status: ExecutionStatus; runId: string | null; events: ResultEvent[]; durationMs: number | null }

export type ApiRequestOptions = {
  /** True when the editor/project source has changed since the last completed code run. */
  stale?: boolean
  /** True when code edits automatically re-run (default). False in manual-run mode. */
  autoRun?: boolean
  /** Re-runs the latest code/project before sending when stale. */
  runBeforeSend?: () => Promise<void>
}

export type ApiRequests = {
  routes: readonly DiscoveredRoute[]
  selected: DiscoveredRoute | null
  select: (route: DiscoveredRoute) => void
  draft: RequestDraft
  edit: (change: Partial<RequestDraft>) => void
  send: () => void
  /** False while Python is busy, stopped, or the code failed to start without newer edits to run. */
  canSend: boolean
  sending: boolean
  /** True while Auto-run is syncing code edits or a Send request is in flight (drives calm hairline animation). */
  syncing: boolean
  /** True only in manual mode when current responses belong to an older version of the code. */
  stale: boolean
  /** True when the last completed code run failed (syntax/startup error), blocking sends until fixed. */
  codeError: boolean
  responses: Readonly<Record<string, SentResponse>>
  /** What the last response refused in the picked request, until that request is edited. */
  refused: readonly Refusal[]
  formError: string | null
}

type QueuedSend = { key: string; request: InvokeRequest; draftText: string }

const isInvoke = (runId: string | null) => runId?.startsWith('invoke-') ?? false
const EMPTY: RequestDraft = { path: '', query: {}, headers: {}, body: '' }

/**
 * The API tab's state: which route is picked, each route's edited request, and the last response per route.
 * A request stays as edited until the route's signature changes; responses clear when the code runs again
 * or the worker resets. While editing hits a temporary syntax/startup error, the last known routes stay
 * visible so the learner is not yanked off the API tab mid-keystroke.
 */
export function useApiRequests(
  routes: readonly DiscoveredRoute[],
  snapshot: Snapshot,
  invoke: (request: InvokeRequest) => Promise<void>,
  options: ApiRequestOptions = {},
): ApiRequests {
  const { stale = false, autoRun = true, runBeforeSend } = options
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, { basis: string; draft: RequestDraft }>>({})
  const [responses, setResponses] = useState<Record<string, SentResponse>>({})
  /** Each route's request as it was sent, to tell whether its response still describes the form. */
  const [sentDrafts, setSentDrafts] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [lastRoutes, setLastRoutes] = useState<readonly DiscoveredRoute[]>([])
  const [codeError, setCodeError] = useState(false)
  const [queuedSending, setQueuedSending] = useState(false)
  const pendingKey = useRef<string | null>(null)
  const queuedSend = useRef<QueuedSend | null>(null)
  const codeRunId = useRef<string | null>(null)

  const { status, runId, events, durationMs } = snapshot
  const keepLastRoutes = routes.length === 0 && lastRoutes.length > 0 && (status === 'running' || (status === 'error' && !isInvoke(runId)))
  const effectiveRoutes = routes.length > 0 ? routes : (keepLastRoutes ? lastRoutes : routes)

  useEffect(() => {
    if (routes.length > 0) {
      setLastRoutes(routes)
      return
    }
    if (status === 'success' && !isInvoke(runId)) {
      setLastRoutes([])
    } else if (status === 'stopped' || status === 'timeout' || (status === 'ready' && runId === null)) {
      setLastRoutes([])
    }
  }, [routes, status, runId])

  useEffect(() => {
    if (status === 'running' || status === 'booting') return
    if (status === 'stopped' || status === 'timeout' || (status === 'ready' && runId === null)) {
      pendingKey.current = null
      queuedSend.current = null
      setQueuedSending(false)
      setCodeError(false)
      setResponses({})
      return
    }
    if (!runId) return
    if (!isInvoke(runId)) {
      if (codeRunId.current !== runId) {
        codeRunId.current = runId
        pendingKey.current = null
        setResponses({})
        const failed = status === 'error'
        setCodeError(failed)
        const queued = queuedSend.current
        queuedSend.current = null
        setQueuedSending(false)
        if (queued && status === 'success' && routes.length > 0) {
          pendingKey.current = queued.key
          setSentDrafts((before) => ({ ...before, [queued.key]: queued.draftText }))
          void invoke(queued.request)
        }
      }
      return
    }
    const key = pendingKey.current
    if (!key) return
    pendingKey.current = null
    const response = responseFromEvents(events, durationMs)
    if (response) setResponses((before) => ({ ...before, [key]: response }))
  }, [status, runId, events, durationMs, routes.length, invoke])

  const selected = effectiveRoutes.find((route) => routeKey(route) === selectedKey) ?? effectiveRoutes[0] ?? null
  const basis = selected ? JSON.stringify(selected) : ''
  const saved = selected ? drafts[routeKey(selected)] : undefined
  const draft = useMemo(
    () => (!selected ? EMPTY : saved?.basis === basis ? saved.draft : preparedDraft(selected)),
    [selected, saved, basis],
  )

  const select = useCallback((route: DiscoveredRoute) => {
    setSelectedKey(routeKey(route))
    setFormError(null)
  }, [])

  const edit = useCallback((change: Partial<RequestDraft>) => {
    if (!selected) return
    setFormError(null)
    setDrafts((before) => ({ ...before, [routeKey(selected)]: { basis, draft: { ...draft, ...change } } }))
  }, [selected, basis, draft])

  const stopped = status === 'stopped' || status === 'timeout'
  const isCodeRunning = status === 'running' && !isInvoke(runId)
  const sending = (status === 'running' && isInvoke(runId)) || queuedSending
  const busy = status === 'running' || status === 'booting' || queuedSending
  const canRunAndSend = Boolean(stale && runBeforeSend && !stopped && !busy && selected !== null)
  const canSend = selected !== null && !stopped && !busy && (
    canRunAndSend || (!stale && !codeError && (status === 'success' || (status === 'error' && isInvoke(runId))))
  )
  const manualStale = stale && !autoRun
  const syncing = !stopped && (sending || (autoRun && (stale || isCodeRunning)))

  const send = useCallback(() => {
    if (!selected || !canSend) return
    try {
      const request = buildRequest(selected, draft)
      setFormError(null)
      const key = routeKey(selected)
      const draftText = JSON.stringify(draft)
      if (stale && runBeforeSend) {
        queuedSend.current = { key, request, draftText }
        setQueuedSending(true)
        void runBeforeSend()
        return
      }
      pendingKey.current = key
      setSentDrafts((before) => ({ ...before, [key]: draftText }))
      void invoke(request)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The request could not be read.')
    }
  }, [selected, canSend, draft, stale, runBeforeSend, invoke])

  const key = selected ? routeKey(selected) : ''
  const refused = useMemo(
    () => (!manualStale && sentDrafts[key] === JSON.stringify(draft) ? refusals(responses[key]) : []),
    [manualStale, sentDrafts, responses, key, draft],
  )

  return {
    routes: effectiveRoutes,
    selected,
    select,
    draft,
    edit,
    send,
    canSend,
    sending,
    syncing,
    stale: manualStale,
    codeError: codeError && !stale,
    responses,
    refused,
    formError,
  }
}
