import { motion } from 'framer-motion'
import { formatIsoDateFr } from '@shared/domain/dates'
import { displayStatus, listTag, shortStatusLabel } from '@shared/domain/seance'
import type { SeanceView } from '@shared/types/patients'
import { Button } from '../../../components/ui/Button'
import { Icon } from '../../../components/ui/Icon'
import { cn } from '../../../lib/cn'
import { staggerItem } from '../../../lib/motion'
import { STATUS_BADGE } from './statusStyles'

interface SeanceListProps {
  seances: SeanceView[]
  selectedId: string | null
  freshId: string | null
  today: string
  onSelect: (id: string) => void
  onCreate: () => void
}

/** Left column (SPEC §5.2): most recent first, future sessions on top in dashed frames. */
export function SeanceList({
  seances,
  selectedId,
  freshId,
  today,
  onSelect,
  onCreate,
}: SeanceListProps) {
  return (
    <motion.section
      variants={staggerItem}
      aria-labelledby="h-list"
      className="flex min-w-0 max-w-full flex-[1_1_230px] flex-col overflow-hidden rounded-card-lg border border-line-faint bg-white shadow-card lg:max-w-[260px] lg:flex-[0_0_clamp(210px,17vw,260px)]"
    >
      <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-4">
        <h2 id="h-list" className="text-[16px] font-extrabold">
          Séances
        </h2>
        <Button
          size="sm"
          variant="primary"
          icon={<Icon name="plus" size={15} strokeWidth={2.6} />}
          onClick={onCreate}
        >
          Nouvelle
        </Button>
      </div>
      <p className="px-4 pb-2 text-[12px] leading-snug text-ink-500">
        Les RDV Doctolib apparaissent ici tout seuls. « Nouvelle » sert aux séances prises hors
        Doctolib.
      </p>
      <ul
        className="flex flex-col gap-1 overflow-y-auto px-2.5 pb-3"
        aria-label="Séances du patient"
      >
        {seances.map((s) => {
          const on = s.id === selectedId
          const status = displayStatus(s, today)
          const tag = listTag({ ...s, invoiced: s.invoice !== null })
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                aria-current={on ? 'true' : undefined}
                className={cn(
                  'btn flex h-auto w-full flex-col items-stretch gap-1 rounded-2xl px-3 py-[11px] text-left font-normal',
                  s.id === freshId && 'pop',
                  on
                    ? 'bg-[linear-gradient(160deg,#3B6CF6,#1F4FD8)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_12px_24px_-12px_rgba(31,79,216,0.9)]'
                    : status === 'upcoming'
                      ? 'btn-ink border border-dashed border-[rgba(14,165,198,0.45)] bg-[#F7FDFE] text-ink-900 hover:!translate-x-[3px] hover:!translate-y-0'
                      : status === 'cancelled'
                        ? 'btn-ink bg-transparent text-[#8E99B3] line-through hover:bg-surface-hover'
                        : 'btn-ink bg-transparent text-ink-900 hover:!translate-x-[3px] hover:!translate-y-0 hover:bg-surface-hover',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-bold tabular-nums">
                    {formatIsoDateFr(s.date)}
                  </span>
                  <span
                    className={cn(
                      'rounded-pill px-2 py-[3px] text-[11px] font-bold no-underline',
                      on ? 'bg-white/[0.18] text-white' : STATUS_BADGE[status],
                    )}
                  >
                    {shortStatusLabel(s, today)}
                  </span>
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span
                    className={cn('truncate text-[13px]', on ? 'text-[#DCE6FD]' : 'text-ink-500')}
                  >
                    {s.motif || 'Motif à saisir'}
                  </span>
                  {tag && (
                    <span
                      className={cn(
                        'shrink-0 text-[11px] font-bold',
                        on
                          ? 'text-nav-soft'
                          : status === 'upcoming'
                            ? 'text-[#0B7F99]'
                            : 'text-royal-600',
                      )}
                    >
                      {tag}
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
        {seances.length === 0 && (
          <li className="px-2 py-4 text-[14px] text-ink-500">Aucune séance pour l’instant.</li>
        )}
      </ul>
    </motion.section>
  )
}
