import { useRef } from 'react'

/**
 * Returns `value` while `settled`, otherwise the last settled value, so run-derived UI stays put while an edit
 * waits for its run instead of blanking and coming back. A new `resetKey` (another lesson) drops the held value.
 */
export function useSettledValue<T>(value: T, settled: boolean, resetKey: string): T {
  const held = useRef<{ key: string; value: T } | null>(null)
  if (settled || held.current?.key !== resetKey) held.current = { key: resetKey, value }
  return held.current.value
}
