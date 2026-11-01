/** The Python basics track in teaching order; lesson numbers and chapters are assigned from this list. */
export const BEGINNER_PATH: readonly { chapter: string; ids: readonly string[] }[] = [
  { chapter: 'First steps', ids: ['printing', 'comments-indentation', 'variables', 'types', 'expressions', 'operators'] },
  { chapter: 'Text & decisions', ids: ['strings', 'string-methods', 'booleans', 'conditionals', 'elif-and-or'] },
  { chapter: 'Lists, loops & dictionaries', ids: ['lists', 'for-loops', 'while-loops', 'dicts'] },
  {
    chapter: 'Functions & errors',
    ids: ['functions', 'function-parameters', 'variable-scope', 'errors', 'common-errors', 'python-for', 'infinite', 'capstone'],
  },
  { chapter: 'Classes, files & modules', ids: ['classes-basics', 'inheritance', 'files-pathlib', 'modules-imports'] },
  {
    chapter: 'Working with data',
    ids: ['missing-data-none', 'nested-records', 'text-normalization', 'assertions-as-tests', 'feedback-classifier-capstone'],
  },
]
