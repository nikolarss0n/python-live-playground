import { useRef } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useResultsPopover } from './useResultsPopover'

const observers: TestResizeObserver[] = []
class TestResizeObserver implements ResizeObserver {
  targets = new Set<Element>()
  disconnected = false
  private readonly notify: ResizeObserverCallback
  constructor(notify: ResizeObserverCallback) { this.notify = notify; observers.push(this) }
  observe(target: Element) { this.targets.add(target) }
  unobserve(target: Element) { this.targets.delete(target) }
  disconnect() { this.disconnected = true; this.targets.clear() }
  deliver() { this.notify([], this) }
}

function Harness({ open = true }: { open?: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const details = useRef<HTMLDivElement>(null)
  useResultsPopover({ open, scope: 'test', root, details })
  return <main className="workspace">
    <div ref={root} className="pane-editor">
      <div ref={details} hidden={!open} data-testid="box"><p>Task content</p></div>
    </div>
    <div className="pane-results"><header className="results-head">Results</header><div className="results-body">Output</div></div>
  </main>
}

const frames = new Map<number, FrameRequestCallback>()
let nextFrame = 0
let paneWidth = 499

function flushFrame() {
  const pending = [...frames.values()]
  frames.clear()
  act(() => pending.forEach((callback) => callback(16)))
}

function observerFor(element: Element) {
  const observer = observers.find((candidate) => candidate.targets.has(element))
  if (!observer) throw new Error('Element is not observed')
  return observer
}

function measureWorkspace(workspace: Element) {
  const measure = vi.fn(() => new DOMRect(0, 100, 1000, 600))
  Object.defineProperty(workspace, 'getBoundingClientRect', { configurable: true, value: measure })
  return measure
}

beforeEach(() => {
  observers.length = 0
  frames.clear()
  nextFrame = 0
  paneWidth = 499
  vi.stubGlobal('ResizeObserver', TestResizeObserver)
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = ++nextFrame
    frames.set(id, callback)
    return id
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => { frames.delete(id) })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains('workspace')) return new DOMRect(0, 100, 1000, 600)
    if (this.classList.contains('pane-results')) return new DOMRect(501, 100, paneWidth, 600)
    if (this.classList.contains('results-head')) return new DOMRect(501, 100, paneWidth, 40)
    if (this.classList.contains('results-body')) return new DOMRect(501, 140, paneWidth, 560)
    return new DOMRect()
  })
})

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('Results popover resize scheduling', () => {
  it('places synchronously once, then coalesces resize deliveries into the next frame', () => {
    const { container } = render(<Harness />)
    const box = screen.getByTestId('box')
    const workspace = container.querySelector('.workspace')
    if (!workspace) throw new Error('Missing workspace')
    expect(box.style.getPropertyValue('--lesson-top')).toBe('40px')
    expect(box.style.getPropertyValue('--lesson-width')).toBe('483px')
    expect(frames.size).toBe(0)
    const measure = measureWorkspace(workspace)
    const observer = observerFor(workspace)
    expect(observer.targets.has(box)).toBe(false)
    expect(observer.targets.has(box.firstElementChild ?? box)).toBe(false)
    paneWidth = 390
    act(() => { observer.deliver(); observer.deliver(); fireEvent(window, new Event('resize')) })
    expect(measure).not.toHaveBeenCalled()
    expect(box.style.getPropertyValue('--lesson-width')).toBe('483px')
    expect(frames.size).toBe(1)
    flushFrame()
    expect(measure).toHaveBeenCalledOnce()
    expect(box.style.getPropertyValue('--lesson-width')).toBe('374px')
  })

  it('updates the scroll cue after content changes without re-running placement', async () => {
    const { container } = render(<Harness />)
    const box = screen.getByTestId('box')
    const workspace = container.querySelector('.workspace')
    if (!workspace) throw new Error('Missing workspace')
    const measure = measureWorkspace(workspace)
    let contentHeight = 600
    Object.defineProperties(box, {
      scrollHeight: { get: () => contentHeight },
      clientHeight: { value: 200 },
    })
    act(() => observerFor(box).deliver())
    expect(box).toHaveAttribute('data-more-below', 'false')
    expect(measure).not.toHaveBeenCalled()
    flushFrame()
    expect(box).toHaveAttribute('data-more-below', 'true')
    expect(measure).not.toHaveBeenCalled()
    contentHeight = 200
    const child = document.createElement('p')
    child.textContent = 'Changed task content'
    await act(async () => { box.append(child) })
    expect(observerFor(box).targets.has(child)).toBe(true)
    flushFrame()
    expect(box).toHaveAttribute('data-more-below', 'false')
    expect(measure).not.toHaveBeenCalled()
  })

  it.each(['close', 'unmount'])('cancels pending work on %s and ignores late notifications', (action) => {
    const { container, rerender, unmount } = render(<Harness />)
    const workspace = container.querySelector('.workspace')
    if (!workspace) throw new Error('Missing workspace')
    const observer = observerFor(workspace)
    act(() => observer.deliver())
    const pendingId = nextFrame
    expect(frames.size).toBe(1)
    if (action === 'close') rerender(<Harness open={false} />)
    else unmount()
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(pendingId)
    expect(frames.size).toBe(0)
    expect(observers.every((entry) => entry.disconnected)).toBe(true)
    act(() => observer.deliver())
    expect(frames.size).toBe(0)
  })
})
