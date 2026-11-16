import type { JevPinpointState } from './useJevPinpoint'

export function JevPill({ state, onRecheck, onShow }: {
  state: Exclude<JevPinpointState, { status: 'off' }>
  onRecheck: () => void
  onShow: () => void
}) {
  if (state.status === 'checking') {
    return <span className="jev-pill is-checking" role="status">Finding the problem…</span>
  }
  if (state.status === 'failed') {
    return <button type="button" className="jev-pill is-failed" title={state.message} aria-label={`${state.message} Retry finding the problem`} onClick={onRecheck}>
      Retry finding the problem
    </button>
  }
  return <button type="button" className="jev-pill is-found" onClick={onShow} aria-label={`Problem found on line ${state.pinpoint.line}. Show it again`}>
    Problem · line {state.pinpoint.line}
  </button>
}
