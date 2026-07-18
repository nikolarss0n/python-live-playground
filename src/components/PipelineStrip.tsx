/**
 * Quiet multi-stage ribbon for AI / multi-step labs.
 * Stages light up when the editor code mentions them (soft, not graded).
 */

type PipelineStripProps = {
  stages: string[]
  code: string
}

function stageActive(stage: string, code: string): boolean {
  const needle = stage.toLowerCase()
  const hay = code.toLowerCase()
  if (hay.includes(needle)) return true
  // common aliases
  if (needle === 'tokenize' && /split\s*\(/.test(hay)) return true
  if (needle === 'count' && /counts|bag/.test(hay)) return true
  if (needle === 'embed' && /vector|magnitude|cosine/.test(hay)) return true
  if (needle === 'validate' && /missing|required|json\.loads/.test(hay))
    return true
  if (needle === 'prompt' && /f["']|prompt\s*=/.test(hay)) return true
  return false
}

export function PipelineStrip({ stages, code }: PipelineStripProps) {
  if (stages.length === 0) return null
  let lastActive = -1
  stages.forEach((s, i) => {
    if (stageActive(s, code)) lastActive = i
  })

  return (
    <div className="pipeline-strip" role="list" aria-label="Pipeline stages">
      {stages.map((stage, i) => {
        const active = i <= lastActive && lastActive >= 0
        const current = i === lastActive
        return (
          <span
            key={stage}
            role="listitem"
            className={`pipeline-stage${active ? ' is-active' : ''}${
              current ? ' is-current' : ''
            }`}
          >
            <span className="pipeline-stage-dot" aria-hidden="true" />
            <span className="pipeline-stage-label">{stage}</span>
            {i < stages.length - 1 ? (
              <span className="pipeline-stage-join" aria-hidden="true">
                →
              </span>
            ) : null}
          </span>
        )
      })}
    </div>
  )
}
