import { describe, expect, it } from 'vitest'
import { chartData, jsonToNode, niceTicks } from './fullstack'

describe('jsonToNode', () => {
  it('maps JSON to the collection tree with Python type names', () => {
    expect(jsonToNode([{ city: 'Oslo', total: 12.5, ok: true, note: null }])).toEqual({
      kind: 'list',
      length: 1,
      items: [{
        kind: 'dict',
        length: 4,
        entries: [
          { key: { kind: 'atom', type: 'str', preview: "'city'" }, value: { kind: 'atom', type: 'str', preview: "'Oslo'" } },
          { key: { kind: 'atom', type: 'str', preview: "'total'" }, value: { kind: 'atom', type: 'float', preview: '12.5' } },
          { key: { kind: 'atom', type: 'str', preview: "'ok'" }, value: { kind: 'atom', type: 'bool', preview: 'True' } },
          { key: { kind: 'atom', type: 'str', preview: "'note'" }, value: { kind: 'atom', type: 'NoneType', preview: 'None' } },
        ],
      }],
    })
  })
})

describe('chartData', () => {
  const rows = [{ day: '2026-10-01', orders: 3, revenue: 120.5 }, { day: '2026-10-02', orders: 5, revenue: 80 }]

  it('uses the first text column as labels and the first number column as values', () => {
    expect(chartData(rows)).toMatchObject({ x: 'day', y: 'orders', numericKeys: ['orders', 'revenue'], points: [{ label: '2026-10-01', value: 3 }, { label: '2026-10-02', value: 5 }] })
  })

  it('honours a chosen value column', () => {
    expect(chartData(rows, 'day', 'revenue')?.points.map((point) => point.value)).toEqual([120.5, 80])
  })

  it('charts a dict of numbers and a list of numbers', () => {
    expect(chartData({ open: 4, closed: 9, label: 'x' })?.points).toEqual([{ label: 'open', value: 4 }, { label: 'closed', value: 9 }])
    expect(chartData([2, 7])?.points).toEqual([{ label: '0', value: 2 }, { label: '1', value: 7 }])
  })

  it('returns null when there is nothing numeric to chart', () => {
    expect(chartData([{ name: 'Ada' }])).toBeNull()
    expect(chartData({ detail: 'Not Found' })).toBeNull()
    expect(chartData([])).toBeNull()
  })
})

describe('niceTicks', () => {
  it('rounds the axis to friendly steps', () => {
    expect(niceTicks(87)).toEqual([0, 25, 50, 75, 100])
    expect(niceTicks(0)).toEqual([0])
  })
})
