import { registerAppHandlers } from './appHandlers'
import { registerBilanHandlers } from './bilanHandlers'
import { registerDocumentHandlers } from './documentHandlers'
import { registerInvoiceHandlers } from './invoiceHandlers'
import { registerPatientHandlers } from './patientHandlers'
import { registerPilotageHandlers } from './pilotageHandlers'
import { registerPlanningHandlers } from './planningHandlers'
import { registerLegacyImportHandlers } from './legacyImportHandlers'
import { registerReconcileHandlers } from './reconcileHandlers'
import { createRegistrar, type IpcContext } from './register'
import { registerSecurityHandlers } from './securityHandlers'
import { registerUpdateHandlers } from './updateHandlers'

export function registerIpcHandlers(ctx: IpcContext, version: string): void {
  const register = createRegistrar(ctx)
  registerAppHandlers(ctx, register, version)
  registerLegacyImportHandlers(register)
  registerReconcileHandlers(register)
  registerSecurityHandlers(register)
  registerPatientHandlers(register)
  registerInvoiceHandlers(register)
  registerDocumentHandlers(register)
  registerPlanningHandlers(register)
  registerPilotageHandlers(register)
  registerBilanHandlers(register)
  registerUpdateHandlers(register)
}
