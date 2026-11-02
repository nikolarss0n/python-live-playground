import { useEffect, useState } from 'react'

const UNDO_MS = 8000

/** Puts the task's starter back in the editor; the old draft is kept as a backup, so Undo can bring it back for a moment. */
export function ResetPill({ lessonId, atStarter, onReset, onUndo, canUndo }: {
  lessonId: string
  atStarter: boolean
  onReset: () => boolean | void
  onUndo?: () => void
  canUndo: boolean
}) {
  const [undoFor, setUndoFor] = useState<string | null>(null)

  useEffect(() => {
    if (!undoFor) return
    const timer = window.setTimeout(() => setUndoFor(null), UNDO_MS)
    return () => window.clearTimeout(timer)
  }, [undoFor])

  if (undoFor === lessonId && canUndo && onUndo) {
    return (
      <button type="button" className="reset-pill is-undo" onClick={() => { onUndo(); setUndoFor(null) }}>
        Undo reset
      </button>
    )
  }

  return (
    <button
      type="button"
      className="reset-pill"
      disabled={atStarter}
      title={atStarter ? 'Already at the starter code' : 'Start this task over from the starter code'}
      onClick={() => { if (onReset() !== false) setUndoFor(lessonId) }}
    >
      <span aria-hidden="true">↺</span>
      Reset
    </button>
  )
}
