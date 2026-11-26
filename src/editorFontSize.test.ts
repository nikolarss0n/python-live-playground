import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_FONT_SIZE,
  EDITOR_FONT_SIZE_EVENT,
  FONT_SIZE_KEY,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  adjustEditorFontSize,
  applyEditorFontSize,
  readEditorFontSize,
} from './editorFontSize'

describe('editorFontSize', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.style.removeProperty('--editor-font-size')
  })

  it('defaults to 14.5px and steps cleanly within bounds', () => {
    expect(readEditorFontSize()).toBe(DEFAULT_FONT_SIZE)
    expect(adjustEditorFontSize('in')).toBe(16)
    expect(document.documentElement.style.getPropertyValue('--editor-font-size')).toBe('16px')
    expect(window.localStorage.getItem(FONT_SIZE_KEY)).toBe('16')

    expect(adjustEditorFontSize('out')).toBe(DEFAULT_FONT_SIZE)
    expect(adjustEditorFontSize('out')).toBe(13)
    expect(adjustEditorFontSize('reset')).toBe(DEFAULT_FONT_SIZE)
  })

  it('clamps out-of-range values and notifies listeners', () => {
    const listener = vi.fn()
    window.addEventListener(EDITOR_FONT_SIZE_EVENT, listener)
    try {
      expect(applyEditorFontSize(99)).toBe(MAX_FONT_SIZE)
      expect(applyEditorFontSize(2)).toBe(MIN_FONT_SIZE)
      expect(applyEditorFontSize(Number.NaN)).toBe(DEFAULT_FONT_SIZE)
      expect(listener).toHaveBeenCalledTimes(3)
    } finally {
      window.removeEventListener(EDITOR_FONT_SIZE_EVENT, listener)
    }
  })
})
