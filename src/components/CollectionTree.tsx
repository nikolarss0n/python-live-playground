import { useState } from 'react'
import type { CollectionNode } from '../execution/collectionStructure'
import {
  collectionLabel,
  collectionSummary,
  isCollectionRoot,
} from '../execution/collectionStructure'

type CollectionTreeProps = {
  node: CollectionNode
  /** Visual tone: print (default text) or expression values. */
  tone?: 'print' | 'expr'
  depth?: number
}

/**
 * Quiet monospace indent tree for list / dict / set / tuple results.
 * Root starts open; nested collections start collapsed.
 */
export function CollectionTree({
  node,
  tone = 'print',
  depth = 0,
}: CollectionTreeProps) {
  if (!isCollectionRoot(node)) {
    return (
      <span className={`coll-atom coll-tone-${tone}`}>
        <span className="coll-atom-value">{node.preview}</span>
        <span className="coll-type-chip" title={`Python type: ${node.type}`}>
          {node.type}
        </span>
      </span>
    )
  }

  return <CollectionBranch node={node} tone={tone} depth={depth} />
}

function CollectionBranch({
  node,
  tone,
  depth,
}: {
  node: Exclude<CollectionNode, { kind: 'atom' }>
  tone: 'print' | 'expr'
  depth: number
}) {
  const [open, setOpen] = useState(depth === 0)
  const label = collectionLabel(node)
  const summary = collectionSummary(node)
  const empty = node.length === 0

  return (
    <div className={`coll-tree coll-tone-${tone}`} data-depth={depth}>
      <button
        type="button"
        className="coll-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        disabled={empty}
      >
        <span className="coll-chevron" aria-hidden="true">
          {empty ? '·' : open ? '▾' : '▸'}
        </span>
        <span className="coll-label">{label}</span>
        {(!open || empty) && (
          <span className="coll-summary">{summary}</span>
        )}
      </button>

      {open && !empty && (
        <ul className="coll-children">
          {node.kind === 'dict'
            ? node.entries.map((entry, i) => (
                <li key={i} className="coll-row coll-row-dict">
                  <span className="coll-key">
                    <CollectionTree
                      node={entry.key}
                      tone={tone}
                      depth={depth + 1}
                    />
                  </span>
                  <span className="coll-sep" aria-hidden="true">
                    :
                  </span>
                  <span className="coll-value">
                    <CollectionTree
                      node={entry.value}
                      tone={tone}
                      depth={depth + 1}
                    />
                  </span>
                </li>
              ))
            : node.items.map((item, i) => (
                <li key={i} className="coll-row">
                  {node.kind !== 'set' ? (
                    <span className="coll-index">{i}</span>
                  ) : (
                    <span
                      className="coll-index coll-index-set"
                      aria-hidden="true"
                    >
                      ·
                    </span>
                  )}
                  <span className="coll-value">
                    <CollectionTree node={item} tone={tone} depth={depth + 1} />
                  </span>
                </li>
              ))}
          {node.truncated ? (
            <li className="coll-row coll-truncated">
              <span className="coll-summary">… truncated</span>
            </li>
          ) : null}
        </ul>
      )}
    </div>
  )
}
