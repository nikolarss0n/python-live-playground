/**
 * When a result on the right is hovered, chip every occurrence of variables
 * used on that result's source line. Chips share one soft intensity with the
 * connector ribbon so the path reads as a single highlight language.
 */
import {
  Decoration,
  EditorView,
  type DecorationSet,
} from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import {
  RangeSetBuilder,
  StateEffect,
  StateField,
  type EditorState,
} from '@codemirror/state'

/** Builtins / common calls — not part of a “value path”. */
export const SKIP_NAMES = new Set([
  'print',
  'input',
  'len',
  'range',
  'sum',
  'min',
  'max',
  'abs',
  'int',
  'str',
  'float',
  'bool',
  'list',
  'dict',
  'set',
  'tuple',
  'type',
  'open',
  'enumerate',
  'zip',
  'map',
  'filter',
  'sorted',
  'reversed',
  'isinstance',
  'hasattr',
  'getattr',
  'True',
  'False',
  'None',
  'self',
  'cls',
])

/** Fixed soft path paint — same for chips and ribbon (no mixed intensities). */
export const PATH_FILL_LIGHT = 'color-mix(in srgb, var(--accent) 16%, transparent)'
export const PATH_STROKE_LIGHT =
  'color-mix(in srgb, var(--accent) 22%, transparent)'
export const PATH_FILL_DARK = 'color-mix(in srgb, var(--accent) 18%, transparent)'
export const PATH_STROKE_DARK =
  'color-mix(in srgb, var(--accent) 26%, transparent)'

export function pathFill(dark: boolean): string {
  return dark ? PATH_FILL_DARK : PATH_FILL_LIGHT
}

export function pathStroke(dark: boolean): string {
  return dark ? PATH_STROKE_DARK : PATH_STROKE_LIGHT
}

/** @deprecated chips no longer use per-name solid hues */
export function chipColorForVariable(_name: string, dark: boolean): string {
  return pathFill(dark)
}

export function chipBorderForVariable(_name: string, dark: boolean): string {
  return pathStroke(dark)
}

export function colorForVariable(name: string, dark: boolean): string {
  return chipColorForVariable(name, dark)
}

const setPathNames = StateEffect.define<readonly string[]>()

const pathNamesField = StateField.define<readonly string[]>({
  create: () => [],
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setPathNames)) return effect.value
    }
    return value
  },
})

/**
 * User variable names referenced on a 1-based source line.
 */
export function namesOnSourceLine(
  state: EditorState,
  lineNumber: number,
): string[] {
  if (lineNumber < 1 || lineNumber > state.doc.lines) return []
  const line = state.doc.line(lineNumber)
  const found: string[] = []
  const seen = new Set<string>()

  syntaxTree(state).iterate({
    from: line.from,
    to: line.to,
    enter(node) {
      if (node.name !== 'VariableName') return
      const name = state.doc.sliceString(node.from, node.to)
      if (!name || SKIP_NAMES.has(name) || seen.has(name)) return
      seen.add(name)
      found.push(name)
    },
  })

  return found
}

function buildChipsForNames(
  state: EditorState,
  dark: boolean,
  names: readonly string[],
): DecorationSet {
  if (names.length === 0) return Decoration.none

  const nameSet = new Set(names)
  const fill = pathFill(dark)
  const border = pathStroke(dark)
  type Range = { from: number; to: number; name: string }
  const ranges: Range[] = []

  syntaxTree(state).iterate({
    from: 0,
    to: state.doc.length,
    enter(node) {
      if (node.name !== 'VariableName') return
      const name = state.doc.sliceString(node.from, node.to)
      if (!nameSet.has(name)) return
      ranges.push({ from: node.from, to: node.to, name })
    },
  })

  ranges.sort((a, b) => a.from - b.from || a.to - b.to)
  const builder = new RangeSetBuilder<Decoration>()
  let lastTo = -1
  for (const r of ranges) {
    if (r.from < lastTo) continue
    builder.add(
      r.from,
      r.to,
      Decoration.mark({
        class: 'cm-var-chip',
        attributes: {
          'data-var': r.name,
          style: `--cm-var-fill: ${fill}; --cm-var-border: ${border}`,
        },
      }),
    )
    lastTo = r.to
  }
  return builder.finish()
}

function chipDecorations(dark: boolean) {
  return EditorView.decorations.compute([pathNamesField], (state) => {
    const names = state.field(pathNamesField)
    if (names.length === 0) return Decoration.none
    return buildChipsForNames(state, dark, names)
  })
}

/** Apply path chips from outside (result-panel hover). */
export function setVariablePathNames(
  view: EditorView,
  names: readonly string[],
): void {
  const current = view.state.field(pathNamesField)
  if (
    current.length === names.length &&
    current.every((n, i) => n === names[i])
  ) {
    return
  }
  view.dispatch({
    effects: setPathNames.of([...names]),
  })
}

/**
 * Highlight chips driven by result hover (via setVariablePathNames).
 */
export function variablePathColors(dark: boolean) {
  return [pathNamesField, chipDecorations(dark)]
}
