import { Outlet } from 'react-router-dom'
import { useSecurity } from '../../features/access/securityState'
import { useInactivity } from '../../hooks/useInactivity'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  const { status, lock } = useSecurity()
  const timeoutMs =
    status.enabled && !status.locked && status.lockAfterMinutes !== null
      ? status.lockAfterMinutes * 60_000
      : null
  useInactivity(timeoutMs, () => void lock())

  return (
    <div className="flex h-full bg-bg bg-app">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto px-8 py-7">
        <Outlet />
      </main>
    </div>
  )
}
