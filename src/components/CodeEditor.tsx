import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { useEffect, useMemo, useRef } from 'react'
import {
  setVariablePathNames,
  variablePathColors,
} from '../editor/variableColors'

type ThemeMode = 'light' | 'dark'

type CodeEditorProps = {
  value: string
  onChange: (value: string) => void
  theme: ThemeMode
  ariaLabel?: string
  onViewReady?: (view: EditorView | null) => void
  onGeometryChange?: () => void
  /** Variable names to chip (from hovering a result on the right). */
  pathNames?: readonly string[]
}

const lightHighlight = HighlightStyle.define([
  { tag: t.comment, color: '#8A8478', fontStyle: 'italic' },
  { tag: t.string, color: '#0B6E4F' },
  { tag: t.number, color: '#B45309' },
  { tag: t.keyword, color: '#7C3AED' },
  { tag: t.operator, color: '#6B6560' },
  { tag: t.definition(t.variableName), color: '#1C1B19' },
  { tag: t.variableName, color: '#1C1B19' },
  { tag: t.function(t.variableName), color: '#0D6E8C' },
  { tag: t.className, color: '#0D6E8C' },
  { tag: t.bool, color: '#B45309' },
  { tag: t.null, color: '#B45309' },
  { tag: t.meta, color: '#8A8478' },
])

const darkHighlight = HighlightStyle.define([
  { tag: t.comment, color: '#8B8680', fontStyle: 'italic' },
  { tag: t.string, color: '#6EE7B7' },
  { tag: t.number, color: '#FBBF24' },
  { tag: t.keyword, color: '#C4B5FD' },
  { tag: t.operator, color: '#A8A29E' },
  // Keep variable glyphs light; path identity is the chip background only.
  { tag: t.definition(t.variableName), color: '#F5F2EB' },
  { tag: t.variableName, color: '#F5F2EB' },
  { tag: t.function(t.variableName), color: '#7DD3FC' },
  { tag: t.className, color: '#7DD3FC' },
  { tag: t.bool, color: '#FBBF24' },
  { tag: t.null, color: '#FBBF24' },
  { tag: t.meta, color: '#8B8680' },
])

function buildTheme(mode: ThemeMode) {
  const isDark = mode === 'dark'
  return EditorView.theme(
    {
      '&': {
        height: '100%',
        fontSize: '14.5px',
        backgroundColor: 'transparent',
      },
      '.cm-scroller': {
        fontFamily:
          '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
        lineHeight: '1.65',
        overflow: 'auto',
      },
      '.cm-content': {
        padding: '1.25rem 1rem 3rem 0.25rem',
        caretColor: isDark ? '#F5F2EB' : '#1C1B19',
      },
      '.cm-gutters': {
        backgroundColor: 'transparent',
        border: 'none',
        color: isDark ? '#5C5852' : '#B0A99E',
        minWidth: '2.75rem',
      },
      '.cm-lineNumbers .cm-gutterElement': {
        padding: '0 0.75rem 0 0.5rem',
        fontSize: '12px',
      },
      '.cm-activeLine': {
        backgroundColor: isDark
          ? 'rgba(255,255,255,0.03)'
          : 'rgba(0,0,0,0.025)',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'transparent',
        color: isDark ? '#A8A29E' : '#6B6560',
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
        backgroundColor: isDark
          ? 'rgba(61, 184, 168, 0.28)'
          : 'rgba(13, 122, 111, 0.18)',
      },
      '.cm-cursor': {
        borderLeftColor: isDark ? '#F5F2EB' : '#1C1B19',
      },
      '&.cm-focused': {
        outline: 'none',
      },
    },
    { dark: isDark },
  )
}

export function CodeEditor({
  value,
  onChange,
  theme,
  ariaLabel = 'Python editor',
  onViewReady,
  onGeometryChange,
  pathNames = [],
}: CodeEditorProps) {
  const ref = useRef<ReactCodeMirrorRef>(null)
  const onGeometryChangeRef = useRef(onGeometryChange)
  onGeometryChangeRef.current = onGeometryChange

  const extensions = useMemo(
    () => [
      python(),
      buildTheme(theme),
      syntaxHighlighting(theme === 'dark' ? darkHighlight : lightHighlight),
      ...variablePathColors(theme === 'dark'),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (
          update.geometryChanged ||
          update.viewportChanged ||
          update.docChanged
        ) {
          onGeometryChangeRef.current?.()
        }
      }),
    ],
    [theme],
  )

  useEffect(() => {
    return () => onViewReady?.(null)
  }, [onViewReady])

  // Result-panel hover drives path chips.
  useEffect(() => {
    const view = ref.current?.view
    if (!view) return
    setVariablePathNames(view, pathNames)
  }, [pathNames, value, theme])

  return (
    <div className="code-editor" role="region" aria-label={ariaLabel}>
      <CodeMirror
        ref={ref}
        value={value}
        height="100%"
        theme="none"
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false,
          searchKeymap: false,
        }}
        extensions={extensions}
        onChange={onChange}
        onCreateEditor={(view) => {
          onViewReady?.(view)
          if (pathNames.length) setVariablePathNames(view, pathNames)
        }}
      />
    </div>
  )
}
