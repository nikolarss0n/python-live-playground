import { useEffect, useId, useRef, useState } from 'react'
import type { SyntaxConcept } from './types'

type ConceptPillsProps = {
  concepts: readonly SyntaxConcept[]
}

export function ConceptPills({ concepts }: ConceptPillsProps) {
  const [openTerm, setOpenTerm] = useState<string | null>(null)
  const cardId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const open = concepts.find((concept) => concept.term === openTerm) ?? null

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpenTerm(null)
      rootRef.current?.querySelector<HTMLButtonElement>('[aria-expanded="true"]')?.focus()
    }
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenTerm(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  if (concepts.length === 0) return null
  return <div className="concept-pills" ref={rootRef}>
    <ul className="concept-pill-list" aria-label="Syntax hints">
      {concepts.map((concept) => {
        const isOpen = concept.term === openTerm
        return <li key={concept.term}>
          <button type="button" className="concept-pill" aria-expanded={isOpen} aria-controls={isOpen ? cardId : undefined}
            onClick={() => setOpenTerm(isOpen ? null : concept.term)}>
            {concept.term}
          </button>
        </li>
      })}
    </ul>
    {open ? <section className="concept-card" id={cardId} role="region" aria-label={open.term}>
      <header>
        <h3>{open.term}</h3>
        <button type="button" className="concept-card-close" aria-label="Close hint" onClick={() => setOpenTerm(null)}>×</button>
      </header>
      <p>{open.explanation}</p>
      <pre><code>{open.example}</code></pre>
    </section> : null}
  </div>
}
