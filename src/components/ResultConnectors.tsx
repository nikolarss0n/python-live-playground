import { useCallback, useEffect, useState, type RefObject } from 'react'
import type { EditorView } from '@codemirror/view'
import type { ResultEvent } from '../execution/protocol'

type Ribbon = {
  id: string
  path: string
  kind: ResultEvent['kind']
}

type ResultConnectorsProps = {
  workspaceRef: RefObject<HTMLElement | null>
  editorView: EditorView | null
  events: ResultEvent[]
  activeIndex: number | null
  enabled: boolean
  geometryKey?: number
}

function eventLine(event: ResultEvent): number | null {
  if (event.line == null || event.line < 1) return null
  return event.line
}

type Pt = { x: number; y: number }

/**
 * Constant-thickness band: source-line capsule → curved neck → result-row capsule.
 * Avoids the "flooded polygon" look when source and result sit at different heights.
 */
function buildRibbonPath(
  source: { x: number; y: number; w: number; h: number },
  result: { x: number; y: number; w: number; h: number },
): string {
  const f = (n: number) => n.toFixed(1)

  // Vertical half-thickness matches the shorter of the two rows so the band
  // reads as a bent highlight, not a tall sheet.
  const half = Math.max(8, Math.min(source.h, result.h) * 0.5 + 1)

  const sLeft = source.x
  const sRight = source.x + source.w
  const sMidY = source.y + source.h / 2

  const rLeft = result.x
  const rRight = result.x + result.w
  const rMidY = result.y + result.h / 2

  // Exit / entry points (center of facing edges)
  const a: Pt = { x: sRight, y: sMidY }
  const b: Pt = { x: rLeft, y: rMidY }

  const gap = Math.max(24, b.x - a.x)
  const c1x = a.x + gap * 0.45
  const c2x = b.x - gap * 0.45

  // Approximate normals along the cubic by sampling ends.
  // At endpoints the tangent is horizontal-ish; use vertical offset for thickness.
  const topA = sMidY - half
  const botA = sMidY + half
  const topB = rMidY - half
  const botB = rMidY + half

  // Rounded source capsule + curved top/bottom + rounded result capsule
  return [
    // Start top-left of source
    `M ${f(sLeft)} ${f(topA)}`,
    // Top of source bar
    `L ${f(sRight)} ${f(topA)}`,
    // Curve across gutter (top edge)
    `C ${f(c1x)} ${f(topA)}, ${f(c2x)} ${f(topB)}, ${f(rLeft)} ${f(topB)}`,
    // Top of result bar
    `L ${f(rRight)} ${f(topB)}`,
    // Right endcap of result
    `L ${f(rRight)} ${f(botB)}`,
    // Bottom of result bar
    `L ${f(rLeft)} ${f(botB)}`,
    // Curve back across gutter (bottom edge)
    `C ${f(c2x)} ${f(botB)}, ${f(c1x)} ${f(botA)}, ${f(sRight)} ${f(botA)}`,
    // Bottom of source bar
    `L ${f(sLeft)} ${f(botA)}`,
    'Z',
  ].join(' ')
}

/**
 * Bent row-highlight bridge between a source line and its result.
 * Only the active (hovered) pair is drawn — no hairline arrows.
 */
export function ResultConnectors({
  workspaceRef,
  editorView,
  events,
  activeIndex,
  enabled,
  geometryKey = 0,
}: ResultConnectorsProps) {
  const [ribbon, setRibbon] = useState<Ribbon | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  const measure = useCallback(() => {
    const workspace = workspaceRef.current
    if (
      !enabled ||
      !workspace ||
      !editorView ||
      activeIndex == null ||
      activeIndex < 0
    ) {
      setRibbon(null)
      return
    }

    const event = events[activeIndex]
    if (!event) {
      setRibbon(null)
      return
    }

    const lineNo = eventLine(event)
    if (lineNo == null) {
      setRibbon(null)
      return
    }

    const ws = workspace.getBoundingClientRect()
    if (ws.width < 8 || ws.height < 8) {
      setRibbon(null)
      return
    }
    setSize({ width: ws.width, height: ws.height })

    const scroller = editorView.scrollDOM
    const scrollerRect = scroller.getBoundingClientRect()
    const editorPane = workspace.querySelector('.pane-editor')
    const editorPaneRect = editorPane?.getBoundingClientRect()
    const resultsPane = workspace.querySelector('.pane-results')
    const resultsPaneRect = resultsPane?.getBoundingClientRect()

    const row = workspace.querySelector(
      `[data-result-index="${activeIndex}"]`,
    ) as HTMLElement | null
    if (!row) {
      setRibbon(null)
      return
    }

    const rowRect = row.getBoundingClientRect()
    const resultsBody = row.closest('.results-body')
    if (resultsBody) {
      const bodyRect = resultsBody.getBoundingClientRect()
      if (
        rowRect.bottom < bodyRect.top + 2 ||
        rowRect.top > bodyRect.bottom - 2
      ) {
        setRibbon(null)
        return
      }
    }

    let line
    try {
      line = editorView.state.doc.line(lineNo)
    } catch {
      setRibbon(null)
      return
    }

    const startCoords = editorView.coordsAtPos(line.from)
    const endCoords = editorView.coordsAtPos(Math.max(line.from, line.to - 1))
    if (!startCoords) {
      setRibbon(null)
      return
    }

    const sourceY = (startCoords.top + startCoords.bottom) / 2
    if (sourceY < scrollerRect.top + 2 || sourceY > scrollerRect.bottom - 2) {
      setRibbon(null)
      return
    }

    const gutterLeft =
      (editorView.dom.querySelector('.cm-gutters') as HTMLElement | null)
        ?.getBoundingClientRect().right ?? startCoords.left - 8

    const sourceLeft = Math.max(gutterLeft, startCoords.left - 4) - ws.left
    const sourceRight = Math.min(
      (editorPaneRect?.right ?? scrollerRect.right) - ws.left - 4,
      (endCoords?.right ?? startCoords.right) - ws.left + 16,
    )
    const sourceTop = startCoords.top - ws.top
    const sourceH = Math.max(18, startCoords.bottom - startCoords.top)

    const resultLeft = rowRect.left - ws.left
    const resultRight = Math.min(
      rowRect.right - ws.left + 4,
      (resultsPaneRect?.right ?? rowRect.right) - ws.left - 10,
    )
    // Prefer the raw error line so tall explain panels don't inflate the band.
    const anchorEl = row.querySelector(
      '[data-error-anchor], .error-card-raw',
    ) as HTMLElement | null
    const anchorRect = anchorEl?.getBoundingClientRect()
    const resultTop = anchorRect
      ? anchorRect.top - ws.top - 2
      : rowRect.top - ws.top
    const resultH = anchorRect
      ? Math.max(20, Math.min(anchorRect.height + 6, 36))
      : Math.max(18, Math.min(rowRect.height, 28))

    if (resultLeft <= sourceRight + 8) {
      setRibbon(null)
      return
    }

    setRibbon({
      id: `ribbon-${activeIndex}-${lineNo}`,
      path: buildRibbonPath(
        {
          x: sourceLeft,
          y: sourceTop,
          w: Math.max(28, sourceRight - sourceLeft),
          h: sourceH,
        },
        {
          x: resultLeft,
          y: resultTop,
          w: Math.max(48, resultRight - resultLeft),
          h: resultH,
        },
      ),
      kind: event.kind,
    })
  }, [workspaceRef, editorView, events, activeIndex, enabled])

  useEffect(() => {
    const id = requestAnimationFrame(() => measure())
    return () => cancelAnimationFrame(id)
  }, [measure, geometryKey])

  useEffect(() => {
    if (!enabled || !editorView) return

    const workspace = workspaceRef.current
    const scroller = editorView.scrollDOM
    const resultsBody = workspace?.querySelector('.results-body')

    const onScrollOrResize = () => {
      requestAnimationFrame(measure)
    }

    const ro = new ResizeObserver(onScrollOrResize)
    if (workspace) ro.observe(workspace)
    ro.observe(scroller)
    if (resultsBody) ro.observe(resultsBody)

    scroller.addEventListener('scroll', onScrollOrResize, { passive: true })
    resultsBody?.addEventListener('scroll', onScrollOrResize, {
      passive: true,
    })
    window.addEventListener('resize', onScrollOrResize)

    return () => {
      ro.disconnect()
      scroller.removeEventListener('scroll', onScrollOrResize)
      resultsBody?.removeEventListener('scroll', onScrollOrResize)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [enabled, editorView, measure, workspaceRef, events, activeIndex])

  if (!enabled || !ribbon || size.width === 0) return null

  return (
    <svg
      className="result-connectors"
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
      aria-hidden="true"
    >
      <path
        d={ribbon.path}
        className={`connector-ribbon connector-ribbon-${ribbon.kind}`}
      />
    </svg>
  )
}
