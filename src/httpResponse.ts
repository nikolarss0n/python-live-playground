/**
 * Detect HTTP-shaped Python result dicts for a quiet response card.
 * Expected keys: status (int-like), optional body / headers.
 */

import type { CollectionNode } from './execution/collectionStructure'

export type HttpResponseView = {
  status: number
  statusLabel: string
  bodyPreview: string
  headersPreview?: string
  method?: string
  path?: string
  simulated?: boolean
}

function atomText(node: CollectionNode | undefined): string | null {
  if (!node || node.kind !== 'atom') return null
  return node.preview
}

function unquote(raw: string | null): string | null {
  if (raw == null) return null
  return raw.replace(/^['"]|['"]$/g, '')
}

function atomBool(node: CollectionNode | undefined): boolean | undefined {
  const text = unquote(atomText(node))
  if (text == null) return undefined
  if (text === 'True' || text === 'true') return true
  if (text === 'False' || text === 'false') return false
  return undefined
}

function parseStatus(preview: string | null): number | null {
  if (!preview) return null
  const n = Number(preview)
  if (!Number.isFinite(n) || n < 100 || n > 599) return null
  return Math.trunc(n)
}

function statusLabel(code: number): string {
  const map: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    422: 'Unprocessable',
    500: 'Server Error',
  }
  return map[code] ?? 'HTTP'
}

function jsonFromAtom(node: Extract<CollectionNode, { kind: 'atom' }>): unknown {
  const { type, preview } = node
  if (type === 'NoneType' || preview === 'None') return null
  if (type === 'bool' || preview === 'True' || preview === 'False') {
    return preview === 'True'
  }
  if (type === 'int' && /^-?\d+$/.test(preview)) return Number(preview)
  if (type === 'float' && Number.isFinite(Number(preview))) return Number(preview)
  if (type === 'str') return unquote(preview) ?? preview
  const unquoted = unquote(preview)
  if (unquoted !== preview) return unquoted
  if (/^-?\d+$/.test(preview)) return Number(preview)
  return preview
}

export function jsonFromNode(node: CollectionNode): unknown {
  if (node.kind === 'atom') return jsonFromAtom(node)
  if (node.kind === 'dict') {
    const out: Record<string, unknown> = {}
    for (const entry of node.entries) {
      const key =
        entry.key.kind === 'atom'
          ? String(jsonFromAtom(entry.key))
          : JSON.stringify(jsonFromNode(entry.key))
      out[key] = jsonFromNode(entry.value)
    }
    return out
  }
  return node.items.map(jsonFromNode)
}

export function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

/** Structure from worker for a dict that looks like an HTTP response. */
export function httpResponseFromStructure(
  node: CollectionNode | undefined | null,
): HttpResponseView | null {
  if (!node || node.kind !== 'dict') return null
  let statusNode: CollectionNode | undefined
  let bodyNode: CollectionNode | undefined
  let headersNode: CollectionNode | undefined
  let methodNode: CollectionNode | undefined
  let pathNode: CollectionNode | undefined
  let simulatedNode: CollectionNode | undefined
  for (const entry of node.entries) {
    const key = atomText(entry.key)?.replace(/^['"]|['"]$/g, '')
    if (key === 'status') statusNode = entry.value
    if (key === 'body') bodyNode = entry.value
    if (key === 'headers') headersNode = entry.value
    if (key === 'method') methodNode = entry.value
    if (key === 'path') pathNode = entry.value
    if (key === 'simulated') simulatedNode = entry.value
  }
  const status = parseStatus(atomText(statusNode))
  if (status == null || !bodyNode) return null
  return {
    status,
    statusLabel: statusLabel(status),
    bodyPreview: prettyJson(jsonFromNode(bodyNode)),
    headersPreview: headersNode
      ? prettyJson(jsonFromNode(headersNode))
      : undefined,
    method: unquote(atomText(methodNode)) ?? undefined,
    path: unquote(atomText(pathNode)) ?? undefined,
    simulated: atomBool(simulatedNode),
  }
}

/** Simulated FastAPI Call event from the worker. */
export function httpResponseFromHttpEvent(event: {
  method: string
  path: string
  status: number
  body: string
  simulated?: boolean
}): HttpResponseView {
  let bodyPreview = event.body
  try {
    bodyPreview = prettyJson(JSON.parse(event.body) as unknown)
  } catch {
    // keep raw
  }
  return {
    status: event.status,
    statusLabel: statusLabel(event.status),
    bodyPreview,
    method: event.method,
    path: event.path,
    simulated: event.simulated ?? true,
  }
}

/** Fallback when only the printed repr string is available. */
export function httpResponseFromText(text: string): HttpResponseView | null {
  const t = text.trim()
  if (!t.startsWith('{') || !t.includes('status')) return null
  const statusMatch = /['"]status['"]\s*:\s*(\d{3})/.exec(t)
  if (!statusMatch) return null
  const status = Number(statusMatch[1])
  if (!Number.isFinite(status)) return null
  const bodyMatch = /['"]body['"]\s*:\s*(\{[\s\S]*\}|\[[\s\S]*\]|'[^']*'|"[^"]*"|True|False|None|\d+)/.exec(
    t,
  )
  if (!bodyMatch) return null
  return {
    status,
    statusLabel: statusLabel(status),
    bodyPreview:
      bodyMatch[1].length > 120
        ? `${bodyMatch[1].slice(0, 119)}…`
        : bodyMatch[1],
  }
}
