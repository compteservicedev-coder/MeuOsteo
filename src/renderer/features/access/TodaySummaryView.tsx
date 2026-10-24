import { useEffect, useState } from 'react'
import { isBackupRecent } from '@shared/domain/backup'
import type { TodaySummary } from '@shared/types/app'
import { Icon } from '../../components/ui/Icon'
import { cn } from '../../lib/cn'

const chip = 'splash-fade-up rounded-pill px-3.5 py-2 text-[14px] font-bold'

/** « Résumé du jour » before opening the planning. */
export function TodaySummaryView({ onOpen }: { onOpen: () => void }) {
  const [summary, setSummary] = useState<TodaySummary | null>(null)
  useEffect(() => {
    // Refused if main locked the interface meanwhile: the chips are simply left out.
    window.api.app.getTodaySummary().then(setSummary, () => setSummary(null))
  }, [])

  const n = summary?.appointmentsToday ?? 0
  const todo = summary?.toReconcile ?? 0
  const backupOk = summary ? isBackupRecent(summary.lastBackupAt, new Date()) : true

  return (
    <section
      aria-labelledby="h-hi"
      className="splash-card-in flex w-full max-w-[420px] flex-col items-center gap-4"
    >
      <div
        aria-hidden="true"
        className="splash-pulse flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(145deg,#5EEAD4,#0EA5C6)] shadow-[0_16px_30px_-12px_rgba(14,165,198,0.9)]"
      >
        <svg
          width="30"
          height="30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path className="draw-check" d="M5 12l5 5L20 7" />
        </svg>
      </div>
      <h2 id="h-hi" className="text-[24px] font-extrabold">
        Bonjour !
      </h2>
      {summary && (
        <ul className="flex flex-wrap justify-center gap-2" aria-label="Résumé du jour">
          <li className={cn(chip, 'bg-white/10')} style={{ animationDelay: '.1s' }}>
            {n === 0 ? 'Aucun rendez-vous aujourd’hui' : `${n} rendez-vous aujourd’hui`}
          </li>
          <li
            className={cn(
              chip,
              todo > 0 ? 'bg-[rgba(224,146,47,0.25)] text-[#FFE2BD]' : 'bg-white/10',
            )}
            style={{ animationDelay: '.2s' }}
          >
            {todo > 0 ? `${todo} à rapprocher` : 'Rien à rapprocher'}
          </li>
          <li
            className={cn(
              chip,
              backupOk
                ? 'bg-[rgba(94,234,212,0.18)] text-[#CFFAF2]'
                : 'bg-[rgba(224,146,47,0.25)] text-[#FFE2BD]',
            )}
            style={{ animationDelay: '.3s' }}
          >
            {backupOk ? 'Sauvegarde OK' : 'Aucune sauvegarde récente'}
          </li>
        </ul>
      )}
      <button
        type="button"
        onClick={onOpen}
        className="btn splash-fade-up min-h-[56px] gap-2.5 rounded-[18px] bg-[linear-gradient(180deg,#22C3D6,#1F4FD8)] px-7 text-[17px] font-extrabold text-white shadow-[0_16px_34px_-14px_rgba(34,195,214,0.9),inset_0_1px_0_rgba(255,255,255,0.35)]"
        style={{ animationDelay: '.4s' }}
      >
        Ouvrir mon planning
        <Icon name="arrowRight" size={20} strokeWidth={2.6} />
      </button>
    </section>
  )
}
