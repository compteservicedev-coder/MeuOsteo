import { registerAppHandlers } from './appHandlers'
import { createRegistrar, type IpcContext } from './register'
import { registerSecurityHandlers } from './securityHandlers'

export function registerIpcHandlers(ctx: IpcContext, version: string): void {
  const register = createRegistrar(ctx)
  registerAppHandlers(ctx, register, version)
  registerSecurityHandlers(register)
}
