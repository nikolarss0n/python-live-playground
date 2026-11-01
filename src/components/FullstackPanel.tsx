import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import type { ApiCall, DbCell, DbTable, ExecutionStatus, FullstackPayload } from '../execution/protocol'
import type { LessonFullstack } from '../examples'
import { chartData, formatNumber, jsonToNode, PRACTICE_DATASETS, type ChartKind } from '../fullstack'
import { CollectionTree } from './CollectionTree'
import { DataChart } from './DataChart'

export type FullstackTab = 'results' | 'data' | 'api' | 'view'

const TABS: { id: FullstackTab; label: string }[] = [
  { id: 'results', label: 'Results' },
  { id: 'data', label: 'Data' },
  { id: 'api', label: 'API' },
  { id: 'view', label: 'View' },
]

/** Results · Data · API · View — one tab list over the right pane in full-stack lessons. */
export function FullstackTabs({ tab, onChange, payload }: { tab: FullstackTab; onChange: (tab: FullstackTab) => void; payload?: FullstackPayload }) {
  const counts: Partial<Record<FullstackTab, number>> = { data: payload?.tables.length, api: payload?.calls.length }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    const index = TABS.findIndex((each) => each.id === tab)
    const next = TABS[(index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]
    onChange(next.id)
    document.getElementById(`fullstack-tab-${next.id}`)?.focus()
  }
  return (
    <div className="fullstack-tabs" role="tablist" aria-label="Full-stack views" onKeyDown={onKeyDown}>
      {TABS.map((each) => (
        <button
          key={each.id}
          id={`fullstack-tab-${each.id}`}
          type="button"
          role="tab"
          aria-selected={tab === each.id}
          aria-controls={each.id === 'results' ? undefined : 'fullstack-panel'}
          tabIndex={tab === each.id ? 0 : -1}
          className={`fullstack-tab${tab === each.id ? ' is-active' : ''}`}
          onClick={() => onChange(each.id)}
        >
          {each.label}
          {counts[each.id] ? <span className="fullstack-tab-count">{counts[each.id]}</span> : null}
        </button>
      ))}
    </div>
  )
}

type PanelProps = {
  tab: Exclude<FullstackTab, 'results'>
  payload?: FullstackPayload
  status: ExecutionStatus
  calls: readonly string[]
  onCallsChange: (calls: string[]) => void
  seed: number
  onShuffle: () => void
  onResetSeed: () => void
  view?: LessonFullstack['view']
  /** Chosen practice datasets, when the lesson lets the learner pick them */
  datasets?: readonly string[]
  onDatasetsChange?: (datasets: string[]) => void
}

export function FullstackPanel({ tab, payload, status, calls, onCallsChange, seed, onShuffle, onResetSeed, view, datasets, onDatasetsChange }: PanelProps) {
  return (
    <section id="fullstack-panel" className="fullstack-panel" role="tabpanel" aria-labelledby={`fullstack-tab-${tab}`}>
      {tab === 'data' && datasets && onDatasetsChange ? <ProjectData chosen={datasets} onChange={onDatasetsChange} /> : null}
      {tab === 'data' ? <DataTab tables={payload?.tables ?? []} seed={seed} onShuffle={onShuffle} onResetSeed={onResetSeed} status={status} /> : null}
      {tab === 'api' ? <ApiTab calls={calls} results={payload?.calls ?? []} onCallsChange={onCallsChange} /> : null}
      {tab === 'view' ? <ViewTab results={payload?.calls ?? []} view={view} /> : null}
    </section>
  )
}

/** Toggle cards for the practice datasets: chosen ones are loaded before every run, the rest stay out of the project. */
function ProjectData({ chosen, onChange }: { chosen: readonly string[]; onChange: (datasets: string[]) => void }) {
  const toggle = (name: string) =>
    onChange(PRACTICE_DATASETS.map((each) => each.name).filter((each) => (each === name) !== chosen.includes(each)))
  return (
    <section className="project-data" aria-labelledby="project-data-title">
      <div className="project-data-head">
        <h2 id="project-data-title">Project data</h2>
        <span>{chosen.length ? `${chosen.length} of ${PRACTICE_DATASETS.length} loaded before each run` : 'Nothing loaded — pick a dataset'}</span>
      </div>
      <div className="project-data-grid">
        {PRACTICE_DATASETS.map((dataset) => {
          const on = chosen.includes(dataset.name)
          return (
            <button
              key={dataset.name}
              type="button"
              className={`project-data-card${on ? ' is-on' : ''}`}
              aria-pressed={on}
              onClick={() => toggle(dataset.name)}
              title={`Columns: ${dataset.columns.join(', ')}`}
            >
              <span className="project-data-check" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="10" height="10"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <span className="project-data-name">{dataset.name}</span>
              <span className="project-data-meta">{dataset.rows} rows · {dataset.columns.length} columns</span>
              <span className="project-data-about">{dataset.about}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function cellText(value: DbCell): string {
  if (value === null) return 'NULL'
  return typeof value === 'number' ? formatNumber(value) : value
}

function DataTab({ tables, seed, onShuffle, onResetSeed, status }: { tables: readonly DbTable[]; seed: number; onShuffle: () => void; onResetSeed: () => void; status: ExecutionStatus }) {
  return (
    <>
      <div className="fullstack-toolbar">
        <span className="fullstack-toolbar-note">
          Practice data · seed <strong>{seed}</strong>
        </span>
        <button type="button" className="fullstack-button is-primary" onClick={onShuffle} disabled={status === 'running'}>
          Shuffle data
        </button>
        {seed !== 1 ? (
          <button type="button" className="fullstack-button" onClick={onResetSeed}>
            Reset
          </button>
        ) : null}
      </div>
      {tables.length === 0 ? (
        <p className="fullstack-empty">
          No tables yet. Create one with <code>db = playdb.connect()</code> and <code>playdb.load(db, "orders")</code>, or your own <code>CREATE TABLE</code>.
        </p>
      ) : (
        tables.map((table) => (
          <div key={table.name} className="db-table">
            <div className="db-table-head">
              <span className="db-table-pill">
                <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                  <rect x="1.5" y="2.5" width="13" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M1.5 6.5h13M6 6.5v7" stroke="currentColor" strokeWidth="1.4" />
                </svg>
                {table.name}
              </span>
              <span className="db-table-count">
                {table.count === 1 ? '1 row' : `${formatNumber(table.count)} rows`}
                {table.rows.length < table.count ? ` · showing ${table.rows.length}` : ''}
              </span>
            </div>
            <div className="db-table-scroll" tabIndex={0} role="region" aria-label={`Table ${table.name}`}>
              <table>
                <thead>
                  <tr>
                    {table.columns.map((column) => (
                      <th key={column.name} scope="col" className={/INT|REAL|NUM|FLOAT|DOUBLE/i.test(column.type) ? 'is-number' : undefined}>
                        {column.name}
                        {column.type ? <span className="db-col-type">{column.type.toLowerCase()}</span> : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((value, index) => (
                        <td key={index} className={typeof value === 'number' ? 'is-number' : value === null ? 'is-null' : undefined}>
                          {cellText(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </>
  )
}

function statusTone(status: number): string {
  if (status >= 500) return 'is-error'
  if (status >= 400) return 'is-warn'
  return 'is-ok'
}

function ApiTab({ calls, results, onCallsChange }: { calls: readonly string[]; results: readonly ApiCall[]; onCallsChange: (calls: string[]) => void }) {
  const [drafts, setDrafts] = useState<string[]>([...calls])
  useEffect(() => setDrafts([...calls]), [calls])
  const commit = (index: number) => {
    const next = drafts[index].trim()
    if (!next || next === calls[index]) return
    onCallsChange(calls.map((call, at) => (at === index ? next : call)))
  }
  return (
    <>
      <div className="fullstack-toolbar">
        <span className="fullstack-toolbar-note">Requests sent to your app after every run. Edit a path and press Enter.</span>
        <button type="button" className="fullstack-button" onClick={() => onCallsChange([...calls, calls.filter((call) => !/^[A-Z]+\s/.test(call)).at(-1) ?? '/'])} disabled={calls.length >= 8}>
          Add request
        </button>
      </div>
      {calls.length === 0 ? (
        <p className="fullstack-empty">This lesson has no API yet. Use Add request to call a route you write, like <code>/orders</code>.</p>
      ) : null}
      {calls.map((call, index) => {
        const result = results[index]
        const method = /^[A-Z]+\s/.test(call) ? call.split(' ')[0] : 'GET'
        return (
          <div key={index} className="api-call">
            <div className="api-call-head">
              <span className="api-method">{method}</span>
              <input
                className="api-path"
                aria-label={`Request ${index + 1} path`}
                value={(drafts[index] ?? call).replace(/^[A-Z]+\s+/, '')}
                onChange={(event) => setDrafts((prev) => prev.map((draft, at) => (at === index ? (method === 'GET' ? event.target.value : `${method} ${event.target.value}`) : draft)))}
                onKeyDown={(event) => { if (event.key === 'Enter') commit(index) }}
                onBlur={() => commit(index)}
                spellCheck={false}
              />
              {result ? <span className={`api-status ${statusTone(result.status)}`}>{result.status}</span> : null}
              {calls.length > 1 ? (
                <button type="button" className="api-remove" aria-label={`Remove request ${index + 1}`} onClick={() => onCallsChange(calls.filter((_, at) => at !== index))}>
                  ×
                </button>
              ) : null}
            </div>
            <div className="api-call-body">
              {result ? <CollectionTree node={jsonToNode(result.body)} tone="expr" /> : <span className="fullstack-empty">Run the code to call this route.</span>}
            </div>
          </div>
        )
      })}
    </>
  )
}

function ViewTab({ results, view }: { results: readonly ApiCall[]; view?: LessonFullstack['view'] }) {
  const chartable = useMemo(() => results.map((result, index) => ({ result, index, data: chartData(result.body) })).filter((entry) => entry.data), [results])
  const [pick, setPick] = useState<number | null>(null)
  const [kind, setKind] = useState<ChartKind>(view?.kind ?? 'bar')
  const [yKey, setYKey] = useState<string | undefined>(view?.y)
  const chosen = chartable.find((entry) => entry.index === pick) ?? chartable.find((entry) => entry.index === (view?.call ?? 0)) ?? chartable[0]
  if (!chosen) {
    return <p className="fullstack-empty">Nothing to chart yet. Return a list of rows with a number column (or a dict of numbers) from a route in the API tab.</p>
  }
  const data = chartData(chosen.result.body, view?.x, yKey) ?? chosen.data!
  return (
    <>
      <div className="fullstack-toolbar">
        {chartable.length > 1 ? (
          <label className="fullstack-field">
            <span>Route</span>
            <select value={chosen.index} onChange={(event) => setPick(Number(event.target.value))}>
              {chartable.map((entry) => (
                <option key={entry.index} value={entry.index}>{entry.result.path}</option>
              ))}
            </select>
          </label>
        ) : null}
        {data.numericKeys.length > 1 ? (
          <label className="fullstack-field">
            <span>Value</span>
            <select value={data.y} onChange={(event) => setYKey(event.target.value)}>
              {data.numericKeys.map((key) => <option key={key} value={key}>{key}</option>)}
            </select>
          </label>
        ) : null}
        <div className="fullstack-segmented" role="radiogroup" aria-label="Chart type">
          {(['bar', 'line', 'table'] as const).map((each) => (
            <button key={each} type="button" role="radio" aria-checked={kind === each} className={kind === each ? 'is-active' : ''} onClick={() => setKind(each)}>
              {each === 'bar' ? 'Bars' : each === 'line' ? 'Line' : 'Table'}
            </button>
          ))}
        </div>
      </div>
      <figure className="view-figure">
        <DataChart key={`${chosen.index}-${data.y}-${kind}`} points={data.points} kind={kind} x={data.x} y={data.y} />
        <figcaption>
          <span className="api-method">{chosen.result.method}</span> {chosen.result.path}
          <span className={`api-status ${statusTone(chosen.result.status)}`}>{chosen.result.status}</span>
          <span className="view-figure-note">{data.y} by {data.x}</span>
        </figcaption>
      </figure>
    </>
  )
}
