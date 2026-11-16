import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { remeasureOnShow } from './remeasureOnShow'

const setVisibility = (state: DocumentVisibilityState) =>
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })

let view: EditorView | null = null
afterEach(() => {
  view?.destroy()
  view = null
  setVisibility('visible')
})

describe('remeasure when the page is shown', () => {
  it('asks for a layout pass when the page becomes visible, not when it hides, and stops after destroy', () => {
    view = new EditorView({ state: EditorState.create({ doc: 'print(1)', extensions: remeasureOnShow }), parent: document.body })
    const measure = vi.spyOn(view, 'requestMeasure')
    setVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(measure).not.toHaveBeenCalled()
    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(measure).toHaveBeenCalledTimes(1)
    view.destroy()
    document.dispatchEvent(new Event('visibilitychange'))
    expect(measure).toHaveBeenCalledTimes(1)
    view = null
  })
})
