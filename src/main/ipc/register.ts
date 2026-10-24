import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { z } from 'zod'
import type { IpcArgs, IpcChannel, IpcResult } from '@shared/types/ipc'
import type { Runtime, RuntimeResult } from '../runtime'

export interface IpcContext {
  startup: Promise<RuntimeResult>
  isTrustedSender: (event: IpcMainInvokeEvent) => boolean
}

export interface HandlerOptions {
  /** Refuse the call while the interface is locked (R-21). Default: true. */
  requireUnlocked?: boolean
}

export type Handler<C extends IpcChannel> = (
  runtime: Runtime,
  ...args: IpcArgs<C>
) => IpcResult<C> | Promise<IpcResult<C>>

/**
 * Registers a typed `ipcMain.handle`: checks the sender, validates the arguments with Zod (the
 * renderer is never trusted), waits for the database and enforces the lock.
 * Arguments are never logged: they may contain an access code.
 */
export function createRegistrar(ctx: IpcContext) {
  return function register<C extends IpcChannel>(
    channel: C,
    argsSchema: z.ZodType<IpcArgs<C>>,
    handler: Handler<C>,
    { requireUnlocked = true }: HandlerOptions = {},
  ): void {
    ipcMain.handle(channel, async (event, ...rawArgs: unknown[]) => {
      if (!ctx.isTrustedSender(event)) throw new Error(`Untrusted sender for ${channel}`)
      const args = argsSchema.parse(rawArgs)
      const started = await ctx.startup
      if (!started.ok) throw new Error('Database unavailable')
      if (requireUnlocked && started.runtime.accessCode.isLocked()) {
        throw new Error('Interface locked')
      }
      return handler(started.runtime, ...args)
    })
  }
}
