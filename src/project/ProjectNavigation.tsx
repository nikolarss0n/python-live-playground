import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useModalFocus } from '../components/useModalFocus'
import { ExplorerContextMenu, type ExplorerMenuTarget } from './ExplorerContextMenu'
import { ProjectFileActions } from './ProjectFileActions'
import { ProjectFileIcon } from './ProjectFileIcon'
import { parentFolder } from './paths'
import { closeProjectTab } from './model'
import type { ProjectWorkspace } from './useProjectWorkspace'
import './project-navigation.css'

export type ProjectFileCounts = Readonly<Record<string, { results: number; errors: number }>>
type NavigationProps = { workspace: ProjectWorkspace; counts: ProjectFileCounts }

type TreeItem = { name: string; path: string; children: TreeItem[] | null }

function fileTree(files: string[], folders: string[]) {
  const root: TreeItem[] = []
  const children = new Map<string, TreeItem[]>([['', root]])
  for (const path of [...folders].sort()) {
    const items: TreeItem[] = []
    children.get(parentFolder(path))?.push({ path, name: path.slice(path.lastIndexOf('/') + 1), children: items })
    children.set(path, items)
  }
  for (const path of files) {
    children.get(parentFolder(path))?.push({ path, name: path.slice(path.lastIndexOf('/') + 1), children: null })
  }
  for (const siblings of children.values()) {
    siblings.sort((a, b) => Number(!!b.children) - Number(!!a.children) || a.name.localeCompare(b.name))
  }
  return root
}

function CountBadge({ count, kind }: { count: number; kind: 'result' | 'error' }) {
  if (!count) return null
  const description = count + ' ' + kind + (count === 1 ? '' : 's')
  return <span role="img" className={'project-badge project-' + kind} aria-label={description} title={description}>{count}</span>
}

function UnsavedDot() {
  return <span className="project-unsaved" role="img" aria-label="Unsaved changes" title="Unsaved changes" />
}

function FileTree({ workspace, counts, onPick }: NavigationProps & { onPick?: () => void }) {
  const { project, openFile, dirtyPaths } = workspace
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [selection, select] = useState('')
  const [draftParent, setDraftParent] = useState<string | null>(null)
  const [menu, setMenu] = useState<ExplorerMenuTarget | null>(null)
  const [folderError, setFolderError] = useState('')
  const folderInput = useRef<HTMLInputElement>(null)
  const folderTrigger = useRef<HTMLButtonElement>(null)
  const pendingFocus = useRef<string | null>(null)
  const tree = useRef<HTMLElement>(null)
  const errorId = useId()
  const parent = project.folders.includes(selection) ? selection
    : Object.hasOwn(project.files, selection) ? parentFolder(selection) : ''

  useLayoutEffect(() => {
    if (draftParent !== null) folderInput.current?.focus()
    else if (pendingFocus.current !== null) {
      const path = pendingFocus.current
      focusPath(path)
      pendingFocus.current = null
    }
  }, [draftParent, project, menu])

  function showMenu(path: string, trigger: HTMLButtonElement, x?: number, y?: number) {
    const rect = trigger.getBoundingClientRect()
    select(path)
    setMenu({ kind: !path ? 'root' : Object.hasOwn(project.files, path) ? 'file' : 'folder', path, trigger, x: x ?? rect.left, y: y ?? rect.bottom })
  }

  function focusPath(path: string) {
    const button = tree.current?.querySelector<HTMLButtonElement>('button[title="' + CSS.escape(path) + '"]')
    const target = button ?? folderTrigger.current
    target?.focus()
  }

  function startFolder(directory = parent) {
    setCollapsed(previous => new Set([...previous].filter(folder => directory !== folder && !directory.startsWith(folder + '/'))))
    setDraftParent(directory)
    setFolderError('')
    folderInput.current?.focus()
  }

  // Reveal the active file when opened from outside the tree, including a result link.
  useEffect(() => {
    setCollapsed(previous => {
      const next = new Set([...previous].filter(folder => !project.activePath.startsWith(folder + '/')))
      return next.size === previous.size ? previous : next
    })
  }, [project.activePath])

  function toggleFolder(path: string) {
    setCollapsed(previous => {
      const next = new Set(previous)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function rows(items: TreeItem[], directory: string) {
    return <ul>{draftParent === directory && <li>
      <form className="project-folder-input project-row" onSubmit={event => {
        event.preventDefault()
        const name = folderInput.current?.value ?? ''
        const path = directory ? directory + '/' + name : name
        const problem = workspace.createFolder(path)
        if (problem) { setFolderError(problem); return }
        pendingFocus.current = path
        select(path)
        setDraftParent(null)
      }}>
        <ProjectFileIcon path="" folder="closed" />
        <input aria-label="Folder name" aria-invalid={!!folderError} aria-describedby={folderError ? errorId : undefined}
          autoComplete="off" spellCheck={false} ref={folderInput}
          onChange={() => setFolderError('')} onBlur={() => setDraftParent(null)}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              setDraftParent(null)
              folderTrigger.current?.focus()
            }
          }} />
      </form>
      {folderError && <p className="project-folder-error" role="alert" id={errorId}>{folderError}</p>}
    </li>}{items.map(item => {
      const folderOpen = !collapsed.has(item.path)
      const count = counts[item.path]
      const current = item.path === project.activePath
      return <li key={item.path}>{item.children ? <>
        <button type="button" className="project-row" title={item.path} aria-expanded={folderOpen}
          aria-haspopup="menu"
          data-selected={selection === item.path || undefined}
          onClick={() => { select(item.path); toggleFolder(item.path) }}>
          <span aria-hidden="true" className={'project-chevron' + (folderOpen ? ' is-open' : '')} />
          <ProjectFileIcon path={item.path} folder={folderOpen ? 'open' : 'closed'} />
          <span className="project-row-name">{item.name}</span>
        </button>
        {folderOpen && rows(item.children, item.path)}
      </> : <button type="button" className="project-row project-file-row" title={item.path} aria-haspopup="menu"
        aria-current={current ? 'true' : undefined} onClick={() => { select(item.path); openFile(item.path); onPick?.() }}>
        <ProjectFileIcon path={item.path} />
        <span className="project-row-name">{item.name}</span>
        <span className="project-row-meta">
          {dirtyPaths.has(item.path) && <UnsavedDot />}
          {item.path === project.entry && <span className="project-badge project-entry" title="Entry file">main</span>}
          <CountBadge kind="result" count={count?.results ?? 0} />
          <CountBadge kind="error" count={count?.errors ?? 0} />
        </span>
      </button>}</li>
    })}</ul>
  }

  return <div className="project-tree-content" onContextMenu={event => {
    if (!(event.target instanceof Element) || event.target.closest('input, textarea, [contenteditable="true"]')) return
    event.preventDefault()
    if (event.target.closest('.project-folder-menu')) return
    const row = event.target.closest<HTMLButtonElement>('button.project-row')
    const trigger = row ?? folderTrigger.current
    if (trigger) showMenu(row?.title ?? '', trigger, event.clientX, event.clientY)
  }} onKeyDown={event => {
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
    if (!(event.target instanceof HTMLButtonElement) || !event.target.matches('.project-row, .project-root')) return
    event.preventDefault()
    showMenu(event.target.matches('.project-row') ? event.target.title : '', event.target)
  }}>
    <ProjectFileActions workspace={workspace} closeDrawer={onPick} parent={parent} selectRoot={() => select('')}
      onNewFolder={() => startFolder()} selectedFolder={project.folders.includes(selection) ? selection : null}
      onFolderMenu={trigger => showMenu(selection, trigger)} folderTrigger={folderTrigger} />
    <nav ref={tree} aria-label="Project files" className="project-tree">
      {rows(fileTree(Object.keys(project.files), project.folders), '')}
    </nav>
    {menu && (menu.kind === 'root' || project.folders.includes(menu.path) || Object.hasOwn(project.files, menu.path)) && <ExplorerContextMenu key={menu.path} target={menu} workspace={workspace}
      close={() => setMenu(null)} newFolder={() => { setMenu(null); startFolder(menu.path) }}
      onRename={name => {
        const parent = parentFolder(menu.path)
        const path = parent ? parent + '/' + name : name
        setMenu(null)
        select(path)
        pendingFocus.current = path
      }}
      onDelete={() => {
        const path = parentFolder(menu.path)
        setMenu(null)
        select(path)
        pendingFocus.current = path
      }}
      onFile={() => { setMenu(null); select(''); onPick?.() }} />}
  </div>
}

export function ProjectExplorer(props: NavigationProps) {
  return <aside id="workspace-files" aria-label="Project explorer" className="project-explorer"><FileTree {...props} /></aside>
}

function ProjectDrawer({ open, onClose, ...props }: NavigationProps & { open: boolean; onClose: () => void }) {
  const dialog = useModalFocus(open, onClose)
  useEffect(() => {
    if (!open || !window.matchMedia) return
    const media = window.matchMedia('(min-width: 801px)')
    const onResize = () => { if (media.matches) onClose() }
    media.addEventListener('change', onResize)
    return () => media.removeEventListener('change', onResize)
  }, [open, onClose])
  if (!open) return null
  return createPortal(<div className="project-drawer-overlay" onClick={onClose}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-label="Project explorer" className="project-drawer"
      tabIndex={-1} onClick={event => event.stopPropagation()}><FileTree {...props} onPick={onClose} /></div>
  </div>, document.body)
}

export function ProjectFileBar({ workspace, counts }: NavigationProps) {
  const { project, dirtyPaths, openFile, closeFile } = workspace
  const { activePath, openPaths } = project
  const [tabMenu, setTabMenu] = useState<ExplorerMenuTarget | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const tabs = useRef(new Map<string, HTMLButtonElement>())
  const strip = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const tab = tabs.current.get(activePath)?.parentElement
    const viewport = strip.current
    if (!tab || !viewport) return
    const rect = tab.getBoundingClientRect()
    const view = viewport.getBoundingClientRect()
    if (rect.left < view.left) viewport.scrollLeft -= view.left - rect.left + 6
    else if (rect.right > view.right) viewport.scrollLeft += rect.right - view.right + 6
  }, [activePath, openPaths])

  function closeTab(path: string) {
    if (openPaths.length < 2) return
    const nextActive = closeProjectTab(project, path).activePath
    closeFile(path)
    tabs.current.get(nextActive)?.focus()
  }

  function openTabMenu(path: string, trigger: HTMLButtonElement, x?: number, y?: number) {
    const rect = trigger.getBoundingClientRect()
    setTabMenu({ kind: 'file', path, trigger, x: x ?? rect.left, y: y ?? rect.bottom })
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, path: string) {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault()
      openTabMenu(path, event.currentTarget)
      return
    }
    const index = openPaths.indexOf(path)
    let target: string
    switch (event.key) {
      case 'ArrowRight': target = openPaths[(index + 1) % openPaths.length]; break
      case 'ArrowLeft': target = openPaths[(index - 1 + openPaths.length) % openPaths.length]; break
      case 'Home': target = openPaths[0]; break
      case 'End': target = openPaths[openPaths.length - 1]; break
      case 'Delete': event.preventDefault(); closeTab(path); return
      default: return
    }
    event.preventDefault()
    openFile(target)
    tabs.current.get(target)?.focus()
  }

  return <div className="project-file-bar">
    <div className="project-tabs-row">
      <button type="button" className="project-menu-toggle project-icon-button" title="Open project files"
        aria-label="Open project files" aria-expanded={drawerOpen} aria-haspopup="dialog" onClick={() => setDrawerOpen(true)}>
        <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 5h14M3 10h14M3 15h14" /></svg>
      </button>
      <div className="project-tabs" ref={strip} role="tablist" aria-label="Open files">
        {openPaths.map(path => {
          const selected = activePath === path
          return <div key={path} role="presentation" className={'project-pill' + (selected ? ' is-active' : '')}>
            <button type="button" role="tab" aria-label={path} aria-selected={selected} aria-controls="project-editor-panel"
              tabIndex={selected ? 0 : -1} title={path} aria-haspopup="menu" onContextMenu={event => {
                event.preventDefault()
                openTabMenu(path, event.currentTarget, event.clientX, event.clientY)
              }} onClick={() => openFile(path)} onKeyDown={event => onTabKey(event, path)}
              ref={element => { if (element) tabs.current.set(path, element); else tabs.current.delete(path) }}>
              <ProjectFileIcon path={path} /><span className="project-tab-name">{path.split('/').at(-1)}</span>
              {dirtyPaths.has(path) && <UnsavedDot />}
              <CountBadge kind="error" count={counts[path]?.errors ?? 0} />
            </button>
            {openPaths.length > 1 && <button type="button" className="project-tab-close" aria-label={'Close ' + path}
              title={'Close ' + path} tabIndex={selected ? 0 : -1} onClick={() => closeTab(path)}>×</button>}
          </div>
        })}
      </div>
    </div>
    {tabMenu && Object.hasOwn(project.files, tabMenu.path) && <ExplorerContextMenu key={tabMenu.path} target={tabMenu}
      workspace={workspace} close={() => setTabMenu(null)} onFile={() => setTabMenu(null)}
      onRename={() => setTabMenu(null)} onDelete={() => setTabMenu(null)} />}
    <ProjectDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} workspace={workspace} counts={counts} />
  </div>
}
