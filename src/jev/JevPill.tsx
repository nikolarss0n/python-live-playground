import type { JevPinpointState } from './useJevPinpoint'

export function JevPill({ state, onRecheck, onShow }: {
  state: Exclude<JevPinpointState, { status: 'off' }>
  onRecheck: () => void
  onShow: () => void
}) {
  if (state.status === 'checking') {
    return <span className="jev-pill is-checking" role="status">Jev: finding the problem…</span>
  }
  if (state.status === 'failed') {
    return <button type="button" className="jev-pill is-failed" title={state.message} aria-label={`${state.message} Retry Jev`} onClick={onRecheck}>
      Jev unavailable · retry
    </button>
  }
  const who = state.source === 'Jev' ? 'Jev' : 'Problem'
  return <button type="button" className="jev-pill is-found" onClick={onShow} aria-label={`${who} found on line ${state.pinpoint.line}. Show it again`}>
    {who} · line {state.pinpoint.line}
  </button>
}
