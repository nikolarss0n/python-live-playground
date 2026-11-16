/**
 * A page that loads hidden (a window behind another app, a background tab) gets no animation frames, so CodeMirror
 * never takes its layout pass and line numbers stay offset from their lines until the next edit. Measure again as
 * soon as the page is shown.
 */

import { ViewPlugin, type EditorView } from '@codemirror/view'

export const remeasureOnShow = ViewPlugin.fromClass(
  class {
    private readonly onVisibility: () => void
    private readonly doc: Document

    constructor(view: EditorView) {
      this.doc = view.dom.ownerDocument
      this.onVisibility = () => {
        if (this.doc.visibilityState === 'visible') view.requestMeasure()
      }
      this.doc.addEventListener('visibilitychange', this.onVisibility)
    }

    destroy() {
      this.doc.removeEventListener('visibilitychange', this.onVisibility)
    }
  },
)
