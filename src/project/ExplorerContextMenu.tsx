import { parentFolder } from './paths'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { ProjectWorkspace } from './useProjectWorkspace'

export interface ExplorerMenuTarget {
  kind: 'root' | 'folder' | 'file'
  path: string
  x: number
  y: number
  trigger: HTMLButtonElement
}

export function ExplorerContextMenu({ target, workspace, close, newFolder, onRename, onDelete, onFile }: {
  target: ExplorerMenuTarget
  workspace: ProjectWorkspace
  close: () => void
  newFolder?: () => void
  onRename: (name: string) => void
  onDelete: () => void
  onFile: () => void
}) {
  const { path, trigger, kind } = target
  const isFile = kind === 'file'
  const label = isFile ? 'file' : 'folder'
  const [mode, setMode] = useState<'menu' | 'rename' | 'file' | 'delete'>('menu')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const panel = useRef<HTMLDivElement>(null)
  const protectsEntry = isFile ? workspace.project.entry === path : workspace.project.entry.startsWith(path + '/')

  function cancel() {
    close()
    trigger.focus()
  }

  useLayoutEffect(() => {
    const element = panel.current
    if (!element) return
    const position = () => {
      element.style.left = Math.max(4, Math.min(target.x, window.innerWidth - element.offsetWidth - 4)) + 'px'
      element.style.top = Math.max(4, Math.min(target.y, window.innerHeight - element.offsetHeight - 4)) + 'px'
    }
    position()
    const observer = new ResizeObserver(position)
    observer.observe(element)
    window.addEventListener('resize', position)
    const input = element.querySelector('input')
    if (input) { input.focus(); input.select() }
    else element.querySelector<HTMLButtonElement>('button:enabled')?.focus()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', position)
    }
  }, [target, mode])

  useEffect(() => {
    const outside = (event: Event) => {
      if (!panel.current?.contains(event.target as Node)) close()
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('focusin', outside)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('focusin', outside)
    }
  }, [close])

  function keyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      cancel()
    }
    if (mode !== 'menu') return
    const items = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:enabled') ?? [])
    const index = items.findIndex(item => item === document.activeElement)
    const positions: Record<string, number> = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.length - 1 }
    if (Object.hasOwn(positions, event.key)) {
      event.preventDefault()
      items[(positions[event.key] + items.length) % items.length]?.focus()
    }
  }

  return <div ref={panel} role={mode === 'menu' ? 'menu' : 'dialog'} aria-label={kind === 'root' ? 'Project actions' : (isFile ? 'File' : 'Folder') + ' actions for ' + path}
    className="project-folder-menu project-action-panel" onKeyDown={keyDown}>
    {mode === 'menu' ? <div className="project-action-list" role="none">
      {isFile && <button role="menuitem" onClick={() => { workspace.openFile(path); onFile() }}>Open</button>}
      {!isFile && <><button role="menuitem" onClick={() => setMode('file')}>New File…</button>
      <button role="menuitem" onClick={newFolder}>New Folder…</button></>}
      {isFile && path.endsWith('.py') && <button role="menuitem" disabled={protectsEntry} onClick={() => {
        const problem = workspace.setEntry(path)
        if (problem) setError(problem)
        else cancel()
      }}>Set as entry file</button>}
      {kind !== 'root' && <><hr />
      <button role="menuitem" onClick={() => { setName(path.split('/').at(-1) ?? path); setMode('rename') }}>Rename…</button>
      <button role="menuitem" disabled={protectsEntry} title={protectsEntry ? 'Choose another entry file first.' : undefined}
        onClick={() => setMode('delete')}>Delete…</button></>}
    </div> : mode === 'delete' ? <div className="project-delete-confirm">
      <p>Delete <strong>{path}</strong>{isFile ? '' : ' and all its contents'}?</p>
      <div><button onClick={cancel}>Cancel</button><button className="project-delete-button" onClick={() => {
        const problem = isFile ? workspace.deleteFile(path) : workspace.deleteFolder(path)
        if (problem) setError(problem)
        else onDelete()
      }}>Delete {label}</button></div>
    </div> : <form className="project-new-file" onSubmit={event => {
      event.preventDefault()
      const directory = mode === 'rename' ? parentFolder(path) : path
      const destination = directory ? directory + '/' + name : name
      let problem: string | null
      if (mode === 'file') problem = workspace.createFile(destination)
      else if (isFile) problem = name.includes('/') ? 'Enter a single file name.' : workspace.renameFile(path, destination)
      else problem = workspace.renameFolder(path, name)
      if (problem) { setError(problem); return }
      if (mode === 'rename') onRename(name)
      else onFile()
    }}>
      <label>{mode === 'rename' ? 'New ' + label + ' name' : 'File name'}<input value={name} required autoComplete="off"
        spellCheck={false} aria-invalid={!!error} onChange={event => { setName(event.target.value); setError('') }} /></label>
      <div><button type="submit">{mode === 'rename' ? 'Rename' : 'Create file'}</button><button type="button" onClick={cancel}>Cancel</button></div>
    </form>}
    {error && <p className="project-action-error" role="alert">{error}</p>}
  </div>
}
