import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { SecurityStatus } from '@shared/types/security'
import { SecurityContext } from './securityState'

export function SecurityProvider({
  initialStatus,
  children,
}: {
  initialStatus: SecurityStatus
  children: ReactNode
}) {
  const [status, setStatus] = useState(initialStatus)

  const refresh = useCallback(async () => setStatus(await window.api.security.getStatus()), [])
  const lock = useCallback(async () => setStatus(await window.api.security.lock()), [])

  // Main may have locked the interface (system sleep) before this provider mounted.
  useEffect(() => {
    void refresh()
  }, [refresh])

  // Main locks the interface on system sleep or session lock.
  useEffect(() => window.api.security.onLocked(() => void refresh()), [refresh])

  const value = useMemo(() => ({ status, setStatus, lock, refresh }), [status, lock, refresh])
  return <SecurityContext.Provider value={value}>{children}</SecurityContext.Provider>
}
