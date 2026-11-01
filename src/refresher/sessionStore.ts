import {
  REFRESHER_DAY_IDS,
  STUDY_STAGES,
  isPracticeDayId,
  isRefresherDayId,
  type MockVariantId,
  type PracticeDayId,
  type RefresherContext,
  type RefresherDay,
  type RefresherDayId,
  type StudyStage,
} from './types'

export const REFRESHER_STORAGE_KEY = 'plp-refresher-v1'
export const MOCK_DURATION_MS = 60 * 60 * 1000
export const MAX_DRAFT_LENGTH = 80_000
export const MAX_NOTE_LENGTH = 6_000
export const MAX_BACKUPS = 20
export const MAX_WORKSPACES = 30
export const MAX_MISTAKES = 100
const MAX_STORAGE_LENGTH = 4_000_000

export type Draft = {
  code: string
  note: string
  selfComplete: boolean
  verification: { code: string; contextKey: string } | null
}
export type Workspace = Record<StudyStage, Draft>
export type Rubric = {
  readability: boolean
  edgeCases: boolean
  debugging: boolean
  communication: boolean
  notes: string
}
export type MockAttempt = {
  id: string
  workspaceKey: string
  variantId: MockVariantId
  startedAt: number
  finishedAt: number | null
  submittedCode: string | null
  retake: boolean
  rubric?: Rubric
}
export type DaySession = {
  stage: StudyStage
  workspaceKey: string
  workspaces: Record<string, Workspace>
  selectedDays: [PracticeDayId, PracticeDayId]
  attempts: MockAttempt[]
  usedVariants: MockVariantId[]
  rubric: Rubric
}
export type Mistake = {
  id: string
  dayId: RefresherDayId
  error: string
  cause: string
  correctPattern: string
  createdAt: number
  resolved: boolean
}
export type DraftBackup = {
  id: string
  dayId: RefresherDayId
  workspaceKey: string
  stage: StudyStage
  draft: Draft
  createdAt: number
}
export type RefresherState = {
  version: 1
  days: Partial<Record<RefresherDayId, DaySession>>
  mistakes: Mistake[]
  backups: DraftBackup[]
}
export type SessionStorage = Pick<Storage, 'getItem' | 'setItem'>
export type SaveStatus = 'saved' | 'unavailable' | 'too-large' | 'history-full'
export type StarterFor = (day: RefresherDay, stage: StudyStage, context: RefresherContext) => string

export function emptyRefresherState(): RefresherState {
  return { version: 1, days: {}, mistakes: [], backups: [] }
}

export function defaultStarter(day: RefresherDay, stage: StudyStage): string {
  return stage === 'guided' ? day.guidedStarter : stage === 'independent' ? day.independentStarter : ''
}

export function newWorkspace(day: RefresherDay, context: RefresherContext, starter: StarterFor): Workspace {
  const draft = (stage: StudyStage): Draft => ({
    code: starter(day, stage, context), note: '', selfComplete: false, verification: null,
  })
  return {
    recall: draft('recall'), explain: draft('explain'), guided: draft('guided'),
    independent: draft('independent'), review: draft('review'),
  }
}

export function suggestRevisit(mistakes: readonly Mistake[]): [PracticeDayId, PracticeDayId] {
  const candidates = mistakes.filter((item) => !item.resolved).map((item) => item.dayId)
  const selected: PracticeDayId[] = []
  for (const candidate of [...candidates, 'refresher-03', 'refresher-04']) {
    if (isPracticeDayId(candidate) && !selected.includes(candidate)) selected.push(candidate)
    if (selected.length === 2) return [selected[0], selected[1]]
  }
  return ['refresher-03', 'refresher-04']
}

export function ensureDay(state: RefresherState, day: RefresherDay, starter: StarterFor): RefresherState {
  if (state.days[day.id]) return state
  const selectedDays = suggestRevisit(state.mistakes)
  const workspaceKey = day.kind === 'consolidation' ? `revisit:${selectedDays.join(':')}` : 'practice'
  const context: RefresherContext = day.kind === 'consolidation' ? { revisit: selectedDays } : {}
  const session: DaySession = {
    stage: 'recall', workspaceKey, selectedDays,
    workspaces: { [workspaceKey]: newWorkspace(day, context, starter) },
    attempts: [], usedVariants: [],
    rubric: { readability: false, edgeCases: false, debugging: false, communication: false, notes: '' },
  }
  return { ...state, days: { ...state.days, [day.id]: session } }
}

export function browserSessionStorage(): SessionStorage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage } catch { return null }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function text(value: unknown, limit: number): value is string {
  return typeof value === 'string' && value.length <= limit
}
function timestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}
function stage(value: unknown): value is StudyStage {
  return typeof value === 'string' && STUDY_STAGES.some((item) => item === value)
}
function variant(value: unknown): value is MockVariantId {
  return value === 'a' || value === 'b' || value === 'c'
}
function pair(value: unknown): value is [PracticeDayId, PracticeDayId] {
  return Array.isArray(value) && value.length === 2 &&
    typeof value[0] === 'string' && typeof value[1] === 'string' &&
    isPracticeDayId(value[0]) && isPracticeDayId(value[1]) && value[0] !== value[1]
}
function parseDraft(value: unknown): Draft | null {
  if (!record(value) || !text(value.code, MAX_DRAFT_LENGTH) || !text(value.note, MAX_NOTE_LENGTH) ||
    typeof value.selfComplete !== 'boolean') return null
  const verification = record(value.verification) && value.verification.code === value.code &&
    text(value.verification.contextKey, 400)
    ? { code: value.code, contextKey: value.verification.contextKey } : null
  return { code: value.code, note: value.note, selfComplete: value.selfComplete, verification }
}
function parseWorkspace(value: unknown): Workspace | null {
  if (!record(value)) return null
  const recall = parseDraft(value.recall)
  const explain = parseDraft(value.explain)
  const guided = parseDraft(value.guided)
  const independent = parseDraft(value.independent)
  const review = parseDraft(value.review)
  return recall && explain && guided && independent && review
    ? { recall, explain, guided, independent, review } : null
}
function parseRubric(value: unknown): Rubric | null {
  if (!record(value) || !text(value.notes, MAX_NOTE_LENGTH) ||
    typeof value.readability !== 'boolean' || typeof value.edgeCases !== 'boolean' ||
    typeof value.debugging !== 'boolean' || typeof value.communication !== 'boolean') return null
  return {
    readability: value.readability, edgeCases: value.edgeCases, debugging: value.debugging,
    communication: value.communication, notes: value.notes,
  }
}
function parseAttempt(value: unknown): MockAttempt | null {
  if (!record(value) || !text(value.id, 120) || !text(value.workspaceKey, 200) ||
    !variant(value.variantId) || !timestamp(value.startedAt) || typeof value.retake !== 'boolean') return null
  const rubric = value.rubric === undefined ? undefined : parseRubric(value.rubric)
  if (rubric === null) return null
  if (value.finishedAt === null && value.submittedCode === null) {
    return { id: value.id, workspaceKey: value.workspaceKey, variantId: value.variantId,
      startedAt: value.startedAt, finishedAt: null, submittedCode: null, retake: value.retake,
      ...(rubric ? { rubric } : {}) }
  }
  if (!timestamp(value.finishedAt) || value.finishedAt < value.startedAt ||
    !text(value.submittedCode, MAX_DRAFT_LENGTH)) return null
  return { id: value.id, workspaceKey: value.workspaceKey, variantId: value.variantId,
    startedAt: value.startedAt, finishedAt: value.finishedAt, submittedCode: value.submittedCode, retake: value.retake,
    ...(rubric ? { rubric } : {}) }
}
function parseDay(value: unknown): DaySession | null {
  if (!record(value) || !stage(value.stage) || !text(value.workspaceKey, 200) ||
    !record(value.workspaces) || !pair(value.selectedDays) || !Array.isArray(value.attempts) ||
    value.attempts.length > MAX_WORKSPACES || !Array.isArray(value.usedVariants) ||
    value.usedVariants.length > 3 || !value.usedVariants.every(variant)) return null
  const entries = Object.entries(value.workspaces)
  if (entries.length > MAX_WORKSPACES) return null
  const workspaces: Record<string, Workspace> = {}
  for (const [key, entry] of entries) {
    const workspace = parseWorkspace(entry)
    if (!workspace || key.length > 200 || key === '__proto__' || key === 'constructor') return null
    workspaces[key] = workspace
  }
  if (!Object.hasOwn(workspaces, value.workspaceKey)) return null
  const attempts: MockAttempt[] = []
  for (const entry of value.attempts) {
    const attempt = parseAttempt(entry)
    if (!attempt || !Object.hasOwn(workspaces, attempt.workspaceKey)) return null
    attempts.push(attempt)
  }
  const rubric = parseRubric(value.rubric)
  if (!rubric) return null
  return { stage: value.stage, workspaceKey: value.workspaceKey, workspaces,
    selectedDays: value.selectedDays, attempts, usedVariants: [...new Set(value.usedVariants)], rubric }
}
function parseMistake(value: unknown): Mistake | null {
  if (!record(value) || !text(value.id, 120) || typeof value.dayId !== 'string' ||
    !isRefresherDayId(value.dayId) || !text(value.error, 2000) || !text(value.cause, 2000) ||
    !text(value.correctPattern, 2000) || !timestamp(value.createdAt) || typeof value.resolved !== 'boolean') return null
  return { id: value.id, dayId: value.dayId, error: value.error, cause: value.cause,
    correctPattern: value.correctPattern, createdAt: value.createdAt, resolved: value.resolved }
}
function parseBackup(value: unknown): DraftBackup | null {
  if (!record(value) || !text(value.id, 120) || typeof value.dayId !== 'string' ||
    !isRefresherDayId(value.dayId) || !text(value.workspaceKey, 200) || !stage(value.stage) ||
    !timestamp(value.createdAt)) return null
  const draft = parseDraft(value.draft)
  return draft ? { id: value.id, dayId: value.dayId, workspaceKey: value.workspaceKey,
    stage: value.stage, createdAt: value.createdAt, draft } : null
}

export function parseRefresherState(value: unknown): RefresherState | null {
  if (!record(value) || value.version !== 1 || !record(value.days) || !Array.isArray(value.mistakes) ||
    value.mistakes.length > MAX_MISTAKES || !Array.isArray(value.backups) || value.backups.length > MAX_BACKUPS) return null
  const state = emptyRefresherState()
  for (const [id, entry] of Object.entries(value.days)) {
    if (!isRefresherDayId(id)) return null
    const day = parseDay(entry)
    if (!day) return null
    state.days[id] = day
  }
  for (const entry of value.mistakes) {
    const mistake = parseMistake(entry)
    if (!mistake) return null
    state.mistakes.push(mistake)
  }
  for (const entry of value.backups) {
    const backup = parseBackup(entry)
    if (!backup) return null
    state.backups.push(backup)
  }
  return state
}

export function loadRefresherState(storage: SessionStorage | null = browserSessionStorage()): {
  state: RefresherState; status: 'loaded' | 'empty' | 'invalid' | 'unavailable'
} {
  if (!storage) return { state: emptyRefresherState(), status: 'unavailable' }
  let raw: string | null
  try { raw = storage.getItem(REFRESHER_STORAGE_KEY) } catch {
    return { state: emptyRefresherState(), status: 'unavailable' }
  }
  if (raw === null) return { state: emptyRefresherState(), status: 'empty' }
  try {
    if (raw.length > MAX_STORAGE_LENGTH) return { state: emptyRefresherState(), status: 'invalid' }
    const parsed: unknown = JSON.parse(raw)
    const state = parseRefresherState(parsed)
    return state ? { state, status: 'loaded' } : { state: emptyRefresherState(), status: 'invalid' }
  } catch { return { state: emptyRefresherState(), status: 'invalid' } }
}

export function saveRefresherState(state: RefresherState, storage: SessionStorage | null = browserSessionStorage()): SaveStatus {
  if (!storage) return 'unavailable'
  try {
    const raw = JSON.stringify(state)
    if (raw.length > MAX_STORAGE_LENGTH || !parseRefresherState(state)) return 'too-large'
    storage.setItem(REFRESHER_STORAGE_KEY, raw)
    return 'saved'
  } catch { return 'unavailable' }
}

export function currentAttempt(session: DaySession): MockAttempt | undefined {
  return session.attempts.find((attempt) => attempt.workspaceKey === session.workspaceKey)
}

export function contextFor(id: RefresherDayId, session: DaySession, now: number): RefresherContext {
  const attempt = currentAttempt(session)
  if (attempt) return { variant: attempt.variantId,
    followUp: id === 'refresher-13' && (attempt.finishedAt ?? now) - attempt.startedAt >= 30 * 60_000 }
  return id === 'refresher-14' ? { revisit: session.selectedDays } : {}
}

export function verificationKey(id: RefresherDayId, session: DaySession, targetStage: StudyStage, now: number): string {
  return `${id}/${session.workspaceKey}/${targetStage}/${JSON.stringify(contextFor(id, session, now))}`
}

export function completedStages(id: RefresherDayId, session: DaySession, now: number): Record<StudyStage, boolean> {
  const workspace = session.workspaces[session.workspaceKey]
  const verified = (targetStage: StudyStage) => {
    const draft = workspace[targetStage]
    return draft.verification !== null && draft.verification.code === draft.code &&
      draft.verification.contextKey === verificationKey(id, session, targetStage, now)
  }
  const reported = (targetStage: StudyStage) => workspace[targetStage].selfComplete && workspace[targetStage].note.trim().length > 0
  return { recall: reported('recall'), explain: workspace.explain.selfComplete, guided: id === 'refresher-14' ? reported('guided') : verified('guided'),
    independent: verified('independent'), review: reported('review') }
}

export function completedDays(state: RefresherState, now: number): Set<RefresherDayId> {
  return new Set(REFRESHER_DAY_IDS.filter((id) => {
    const day = state.days[id]
    if (!day) return false
    const complete = completedStages(id, day, now)
    const attempt = currentAttempt(day)
    if (id === 'refresher-12' || id === 'refresher-13') {
      return attempt?.finishedAt !== null && attempt !== undefined && complete.independent && complete.review &&
        (id !== 'refresher-13' || contextFor(id, day, now).followUp === true) &&
        day.rubric.readability && day.rubric.edgeCases && day.rubric.debugging && day.rubric.communication
    }
    return complete.recall && complete.explain && complete.guided && complete.independent && complete.review
  }))
}

export function expireMockAttempts(state: RefresherState, now: number): RefresherState {
  let next = state
  for (const id of ['refresher-12', 'refresher-13'] as const) {
    const session = next.days[id]
    if (!session) continue
    let changed = false
    const attempts = session.attempts.map((attempt) => {
      if (attempt.finishedAt !== null || now < attempt.startedAt + MOCK_DURATION_MS) return attempt
      changed = true
      return { ...attempt, finishedAt: attempt.startedAt + MOCK_DURATION_MS,
        submittedCode: session.workspaces[attempt.workspaceKey].independent.code }
    })
    if (changed) next = { ...next, days: { ...next.days, [id]: { ...session, attempts } } }
  }
  return next
}
