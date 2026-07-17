/** Typed message protocol between the UI thread and the Python worker. */

export type ExecutionStatus =
  | 'booting'
  | 'ready'
  | 'running'
  | 'success'
  | 'error'
  | 'timeout'
  | 'stopped'
  | 'idle'

import type { ErrorExplanation } from './errorExplain'

export type { ErrorExplanation }

export type ResultEvent =
  | {
      kind: 'print'
      text: string
      line?: number
    }
  | {
      kind: 'expr'
      value: string
      line: number
    }
  | {
      kind: 'error'
      message: string
      friendly: string
      traceback: string
      line?: number
      /** Structured teaching copy for the results panel */
      explanation?: ErrorExplanation
    }
  | {
      kind: 'warning'
      text: string
      line?: number
    }

/** Main → Worker */
export type WorkerInboundMessage =
  | { type: 'init' }
  | { type: 'run'; id: string; code: string }

/** Worker → Main */
export type WorkerOutboundMessage =
  | { type: 'ready' }
  | { type: 'result'; id: string; events: ResultEvent[]; durationMs: number }
  | { type: 'failed'; id: string; error: string }

export const DEFAULT_DEBOUNCE_MS = 450
export const DEFAULT_TIMEOUT_MS = 5_000
