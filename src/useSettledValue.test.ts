import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSettledValue } from './useSettledValue'

describe('useSettledValue', () => {
  it('holds the last settled value until the run settles again, and resets on a new key', () => {
    const { result, rerender } = renderHook(({ value, settled, key }) => useSettledValue(value, settled, key), {
      initialProps: { value: 'checks A', settled: true, key: 'printing' },
    })
    rerender({ value: null as unknown as string, settled: false, key: 'printing' })
    expect(result.current).toBe('checks A')
    rerender({ value: 'checks B', settled: true, key: 'printing' })
    expect(result.current).toBe('checks B')
    rerender({ value: 'other lesson', settled: false, key: 'variables' })
    expect(result.current).toBe('other lesson')
  })
})
