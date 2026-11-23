import { useEffect, useId, useRef, useState, type RefObject, type FormEvent } from 'react'
import type { ProjectWorkspace } from './useProjectWorkspace'

type Action = 'create' | 'choose' | 'rename' | 'delete'

export function ProjectFileActions({ workspace, closeDrawer, parent, selectRoot, onNewFolder, selectedFolder, onFolderMenu, folderTrigger }: {
  selectedFolder: string | null
  onFolderMenu: (trigger: HTMLButtonElement) => void
  parent: string
  selectRoot: () => void
  onNewFolder: () => void
  folderTrigger: RefObject<HTMLButtonElement | null>
  workspace: ProjectWorkspace
  closeDrawer?: () => void
}) {
  const { activePath, entry } = workspace.project
  const [action, setAction] = useState<Action | null>(null)
  const [path, setPath] = useState('')
  const [error, setError] = useState<string | null>(null)
  const controls = useRef<HTMLDivElement>(null)
  const add = useRef<HTMLButtonElement>(null)
  const more = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const cancelDelete = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const errorId = useId()

  useEffect(() => {
    setAction(null)
    setError(null)
  }, [activePath])

  useEffect(() => {
    if (!action) return
    input.current?.focus()
    cancelDelete.current?.focus()
    const outside = (event: MouseEvent) => {
      // A menu action can replace the clicked button with an input before the event reaches document.
      if (controls.current && !event.composedPath().includes(controls.current)) setAction(null)
    }
    document.addEventListener('click', outside)
    return () => document.removeEventListener('click', outside)
  }, [action])

  function show(next: Action) {
    setError(null)
    setPath(next === 'rename' ? activePath : next === 'create' && parent ? parent + '/' : '')
    setAction(next)
  }

  function close() {
    setAction(null)
    setError(null)
    const trigger = action === 'create' ? add : more
    trigger.current?.focus()
  }

  function finish(problem: string | null) {
    if (problem) {
      setError(problem)
      input.current?.focus()
      return
    }
    close()
    if (action === 'create') closeDrawer?.()
  }

  function submitPath(event: FormEvent) {
    event.preventDefault()
    finish(action === 'create' ? workspace.createFile(path) : workspace.renameFile(activePath, path))
  }

  return <div ref={controls} onKeyDown={event => {
    if (action && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
  }}>
    <div className="project-tree-heading">
      <h2><button type="button" className="project-root" title="Select project root" onClick={selectRoot}>Project</button></h2>
      <button type="button" ref={add} className="project-icon-button" title="New file" aria-label="New file"
        aria-controls={action === 'create' ? panelId : undefined} aria-expanded={action === 'create'}
        onClick={() => action === 'create' ? close() : show('create')}>+</button>
      <button type="button" ref={folderTrigger} className="project-icon-button" aria-label="New folder" title="New folder"
        onClick={() => { setAction(null); onNewFolder() }}>
        <svg aria-hidden="true" width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor"
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 15H2.5V4h5l2 2h7v3M14 10v7m-3.5-3.5h7" />
        </svg>
      </button>
      <button type="button" ref={more} className="project-icon-button" title={'Actions for ' + (selectedFolder ?? activePath)}
        aria-label={'Actions for ' + (selectedFolder ?? activePath)} aria-haspopup={selectedFolder ? 'menu' : undefined} aria-controls={action && action !== 'create' ? panelId : undefined}
        aria-expanded={!!action && action !== 'create'} onClick={event => {
          if (selectedFolder) { setAction(null); onFolderMenu(event.currentTarget) }
          else if (action && action !== 'create') close()
          else show('choose')
        }}>⋯</button>
      {closeDrawer && <button type="button" className="project-icon-button" aria-label="Close project files" onClick={closeDrawer}>×</button>}
    </div>
    {action && <div id={panelId} className="project-action-panel">
      {action !== 'create' && <div className="project-action-path">{activePath}</div>}
      {action === 'choose' && <div className="project-action-list" role="group" aria-label="File actions">
        <button type="button" onClick={() => show('rename')}>Rename or move…</button>
        <button type="button" disabled={!activePath.endsWith('.py') || activePath === entry}
          onClick={() => finish(workspace.setEntry(activePath))}>Set as entry file</button>
        <button type="button" disabled={activePath === entry} onClick={() => show('delete')}>Delete file…</button>
      </div>}
      {(action === 'create' || action === 'rename') && <form className="project-new-file" onSubmit={submitPath}>
        <label>{action === 'create' ? 'File path' : 'New file path'}
          <input ref={input} value={path} placeholder="helpers/format.py" autoComplete="off" spellCheck={false}
            aria-invalid={!!error} aria-describedby={error ? errorId : undefined}
            onChange={event => { setPath(event.target.value); setError(null) }} />
        </label>
        <div><button type="submit">{action === 'create' ? 'Create file' : 'Save path'}</button>
          <button type="button" onClick={close}>Cancel</button></div>
      </form>}
      {action === 'delete' && <div className="project-delete-confirm">
        <p>Delete this file and its contents?</p>
        <div><button type="button" ref={cancelDelete} onClick={close}>Cancel</button>
          <button type="button" className="project-delete-button" onClick={() => finish(workspace.deleteFile(activePath))}>Delete file</button></div>
      </div>}
      {error && <p className="project-action-error" id={errorId} role="alert">{error}</p>}
    </div>}
  </div>
}
