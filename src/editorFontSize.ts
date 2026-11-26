import { readPreference, writePreference } from './preferences'

export const FONT_SIZE_KEY = 'plp-editor-font-size'
export const DEFAULT_FONT_SIZE = 14.5
export const MIN_FONT_SIZE = 11
export const MAX_FONT_SIZE = 22
export const FONT_SIZE_STEP = 1.5
export const EDITOR_FONT_SIZE_EVENT = 'plp-font-size-change'
export const EDITOR_FIND_EVENT = 'plp-open-find'

export type ZoomDirection = 'in' | 'out' | 'reset'

export function clampEditorFontSize(size: number): number {
  if (!Number.isFinite(size)) return DEFAULT_FONT_SIZE
  const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size))
  return Math.round(clamped * 2) / 2
}

export function readEditorFontSize(): number {
  const raw = readPreference(FONT_SIZE_KEY)
  if (raw === null) return DEFAULT_FONT_SIZE
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? clampEditorFontSize(parsed) : DEFAULT_FONT_SIZE
}

export function applyEditorFontSize(
  size: number,
  root: HTMLElement = document.documentElement,
): number {
  const clamped = clampEditorFontSize(size)
  root.style.setProperty('--editor-font-size', `${clamped}px`)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EDITOR_FONT_SIZE_EVENT, { detail: clamped }))
  }
  return clamped
}

export function adjustEditorFontSize(direction: ZoomDirection): number {
  const current = readEditorFontSize()
  const next = direction === 'reset'
    ? DEFAULT_FONT_SIZE
    : clampEditorFontSize(current + (direction === 'in' ? FONT_SIZE_STEP : -FONT_SIZE_STEP))
  writePreference(FONT_SIZE_KEY, String(next))
  return applyEditorFontSize(next)
}

export function requestEditorFind(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EDITOR_FIND_EVENT))
  }
}
