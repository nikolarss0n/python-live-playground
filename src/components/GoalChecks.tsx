import type { GoalChecks as GoalChecksView } from '../jev/useJevGoalCheck'

const MARK = { pass: '✓', fail: '✕', checking: '' } as const
const STATE = { pass: 'Passed', fail: 'Not yet', checking: 'Checking' } as const

export function GoalChecks({ checks }: { checks: GoalChecksView }) {
  const { rows, passed, source, refreshing } = checks
  const checking = rows.some((row) => row.status === 'checking')
  const allPass = passed === rows.length
  return (
    <section className={`goal-checks${allPass ? ' is-complete' : ''}`} aria-label="Goal checks">
      <header className="goal-checks-head">
        <span className="goal-checks-title">{allPass ? 'Goal complete' : 'Checks'}</span>
        <span className={`goal-checks-count${refreshing ? ' is-refreshing' : ''}`} role="status">
          {checking ? 'Jev is checking…' : `${passed}/${rows.length} passed${source === 'Jev' ? ' · Jev' : ''}`}
        </span>
      </header>
      <ul className="goal-checks-list">
        {rows.map((row) => (
          <li key={row.id} className={`goal-check is-${row.status}${row.isGoal ? ' is-goal' : ''}`}>
            <span className="goal-check-mark" aria-hidden="true">{MARK[row.status]}</span>
            <span className="goal-check-text">
              <span className="sr-only">{STATE[row.status]}: </span>
              {row.isGoal ? <span className="goal-check-kind">Goal</span> : null}
              {row.label}
              {row.note ? <small>{row.note}</small> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
