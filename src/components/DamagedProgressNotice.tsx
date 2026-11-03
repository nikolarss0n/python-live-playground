import type { DamagedNotice } from '../useLearningSession'

/** Footer notice when earlier saved progress could not be read, with a way to download it. */
export function DamagedProgressNotice({ what, notice, onDownload }: {
  /** What the progress belongs to, e.g. "lesson" or "refresher". */
  what: string
  notice: DamagedNotice
  onDownload: () => void
}) {
  return (
    <span className="footer-damaged">
      {notice === 'blocked'
        ? `Earlier saved ${what} progress could not be read. Saving is paused so it is not lost.`
        : `Earlier saved ${what} progress could not be read. A copy was kept on this device.`}
      <button type="button" className="footer-damaged-download" onClick={onDownload}>
        Download {what} progress
      </button>
    </span>
  )
}
