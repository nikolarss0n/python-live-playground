/** Shown while code from a shared link is waiting to be run; it never runs until the learner asks. */
export function SharedCodePill({ onRun }: { onRun: () => void }) {
  return (
    <span className="starter-pill" role="status">
      <span className="starter-pill-text">Shared code has not run. Read it first.</span>
      <button type="button" className="starter-pill-action" onClick={onRun}>Run it</button>
    </span>
  )
}
