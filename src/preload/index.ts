import { contextBridge, ipcRenderer } from 'electron'
import type { IpcArgs, IpcChannel, IpcResult, MeuOsteoApi } from '@shared/types/ipc'

// Sandboxed preload: only `electron` can be required, so this file imports types only.

function invoke<C extends IpcChannel>(channel: C, ...args: IpcArgs<C>): Promise<IpcResult<C>> {
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcResult<C>>
}

const api: MeuOsteoApi = {
  app: {
    getStartupState: () => invoke('app:get-startup-state'),
    getTodaySummary: () => invoke('app:get-today-summary'),
  },
  legacyImport: {
    chooseFile: () => invoke('legacy-import:choose-file'),
    analyze: (fileId) => invoke('legacy-import:analyze', fileId),
    run: (request) => invoke('legacy-import:run', request),
  },
  reconcile: {
    listTasks: () => invoke('reconcile:list-tasks'),
    compareDuplicates: (a, b) => invoke('duplicates:compare', a, b),
    ignoreDuplicate: (a, b) => invoke('duplicates:ignore', a, b),
    mergeDuplicates: (request) => invoke('duplicates:merge', request),
  },
  security: {
    getStatus: () => invoke('security:get-status'),
    unlock: (pin) => invoke('security:unlock', pin),
    lock: () => invoke('security:lock'),
    enable: (pin) => invoke('security:enable', pin),
    disable: (currentPin) => invoke('security:disable', currentPin),
    changeCode: (input) => invoke('security:change-code', input),
    resetWithRecoveryKey: (input) => invoke('security:reset-with-recovery-key', input),
    regenerateRecoveryKey: (currentPin) => invoke('security:regenerate-recovery-key', currentPin),
    setLockAfter: (minutes) => invoke('security:set-lock-after', minutes),
    skipSetup: () => invoke('security:skip-setup'),
    onLocked: (listener) => {
      const handler = () => listener()
      ipcRenderer.on('security:locked', handler)
      return () => ipcRenderer.removeListener('security:locked', handler)
    },
  },
  patients: {
    search: (query) => invoke('patients:search', query),
    recent: () => invoke('patients:recent'),
    today: () => invoke('patients:today'),
    count: () => invoke('patients:count'),
    get: (id) => invoke('patients:get', id),
    create: (draft) => invoke('patients:create', draft),
    update: (id, draft) => invoke('patients:update', id, draft),
    duplicates: (query) => invoke('patients:duplicates', query),
    markOpened: (id) => invoke('patients:mark-opened', id),
    setComment: (id, commentaire) => invoke('patients:set-comment', id, commentaire),
    setAntecedents: (id, tags) => invoke('patients:set-antecedents', id, tags),
    delete: (id) => invoke('patients:delete', id),
    restore: (id) => invoke('patients:restore', id),
    listDeleted: () => invoke('patients:list-deleted'),
    journal: (id) => invoke('patients:journal', id),
    linkCandidates: (id, query) => invoke('patients:link-candidates', id, query),
    addLink: (id, otherId, relation) => invoke('patients:add-link', id, otherId, relation),
    removeLink: (id, otherId) => invoke('patients:remove-link', id, otherId),
  },
  communes: {
    byCp: (cp) => invoke('communes:by-cp', cp),
  },
  seances: {
    createToday: (patientId) => invoke('seances:create-today', patientId),
    save: (id, changes) => invoke('seances:save', id, changes),
    markDone: (id, changes) => invoke('seances:mark-done', id, changes),
    cancel: (id, reason) => invoke('seances:cancel', id, reason),
    restore: (id) => invoke('seances:restore', id),
    delete: (id) => invoke('seances:delete', id),
    unlock: (id, reason) => invoke('seances:unlock', id, reason),
    relock: (id) => invoke('seances:relock', id),
  },
  invoices: {
    preview: (seanceId) => invoke('invoices:preview', seanceId),
    issue: (seanceId, options) => invoke('invoices:issue', seanceId, options),
    list: () => invoke('invoices:list'),
    detail: (id) => invoke('invoices:detail', id),
    send: (id) => invoke('invoices:send', id),
    print: (id) => invoke('invoices:print', id),
    savePdf: (id) => invoke('invoices:save-pdf', id),
    openPdf: (id) => invoke('invoices:open-pdf', id),
    markPaid: (id) => invoke('invoices:mark-paid', id),
    delete: (id) => invoke('invoices:delete', id),
    exportSelection: (rows, fileName) => invoke('invoices:export-selection', rows, fileName),
    exportAccounting: () => invoke('invoices:export-accounting'),
    getSettings: () => invoke('invoices:get-settings'),
    saveSettings: (input) => invoke('invoices:save-settings', input),
    chooseSignature: () => invoke('invoices:choose-signature'),
    removeSignature: () => invoke('invoices:remove-signature'),
    setNumberingStart: (sequence) => invoke('invoices:set-numbering-start', sequence),
  },
  gmail: {
    getStatus: () => invoke('gmail:get-status'),
    save: (input) => invoke('gmail:save', input),
    test: () => invoke('gmail:test'),
    setConnected: (connected) => invoke('gmail:set-connected', connected),
  },
}

contextBridge.exposeInMainWorld('api', api)
