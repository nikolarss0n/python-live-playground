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

type Box = { x: number; y: number; w: number; h: number }

/**
 * One soft shape: a rounded capsule around the source code, a smooth neck that tapers between the two heights, and a
 * rounded capsule around the result's first line. Each end keeps its own height so the band hugs both texts.
 */
function buildRibbonPath(source: Box, result: Box): string {
  const f = (n: number) => n.toFixed(1)
  const sL = source.x
  const sR = source.x + source.w
  const sT = source.y
  const sB = source.y + source.h
  const rL = result.x
  const rR = result.x + result.w
  const rT = result.y
  const rB = result.y + result.h
  const sr = Math.min(6, source.h / 2, source.w / 2)
  const rr = Math.min(6, result.h / 2, result.w / 2)
  const bend = Math.max(16, (rL - sR) * 0.5)
  const c1 = sR + bend
  const c2 = rL - bend

  return [
    `M ${f(sL + sr)} ${f(sT)}`,
    `L ${f(sR)} ${f(sT)}`,
    `C ${f(c1)} ${f(sT)}, ${f(c2)} ${f(rT)}, ${f(rL)} ${f(rT)}`,
    `L ${f(rR - rr)} ${f(rT)}`,
    `Q ${f(rR)} ${f(rT)}, ${f(rR)} ${f(rT + rr)}`,
    `L ${f(rR)} ${f(rB - rr)}`,
    `Q ${f(rR)} ${f(rB)}, ${f(rR - rr)} ${f(rB)}`,
    `L ${f(rL)} ${f(rB)}`,
    `C ${f(c2)} ${f(rB)}, ${f(c1)} ${f(sB)}, ${f(sR)} ${f(sB)}`,
    `L ${f(sL + sr)} ${f(sB)}`,
    `Q ${f(sL)} ${f(sB)}, ${f(sL)} ${f(sB - sr)}`,
    `L ${f(sL)} ${f(sT + sr)}`,
    `Q ${f(sL)} ${f(sT)}, ${f(sL + sr)} ${f(sT)}`,
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

    const indent = line.text.length - line.text.trimStart().length
    const textFrom = line.from + Math.min(indent, Math.max(0, line.length - 1))
    const startCoords = editorView.coordsAtPos(textFrom)
    const endCoords = editorView.coordsAtPos(line.to, -1)
    if (!startCoords) {
      setRibbon(null)
      return
    }

    const sourceY = (startCoords.top + startCoords.bottom) / 2
    if (sourceY < scrollerRect.top + 2 || sourceY > scrollerRect.bottom - 2) {
      setRibbon(null)
      return
    }

    const PAD_X = 6
    const PAD_Y = 3
    const sourceLeft = startCoords.left - PAD_X - ws.left
    const sourceRight = Math.min(
      (editorPaneRect?.right ?? scrollerRect.right) - ws.left - 8,
      (endCoords?.right ?? startCoords.right) - ws.left + PAD_X,
    )
    const sourceTop = startCoords.top - ws.top - PAD_Y
    const sourceH = startCoords.bottom - startCoords.top + PAD_Y * 2

    // Hug the result's first visible line: the error line, a collection's header pill, or the value text.
    const anchorEl = row.querySelector(
      '[data-error-anchor], .error-card-raw, .coll-toggle, .result-text, .result-value-wrap',
    ) as HTMLElement | null
    const anchorRect = anchorEl?.getBoundingClientRect() ?? rowRect
    const lineH = Math.min(anchorRect.height, sourceH - PAD_Y * 2 + 2)
    const resultLeft = rowRect.left - ws.left
    const resultRight = Math.min(rowRect.right, resultsPaneRect?.right ?? rowRect.right) - ws.left - 2
    const resultTop = anchorRect.top - ws.top - PAD_Y
    const resultH = Math.max(16, lineH) + PAD_Y * 2

    if (resultLeft <= sourceRight + 8) {
      setRibbon(null)
      return
    }

    setRibbon({
      id: `ribbon-${activeIndex}-${lineNo}`,
      path: buildRibbonPath(
        { x: sourceLeft, y: sourceTop, w: Math.max(24, sourceRight - sourceLeft), h: sourceH },
        { x: resultLeft, y: resultTop, w: Math.max(40, resultRight - resultLeft), h: resultH },
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
