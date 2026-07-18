import type { CollectionNode } from '../execution/collectionStructure'
import { isCollectionRoot } from '../execution/collectionStructure'

/** True when a structure looks like a short list of token-like atoms. */
export function looksLikeTokenList(node: CollectionNode | undefined | null): boolean {
  if (!isCollectionRoot(node)) return false
  if (node.kind !== 'list' && node.kind !== 'tuple') return false
  if (node.length === 0 || node.length > 48) return false
  if (node.items.length === 0) return false
  return node.items.every((item) => {
    if (item.kind !== 'atom') return false
    if (item.type === 'str') return item.preview.length <= 40
    // also allow bare short symbols if typed oddly
    return item.preview.length > 0 && item.preview.length <= 24
  })
}

function stripQuotes(preview: string): string {
  if (
    (preview.startsWith("'") && preview.endsWith("'")) ||
    (preview.startsWith('"') && preview.endsWith('"'))
  ) {
    return preview.slice(1, -1)
  }
  return preview
}

type TokenChipsProps = {
  node: CollectionNode
  tone?: 'print' | 'expr'
}

/**
 * Quiet chip row for token lists (AI foundations).
 * Sits above the expandable collection tree.
 */
export function TokenChips({ node, tone = 'print' }: TokenChipsProps) {
  if (!looksLikeTokenList(node) || !isCollectionRoot(node) || node.kind === 'dict') {
    return null
  }

  return (
    <div
      className={`token-chips token-chips-${tone}`}
      aria-label={`${node.length} tokens`}
    >
      {node.items.map((item, i) => {
        if (item.kind !== 'atom') return null
        return (
          <span key={`${item.preview}-${i}`} className="token-chip">
            {stripQuotes(item.preview)}
          </span>
        )
      })}
      {node.truncated ? <span className="token-chip is-more">…</span> : null}
    </div>
  )
}
