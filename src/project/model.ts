import { isProjectPath, parentFolder, projectFilesError, projectFolders } from './paths'

export interface Project {
  name: string
  entry: string
  files: Record<string, string>
  folders: string[]
  activePath: string
  openPaths: string[]
}

export interface WorkspaceSnapshot {
  enabled: boolean
  project: Project
  otherProjects: Project[]
}

export const PROJECT_STORAGE_KEY = 'plp-project-v1'

export function starterProject(): Project {
  return {
    name: 'mail-tools',
    folders: ['mail_tools', 'data'],
    entry: 'main.py',
    activePath: 'mail_tools/mask.py',
    openPaths: ['main.py', 'mail_tools/mask.py', 'data/mails.csv'],
    files: {
      'main.py': [
        'from mail_tools.mask import print_masked',
        '',
        'with open("data/mails.csv", encoding="utf-8") as mails:',
        '    next(mails)  # Skip the column heading.',
        '    for email in mails:',
        '        print_masked(email.strip())',
        '',
      ].join('\n'),
      'mail_tools/__init__.py': '',
      'mail_tools/mask.py': [
        'def print_masked(email):',
        '    name, domain = email.split("@")',
        '    if len(name) == 1:',
        '        print("*@" + domain)',
        '    else:',
        '        print(name[0] + "*" * (len(name) - 1) + "@" + domain)',
        '',
      ].join('\n'),
      'data/mails.csv': 'email\nmarina@example.com\nsasha@example.org\na@example.net\nkevin@example.com\n',
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTextFileMap(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((text) => typeof text === 'string')
}

function isProjectName(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 80 && value.trim() === value
    && !value.includes('/') && !value.includes('\\') && Array.from(value).every((character) => character.charCodeAt(0) >= 32)
}

export function projectNameError(name: string, names: string[]): string | null {
  if (!isProjectName(name)) return 'Enter a project name of up to 80 characters without slashes.'
  return names.some((existing) => existing.toLowerCase() === name.toLowerCase()) ? 'A project already has that name.' : null
}

function parseProject(value: unknown): Project | null {
  if (!isRecord(value)) return null
  const { files, entry, name, activePath, openPaths } = value
  const folders: unknown = value.folders === undefined ? [] : value.folders
  if (!Array.isArray(folders) || !folders.every((folder): folder is string => typeof folder === 'string')) return null
  if (!isTextFileMap(files) || projectFilesError(files, folders) || !isProjectName(name)
    || typeof entry !== 'string' || !Object.hasOwn(files, entry) || !entry.endsWith('.py')) return null
  const validTabs = Array.isArray(openPaths)
    ? openPaths.filter((path): path is string => typeof path === 'string' && Object.hasOwn(files, path)) : []
  const tabs = [...new Set(validTabs)]
  if (!tabs.length) tabs.push(entry)
  return { files, entry, name, folders: projectFolders(files, folders), openPaths: tabs, activePath: typeof activePath === 'string' && tabs.includes(activePath) ? activePath : tabs[0] }
}

export function parseWorkspace(raw: string): WorkspaceSnapshot | null {
  try {
    const saved: unknown = JSON.parse(raw)
    if (!isRecord(saved) || saved.version !== 1 || typeof saved.enabled !== 'boolean') return null
    const project = parseProject(saved.project)
    if (!project) return null
    const otherProjects: Project[] = []
    const names = new Set([project.name.toLowerCase()])
    const others: unknown = saved.otherProjects ?? []
    if (!Array.isArray(others)) return null
    for (const item of others) {
      const other = parseProject(item)
      if (!other || names.has(other.name.toLowerCase())) return null
      names.add(other.name.toLowerCase())
      otherProjects.push(other)
    }
    return { enabled: saved.enabled, project, otherProjects }
  } catch {
    return null
  }
}

export function openProjectFile(project: Project, path: string): Project {
  if (!Object.hasOwn(project.files, path) || path === project.activePath) return project
  return { ...project, activePath: path, openPaths: project.openPaths.includes(path) ? project.openPaths : [...project.openPaths, path] }
}

export function closeProjectTab(project: Project, path: string): Project {
  const index = project.openPaths.indexOf(path)
  if (index < 0 || project.openPaths.length === 1) return project
  const openPaths = project.openPaths.filter((file) => file !== path)
  const activePath = path === project.activePath ? openPaths[Math.min(index, openPaths.length - 1)] : project.activePath
  return { ...project, activePath, openPaths }
}

export function renameProjectFile(project: Project, path: string, newPath: string): Project | string {
  if (!Object.hasOwn(project.files, path)) return 'That file is no longer in this project.'
  if (newPath === path) return project
  if (Object.hasOwn(project.files, newPath)) return 'A file already exists at this path.'
  if (path === project.entry && !newPath.endsWith('.py')) return 'Keep the entry file’s .py extension or choose another entry first.'
  const renamed = (file: string) => file === path ? newPath : file
  const files = Object.fromEntries(Object.entries(project.files).map(([file, text]) => [renamed(file), text]))
  const error = projectFilesError(files, project.folders)
  if (error) return error
  return { ...project, files, folders: projectFolders(files, project.folders), entry: renamed(project.entry), activePath: renamed(project.activePath), openPaths: project.openPaths.map(renamed) }
}

export function deleteProjectFile(project: Project, path: string): Project | string {
  if (!Object.hasOwn(project.files, path)) return 'That file is no longer in this project.'
  if (path === project.entry) return 'Choose another Python file as the entry before deleting this one.'
  const files = { ...project.files }
  delete files[path]
  const remaining = closeProjectTab(project, path)
  if (remaining.activePath === path) {
    return { ...project, files, activePath: project.entry, openPaths: [project.entry] }
  }
  return { ...remaining, files }
}

export function setProjectEntry(project: Project, path: string): Project | string {
  if (!Object.hasOwn(project.files, path) || !path.endsWith('.py')) return 'Choose an existing .py file as the project entry.'
  return path === project.entry ? project : { ...project, entry: path }
}

export function renameProjectFolder(project: Project, path: string, name: string): Project | string {
  if (!project.folders.includes(path)) return 'That folder is no longer in this project.'
  if (name.includes('/') || !isProjectPath(name)) return 'Enter a single folder name.'
  const parent = parentFolder(path)
  const target = parent ? parent + '/' + name : name
  if (path === target) return project
  if (project.folders.includes(target) || Object.hasOwn(project.files, target)) return 'That name already exists here.'
  const renamed = (item: string) => item === path || item.startsWith(path + '/') ? target + item.slice(path.length) : item
  const folders = project.folders.map(renamed)
  const files = Object.fromEntries(Object.entries(project.files).map(([file, content]) => [renamed(file), content]))
  const error = projectFilesError(files, folders)
  if (error) return error
  return { ...project, folders, files, entry: renamed(project.entry), activePath: renamed(project.activePath),
    openPaths: project.openPaths.map(renamed) }
}

export function deleteProjectFolder(project: Project, path: string): Project | string {
  if (!project.folders.includes(path)) return 'That folder is no longer in this project.'
  const inside = (file: string) => file.startsWith(path + '/')
  if (inside(project.entry)) return 'Choose an entry file outside this folder before deleting it.'
  const files = Object.fromEntries(Object.entries(project.files).filter(([file]) => !inside(file)))
  const folders = project.folders.filter(folder => folder !== path && !inside(folder))
  const openPaths = project.openPaths.filter(file => !inside(file))
  if (!openPaths.length) openPaths.push(project.entry)
  return { ...project, files, folders, openPaths, activePath: inside(project.activePath) ? openPaths[0] : project.activePath }
}
