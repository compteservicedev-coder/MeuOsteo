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
  ChooseLegacyFileResult,
  LegacyAnalyzeResult,
  LegacyImportRequest,
  LegacyImportResult,
} from './legacyImport'
import type {
  DeleteInvoiceResult,
  GmailSettingsInput,
  GmailStatus,
  GmailTestResult,
  InvoiceActionResult,
  InvoiceDetail,
  InvoicePreview,
  InvoiceRow,
  InvoiceSettingsInput,
  InvoiceSettingsView,
  IssueResult,
  SaveFileResult,
  SendOutcome,
  UnlockReason,
} from './invoices'
import type {
  AttachResult,
  BlockInput,
  BlockPreview,
  CreateAndAttachResult,
  DaySlots,
  ExportImportResult,
  NewRdvInput,
  NewRdvResult,
  PlanningView,
  RdvCandidates,
  SyncStatus,
} from './planning'
import type { AgendaSettings } from '../domain/planning'
import type { MergeComparison, MergeRequest, MergeResult, ReconcileTasks } from './reconcile'
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
  'legacy-import:choose-file': { args: []; result: ChooseLegacyFileResult }
  'legacy-import:analyze': { args: [fileId: string]; result: LegacyAnalyzeResult }
  'legacy-import:run': { args: [request: LegacyImportRequest]; result: LegacyImportResult }
  'reconcile:list-tasks': { args: []; result: ReconcileTasks }
  'duplicates:compare': { args: [a: string, b: string]; result: MergeComparison | null }
  'duplicates:ignore': { args: [a: string, b: string]; result: { ok: boolean } }
  'duplicates:merge': { args: [request: MergeRequest]; result: MergeResult }
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
  'seances:unlock': {
    args: [id: string, reason: UnlockReason]
    result: { ok: true } | SeanceFailure
  }
  'seances:relock': { args: [id: string]; result: void }
  'invoices:preview': { args: [seanceId: string]; result: InvoicePreview }
  'invoices:issue': { args: [seanceId: string, options: { send: boolean }]; result: IssueResult }
  'invoices:list': { args: []; result: InvoiceRow[] }
  'invoices:detail': { args: [id: string]; result: InvoiceDetail | null }
  'invoices:send': { args: [id: string]; result: SendOutcome }
  'invoices:print': { args: [id: string]; result: InvoiceActionResult }
  'invoices:save-pdf': { args: [id: string]; result: SaveFileResult }
  'invoices:open-pdf': { args: [id: string]; result: InvoiceActionResult }
  'invoices:mark-paid': { args: [id: string]; result: InvoiceActionResult }
  'invoices:delete': { args: [id: string]; result: DeleteInvoiceResult }
  'invoices:export-selection': {
    args: [rows: string[][], fileName: string]
    result: SaveFileResult
  }
  'invoices:export-accounting': { args: []; result: SaveFileResult }
  'invoices:get-settings': { args: []; result: InvoiceSettingsView }
  'invoices:save-settings': { args: [input: InvoiceSettingsInput]; result: InvoiceSettingsView }
  'invoices:choose-signature': { args: []; result: InvoiceSettingsView }
  'invoices:remove-signature': { args: []; result: InvoiceSettingsView }
  'invoices:set-numbering-start': { args: [sequence: number]; result: InvoiceSettingsView }
  'gmail:get-status': { args: []; result: GmailStatus }
  'gmail:save': { args: [input: GmailSettingsInput]; result: GmailStatus }
  'gmail:test': { args: []; result: GmailTestResult }
  'gmail:set-connected': { args: [connected: boolean]; result: GmailStatus }
  'planning:weeks': { args: [monday: string]; result: PlanningView }
  'planning:blocked-dates': { args: [from: string, to: string]; result: string[] }
  'planning:day-slots': { args: [date: string, patientId: string | null]; result: DaySlots }
  'planning:create-rdv': { args: [input: NewRdvInput]; result: NewRdvResult }
  'planning:preview-block': { args: [input: BlockInput]; result: BlockPreview }
  'planning:add-blocks': { args: [input: BlockInput]; result: { ok: boolean; days: number } }
  'planning:remove-block': { args: [id: string]; result: boolean }
  'agenda:get': { args: []; result: AgendaSettings }
  'agenda:save': { args: [settings: AgendaSettings]; result: AgendaSettings }
  'doctolib:candidates': { args: [key: string]; result: RdvCandidates | null }
  'doctolib:attach': {
    args: [key: string, patientId: string, remember: boolean]
    result: AttachResult
  }
  'doctolib:create-and-attach': {
    args: [key: string, draft: PatientDraft]
    result: CreateAndAttachResult
  }
  'doctolib:dismiss-alert': { args: [id: string]; result: void }
  'doctolib:import-export': { args: []; result: ExportImportResult }
  'sync:get-status': { args: []; result: SyncStatus }
  'sync:run': { args: []; result: SyncStatus }
}

export type IpcChannel = keyof IpcInvokeContract
export type IpcArgs<C extends IpcChannel> = IpcInvokeContract[C]['args']
export type IpcResult<C extends IpcChannel> = IpcInvokeContract[C]['result']

/** Events pushed by main to the renderer (`webContents.send`). */
export interface IpcEventContract {
  /** The interface was locked by main (system sleep, session lock). */
  'security:locked': []
  /** The Gmail synchronisation changed state (running, done, error). */
  'sync:status': [status: SyncStatus]
}

export type IpcEvent = keyof IpcEventContract

/** What `window.api` exposes to the renderer. */
export interface MeuOsteoApi {
  app: {
    getStartupState(): Promise<StartupState>
    getTodaySummary(): Promise<TodaySummary>
  }
  /** Reprise de l'historique (docs/MIGRATION.md). */
  legacyImport: {
    chooseFile(): Promise<ChooseLegacyFileResult>
    analyze(fileId: string): Promise<LegacyAnalyzeResult>
    run(request: LegacyImportRequest): Promise<LegacyImportResult>
  }
  /** « À rapprocher » and duplicates (R-19). */
  reconcile: {
    listTasks(): Promise<ReconcileTasks>
    compareDuplicates(a: string, b: string): Promise<MergeComparison | null>
    ignoreDuplicate(a: string, b: string): Promise<{ ok: boolean }>
    mergeDuplicates(request: MergeRequest): Promise<MergeResult>
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
    /** R-04 « Déverrouiller date et tarif… ». */
    unlock(id: string, reason: UnlockReason): Promise<{ ok: true } | SeanceFailure>
    relock(id: string): Promise<void>
  }
  invoices: {
    preview(seanceId: string): Promise<InvoicePreview>
    issue(seanceId: string, options: { send: boolean }): Promise<IssueResult>
    list(): Promise<InvoiceRow[]>
    detail(id: string): Promise<InvoiceDetail | null>
    send(id: string): Promise<SendOutcome>
    print(id: string): Promise<InvoiceActionResult>
    savePdf(id: string): Promise<SaveFileResult>
    openPdf(id: string): Promise<InvoiceActionResult>
    markPaid(id: string): Promise<InvoiceActionResult>
    delete(id: string): Promise<DeleteInvoiceResult>
    exportSelection(rows: string[][], fileName: string): Promise<SaveFileResult>
    exportAccounting(): Promise<SaveFileResult>
    getSettings(): Promise<InvoiceSettingsView>
    saveSettings(input: InvoiceSettingsInput): Promise<InvoiceSettingsView>
    chooseSignature(): Promise<InvoiceSettingsView>
    removeSignature(): Promise<InvoiceSettingsView>
    setNumberingStart(sequence: number): Promise<InvoiceSettingsView>
  }
  planning: {
    weeks(monday: string): Promise<PlanningView>
    blockedDates(from: string, to: string): Promise<string[]>
    daySlots(date: string, patientId: string | null): Promise<DaySlots>
    createRdv(input: NewRdvInput): Promise<NewRdvResult>
    previewBlock(input: BlockInput): Promise<BlockPreview>
    addBlocks(input: BlockInput): Promise<{ ok: boolean; days: number }>
    removeBlock(id: string): Promise<boolean>
  }
  agenda: {
    get(): Promise<AgendaSettings>
    save(settings: AgendaSettings): Promise<AgendaSettings>
  }
  doctolib: {
    candidates(key: string): Promise<RdvCandidates | null>
    attach(key: string, patientId: string, remember: boolean): Promise<AttachResult>
    createAndAttach(key: string, draft: PatientDraft): Promise<CreateAndAttachResult>
    dismissAlert(id: string): Promise<void>
    importExport(): Promise<ExportImportResult>
  }
  sync: {
    getStatus(): Promise<SyncStatus>
    run(): Promise<SyncStatus>
    /** Returns an unsubscribe function. */
    onStatus(listener: (status: SyncStatus) => void): () => void
  }
  gmail: {
    getStatus(): Promise<GmailStatus>
    save(input: GmailSettingsInput): Promise<GmailStatus>
    test(): Promise<GmailTestResult>
    setConnected(connected: boolean): Promise<GmailStatus>
  }
}
