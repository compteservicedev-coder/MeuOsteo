import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'info' | 'error'

export interface ToastApi {
  show: (message: string, tone?: ToastTone) => void
}

/** Toasts disappear by themselves after 3 s (SPEC §1). */
export const TOAST_DURATION_MS = 3000

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
