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
}

contextBridge.exposeInMainWorld('api', api)
