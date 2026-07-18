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
}

function atomText(node: CollectionNode | undefined): string | null {
  if (!node || node.kind !== 'atom') return null
  return node.preview
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
    500: 'Server Error',
  }
  return map[code] ?? 'HTTP'
}

function nodePreview(node: CollectionNode | undefined, max = 120): string {
  if (!node) return ''
  if (node.kind === 'atom') {
    const p = node.preview
    return p.length > max ? `${p.slice(0, max - 1)}…` : p
  }
  if (node.kind === 'dict') {
    const parts = node.entries.slice(0, 4).map((e) => {
      const k = atomText(e.key) ?? '…'
      const v =
        e.value.kind === 'atom' ? e.value.preview : `${e.value.kind}(…)`
      return `${k}: ${v}`
    })
    const more = node.length > parts.length ? ', …' : ''
    return `{${parts.join(', ')}${more}}`
  }
  if (node.kind === 'list' || node.kind === 'tuple' || node.kind === 'set') {
    return `${node.kind}(${node.length})`
  }
  return ''
}

/** Structure from worker for a dict that looks like an HTTP response. */
export function httpResponseFromStructure(
  node: CollectionNode | undefined | null,
): HttpResponseView | null {
  if (!node || node.kind !== 'dict') return null
  let statusNode: CollectionNode | undefined
  let bodyNode: CollectionNode | undefined
  let headersNode: CollectionNode | undefined
  for (const entry of node.entries) {
    const key = atomText(entry.key)?.replace(/^['"]|['"]$/g, '')
    if (key === 'status') statusNode = entry.value
    if (key === 'body') bodyNode = entry.value
    if (key === 'headers') headersNode = entry.value
  }
  const status = parseStatus(atomText(statusNode))
  if (status == null || !bodyNode) return null
  return {
    status,
    statusLabel: statusLabel(status),
    bodyPreview: nodePreview(bodyNode),
    headersPreview: headersNode ? nodePreview(headersNode) : undefined,
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
