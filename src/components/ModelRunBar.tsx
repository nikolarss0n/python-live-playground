import { useMemo, useState } from 'react'
import type { ResultEvent } from '../execution/protocol'
import type { AppSettings } from '../settings'
import { testLlmCompletion } from '../llmClient'
import { resolveModelPrompt } from './modelPrompt'

type ModelRunBarProps = {
  events: ResultEvent[]
  settings: AppSettings
  onOpenSettings: () => void
  /** Lesson-provided prompt when Results has no long print yet */
  fallbackPrompt?: string
}

/**
 * One-shot “Run with model” using Settings key + printed or fallback prompt.
 * No chat sidebar.
 */
export function ModelRunBar({
  events,
  settings,
  onOpenSettings,
  fallbackPrompt,
}: ModelRunBarProps) {
  const resolved = useMemo(
    () => resolveModelPrompt(events, fallbackPrompt),
    [events, fallbackPrompt],
  )
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const configured =
    settings.apiKey.trim().length > 0 && settings.llmBaseUrl.trim().length > 0

  const run = async () => {
    if (!configured) {
      setNote('Add an API key and LLM base URL in Settings first.')
      return
    }
    if (!resolved) {
      setNote('Run your code so a prompt appears in Results, or use a lesson with a default prompt.')
      return
    }
    setBusy(true)
    setNote(null)
    try {
      const result = await testLlmCompletion({
        baseUrl: settings.llmBaseUrl,
        apiKey: settings.apiKey,
        model: settings.llmModel,
        prompt: resolved.text,
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
          Optional — one-shot completion with your Settings key (no chat UI)
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
        {resolved ? (
          <span className="model-run-ready">
            {resolved.source === 'print'
              ? `From Results (${resolved.text.length} chars)`
              : `Lesson default (${resolved.text.length} chars)`}
          </span>
        ) : (
          <span className="model-run-ready is-muted">No prompt ready</span>
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
