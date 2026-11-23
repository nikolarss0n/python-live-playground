import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useModalFocus } from '../components/useModalFocus'
import { patternNames, type PatternReview, type PatternEvidence, type SourceLocation } from './designPatterns'

export function PatternReviewDialog({ files, close, open }: {
  files: Readonly<Record<string, string>>
  close: () => void
  open: (location: SourceLocation) => void
}) {
  const dialog = useModalFocus(true, close)
  const [review, setReview] = useState<PatternReview | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setReview(null)
    setFailed(false)
    const worker = new Worker(new URL('./patternReview.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<PatternReview>) => { setReview(event.data); worker.terminate() }
    worker.onerror = () => { setFailed(true); worker.terminate() }
    worker.postMessage(files)
    return () => worker.terminate()
  }, [files])
  const unmatched = review ? patternNames.filter(name => !review.matches.some(match => match.pattern === name)) : []
  function link(location: SourceLocation) {
    const label = location.path + ':' + location.line
    return <button className="pattern-location" type="button" key={label} onClick={() => open(location)}>{label}</button>
  }
  function evidence(item: PatternEvidence) {
    return <><p>{item.description}</p><div className="pattern-links">{item.locations.map(link)}</div></>
  }
  return createPortal(<div className="help-overlay" onClick={close}>
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="pattern-review-title"
      className="help-card pattern-review" onClick={e => e.stopPropagation()}>
      <header><h2 id="pattern-review-title" className="help-title">Design patterns</h2>
        <button type="button" className="project-icon-button" aria-label="Close pattern review" onClick={close}>×</button></header>
      {failed && <p role="alert">The local review could not finish. Close it and try again.</p>}
      {!review && !failed && <p role="status">Reading Python files…</p>}
      {review && <><p>Local syntax review of {review.scanned} Python {review.scanned === 1 ? 'file' : 'files'}. Matches suggest a structure you can inspect.</p>
      {review.matches.map((item, i) => <section key={i}><h3>{item.pattern}</h3>{evidence(item)}</section>)}
      {unmatched.length > 0 && <section><h3>No match found</h3><p>{unmatched.join(' · ')}</p></section>}
      <section><h3>Suggestions</h3>{review.suggestions.length ? review.suggestions.map((item, i) => <div key={i}>{evidence(item)}</div>)
        : <p>No repeated dispatch decisions found to refactor.</p>}</section>
      {review.skipped.length > 0 && <section><h3>Skipped due to syntax errors</h3><div className="pattern-links">{review.skipped.map(link)}</div></section>}
      </>}
    </section>
  </div>, document.body)
}
