import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  BLOCK_CARD_LABELS,
  dayLabel,
  weekRange,
  weekTitle,
  type CardKind,
} from '@shared/domain/planning'
import type { PlanningCard, PlanningWeek } from '@shared/types/planning'
import { Icon } from '../../components/ui/Icon'
import { cn } from '../../lib/cn'
import { EASE_SOFT } from '../../lib/motion'

const CARD_STYLES: Record<CardKind, string> = {
  off: 'border border-dashed border-[#8E99B3] bg-white text-ink-500 line-through',
  past: 'border border-line bg-[linear-gradient(180deg,#F7F9FC,#EDF1F7)] text-ink-600 shadow-[inset_0_1px_0_#FFFFFF,0_3px_8px_-6px_rgba(15,30,70,0.3)]',
  ok: 'border border-[#9FE6D9] bg-[linear-gradient(180deg,#E3FAF5,#C9F2EA)] text-aqua-ink shadow-[inset_0_1px_0_#FFFFFF,0_6px_14px_-8px_rgba(23,51,143,0.4)]',
}

const BLOCK_STYLE =
  'flex flex-col gap-px rounded-[11px] border border-dashed border-[#E0B57A] bg-[repeating-linear-gradient(135deg,#FBEEDC_0_6px,#FFF8EE_6px_12px)] px-[9px] py-[7px] text-[#7A4207]'

interface WeekGridProps {
  weeks: PlanningWeek[]
  today: string
  freshId: string | null
  onAdd: (date: string) => void
  onUnblock: (id: string, label: string) => void
}

function Card({ card, fresh }: { card: PlanningCard; fresh: boolean }) {
  const body = (
    <>
      <span className="text-[12px] font-extrabold tabular-nums">{card.heure ?? '—'}</span>
      <span className="truncate text-[13px] font-bold">{card.nom}</span>
      <span className="truncate text-[12px] opacity-80">{card.motif}</span>
    </>
  )
  const cls = cn(
    'flex min-h-[44px] flex-col gap-0.5 rounded-control px-[9px] py-[7px] text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5',
    CARD_STYLES[card.kind],
    fresh && 'pop',
  )
  return (
    <Link to={`/patients/${card.patientId}?seance=${card.seanceId}`} className={cls}>
      {body}
    </Link>
  )
}

/** Two rows of days (SPEC §3): « Cette semaine », « Semaine prochaine ». */
export function WeekGrid({ weeks, today, freshId, onAdd, onUnblock }: WeekGridProps) {
  return (
    <div className="flex flex-col gap-5">
      {weeks.map((w) => {
        const first = w.days[0]?.date ?? w.monday
        const last = w.days.at(-1)?.date ?? w.monday
        return (
          <motion.section
            key={w.monday}
            aria-label={`Semaine du ${weekRange(first, last)}`}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, ease: EASE_SOFT }}
            className="flex flex-col gap-2.5"
          >
            <div className="flex items-baseline gap-2.5 px-1">
              <h2 className="text-section">{weekTitle(w.monday, today)}</h2>
              <span className="text-[13px] text-ink-500">
                {weekRange(first, last)} · {w.count} RDV
              </span>
            </div>
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${Math.max(1, w.days.length)}, minmax(0, 1fr))`,
              }}
            >
              {w.days.map((d) => {
                const isToday = d.date === today
                const past = d.date < today
                const full = d.blocks.find((b) => b.creneau === 'day')
                const am = d.blocks.find((b) => b.creneau === 'am')
                const pm = d.blocks.find((b) => b.creneau === 'pm')
                const blockItem = (b: NonNullable<typeof full>) => {
                  const label = BLOCK_CARD_LABELS[b.creneau]
                  return (
                    <div key={b.id} className={cn(BLOCK_STYLE, 'pop')}>
                      <span className="text-[12px] font-extrabold">{label}</span>
                      <span className="truncate text-[12px]">{b.motif ?? ''}</span>
                      {!past && (
                        <button
                          type="button"
                          onClick={() =>
                            onUnblock(b.id, `${label} du ${dayLabel(d.date).toLowerCase()}`)
                          }
                          aria-label={`Débloquer ${label.toLowerCase()} du ${dayLabel(d.date)}`}
                          className="mt-1 self-start rounded-md text-[12px] font-bold text-[#7A4207] underline underline-offset-2"
                        >
                          Débloquer
                        </button>
                      )}
                    </div>
                  )
                }
                const morning = d.cards.filter((c) => !c.heure || c.heure < '13:00')
                const afternoon = d.cards.filter((c) => c.heure && c.heure >= '13:00')
                return (
                  <div
                    key={d.date}
                    aria-current={isToday ? 'date' : undefined}
                    className={cn(
                      'flex min-h-[150px] min-w-0 flex-col gap-1.5 rounded-[14px] px-2 py-2.5',
                      isToday
                        ? 'border-2 border-cyan-500 bg-white shadow-[0_0_0_4px_rgba(14,165,198,0.12),0_18px_36px_-18px_rgba(23,51,143,0.55)]'
                        : full
                          ? 'border border-dashed border-[#E0B57A] bg-[repeating-linear-gradient(135deg,rgba(251,238,220,0.7)_0_8px,rgba(255,255,255,0.7)_8px_16px)]'
                          : 'border border-line-faint bg-white/80 shadow-[inset_0_1px_0_#FFFFFF,0_10px_24px_-18px_rgba(15,30,70,0.35)]',
                      past && 'opacity-[0.72]',
                    )}
                  >
                    <div className="flex items-center justify-between gap-1 px-1">
                      <span
                        className={cn(
                          'text-[13px] font-extrabold',
                          isToday ? 'text-[#0B7F99]' : past ? 'text-ink-500' : 'text-ink-900',
                        )}
                      >
                        {dayLabel(d.date)}
                      </span>
                      {d.count > 0 && (
                        <span className="rounded-pill bg-surface-rail px-1.5 text-[11px] font-extrabold text-ink-500">
                          {d.count}
                        </span>
                      )}
                    </div>
                    {full && blockItem(full)}
                    {am && blockItem(am)}
                    {morning.map((c) => (
                      <Card key={c.id} card={c} fresh={c.id === freshId} />
                    ))}
                    {pm && blockItem(pm)}
                    {afternoon.map((c) => (
                      <Card key={c.id} card={c} fresh={c.id === freshId} />
                    ))}
                    {d.cards.length === 0 && d.blocks.length === 0 && (
                      <span className="px-1 text-[12px] text-ink-500">Aucun RDV</span>
                    )}
                    {!past && !full && (
                      <button
                        type="button"
                        onClick={() => onAdd(d.date)}
                        aria-label={`Ajouter un rendez-vous le ${dayLabel(d.date)}`}
                        className="mt-auto flex min-h-[36px] items-center justify-center gap-1 rounded-[10px] border border-dashed border-line-strong text-[12px] font-bold text-ink-500 transition-colors hover:border-royal-500 hover:bg-royal-50 hover:text-royal-700"
                      >
                        <Icon name="plus" size={13} strokeWidth={2.6} />
                        RDV
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </motion.section>
        )
      })}
    </div>
  )
}
