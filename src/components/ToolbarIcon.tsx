const ICONS = {
  folder: 'M1.5 4.5a1 1 0 0 1 1-1h3.1l1.5 1.7h6.4a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1Z',
  prev: 'M10 3.5 5.5 8l4.5 4.5',
  next: 'M6 3.5 10.5 8 6 12.5',
  settings: 'M8 5.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8ZM6.9 1.5h2.2l.35 1.7 1.2.7 1.65-.55 1.1 1.9-1.3 1.15v1.4l1.3 1.15-1.1 1.9-1.65-.55-1.2.7-.35 1.7H6.9l-.35-1.7-1.2-.7-1.65.55-1.1-1.9 1.3-1.15v-1.4L2.6 5.25l1.1-1.9 1.65.55 1.2-.7Z',
  sun: 'M8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06',
  moon: 'M13.5 9.6A5.5 5.5 0 0 1 6.4 2.5a5.5 5.5 0 1 0 7.1 7.1Z',
} as const

export function ToolbarIcon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg className="toolbar-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d={ICONS[name]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
