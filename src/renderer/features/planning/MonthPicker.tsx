import * as Popover from '@radix-ui/react-popover'
import { useEffect, useState } from 'react'
import { addDays } from '@shared/domain/dates'
import { calendarWeeks, monthTitle } from '@shared/domain/planning'
import { Icon } from '../../components/ui/Icon'
import { cn } from '../../lib/cn'

interface MonthPickerProps {
  /** Monday of the first week shown. */
  monday: string
  weeks: 1 | 2
  today: string
  onPick: (monday: string) => void
}

/** « Mois Année ▾ »: month calendar, a click on a week shows it with the next (SPEC §3). */
export function MonthPicker({ monday, weeks, today, onPick }: MonthPickerProps) {
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState({
    y: Number(monday.slice(0, 4)),
    m: Number(monday.slice(5, 7)) - 1,
  })
  const [blocked, setBlocked] = useState<Set<string>>(new Set())
  const grid = calendarWeeks(cursor.y, cursor.m)

  useEffect(() => {
    if (!open) return
    void window.api.planning
      .blockedDates(grid[0]![0]!, grid.at(-1)![6]!)
      .then((d) => setBlocked(new Set(d)))
    // grid is derived from cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cursor])

  useEffect(() => {
    setCursor({ y: Number(monday.slice(0, 4)), m: Number(monday.slice(5, 7)) - 1 })
  }, [monday])

  const move = (delta: number) =>
    setCursor((c) => {
      const m = c.m + delta
      return { y: c.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }
    })

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className="btn btn-secondary btn-ink min-h-[46px] gap-1.5 px-4">
          <Icon name="calendar" size={16} />
          {monthTitle(Number(monday.slice(0, 4)), Number(monday.slice(5, 7)) - 1)} ▾
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="start"
          className="z-30 flex w-[300px] flex-col gap-2 rounded-[18px] border border-line-faint bg-white p-4 shadow-[0_24px_50px_-20px_rgba(15,30,70,0.5)]"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Mois précédent"
              onClick={() => move(-1)}
              className="btn btn-ghost btn-ink h-10 w-10 px-0"
            >
              <Icon name="chevronLeft" size={16} />
            </button>
            <span className="text-[15px] font-extrabold">{monthTitle(cursor.y, cursor.m)}</span>
            <button
              type="button"
              aria-label="Mois suivant"
              onClick={() => move(1)}
              className="btn btn-ghost btn-ink h-10 w-10 px-0"
            >
              <Icon name="chevronRight" size={16} />
            </button>
          </div>
          <div
            aria-hidden="true"
            className="grid grid-cols-7 px-1.5 text-center text-[11px] font-bold text-ink-500"
          >
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          {grid.map((week) => {
            const mon = week[0]!
            const selected = mon === monday || (weeks === 2 && week[0] === addDays(monday, 7))
            return (
              <button
                key={mon}
                type="button"
                aria-label={`Afficher la semaine du ${Number(mon.slice(8))}/${mon.slice(5, 7)}`}
                onClick={() => {
                  onPick(mon)
                  setOpen(false)
                }}
                className={cn(
                  'grid w-full grid-cols-7 rounded-control px-1.5 py-0.5',
                  selected
                    ? 'bg-royal-50 shadow-[inset_0_0_0_2px_rgba(59,108,246,0.35)]'
                    : 'hover:bg-surface-hover',
                )}
              >
                {week.map((d) => {
                  const inMonth = Number(d.slice(5, 7)) - 1 === cursor.m
                  const isToday = d === today
                  return (
                    <span
                      key={d}
                      className={cn(
                        'relative flex h-[34px] items-center justify-center rounded-[9px] text-[13px]',
                        isToday
                          ? 'bg-[linear-gradient(180deg,#22C3D6,#0EA5C6)] font-extrabold text-white'
                          : selected
                            ? 'font-semibold text-royal-700'
                            : inMonth
                              ? 'font-semibold text-ink-900'
                              : 'text-[#B7C2D6]',
                      )}
                    >
                      {Number(d.slice(8))}
                      {blocked.has(d) && (
                        <span className="absolute bottom-[3px] left-1/2 h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-amber-500" />
                      )}
                    </span>
                  )
                })}
              </button>
            )
          })}
          <p className="text-[12px] text-ink-500">
            Choisissez une semaine : elle s’affiche avec la suivante. Point orange = jour bloqué.
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
