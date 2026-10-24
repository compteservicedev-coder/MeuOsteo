import { registerAppHandlers } from './appHandlers'
import { registerLegacyImportHandlers } from './legacyImportHandlers'
import { registerReconcileHandlers } from './reconcileHandlers'
import { createRegistrar, type IpcContext } from './register'
import { registerSecurityHandlers } from './securityHandlers'

export function registerIpcHandlers(ctx: IpcContext, version: string): void {
  const register = createRegistrar(ctx)
  registerAppHandlers(ctx, register, version)
  registerLegacyImportHandlers(register)
  registerReconcileHandlers(register)
  registerSecurityHandlers(register)
}
