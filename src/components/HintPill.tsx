/** Orange pill above the editor that opens a hint bubble on the next ??? blank. */
export function HintPill({ blanks, onClick }: { blanks: number; onClick: () => void }) {
  const label = `Show a hint for the next blank (${blanks} ${blanks === 1 ? 'blank' : 'blanks'} left)`
  return (
    <button
      type="button"
      className="hint-pill"
      aria-label={label}
      title={label}
      // Keep the editor selection so the hint can target the blank under the cursor.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      Hint
      <span className="hint-pill-count" aria-hidden="true">{blanks}</span>
    </button>
  )
}
