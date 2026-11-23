import { pythonLanguage } from '@codemirror/lang-python'
import { Text } from '@codemirror/state'
import type { SyntaxNode } from '@lezer/common'

export const patternNames = ['Simple factory', 'Function decorator', 'Adapter'] as const
export type PatternName = typeof patternNames[number]
export interface SourceLocation { path: string; line: number }
export interface PatternEvidence { description: string; locations: SourceLocation[] }
export interface PatternReview {
  scanned: number
  skipped: SourceLocation[]
  matches: (PatternEvidence & { pattern: PatternName })[]
  suggestions: PatternEvidence[]
}

function children(node: SyntaxNode | null): SyntaxNode[] {
  const result: SyntaxNode[] = []
  for (let child = node?.firstChild; child; child = child.nextSibling) result.push(child)
  return result
}

// Visit one lexical scope. A nested function or class has its own returns and assignments.
function scope(body: SyntaxNode | null): SyntaxNode[] {
  const nodes: SyntaxNode[] = []
  body?.cursor().iterate(node => {
    if (node.name === 'FunctionDefinition' || node.name === 'ClassDefinition' || node.name === 'LambdaExpression') return false
    nodes.push(node.node)
  })
  return nodes
}

function parameters(fn: SyntaxNode, text: (node: SyntaxNode | null) => string) {
  const names = new Set<string>()
  let next = true
  for (const child of children(fn.getChild('ParamList'))) {
    if (child.name === '(' || child.name === ',') next = true
    else if (child.name === 'VariableName' && next) { names.add(text(child)); next = false }
  }
  return names
}

export function reviewDesignPatterns(files: Readonly<Record<string, string>>): PatternReview {
  const report: PatternReview = { scanned: 0, skipped: [], matches: [], suggestions: [] }
  const decisions = new Map<string, { arg: string; values: string[]; locations: SourceLocation[] }>()
  const sources = Object.entries(files).filter(([path]) => path.endsWith('.py')).map(([path, source]) => {
    const tree = pythonLanguage.parser.parse(source)
    const text = (node: SyntaxNode | null) => node ? source.slice(node.from, node.to) : ''
    const module = path.replace(/\.py$/, '').replaceAll('/', '.').replace(/\.__init__$/, '')
    const exports = new Set(tree.topNode.getChildren('ClassDefinition').map(n => text(n.getChild('VariableName'))))
    return { path, source, tree, text, module, exports }
  })
  const modules = new Map(sources.map(unit => [unit.module, unit.exports]))
  for (const { path, source, tree, text, module } of sources) {
    const doc = Text.of(source.split('\n'))
    const location = (node: SyntaxNode) => ({ path, line: doc.lineAt(node.from).number })
    let firstError: SourceLocation | undefined
    const functions: SyntaxNode[] = []
    const classes: SyntaxNode[] = []
    tree.iterate({ enter(node) {
      if (node.type.isError) firstError ??= location(node.node)
      if (node.name === 'FunctionDefinition') functions.push(node.node)
      if (node.name === 'ClassDefinition') classes.push(node.node)
    } })
    if (firstError) { report.skipped.push(firstError); continue }
    report.scanned++
    const nameOf = (node: SyntaxNode) => text(node.getChild('VariableName'))
    const classNames = new Set(classes.map(nameOf))
    for (const statement of tree.topNode.getChildren('ImportStatement')) {
      const parts = children(statement)
      const split = parts.findIndex(part => part.name === 'import')
      if (parts[0]?.name !== 'from' || split < 2) continue
      let origin = parts.slice(1, split).map(text).join('')
      if (origin.startsWith('.')) {
        const dots = origin.match(/^\.+/)?.[0].length ?? 0
        const dirs = module.split('.')
        const depth = dirs.length - dots + Number(path.endsWith('/__init__.py'))
        if (depth < 0) continue
        origin = [...dirs.slice(0, depth), origin.slice(dots)].filter(Boolean).join('.')
      }
      const exported = modules.get(origin)
      if (!exported) continue
      for (let i = split + 1; i < parts.length; i++) {
        if (parts[i].name !== 'VariableName') continue
        const original = text(parts[i])
        let alias = original
        if (parts[i + 1]?.name === 'as') {
          i += 2
          alias = text(parts[i])
        }
        if (exported.has(original)) classNames.add(alias)
      }
    }
    const record = (pattern: PatternName, description: string, ...nodes: SyntaxNode[]) =>
      report.matches.push({ pattern, description, locations: nodes.map(location) })

    for (const fn of functions) {
      const body = fn.getChild('Body')
      const nodes = scope(body)
      const returned = nodes.filter(n => n.name === 'ReturnStatement')
      const branches = nodes.filter(n => n.name === 'IfStatement')
      const constructed = new Set(returned.map(n => text(n.getChild('CallExpression')?.firstChild ?? null)).filter(n => classNames.has(n)))
      if (constructed.size >= 2 && branches.length) {
        record('Simple factory', nameOf(fn) + ' chooses between project constructors: ' + [...constructed].join(', ') + '.', fn)
      }
      const args = parameters(fn, text)
      for (const wrapper of body?.getChildren('FunctionDefinition') ?? []) {
        if (!returned.some(n => text(n.getChild('VariableName')) === nameOf(wrapper))) continue
        const wrapped = scope(wrapper.getChild('Body')).find(n => n.name === 'CallExpression' && args.has(text(n.firstChild)))
        if (wrapped) record('Function decorator', nameOf(fn) + ' returns ' + nameOf(wrapper) + ', which calls its supplied function ' + text(wrapped.firstChild) + '.', fn, wrapper)
      }
      // Repeated dispatch on the same parameter and literals is evidence for a shared policy.
      for (const branch of branches) {
        const conditions = branch.getChildren('BinaryExpression').map(n => {
          if (n.firstChild?.name !== 'VariableName' || text(n.getChild('CompareOp')) !== '==' || n.lastChild?.name !== 'String') return null
          return { arg: text(n.firstChild), value: text(n.lastChild).replace(/^['"]|['"]$/g, '') }
        })
        const first = conditions[0]
        if (!first || conditions.length < 2 || !args.has(first.arg) || !conditions.every(c => c?.arg === first.arg)) continue
        const values = [...new Set(conditions.flatMap(c => c ? [c.value] : []))].sort()
        if (values.length < 2) continue
        const key = JSON.stringify([first.arg, values])
        const group = decisions.get(key) ?? { arg: first.arg, values, locations: [] }
        const { locations } = group
        const here = location(fn)
        if (!locations.some(item => item.path === path && item.line === here.line)) locations.push(here)
        decisions.set(key, group)
      }
    }

    for (const cls of classes) {
      const methods = cls.getChild('Body')?.getChildren('FunctionDefinition') ?? []
      const init = methods.find(m => nameOf(m) === '__init__')
      if (!init) continue
      const injected = new Set<string>()
      const args = parameters(init, text)
      for (const node of scope(init.getChild('Body'))) {
        if (node.name !== 'AssignStatement' || node.firstChild?.name !== 'MemberExpression' || node.lastChild?.name !== 'VariableName') continue
        const member = node.firstChild
        if (text(member.firstChild) === 'self' && args.has(text(node.lastChild)) && text(node.lastChild) !== 'self') injected.add(text(member))
      }
      for (const method of methods) {
        if (nameOf(method).startsWith('_')) continue
        const delegated = scope(method.getChild('Body')).find(n => {
          const callee = n.name === 'ReturnStatement' ? n.getChild('CallExpression')?.firstChild : null
          return callee?.name === 'MemberExpression' && injected.has(text(callee.firstChild)) && text(callee.lastChild) !== nameOf(method)
        })
        if (delegated) {
          const callee = delegated.getChild('CallExpression')?.firstChild
          record('Adapter', nameOf(cls) + '.' + nameOf(method) + ' delegates to the injected object via ' + text(callee ?? null) + '.', method)
        }
      }
    }
  }
  for (const { arg, values, locations } of decisions.values()) {
    if (locations.length < 2) continue
    report.suggestions.push({ description: 'These functions branch on ' + arg + ' for ' + values.join(' and ') +
      '. If both decisions change together, consider a shared Strategy for each case.', locations })
  }
  return report
}
