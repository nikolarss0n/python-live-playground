import { useId } from 'react'
import { formatNumber, niceTicks, type ChartKind, type ChartPoint } from '../fullstack'

const WIDTH = 640
const HEIGHT = 280
const PAD = { top: 18, right: 16, bottom: 48, left: 52 }

/** Hand-drawn SVG chart for the View tab: bars or a line over labelled points, or a plain table. */
export function DataChart({ points, kind, x, y }: { points: readonly ChartPoint[]; kind: ChartKind; x: string; y: string }) {
  const titleId = useId()
  if (kind === 'table') {
    return (
      <table className="data-chart-table">
        <thead>
          <tr><th scope="col">{x}</th><th scope="col">{y}</th></tr>
        </thead>
        <tbody>
          {points.map((point, index) => (
            <tr key={index}><td>{point.label}</td><td>{formatNumber(point.value)}</td></tr>
          ))}
        </tbody>
      </table>
    )
  }

  const max = Math.max(0, ...points.map((point) => point.value))
  const min = Math.min(0, ...points.map((point) => point.value))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1] || 1
  const plotW = WIDTH - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const yOf = (value: number) => PAD.top + plotH - ((value - Math.min(0, min)) / (top - Math.min(0, min))) * plotH
  const band = plotW / Math.max(1, points.length)
  const xOf = (index: number) => PAD.left + band * index + band / 2
  const barW = Math.max(4, Math.min(48, band * 0.62))
  const labelEvery = Math.max(1, Math.ceil(points.length / 10))
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${xOf(index).toFixed(1)} ${yOf(point.value).toFixed(1)}`).join(' ')

  return (
    <svg className={`data-chart data-chart-${kind}`} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={titleId}>
      <title id={titleId}>{`${y} by ${x}, ${points.length} points`}</title>
      {ticks.map((tick) => (
        <g key={tick} className="data-chart-tick">
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yOf(tick)} y2={yOf(tick)} />
          <text x={PAD.left - 8} y={yOf(tick)} textAnchor="end" dominantBaseline="middle">{formatNumber(tick)}</text>
        </g>
      ))}
      {kind === 'bar'
        ? points.map((point, index) => {
            const yTop = yOf(Math.max(0, point.value))
            const height = Math.max(1, Math.abs(yOf(point.value) - yOf(0)))
            return (
              <g key={index} className="data-chart-bar" style={{ animationDelay: `${Math.min(index, 12) * 24}ms` }}>
                <rect x={xOf(index) - barW / 2} y={yTop} width={barW} height={height} rx={Math.min(5, barW / 3)} />
                <title>{`${point.label}: ${formatNumber(point.value)}`}</title>
                {points.length <= 16 ? (
                  <text className="data-chart-value" x={xOf(index)} y={yTop - 6} textAnchor="middle">{formatNumber(point.value)}</text>
                ) : null}
              </g>
            )
          })
        : (
          <g className="data-chart-line">
            <path d={line} />
            {points.map((point, index) => (
              <circle key={index} cx={xOf(index)} cy={yOf(point.value)} r={3.5}>
                <title>{`${point.label}: ${formatNumber(point.value)}`}</title>
              </circle>
            ))}
          </g>
        )}
      <line className="data-chart-axis" x1={PAD.left} x2={WIDTH - PAD.right} y1={yOf(0)} y2={yOf(0)} />
      {points.map((point, index) =>
        index % labelEvery === 0 ? (
          <text key={index} className="data-chart-label" x={xOf(index)} y={HEIGHT - PAD.bottom + 18} textAnchor="middle">
            {point.label.length > 12 ? `${point.label.slice(0, 11)}…` : point.label}
          </text>
        ) : null,
      )}
    </svg>
  )
}
