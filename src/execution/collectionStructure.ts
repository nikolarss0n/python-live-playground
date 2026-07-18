/**
 * Structured Python collections for quiet expandable results.
 * Built by the worker (`_plp_structure`) and rendered as an indent tree.
 */

export type CollectionNode =
  | {
      kind: 'list' | 'tuple' | 'set'
      length: number
      items: CollectionNode[]
      truncated?: boolean
    }
  | {
      kind: 'dict'
      length: number
      entries: { key: CollectionNode; value: CollectionNode }[]
      truncated?: boolean
    }
  | {
      kind: 'atom'
      type: string
      preview: string
    }

export function isCollectionRoot(
  node: CollectionNode | undefined | null,
): node is Exclude<CollectionNode, { kind: 'atom' }> {
  return node != null && node.kind !== 'atom'
}

/** Short type label: list(3), dict(2), set(4) */
export function collectionLabel(node: CollectionNode): string {
  if (node.kind === 'atom') return node.type
  return `${node.kind}(${node.length})`
}

/** One-line collapsed preview of a few children. */
export function collectionSummary(node: CollectionNode, maxParts = 4): string {
  if (node.kind === 'atom') return node.preview

  if (node.kind === 'dict') {
    const parts = node.entries.slice(0, maxParts).map((e) => {
      const k = atomPreview(e.key)
      const v = atomPreview(e.value)
      return `${k}: ${v}`
    })
    const more =
      node.truncated ||
      node.entries.length > maxParts ||
      node.length > node.entries.length
        ? ', …'
        : ''
    return `{${parts.join(', ')}${more}}`
  }

  const parts = node.items.slice(0, maxParts).map((item) => atomPreview(item))
  const more =
    node.truncated ||
    node.items.length > maxParts ||
    node.length > node.items.length
      ? ', …'
      : ''
  const body = parts.join(', ') + more
  if (node.kind === 'tuple')
    return `(${body}${node.length === 1 && !more ? ',' : ''})`
  if (node.kind === 'set') return `{${body}}`
  return `[${body}]`
}

function atomPreview(node: CollectionNode): string {
  if (node.kind === 'atom') {
    const p = node.preview
    return p.length > 40 ? `${p.slice(0, 37)}…` : p
  }
  return collectionLabel(node)
}

/** True when a worker-shaped value looks like a CollectionNode. */
export function parseCollectionNode(raw: unknown): CollectionNode | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const kind = o.kind
  if (kind === 'atom') {
    if (typeof o.type !== 'string' || typeof o.preview !== 'string') return null
    return { kind: 'atom', type: o.type, preview: o.preview }
  }
  if (kind === 'list' || kind === 'tuple' || kind === 'set') {
    if (typeof o.length !== 'number' || !Array.isArray(o.items)) return null
    const items: CollectionNode[] = []
    for (const item of o.items) {
      const n = parseCollectionNode(item)
      if (!n) return null
      items.push(n)
    }
    return {
      kind,
      length: o.length,
      items,
      truncated: o.truncated === true ? true : undefined,
    }
  }
  if (kind === 'dict') {
    if (typeof o.length !== 'number' || !Array.isArray(o.entries)) return null
    const entries: { key: CollectionNode; value: CollectionNode }[] = []
    for (const entry of o.entries) {
      if (!entry || typeof entry !== 'object') return null
      const e = entry as Record<string, unknown>
      const key = parseCollectionNode(e.key)
      const value = parseCollectionNode(e.value)
      if (!key || !value) return null
      entries.push({ key, value })
    }
    return {
      kind: 'dict',
      length: o.length,
      entries,
      truncated: o.truncated === true ? true : undefined,
    }
  }
  return null
}
