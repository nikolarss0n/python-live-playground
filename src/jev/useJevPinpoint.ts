import { useCallback, useEffect, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import type { ErrorFrame } from '../execution/protocol'
import { showProblemMark } from '../editor/problemMark'
import { diagnose, diagnoseTimeout, markReported, otherSuspects } from './diagnose'
import { askJevPinpoint, jevAvailable, type Pinpoint } from './pinpoint'

export type PinpointSource = 'Fix' | 'Jev'
export type JevPinpointState =
  | { status: 'off' }
  | { status: 'checking' }
  | { status: 'found'; pinpoint: Pinpoint; source: PinpointSource }
  | { status: 'failed'; message: string }

export type FreshError = { message: string; line?: number; column?: number | null; endColumn?: number | null; frames?: readonly ErrorFrame[] }

type Options = {
  view: EditorView | null
  code: string
  error: FreshError | null
  /** Set when the run timed out; the error may have no line if the worker was force-stopped. */
  timedOut?: boolean
  /** First failing behaviour check of a run that finished without an error. */
  failedCheck?: { label: string; detail: string } | null
  /** False in restricted practice modes; nothing is diagnosed or sent then. */
  enabled: boolean
}

function withSuspects(code: string, pinpoint: Pinpoint): Pinpoint {
  const others = otherSuspects(code, pinpoint.line)
  if (!others.length) return pinpoint
  return { ...pinpoint, message: `${pinpoint.message} Also check line${others.length === 1 ? '' : 's'} ${others.join(', ')}.` }
}

/**
 * Finds the problem for each fresh run: the local diagnoser first (instant, nothing sent), then Jev for errors it cannot
 * place and for failing checks. Marks the answer in the editor; edits clear it and cancel pending requests.
 */
export function useJevPinpoint({ view, code, error, timedOut = false, failedCheck = null, enabled }: Options) {
  const [ready, setReady] = useState(false)
  const [state, setState] = useState<JevPinpointState>({ status: 'off' })
  const controller = useRef<AbortController | null>(null)
  const message = error?.message
  const line = error?.line
  const column = error?.column
  const endColumn = error?.endColumn
  const frames = error?.frames
  const checkLabel = failedCheck?.label
  const checkDetail = failedCheck?.detail

  useEffect(() => {
    let live = true
    void jevAvailable().then((available) => { if (live) setReady(available) })
    return () => { live = false }
  }, [])

  const check = useCallback(() => {
    controller.current?.abort()
    if (!enabled || !view || (message === undefined && checkLabel === undefined)) {
      // A fix made outside the code, such as in the Inputs box, does not edit the document, so clear the old mark here.
      if (view) showProblemMark(view, null)
      setState({ status: 'off' })
      return
    }
    const show = (pinpoint: Pinpoint, source: PinpointSource) => {
      const shown = withSuspects(code, pinpoint)
      setState({ status: 'found', pinpoint: shown, source })
      showProblemMark(view, { source, ...shown })
    }
    if (message !== undefined) {
      const local = diagnose({ code, message, line, column, endColumn, frames }) ?? (timedOut && !line ? diagnoseTimeout(code) : null)
      if (local) { show(local, 'Fix'); return }
    }
    const lastResort = message !== undefined ? markReported({ code, message, line, column, endColumn, frames }) : null
    if (!ready) {
      if (lastResort) show(lastResort, 'Fix')
      else setState({ status: 'off' })
      return
    }
    const abort = new AbortController()
    controller.current = abort
    setState({ status: 'checking' })
    const problem = message !== undefined
      ? { message, line, frames }
      : { message: '', check: { label: checkLabel!, detail: checkDetail ?? '' } }
    void askJevPinpoint(code, problem, { signal: abort.signal }).then((result) => {
      if (abort.signal.aborted || view.state.doc.toString() !== code) return
      if (!result.ok) {
        if (lastResort) show(lastResort, 'Fix')
        else setState({ status: 'failed', message: result.error })
        return
      }
      show(result.pinpoint, 'Jev')
    })
  }, [ready, enabled, view, code, message, line, column, endColumn, frames, timedOut, checkLabel, checkDetail])

  useEffect(() => {
    check()
    return () => controller.current?.abort()
  }, [check])

  const show = useCallback(() => {
    if (view && state.status === 'found') showProblemMark(view, { source: state.source, ...state.pinpoint })
  }, [view, state])

  return { ready, state, recheck: check, show }
}
