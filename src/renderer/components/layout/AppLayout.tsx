import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
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

  // Ctrl+K: patient search from any screen (SPEC §1).
  const navigate = useNavigate()
  const locked = status.locked
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (locked || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'k') return
      e.preventDefault()
      navigate('/patients', { state: { focusSearch: Date.now() } })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, locked])

  return (
    <div className="flex h-full bg-bg bg-app">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto px-8 py-7">
        <Outlet />
      </main>
    </div>
  )
}
