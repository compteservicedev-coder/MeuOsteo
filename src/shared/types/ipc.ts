import type { LockAfterMinutes, PinChangeInput } from '../domain/accessCode'
import type { StartupState, TodaySummary } from './app'
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
}
