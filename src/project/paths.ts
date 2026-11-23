export const MAX_PROJECT_FILES = 100
export const MAX_PROJECT_CHARS = 1_000_000

export function isProjectPath(path: string): boolean {
  if (!path || path.length > 240 || /[\\:]/u.test(path)) return false
  return path.split('/').every((part) =>
    part.length > 0 && part.trim() === part && part !== '.' && part !== '..'
    && !Object.hasOwn(Object.prototype, part)
    && Array.from(part).every((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127))
}

export function parentFolder(path: string): string {
  return path.slice(0, Math.max(0, path.lastIndexOf('/')))
}

export function projectFolders(files: Record<string, string>, explicit: readonly string[]): string[] {
  const folders = new Set(explicit)
  for (const path of [...Object.keys(files), ...explicit]) {
    for (let parent = parentFolder(path); parent; parent = parentFolder(parent)) folders.add(parent)
  }
  return [...folders]
}

export function projectFilesError(files: Record<string, string>, folders: readonly string[] = []): string | null {
  for (const folder of folders) {
    if (!isProjectPath(folder)) return 'Use a relative folder name, such as helpers.'
    for (let path = folder; path; path = parentFolder(path)) {
      if (Object.hasOwn(files, path)) return 'A file and a folder cannot share the same path.'
    }
  }
  const paths = Object.keys(files)
  if (paths.length > MAX_PROJECT_FILES) return `A project can contain up to ${MAX_PROJECT_FILES} files.`
  let characters = 0
  for (const path of paths) {
    if (!isProjectPath(path)) return 'Use a relative file path, such as helpers/format.py.'
    const parts = path.split('/')
    while (parts.length > 1) {
      parts.pop()
      if (Object.hasOwn(files, parts.join('/'))) return 'A file and a folder cannot share the same path.'
    }
    if (typeof files[path] !== 'string') return 'Project files must contain text.'
    characters += files[path].length
  }
  return characters <= MAX_PROJECT_CHARS ? null : 'The project exceeds the 1 million character limit.'
}
