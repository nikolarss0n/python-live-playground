import { useRef, useState, type ReactNode, type RefObject } from 'react'
import { readPreference, writePreference } from '../preferences'
import { useWideLayout } from '../useWideLayout'

function usePosition(key: string, fallback: number) {
  const [value, setValue] = useState(() => {
    const stored = Number(readPreference(key))
    return stored > 0 && stored < 100 ? stored : fallback
  })
  return {
    value,
    move: (position: number, save: boolean) => {
      setValue(position)
      if (save) writePreference(key, String(position))
    },
  }
}

type DividerProps = {
  label: string
  controls: string
  vertical: boolean
  value: number
  min: number
  max: number
  move: (position: number, save: boolean) => void
}

function Divider({ label, controls, vertical, value, min, max, move }: DividerProps) {
  const drag = useRef<{ id: number; offset: number } | null>(null)
  const clamp = (position: number) => Math.min(max, Math.max(min, position))
  function pointerPosition(handle: HTMLElement, clientX: number, clientY: number) {
    const rect = handle.parentElement!.getBoundingClientRect()
    return vertical ? 100 * (clientX - rect.left) / rect.width : 100 * (clientY - rect.top) / rect.height
  }
  return <div className="split" role="separator" tabIndex={0} aria-label={label} title={label}
    aria-controls={controls} aria-orientation={vertical ? 'vertical' : 'horizontal'}
    aria-valuemin={Math.round(min)} aria-valuemax={Math.round(max)} aria-valuenow={Math.round(value)}
    onPointerDown={event => {
      if (event.button !== 0 || !event.isPrimary) return
      const handle = event.currentTarget
      handle.setPointerCapture(event.pointerId)
      drag.current = { id: event.pointerId, offset: pointerPosition(handle, event.clientX, event.clientY) - value }
    }}
    onPointerMove={event => {
      if (drag.current?.id !== event.pointerId) return
      move(clamp(pointerPosition(event.currentTarget, event.clientX, event.clientY) - drag.current.offset), false)
    }}
    onPointerUp={event => {
      if (drag.current?.id !== event.pointerId) return
      move(clamp(pointerPosition(event.currentTarget, event.clientX, event.clientY) - drag.current.offset), true)
      drag.current = null
    }}
    onLostPointerCapture={() => { drag.current = null }}
    onKeyDown={event => {
      const step = event.shiftKey ? 10 : 2
      let next: number
      switch (event.key) {
        case 'Home': next = min; break
        case 'End': next = max; break
        case vertical ? 'ArrowLeft' : 'ArrowUp': next = value - step; break
        case vertical ? 'ArrowRight' : 'ArrowDown': next = value + step; break
        default: return
      }
      event.preventDefault()
      move(clamp(next), true)
    }}
  />
}

type WorkspaceProps = {
  workspaceRef?: RefObject<HTMLElement | null>
  pathKind?: string
  files?: ReactNode
  editor: ReactNode
  children: ReactNode
}

export function ResizableWorkspace({ workspaceRef, pathKind, files, editor, children }: WorkspaceProps) {
  const wide = useWideLayout()
  const mode = files ? 'project' : 'scratchpad'
  const sidebar = usePosition('plp-files-split', 17)
  const columns = usePosition(`plp-${mode}-column-split`, files ? 60 : 50)
  const rows = usePosition(`plp-${mode}-row-split`, 52.5)
  const editorEnd = wide ? columns : rows
  const hasSidebar = wide && Boolean(files)
  const filesEnd = hasSidebar ? Math.max(10, Math.min(sidebar.value, 42)) : 0
  const min = filesEnd + 20
  const end = Math.max(min, Math.min(editorEnd.value, 82))
  const editorTrack = `minmax(0, calc(${end - filesEnd}% - ${hasSidebar ? 1 : 0}px)) 1px minmax(0, 1fr)`
  const style = wide
    ? { gridTemplateColumns: (hasSidebar ? `${filesEnd}% 1px ` : '') + editorTrack }
    : { gridTemplateRows: editorTrack }
  return <main ref={workspaceRef} className={files ? 'workspace project-workspace' : 'workspace'} data-path-kind={pathKind} style={style}>
    {files}
    {hasSidebar && <Divider label="Resize Files panel" controls="workspace-files" vertical
      value={filesEnd} min={10} max={Math.min(42, end - 20)} move={sidebar.move} />}
    {editor}
    <Divider key={wide ? 'columns' : 'rows'} label="Resize Code and Results panels" controls="workspace-code"
      vertical={wide} value={end} min={min} max={82} move={editorEnd.move} />
    {children}
  </main>
}
