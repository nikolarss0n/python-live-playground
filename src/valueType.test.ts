import { describe, expect, it } from 'vitest'
import { inferTypeLabel } from './valueType'

describe('inferTypeLabel', () => {
  it('labels common scalars and collections', () => {
    expect(inferTypeLabel('42')).toBe('int')
    expect(inferTypeLabel('3.14')).toBe('float')
    expect(inferTypeLabel('True')).toBe('bool')
    expect(inferTypeLabel('None')).toBe('NoneType')
    expect(inferTypeLabel("'hi'")).toBe('str')
    expect(inferTypeLabel('[1, 2]')).toBe('list')
    expect(inferTypeLabel("{'a': 1}")).toBe('dict')
    expect(inferTypeLabel('{1, 2}')).toBe('set')
    expect(inferTypeLabel('(1,)')).toBe('tuple')
  })
})
