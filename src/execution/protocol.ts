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
import type { CollectionNode } from './collectionStructure'
import type { ExerciseCheck, ExerciseId } from '../serviceExercise'
import type { RefresherContext } from '../refresher/types'

/** Full-stack lessons: the dataset seed and the routes the API tab calls after each run ("GET /path?x=1" or "/path"). */
/** datasets: practice tables loaded into the shared database before the code runs (the Project data picker). */
export type FullstackRequest = { seed: number; calls: string[]; datasets?: string[] }
export type DbCell = string | number | null
export type DbTable = { name: string; columns: { name: string; type: string }[]; rows: DbCell[][]; count: number }
export type ApiCall = { method: string; path: string; status: number; body: unknown }
export type FullstackPayload = { tables: DbTable[]; calls: ApiCall[] }

export type RunCheckOptions = { context?: RefresherContext; contextKey?: string; fullstack?: FullstackRequest }

export type { ErrorExplanation }
export type { CollectionNode }

export type ErrorFrame = { line: number; name: string; column?: number | null; endColumn?: number | null }

export type ResultEvent =
  | {
      kind: 'print'
      text: string
      line?: number
      /** Structured tree for list/dict/set/tuple when capture is available. */
      structure?: CollectionNode
    }
  | {
      kind: 'expr'
      value: string
      line: number
      structure?: CollectionNode
    }
  | {
      kind: 'error'
      message: string
      friendly: string
      traceback: string
      line?: number
      /** 0-based columns of the failing expression on `line`, when Python reports them */
      column?: number
      endColumn?: number
      /** Editor-code frames, outermost first (callers before the failing function) */
      frames?: ErrorFrame[]
      /** Structured teaching copy for the results panel */
      explanation?: ErrorExplanation
    }
  | {
      kind: 'warning'
      text: string
      line?: number
    }
  | {
      kind: 'http'
      method: string
      path: string
      status: number
      body: string
      simulated: boolean
      line?: number
    }

export type DiscoveredRoute = {
  method: string
  path: string
  callPath?: string
}

export type InvokeRequest = {
  method: string
  path: string
  query?: Record<string, string>
  body?: unknown
  headers?: Record<string, string>
}

/** Main → Worker */
export type WorkerInboundMessage =
  | { type: 'init' }
  | { type: 'run'; id: string; code: string; exerciseId?: ExerciseId } & RunCheckOptions
  | { type: 'invoke'; id: string } & InvokeRequest
  | { type: 'load'; id: string; packages: string[] }

/** Worker → Main */
export type WorkerOutboundMessage =
  | { type: 'ready' }
  | {
      type: 'result'
      id: string
      events: ResultEvent[]
      durationMs: number
      routes?: DiscoveredRoute[]
      exerciseId?: ExerciseId
      checks?: ExerciseCheck[]
      contextKey?: string
      fullstack?: FullstackPayload
    }
  | { type: 'loaded'; id: string }
  | { type: 'failed'; id: string; error: string }

export const DEFAULT_DEBOUNCE_MS = 450
/** Hard wall-clock kill if the worker is still busy (stuck without loop ticks). */
export const DEFAULT_TIMEOUT_MS = 3_000
/** Soft limit is enforced inside Python loop instrumentation (~2s). */
