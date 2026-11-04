import type { CollectionNode } from './collectionStructure'
import type { ExerciseCheck } from '../serviceExercise'
import type { ApiCall, DbCell, DbTable, DiscoveredRoute, ErrorFrame, FullstackPayload, ResultEvent, WorkerOutboundMessage } from './protocol'

/**
 * Learner Python shares the worker, so anything it posts back is untrusted.
 * Messages are rebuilt field by field; a malformed event is dropped rather than reaching React.
 */

const MAX_EVENTS = 5_000
const MAX_NODES = 20_000
const MAX_DEPTH = 64

type Json = Record<string, unknown>

const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value)
const str = (value: unknown): value is string => typeof value === 'string'
const num = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const optNum = (value: unknown): number | undefined => (num(value) ? value : undefined)

function withOptional<T extends Json>(base: T, extra: Json): T {
  for (const [key, value] of Object.entries(extra)) if (value !== undefined) (base as Json)[key] = value
  return base
}

function readNode(value: unknown, budget: { nodes: number }, depth: number): CollectionNode | null {
  budget.nodes -= 1
  if (budget.nodes < 0 || depth > MAX_DEPTH || !isRecord(value) || !num(value.length) && value.kind !== 'atom') return null
  if (value.kind === 'atom') return str(value.type) && str(value.preview) ? { kind: 'atom', type: value.type, preview: value.preview } : null
  const truncated = value.truncated === true ? { truncated: true } : {}
  if (value.kind === 'list' || value.kind === 'tuple' || value.kind === 'set') {
    if (!Array.isArray(value.items)) return null
    const items: CollectionNode[] = []
    for (const item of value.items) {
      const node = readNode(item, budget, depth + 1)
      if (!node) return null
      items.push(node)
    }
    return { kind: value.kind, length: value.length as number, items, ...truncated }
  }
  if (value.kind === 'dict') {
    if (!Array.isArray(value.entries)) return null
    const entries: { key: CollectionNode; value: CollectionNode }[] = []
    for (const entry of value.entries) {
      if (!isRecord(entry)) return null
      const key = readNode(entry.key, budget, depth + 1)
      const item = key && readNode(entry.value, budget, depth + 1)
      if (!key || !item) return null
      entries.push({ key, value: item })
    }
    return { kind: 'dict', length: value.length as number, entries, ...truncated }
  }
  return null
}

function readStructure(value: unknown): { structure?: CollectionNode } {
  if (value === undefined || value === null) return {}
  const node = readNode(value, { nodes: MAX_NODES }, 0)
  return node ? { structure: node } : {}
}

function readFrames(value: unknown): ErrorFrame[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter(isRecord).filter((frame) => num(frame.line) && str(frame.name)).map((frame) =>
    withOptional({ line: frame.line as number, name: frame.name as string }, {
      column: num(frame.column) || frame.column === null ? frame.column : undefined,
      endColumn: num(frame.endColumn) || frame.endColumn === null ? frame.endColumn : undefined,
    }),
  )
}

export function readResultEvent(value: unknown): ResultEvent | null {
  if (!isRecord(value)) return null
  const line = optNum(value.line)
  switch (value.kind) {
    case 'print':
      return str(value.text) ? withOptional({ kind: 'print' as const, text: value.text, ...readStructure(value.structure) }, { line }) : null
    case 'expr':
      return str(value.value) && num(value.line) ? { kind: 'expr', value: value.value, line: value.line, ...readStructure(value.structure) } : null
    case 'warning':
      return str(value.text) ? withOptional({ kind: 'warning' as const, text: value.text }, { line }) : null
    case 'error':
      // The explanation is rebuilt on the main thread from the message, so a forged one is never shown.
      return str(value.message) && str(value.friendly) && str(value.traceback)
        ? withOptional({ kind: 'error' as const, message: value.message, friendly: value.friendly, traceback: value.traceback }, {
          line, column: optNum(value.column), endColumn: optNum(value.endColumn), frames: readFrames(value.frames),
        })
        : null
    case 'http':
      return str(value.method) && str(value.path) && num(value.status) && str(value.body) && typeof value.simulated === 'boolean'
        ? withOptional({ kind: 'http' as const, method: value.method, path: value.path, status: value.status, body: value.body, simulated: value.simulated }, { line })
        : null
    default:
      return null
  }
}

function readRoutes(value: unknown): DiscoveredRoute[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter(isRecord).filter((route) => str(route.method) && str(route.path)).map((route) =>
    withOptional({ method: route.method as string, path: route.path as string }, { callPath: str(route.callPath) ? route.callPath : undefined }),
  )
}

function readChecks(value: unknown): ExerciseCheck[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter(isRecord).filter((check) => str(check.id) && str(check.label) && typeof check.passed === 'boolean' && str(check.detail))
    .map((check) => ({ id: check.id as string, label: check.label as string, passed: check.passed as boolean, detail: check.detail as string }))
}

const isCell = (value: unknown): value is DbCell => value === null || str(value) || num(value)

function readFullstack(value: unknown): FullstackPayload | undefined {
  if (!isRecord(value) || !Array.isArray(value.tables) || !Array.isArray(value.calls)) return undefined
  const tables: DbTable[] = value.tables.filter(isRecord).filter((table) =>
    str(table.name) && num(table.count) && Array.isArray(table.columns) && Array.isArray(table.rows),
  ).map((table) => ({
    name: table.name as string,
    count: table.count as number,
    columns: (table.columns as unknown[]).filter(isRecord).filter((column) => str(column.name) && str(column.type))
      .map((column) => ({ name: column.name as string, type: column.type as string })),
    rows: (table.rows as unknown[]).filter((row): row is unknown[] => Array.isArray(row)).map((row) => row.map((cell) => (isCell(cell) ? cell : String(cell)))),
  }))
  const calls: ApiCall[] = value.calls.filter(isRecord).filter((call) => str(call.method) && str(call.path) && num(call.status))
    .map((call) => ({ method: call.method as string, path: call.path as string, status: call.status as number, body: call.body }))
  return { tables, calls }
}

/** The validated message, or null when it is not one the runner understands. */
export function readWorkerMessage(data: unknown): WorkerOutboundMessage | null {
  if (!isRecord(data)) return null
  switch (data.type) {
    case 'ready':
      return { type: 'ready' }
    case 'loaded':
      return str(data.id) ? { type: 'loaded', id: data.id } : null
    case 'failed':
      return str(data.id) ? { type: 'failed', id: data.id, error: str(data.error) ? data.error : 'Python failed.' } : null
    case 'result': {
      if (!str(data.id) || !Array.isArray(data.events)) return null
      const events = data.events.slice(0, MAX_EVENTS).map(readResultEvent).filter((event): event is ResultEvent => event !== null)
      return withOptional({ type: 'result', id: data.id, events, durationMs: optNum(data.durationMs) ?? 0 }, {
        routes: readRoutes(data.routes),
        exerciseId: str(data.exerciseId) ? data.exerciseId : undefined,
        contextKey: str(data.contextKey) ? data.contextKey : undefined,
        checks: readChecks(data.checks),
        fullstack: readFullstack(data.fullstack),
      }) as WorkerOutboundMessage
    }
    default:
      return null
  }
}
