type IconProps = { path: string; folder?: 'open' | 'closed' }

export function ProjectFileIcon({ path, folder }: IconProps) {
  const name = path.split('/').at(-1) ?? path
  const extension = name.split('.').at(-1)?.toLowerCase()
  let ink = 'var(--muted)'
  let glyph = <><path d="M4 2h5l3 3v9H4z" /><path d="M9 2v3h3M6 8h4m-4 3h4" /></>
  if (folder) {
    ink = 'var(--coll-tuple)'
    glyph = <><path d="M1.5 12.5V4c0-.6.5-1.1 1.1-1.1h3.6l1.4 1.5H13c.6 0 1.1.5 1.1 1.1v6.1c0 .7-.5 1.1-1.1 1.1H2.5z" fill="currentColor" fillOpacity=".12" />
      {folder === 'open' && <path d="m2 12.6 1.6-5.3h11.5l-1.7 5.3z" fill="var(--surface)" />}</>
  } else if (extension === 'py' && (name.startsWith('test_') || name.endsWith('_test.py'))) {
    ink = 'var(--accent-deep)'
    glyph = <><path d="M6 2h4M7 2v4.3l-3.7 6.1q-.8 1.6 1 1.6h7.4q1.7 0 1-1.6L9 6.3V2" /><path d="M5 10h6" /></>
  } else if (extension === 'py') {
    glyph = <g stroke="none">
      <path d="M8 1.5c-2.6 0-3 1-3 2.2v1.8h3.2v.6H3.6C2.3 6.1 1.5 7 1.5 8.6s.8 2.5 2 2.5H5V9.6c0-1.2 1-2.1 2.2-2.1h2.7c1 0 1.8-.8 1.8-1.8v-2c0-1.2-1.1-2.2-3.7-2.2z" fill="var(--coll-tuple)" />
      <path d="M8 14.5c2.6 0 3-1 3-2.2v-1.8H7.8v-.6h4.6c1.3 0 2.1-.9 2.1-2.5s-.8-2.5-2-2.5H11v1.5c0 1.2-1 2.1-2.2 2.1H6.1c-1 0-1.8.8-1.8 1.8v2c0 1.2 1.1 2.2 3.7 2.2z" fill="#e5ac29" />
      <circle cx="6.6" cy="3.3" r=".65" fill="var(--surface)" /><circle cx="9.4" cy="12.7" r=".65" fill="var(--surface)" />
    </g>
  } else if (extension === 'csv' || extension === 'tsv') {
    ink = 'var(--ok)'
    glyph = <><rect x="2" y="2.5" width="12" height="11" rx="2" /><path d="M2.5 6.5h11M2.5 10h11M6.5 3v10" /></>
  } else if (extension === 'json') {
    ink = 'var(--expr)'
    glyph = <path d="M6 2.5c-1.5 0-2 .7-2 2v1.6c0 .9-.5 1.4-1.5 1.9 1 .4 1.5 1 1.5 1.9v1.6c0 1.3.5 2 2 2M10 2.5c1.5 0 2 .7 2 2v1.6c0 .9.5 1.4 1.5 1.9-1 .4-1.5 1-1.5 1.9v1.6c0 1.3-.5 2-2 2" />
  } else if (extension === 'md') {
    ink = 'var(--solution)'
    glyph = <><rect x="1.5" y="3.5" width="13" height="9" rx="2" /><path d="M4 10V6l2 2 2-2v4M11 6v4m-1.3-1.3L11 10l1.3-1.3" /></>
  }
  return <svg aria-hidden="true" className="project-file-icon" viewBox="0 0 16 16" style={{color: ink}}
    fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" strokeLinecap="round">{glyph}</svg>
}
