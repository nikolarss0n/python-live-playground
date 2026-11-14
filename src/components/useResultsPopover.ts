import { useLayoutEffect, type RefObject } from 'react'
import './resultsPopover.css'

type Placement = {
  open: boolean
  scope: string
  root: RefObject<HTMLElement | null>
  details: RefObject<HTMLDivElement | null>
}

export function updateScrollCue(element: HTMLDivElement | null) {
  if (element) element.dataset.moreBelow = String(element.scrollHeight - element.clientHeight - element.scrollTop > 1)
}

/** Both study boxes stay in the editor's tab order while occupying the Results pane. */
export function useResultsPopover({ open, scope, root, details }: Placement) {
  useLayoutEffect(() => {
    if (!open) return
    const box = details.current
    const workspace = root.current?.closest('.workspace')
    const results = workspace?.querySelector('.pane-results')
    const header = results?.querySelector('.results-head')
    if (!box || !workspace || !results || !header) return
    const place = () => {
      const origin = workspace.getBoundingClientRect()
      const pane = results.getBoundingClientRect()
      const evidence = results.querySelector('.results-task-evidence')?.getBoundingClientRect()
      const body = results.querySelector('.results-body')?.getBoundingClientRect()
      const top = body?.top ?? Math.max(pane.top, header.getBoundingClientRect().bottom, evidence && evidence.height > 0 ? evidence.bottom : 0) + 8
      box.style.setProperty('--lesson-left', `${pane.left - origin.left + 8}px`)
      box.style.setProperty('--lesson-top', `${top - origin.top}px`)
      box.style.setProperty('--lesson-width', `${Math.max(0, pane.width - 16)}px`)
      box.style.setProperty('--lesson-height', `${Math.max(0, pane.bottom - top - 8)}px`)
      updateScrollCue(box)
    }
    let frame: number | null = null
    let needsPlacement = false
    let disposed = false
    const schedule = (placement: boolean) => {
      if (disposed) return
      needsPlacement ||= placement
      if (frame !== null) return
      frame = window.requestAnimationFrame(() => {
        frame = null
        if (disposed) return
        if (needsPlacement) {
          needsPlacement = false
          place()
        } else updateScrollCue(box)
      })
    }

    // First paint is positioned already; observer deliveries never resize their own targets.
    place()
    const schedulePlacement = () => schedule(true)
    const observer = new ResizeObserver(schedulePlacement)
    for (const element of [workspace, results, header, results.querySelector('.results-body'), results.querySelector('.results-task-evidence')]) {
      if (element) observer.observe(element)
    }

    // Content size affects the scroll cue, not the box's position or dimensions.
    const cueObserver = new ResizeObserver(() => schedule(false))
    let cueTargets = new Set<Element>()
    const observeContent = () => {
      const targets = new Set<Element>([box, ...box.children])
      for (const target of cueTargets) if (!targets.has(target)) cueObserver.unobserve(target)
      for (const target of targets) if (!cueTargets.has(target)) cueObserver.observe(target)
      cueTargets = targets
    }
    observeContent()
    const contentChanges = new MutationObserver(() => {
      if (disposed) return
      observeContent()
      schedule(false)
    })
    contentChanges.observe(box, { childList: true, characterData: true, subtree: true })
    window.addEventListener('resize', schedulePlacement)
    return () => {
      disposed = true
      observer.disconnect()
      cueObserver.disconnect()
      contentChanges.disconnect()
      window.removeEventListener('resize', schedulePlacement)
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [open, scope, root, details])
}
