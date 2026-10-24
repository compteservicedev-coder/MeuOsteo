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
  },
}

contextBridge.exposeInMainWorld('api', api)
