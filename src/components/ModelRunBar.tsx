import { useMemo, useState } from 'react'
import type { ResultEvent } from '../execution/protocol'
import type { AppSettings } from '../settings'
import { testLlmCompletion } from '../llmClient'

type ModelRunBarProps = {
  events: ResultEvent[]
  settings: AppSettings
  onOpenSettings: () => void
}

/** Prefer the longest non-empty print — usually the filled prompt. */
export function pickPromptFromEvents(events: readonly ResultEvent[]): string | null {
  let best: string | null = null
  for (const e of events) {
    if (e.kind !== 'print') continue
    const t = e.text.trim()
    if (t.length < 8) continue
    if (!best || t.length >= best.length) best = t
  }
  return best
}

/**
 * One-shot “Run with model” using Settings key + last printed prompt.
 * No chat sidebar.
 */
export function ModelRunBar({
  events,
  settings,
  onOpenSettings,
}: ModelRunBarProps) {
  const prompt = useMemo(() => pickPromptFromEvents(events), [events])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const configured =
    settings.apiKey.trim().length > 0 && settings.llmBaseUrl.trim().length > 0

  const run = async () => {
    if (!configured) {
      setNote('Add an API key and LLM base URL in Settings first.')
      return
    }
    if (!prompt) {
      setNote('Run your code so print(prompt) appears in Results first.')
      return
    }
    setBusy(true)
    setNote(null)
    try {
      const result = await testLlmCompletion({
        baseUrl: settings.llmBaseUrl,
        apiKey: settings.apiKey,
        model: settings.llmModel,
        prompt,
      })
      if (result.ok) {
        setNote(`${result.model} · ${result.durationMs} ms\n${result.text}`)
      } else {
        setNote(result.error)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="model-run-bar" role="region" aria-label="Run with model">
      <div className="model-run-head">
        <span className="model-run-title">Model</span>
        <span className="model-run-hint">
          Optional — sends your last printed prompt with the Settings key (no chat UI)
        </span>
      </div>
      <div className="model-run-actions">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => void run()}
        >
          {busy ? 'Calling model…' : 'Run with model'}
        </button>
        <button type="button" className="linkish" onClick={onOpenSettings}>
          Settings
        </button>
        {prompt ? (
          <span className="model-run-ready">Prompt ready ({prompt.length} chars)</span>
        ) : (
          <span className="model-run-ready is-muted">Waiting for printed prompt</span>
        )}
      </div>
      {note ? (
        <pre className="model-run-note" role="status">
          {note}
        </pre>
      ) : null}
    </div>
  )
}
