import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { isBackupRecent } from '@shared/domain/backup'
import { formatElapsedFr } from '@shared/domain/dates'
import type { TodaySummary } from '@shared/types/app'
import { cn } from '../../lib/cn'
import { useDataChanged } from '../../lib/dataEvents'
import { Icon, type IconName } from '../ui/Icon'

interface NavItem {
  to: string
  label: string
  icon: IconName
}

/** Order of SPEC §1. */
const MAIN_ITEMS: NavItem[] = [
  { to: '/planning', label: 'Planning', icon: 'calendar' },
  { to: '/patients', label: 'Patients', icon: 'users' },
  { to: '/factures', label: 'Factures', icon: 'invoice' },
  { to: '/tableau-de-bord', label: 'Tableau de bord', icon: 'chart' },
  { to: '/bilan', label: 'Bilan mensuel', icon: 'wallet' },
]

const SETTINGS_ITEM: NavItem = { to: '/parametres', label: 'Paramètres', icon: 'settings' }
const HELP_ITEM: NavItem = { to: '/aide', label: 'Aide & FAQ', icon: 'help' }

/** Refreshes the badge and the backup indicator every minute. */
function useShellSummary(): TodaySummary | null {
  const [summary, setSummary] = useState<TodaySummary | null>(null)
  const load = useCallback(
    () =>
      window.api.app
        .getTodaySummary()
        .then(setSummary)
        .catch(() => undefined), // refused while locked
    [],
  )
  useEffect(() => {
    void load()
    const timer = window.setInterval(load, 60_000)
    return () => window.clearInterval(timer)
  }, [load])
  useDataChanged(load)
  return summary
}

function NavEntry({ item, badge }: { item: NavItem; badge?: number }) {
  return (
    <NavLink
      to={item.to}
      title={item.label}
      className={({ isActive }) =>
        cn(
          'btn h-[46px] min-h-[46px] justify-center gap-3 px-3.5 text-[15px] font-semibold min-[1100px]:justify-start',
          isActive
            ? 'bg-primary text-white shadow-nav-active'
            : 'bg-transparent text-nav-text hover:!translate-x-[3px] hover:!translate-y-0 hover:bg-white/[0.08] hover:text-white',
        )
      }
    >
      <Icon name={item.icon} />
      <span className="sr-only min-[1100px]:not-sr-only">{item.label}</span>
      {badge ? (
        <span
          aria-label={`${badge} à rapprocher`}
          className="absolute right-1.5 top-1 rounded-pill bg-amber-500 px-1.5 text-[11px] font-extrabold text-navy-900 min-[1100px]:static min-[1100px]:ml-auto min-[1100px]:px-2 min-[1100px]:text-[12px]"
        >
          {badge}
        </span>
      ) : null}
    </NavLink>
  )
}

/** Dark sidebar; icons only under 1100 px (SPEC §1). */
export function Sidebar() {
  const summary = useShellSummary()
  const backupOk = summary ? isBackupRecent(summary.lastBackupAt, new Date()) : true
  const backupLabel = summary?.lastBackupAt
    ? `Sauvegarde auto · ${formatElapsedFr(new Date(summary.lastBackupAt), new Date())}`
    : 'Sauvegarde · aucune pour l’instant'

  return (
    <nav
      aria-label="Navigation principale"
      className="sticky top-0 z-[1] flex h-screen w-[76px] shrink-0 flex-col gap-1.5 bg-sidebar px-3 py-[22px] shadow-nav min-[1100px]:w-[232px] min-[1100px]:px-3.5"
    >
      <div className="flex items-center justify-center gap-3 px-1 pb-[22px] min-[1100px]:justify-start min-[1100px]:px-2">
        <div
          aria-hidden="true"
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-control bg-logo text-[18px] font-extrabold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_18px_-6px_rgba(0,0,0,0.5)]"
        >
          M
        </div>
        <div className="hidden flex-col min-[1100px]:flex">
          <span className="text-[17px] font-bold text-white">MeuOsteo</span>
          <span className="text-[12px] text-nav-muted">Cabinet d’ostéopathie</span>
        </div>
      </div>
      {MAIN_ITEMS.map((item) => (
        <NavEntry
          key={item.to}
          item={item}
          {...(item.to === '/planning' && summary ? { badge: summary.toReconcile } : {})}
        />
      ))}
      <div className="min-h-6 grow" />
      <NavEntry item={HELP_ITEM} />
      <NavEntry item={SETTINGS_ITEM} />
      <Link
        to="/parametres?onglet=sauvegarde"
        className="mt-2 flex items-center justify-center gap-2.5 rounded-control bg-white/[0.06] px-3 py-2.5 text-[12px] text-nav-text shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-white/[0.1] hover:text-white min-[1100px]:justify-start"
        title={`${backupLabel} · la base est copiée à chaque fermeture de l’application`}
      >
        <span
          aria-hidden="true"
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            backupOk ? 'pulse-aqua bg-aqua-300' : 'bg-amber-500',
          )}
        />
        <span className="sr-only min-[1100px]:not-sr-only">{backupLabel}</span>
      </Link>
    </nav>
  )
}
