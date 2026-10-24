import { createContext, useContext } from 'react'
import type { SecurityStatus } from '@shared/types/security'

export interface SecurityContextValue {
  status: SecurityStatus
  setStatus: (status: SecurityStatus) => void
  /** Locks the interface now (inactivity). No effect without a code. */
  lock: () => Promise<void>
  refresh: () => Promise<void>
}

export const SecurityContext = createContext<SecurityContextValue | null>(null)

export function useSecurity(): SecurityContextValue {
  const ctx = useContext(SecurityContext)
  if (!ctx) throw new Error('useSecurity must be used inside <SecurityProvider>')
  return ctx
}
