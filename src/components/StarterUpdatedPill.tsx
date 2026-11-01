/** Shown when a lesson's starter changed after the learner's draft began; restarting keeps the draft as a backup. */
export function StarterUpdatedPill({ onRestart, onKeep }: { onRestart: () => void; onKeep: () => void }) {
  return (
    <span className="starter-pill" role="status">
      <span className="starter-pill-text">This lesson’s starter was updated</span>
      <button type="button" className="starter-pill-action" onClick={onRestart}>Use new starter</button>
      <button type="button" className="starter-pill-action is-quiet" onClick={onKeep}>Keep mine</button>
    </span>
  )
}
