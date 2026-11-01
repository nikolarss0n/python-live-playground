import { useEffect, useMemo, useRef, useState } from 'react'
import { askErrorAdvice, buildErrorAdviceContext, type ErrorAdvice } from '../errorAdvice'
import type { ResultEvent } from '../execution/protocol'
import type { AppSettings } from '../settings'

export type ErrorHelpContext = {
  code: string
  contextId: string
  lessonTitle: string
  settings: Pick<AppSettings, 'apiKey' | 'llmBaseUrl' | 'llmModel'>
  allowed: boolean
  fresh: boolean
  onOpenSettings: () => void
  /** Show the model's answer as code in the editor instead of prose here. */
  onSuggest?: (advice: ErrorAdvice, line: number | undefined) => void
}

type AdviceState = { status: 'idle' } | { status: 'loading' } |
  { status: 'ready'; advice: ErrorAdvice } | { status: 'failed'; message: string }

export function ErrorHelp({ error, context }: {
  error: Extract<ResultEvent, { kind: 'error' }>
  context: ErrorHelpContext
}) {
  const { code, contextId, settings, lessonTitle, allowed, fresh, onOpenSettings, onSuggest } = context
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<AdviceState>({ status: 'idle' })
  const generation = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const preview = useMemo(() => buildErrorAdviceContext({
    code, error: { message: error.message, line: error.line }, lessonTitle, apiKey: settings.apiKey,
  }), [code, error.message, error.line, lessonTitle, settings.apiKey])

  useEffect(() => {
    generation.current += 1
    controller.current?.abort()
    setState({ status: 'idle' })
    setOpen(false)
    return () => { generation.current += 1; controller.current?.abort() }
  }, [code, error.message, error.line, contextId, allowed, fresh, settings.apiKey, settings.llmBaseUrl, settings.llmModel])

  if (!allowed) return null
  const configured = settings.apiKey.trim().length > 0 && settings.llmBaseUrl.trim().length > 0
  const ask = async () => {
    if (!fresh || !configured || state.status === 'loading') return
    const requestId = ++generation.current
    const abort = new AbortController()
    controller.current = abort
    setState({ status: 'loading' })
    const result = await askErrorAdvice({
      baseUrl: settings.llmBaseUrl, apiKey: settings.apiKey, model: settings.llmModel,
      code, error: { message: error.message, line: error.line }, lessonTitle, signal: abort.signal,
    })
    if (requestId !== generation.current || abort.signal.aborted) return
    if (result.ok) onSuggest?.(result.advice, error.line)
    setState(result.ok ? { status: 'ready', advice: result.advice } : { status: 'failed', message: result.error })
  }

  return <div className="error-ai-help">
    <button type="button" className="linkish" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      {open ? 'Hide AI error help' : 'AI error help'}
    </button>
    {open ? <div className="error-ai-content">
      <p>Optional: send the snippet below and this error to the model configured in Settings. Your code is not changed automatically.</p>
      <details><summary>Snippet and error to send</summary>
        <pre className="error-card-example">{preview.snippet}</pre>
        <p>{preview.error.message}</p>
        {preview.contextNote ? <p>{preview.contextNote}</p> : null}
      </details>
      {!fresh ? <p role="status">Run the current code before asking for a hint.</p> : configured ? <div className="error-card-actions">
        <button type="button" className="btn-explain" disabled={state.status === 'loading'} onClick={() => void ask()}>
          {state.status === 'loading' ? 'Thinking…' : 'Ask for a hint'}
        </button>
        {state.status === 'loading' ? <button type="button" className="linkish" onClick={() => {
          generation.current += 1; controller.current?.abort(); setState({ status: 'idle' })
        }}>Cancel</button> : null}
      </div> : <button type="button" className="btn-explain" onClick={onOpenSettings}>Configure AI help</button>}
      {state.status === 'failed' ? <p role="alert">{state.message}</p> : null}
      {state.status === 'ready' && onSuggest ? <p role="status" aria-label="AI error suggestion">
        Suggestion shown in the editor{error.line ? ` under line ${error.line}` : ''}.
      </p> : null}
      {state.status === 'ready' && !onSuggest ? <div role="status" aria-label="AI error suggestion">
        <p><strong>AI suggestion</strong></p>
        <p>{state.advice.explanation}</p><p>{state.advice.hint}</p>
        {state.advice.example ? <pre className="error-card-example">{state.advice.example}</pre> : null}
        <p>Edit the code yourself, then run it to check the suggestion.</p>
      </div> : null}
    </div> : null}
  </div>
}
