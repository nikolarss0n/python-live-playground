import { useId } from 'react'

/** Lines typed here are what input() reads, one per call, like typing into a terminal. */
export function InputsField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId()
  const hintId = `${id}-hint`
  const rows = Math.min(4, Math.max(1, value.split('\n').length))
  return (
    <div className="inputs-field">
      <label htmlFor={id}>Inputs</label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        spellCheck={false}
        autoComplete="off"
        aria-describedby={hintId}
        placeholder="Type what input() should read"
        onChange={(event) => onChange(event.target.value)}
      />
      <span id={hintId} className="inputs-field-hint">One line per input() call</span>
    </div>
  )
}
