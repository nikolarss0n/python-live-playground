import { useState } from 'react'
import type { LessonCompare } from '../examples'

type CompareSnippetProps = {
  compare: LessonCompare
}

/**
 * Quiet collapsible wrong vs fixed example — stays in the lesson chrome,
 * not a second IDE panel.
 */
export function CompareSnippet({ compare }: CompareSnippetProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="compare-snippet">
      <button
        type="button"
        className="linkish compare-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? 'Hide wrong vs fix' : 'Show wrong vs fix'}
      </button>
      {open && (
        <div className="compare-body">
          {compare.note ? (
            <p className="compare-note">{compare.note}</p>
          ) : null}
          <div className="compare-cols">
            <div className="compare-col compare-wrong">
              <span className="compare-col-label">Wrong</span>
              <pre className="compare-code">{compare.wrong}</pre>
            </div>
            <div className="compare-col compare-fixed">
              <span className="compare-col-label">Fixed</span>
              <pre className="compare-code">{compare.fixed}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
