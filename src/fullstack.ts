import type { CollectionNode } from './execution/collectionStructure'

export type ChartKind = 'bar' | 'line' | 'table'
export type ChartPoint = { label: string; value: number }
export type ChartData = { points: ChartPoint[]; x: string; y: string; keys: string[]; numericKeys: string[] }

const MAX_ITEMS = 50

/** The practice datasets in playdb.py, for the Project data picker. */
export const PRACTICE_DATASETS: readonly { name: string; rows: number; columns: string[]; about: string }[] = [
  { name: 'orders', rows: 40, columns: ['id', 'day', 'city', 'product', 'amount'], about: 'Shop orders by day, city and product' },
  { name: 'weather', rows: 28, columns: ['day', 'city', 'temp_c', 'rain_mm'], about: 'A week of temperature and rain in four cities' },
  { name: 'students', rows: 24, columns: ['name', 'subject', 'grade'], about: 'Grades for eight students in three subjects' },
  { name: 'tickets', rows: 30, columns: ['id', 'topic', 'status', 'minutes'], about: 'Support tickets with topic, status and time spent' },
]

/** A JSON response body as the same tree the Results pane uses for Python collections. */
export function jsonToNode(value: unknown): CollectionNode {
  if (Array.isArray(value)) {
    return { kind: 'list', length: value.length, items: value.slice(0, MAX_ITEMS).map(jsonToNode), ...(value.length > MAX_ITEMS ? { truncated: true } : {}) }
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
    return {
      kind: 'dict',
      length: entries.length,
      entries: entries.slice(0, MAX_ITEMS).map(([key, item]) => ({ key: { kind: 'atom', type: 'str', preview: `'${key}'` }, value: jsonToNode(item) })),
      ...(entries.length > MAX_ITEMS ? { truncated: true } : {}),
    }
  }
  if (typeof value === 'string') return { kind: 'atom', type: 'str', preview: `'${value}'` }
  if (typeof value === 'number') return { kind: 'atom', type: Number.isInteger(value) ? 'int' : 'float', preview: String(value) }
  if (typeof value === 'boolean') return { kind: 'atom', type: 'bool', preview: value ? 'True' : 'False' }
  return { kind: 'atom', type: 'NoneType', preview: 'None' }
}

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * Turns a route's JSON into chart points: a list of objects (label column × number column), a dict of numbers, or a
 * list of numbers. `x` and `y` pick the columns when they exist; otherwise the first text and first number columns.
 */
export function chartData(body: unknown, x?: string, y?: string): ChartData | null {
  if (Array.isArray(body) && body.length && body.every(isRecord)) {
    const keys = Object.keys(body[0])
    const numericKeys = keys.filter((key) => body.every((row) => typeof row[key] === 'number'))
    if (!numericKeys.length) return null
    const yKey = y && numericKeys.includes(y) ? y : numericKeys.find((key) => key !== x) ?? numericKeys[0]
    const xKey = x && keys.includes(x) ? x : keys.find((key) => !numericKeys.includes(key)) ?? keys.find((key) => key !== yKey) ?? yKey
    return {
      points: body.slice(0, MAX_ITEMS).map((row, index) => ({ label: xKey === yKey ? String(index + 1) : String(row[xKey]), value: row[yKey] as number })),
      x: xKey,
      y: yKey,
      keys,
      numericKeys,
    }
  }
  if (isRecord(body)) {
    const entries = Object.entries(body).filter(([, value]) => typeof value === 'number') as [string, number][]
    if (!entries.length) return null
    return { points: entries.slice(0, MAX_ITEMS).map(([label, value]) => ({ label, value })), x: 'key', y: 'value', keys: ['key', 'value'], numericKeys: ['value'] }
  }
  if (Array.isArray(body) && body.length && body.every((value) => typeof value === 'number')) {
    return { points: body.slice(0, MAX_ITEMS).map((value, index) => ({ label: String(index), value })), x: 'index', y: 'value', keys: ['index', 'value'], numericKeys: ['value'] }
  }
  return null
}

/** A rounded axis maximum and three evenly spaced ticks above zero. */
export function niceTicks(max: number): number[] {
  if (!(max > 0)) return [0]
  const rough = max / 4
  const power = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= rough) ?? rough
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, index) => Number((index * step).toPrecision(12)))
}

export function formatNumber(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString('en-US')
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}
