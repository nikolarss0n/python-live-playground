/** Shown while code from a shared link is waiting to be run; it never runs until the learner asks. */
export function SharedCodePill({ onRun }: { onRun: () => void }) {
  return (
    <span className="starter-pill" role="status">
      <span className="starter-pill-text">Shared code has not run. Read it first.</span>
      <button type="button" className="starter-pill-action" onClick={onRun}>Run it</button>
    </span>
  )
}

/** Shown when a shared link stayed closed, because opening it would have cost the learner a draft. */
export function SharedLinkSkippedPill({ onDismiss }: { onDismiss: () => void }) {
  return (
    <span className="starter-pill" role="status">
      <span className="starter-pill-text">Link not opened: backups full.</span>
      <button type="button" className="starter-pill-action is-quiet" onClick={onDismiss}>Dismiss</button>
    </span>
  )
}
