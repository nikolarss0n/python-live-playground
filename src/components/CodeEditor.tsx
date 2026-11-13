import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { python, pythonLanguage } from '@codemirror/lang-python'
import { EditorView, keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { acceptCompletion } from '@codemirror/autocomplete'
import { HighlightStyle, LanguageSupport, syntaxHighlighting } from '@codemirror/language'
import { styleTags, tags as t } from '@lezer/highlight'
import { useEffect, useId, useMemo, useRef } from 'react'
import { EDITOR_EXIT_HINT } from './ShortcutsModal'
import {
  setVariablePathNames,
  variablePathColors,
} from '../editor/variableColors'
import { blankHighlightExtension } from '../editor/blankHighlight'
import { blankHintExtension } from '../editor/blankHint'
import { runPulseExtension } from '../editor/runPulse'
import { problemMarkExtension } from '../editor/problemMark'
import { codeHoverExtension } from '../editor/codeHover'
import { dotCompletionExtension } from '../editor/dotCompletion'
import { docstringExtension } from '../editor/docstring'
import { callParens } from '../editor/callParens'

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
  readOnly?: boolean
}

/** Python plus the tags the stock grammar leaves out: parameters and type annotations. */
const richPython = new LanguageSupport(
  pythonLanguage.configure({
    props: [styleTags({
      'ParamList/VariableName': t.local(t.variableName),
      'TypeDef/VariableName': t.typeName,
    })],
  }),
  python().support,
)

const lightHighlight = HighlightStyle.define([
  { tag: t.comment, color: '#6B665D', fontStyle: 'italic' },
  { tag: t.string, color: '#8C5D00' },
  { tag: [t.escape, t.special(t.string)], color: '#0E7490' },
  { tag: t.number, color: '#B83D0B' },
  { tag: [t.keyword, t.operatorKeyword, t.definitionOperator, t.arithmeticOperator, t.compareOperator, t.meta], color: '#C2185B' },
  { tag: [t.separator, t.derefOperator, t.punctuation], color: '#6B6560' },
  { tag: [t.paren, t.squareBracket], color: '#935A06' },
  { tag: t.brace, color: '#A21CAF' },
  { tag: [t.variableName, t.propertyName], color: '#1C1B19' },
  { tag: t.local(t.variableName), color: '#B91C1C' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#047857' },
  { tag: [t.typeName, t.className, t.definition(t.className)], color: '#0369A1' },
  { tag: [t.bool, t.null], color: '#7C3AED' },
])

const darkHighlight = HighlightStyle.define([
  { tag: t.comment, color: '#888DA5', fontStyle: 'italic' },
  { tag: t.string, color: '#F6D98E' },
  { tag: [t.escape, t.special(t.string)], color: '#7DCFFF' },
  { tag: t.number, color: '#FAB387' },
  { tag: [t.keyword, t.operatorKeyword, t.definitionOperator, t.arithmeticOperator, t.compareOperator, t.meta], color: '#F2709C' },
  { tag: [t.separator, t.derefOperator, t.punctuation], color: '#C8CCD8' },
  { tag: [t.paren, t.squareBracket], color: '#F6D06B' },
  { tag: t.brace, color: '#D98BEB' },
  { tag: [t.variableName, t.propertyName], color: '#E6EAF2' },
  { tag: t.local(t.variableName), color: '#F38BA8' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#7EE2B8' },
  { tag: [t.typeName, t.className, t.definition(t.className)], color: '#7DCFFF' },
  { tag: [t.bool, t.null], color: '#C4A1FF' },
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
        color: isDark ? '#847E75' : '#746B5E',
        minWidth: '2.75rem',
      },
      '.cm-lineNumbers .cm-gutterElement': {
        padding: '0 0.75rem 0 0.5rem',
        fontSize: '12px',
      },
      '.cm-activeLine': {
        // Tint only when focused — idle blue strip reads as an artifact.
        backgroundColor: 'transparent',
      },
      '&.cm-focused .cm-activeLine': {
        backgroundColor: isDark
          ? 'rgba(255,255,255,0.03)'
          : 'rgba(0,0,0,0.025)',
      },
      '.cm-run-pulse-line': {
        backgroundColor: isDark
          ? 'rgba(61, 184, 168, 0.14)'
          : 'rgba(13, 122, 111, 0.12)',
        transition: 'background-color 200ms ease',
      },
      '.cm-blank-token': {
        backgroundColor: isDark
          ? 'rgba(251, 191, 36, 0.16)'
          : 'rgba(180, 121, 31, 0.14)',
        borderBottom: isDark
          ? '2px solid rgba(251, 191, 36, 0.55)'
          : '2px solid rgba(180, 121, 31, 0.5)',
        borderRadius: '3px',
        cursor: 'pointer',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'transparent',
        color: isDark ? '#847E75' : '#746B5E',
      },
      '&.cm-focused .cm-activeLineGutter': {
        color: isDark ? '#A8A29E' : '#6B6560',
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
        backgroundColor: isDark
          ? 'rgba(61, 184, 168, 0.28)'
          : 'rgba(13, 122, 111, 0.18)',
      },
      '.cm-docstring, .cm-docstring *': {
        color: isDark ? '#8E95C2' : '#6366A0',
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
  readOnly = false,
}: CodeEditorProps) {
  const ref = useRef<ReactCodeMirrorRef>(null)
  const keyboardHelpId = useId()
  const onGeometryChangeRef = useRef(onGeometryChange)
  onGeometryChangeRef.current = onGeometryChange

  const extensions = useMemo(
    () => [
      richPython,
      EditorView.contentAttributes.of({ 'aria-label': ariaLabel, 'aria-describedby': keyboardHelpId }),
      dotCompletionExtension(),
      docstringExtension,
      callParens,
      Prec.highest(keymap.of([{ key: 'Tab', run: acceptCompletion }])),
      buildTheme(theme),
      syntaxHighlighting(theme === 'dark' ? darkHighlight : lightHighlight),
      ...variablePathColors(theme === 'dark'),
      blankHighlightExtension(),
      ...blankHintExtension(),
      ...runPulseExtension(),
      ...problemMarkExtension(),
      codeHoverExtension(),
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
    [theme, ariaLabel, keyboardHelpId],
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
      <span id={keyboardHelpId} className="sr-only">{EDITOR_EXIT_HINT}</span>
      <CodeMirror
        ref={ref}
        value={value}
        readOnly={readOnly}
        height="100%"
        theme="none"
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
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
