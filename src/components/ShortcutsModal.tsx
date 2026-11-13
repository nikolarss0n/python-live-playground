import { createPortal } from 'react-dom'
import { useModalFocus } from './useModalFocus'

export const EDITOR_EXIT_HINT = 'Esc then Tab: leave the editor'

type ShortcutsModalProps = { open: boolean; onClose: () => void; hint: string }

export function ShortcutsModal({ open, onClose, hint }: ShortcutsModalProps) {
  const dialog = useModalFocus(open, onClose)
  if (!open) return null
  return createPortal(
    <div className="help-overlay" role="presentation" onClick={onClose}>
      <div className="help-card" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"
        ref={dialog} tabIndex={-1} onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => { if (event.key === '?') { event.preventDefault(); onClose() } }}>
        <h2 className="help-title">Shortcuts</h2>
        <ul className="help-list">
          <li><kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>Enter</kbd> Run now</li>
          <li><kbd>Esc</kbd> Stop / close this help</li>
          <li><kbd>?</kbd> Toggle shortcuts</li>
          <li>{EDITOR_EXIT_HINT}</li>
        </ul>
        <p className="help-note">{hint}</p>
        <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
      </div>
    </div>, document.body,
  )
}
