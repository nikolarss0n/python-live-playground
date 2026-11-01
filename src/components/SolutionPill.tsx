import { useId } from 'react'
import { solutionParts } from '../solution'

/** Purple pill that shows the whole worked solution in a card; a second click hides it. The learner's code is never touched. */
export function SolutionPill({ starter, answers, open, onToggle }: { starter: string; answers: readonly string[]; open: boolean; onToggle: () => void }) {
  const cardId = useId()
  return (
    <>
      <button
        type="button"
        className={`solution-pill${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-controls={cardId}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onToggle}
      >
        {open ? 'Hide solution' : 'Solution'}
      </button>
      {open ? (
        <div className="solution-card" id={cardId} role="region" aria-label="Full solution">
          <div className="solution-card-head">
            <span>Full solution</span>
            <span className="solution-card-note">Filled parts are highlighted. Your code is unchanged.</span>
          </div>
          <pre className="solution-code">
            {solutionParts(starter, answers).map((part, index) =>
              part.filled ? <mark key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>,
            )}
          </pre>
        </div>
      ) : null}
    </>
  )
}
