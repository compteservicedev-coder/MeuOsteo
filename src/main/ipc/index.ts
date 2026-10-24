import { registerAppHandlers } from './appHandlers'
import { registerPatientHandlers } from './patientHandlers'
import { createRegistrar, type IpcContext } from './register'
import { registerSecurityHandlers } from './securityHandlers'

export function registerIpcHandlers(ctx: IpcContext, version: string): void {
  const register = createRegistrar(ctx)
  registerAppHandlers(ctx, register, version)
  registerSecurityHandlers(register)
  registerPatientHandlers(register)
}
