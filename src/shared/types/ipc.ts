import type { LockAfterMinutes, PinChangeInput } from '../domain/accessCode'
import type { PatientDraft } from '../domain/patientValidation'
import type { Relation } from '../domain/relatives'
import type { StartupState, TodaySummary } from './app'
import type {
  CreateSeanceResult,
  DeletedPatientView,
  DuplicateQuery,
  DuplicateView,
  JournalLineView,
  LinkCandidate,
  LinkResult,
  PatientDetail,
  PatientListItem,
  PatientSearchResult,
  SavePatientResult,
  SeanceChanges,
  SeanceFailure,
  SeanceResult,
  TodayAppointment,
} from './patients'
import type {
  ChangeCodeResult,
  DisableCodeResult,
  EnableCodeResult,
  RegenerateRecoveryKeyResult,
  ResetWithRecoveryKeyInput,
  ResetWithRecoveryKeyResult,
  SecurityStatus,
  UnlockResult,
} from './security'

/**
 * Every `ipcRenderer.invoke` channel with its arguments and result. The preload and the main
 * handlers are both typed from this map, so a mismatch fails `npm run typecheck`.
 */
export interface IpcInvokeContract {
  'app:get-startup-state': { args: []; result: StartupState }
  'app:get-today-summary': { args: []; result: TodaySummary }
  'security:get-status': { args: []; result: SecurityStatus }
  'security:unlock': { args: [pin: string]; result: UnlockResult }
  'security:lock': { args: []; result: SecurityStatus }
  'security:enable': { args: [pin: string]; result: EnableCodeResult }
  'security:disable': { args: [currentPin: string]; result: DisableCodeResult }
  'security:change-code': { args: [input: PinChangeInput]; result: ChangeCodeResult }
  'security:reset-with-recovery-key': {
    args: [input: ResetWithRecoveryKeyInput]
    result: ResetWithRecoveryKeyResult
  }
  'security:regenerate-recovery-key': {
    args: [currentPin: string]
    result: RegenerateRecoveryKeyResult
  }
  'security:set-lock-after': { args: [minutes: LockAfterMinutes]; result: SecurityStatus }
  'security:skip-setup': { args: []; result: SecurityStatus }
  'patients:search': { args: [query: string]; result: PatientSearchResult }
  'patients:recent': { args: []; result: PatientListItem[] }
  'patients:today': { args: []; result: TodayAppointment[] }
  'patients:count': { args: []; result: number }
  'patients:get': { args: [id: string]; result: PatientDetail | null }
  'patients:create': { args: [draft: PatientDraft]; result: SavePatientResult }
  'patients:update': { args: [id: string, draft: PatientDraft]; result: SavePatientResult }
  'patients:duplicates': { args: [query: DuplicateQuery]; result: DuplicateView[] }
  'patients:mark-opened': { args: [id: string]; result: void }
  'patients:set-comment': {
    args: [id: string, commentaire: string]
    result: { updatedAt: string } | null
  }
  'patients:set-antecedents': { args: [id: string, tags: string[]]; result: string[] }
  'patients:delete': { args: [id: string]; result: boolean }
  'patients:restore': { args: [id: string]; result: boolean }
  'patients:list-deleted': { args: []; result: DeletedPatientView[] }
  'patients:journal': { args: [id: string]; result: JournalLineView[] }
  'patients:link-candidates': { args: [id: string, query: string]; result: LinkCandidate[] }
  'patients:add-link': {
    args: [id: string, otherId: string, relation: Relation]
    result: LinkResult
  }
  'patients:remove-link': { args: [id: string, otherId: string]; result: LinkResult }
  'communes:by-cp': { args: [cp: string]; result: string[] }
  'seances:create-today': { args: [patientId: string]; result: CreateSeanceResult }
  'seances:save': { args: [id: string, changes: SeanceChanges]; result: SeanceResult }
  'seances:mark-done': { args: [id: string, changes: SeanceChanges]; result: SeanceResult }
  'seances:cancel': { args: [id: string, reason: string]; result: SeanceResult }
  'seances:restore': { args: [id: string]; result: SeanceResult }
  'seances:delete': { args: [id: string]; result: { ok: true } | SeanceFailure }
}

export type IpcChannel = keyof IpcInvokeContract
export type IpcArgs<C extends IpcChannel> = IpcInvokeContract[C]['args']
export type IpcResult<C extends IpcChannel> = IpcInvokeContract[C]['result']

/** Events pushed by main to the renderer (`webContents.send`). */
export interface IpcEventContract {
  /** The interface was locked by main (system sleep, session lock). */
  'security:locked': []
}

export type IpcEvent = keyof IpcEventContract

/** What `window.api` exposes to the renderer. */
export interface MeuOsteoApi {
  app: {
    getStartupState(): Promise<StartupState>
    getTodaySummary(): Promise<TodaySummary>
  }
  security: {
    getStatus(): Promise<SecurityStatus>
    unlock(pin: string): Promise<UnlockResult>
    lock(): Promise<SecurityStatus>
    enable(pin: string): Promise<EnableCodeResult>
    disable(currentPin: string): Promise<DisableCodeResult>
    changeCode(input: PinChangeInput): Promise<ChangeCodeResult>
    resetWithRecoveryKey(input: ResetWithRecoveryKeyInput): Promise<ResetWithRecoveryKeyResult>
    regenerateRecoveryKey(currentPin: string): Promise<RegenerateRecoveryKeyResult>
    setLockAfter(minutes: LockAfterMinutes): Promise<SecurityStatus>
    skipSetup(): Promise<SecurityStatus>
    /** Returns an unsubscribe function. */
    onLocked(listener: () => void): () => void
  }
  patients: {
    search(query: string): Promise<PatientSearchResult>
    recent(): Promise<PatientListItem[]>
    today(): Promise<TodayAppointment[]>
    count(): Promise<number>
    get(id: string): Promise<PatientDetail | null>
    create(draft: PatientDraft): Promise<SavePatientResult>
    update(id: string, draft: PatientDraft): Promise<SavePatientResult>
    duplicates(query: DuplicateQuery): Promise<DuplicateView[]>
    markOpened(id: string): Promise<void>
    setComment(id: string, commentaire: string): Promise<{ updatedAt: string } | null>
    setAntecedents(id: string, tags: string[]): Promise<string[]>
    delete(id: string): Promise<boolean>
    restore(id: string): Promise<boolean>
    listDeleted(): Promise<DeletedPatientView[]>
    journal(id: string): Promise<JournalLineView[]>
    linkCandidates(id: string, query: string): Promise<LinkCandidate[]>
    addLink(id: string, otherId: string, relation: Relation): Promise<LinkResult>
    removeLink(id: string, otherId: string): Promise<LinkResult>
  }
  communes: {
    byCp(cp: string): Promise<string[]>
  }
  seances: {
    createToday(patientId: string): Promise<CreateSeanceResult>
    save(id: string, changes: SeanceChanges): Promise<SeanceResult>
    markDone(id: string, changes: SeanceChanges): Promise<SeanceResult>
    cancel(id: string, reason: string): Promise<SeanceResult>
    restore(id: string): Promise<SeanceResult>
    delete(id: string): Promise<{ ok: true } | SeanceFailure>
  }
}
