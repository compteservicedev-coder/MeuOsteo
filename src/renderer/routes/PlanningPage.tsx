import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { addDays, formatIsoDateFr } from '@shared/domain/dates'
import { mondayOf, rangeLabel } from '@shared/domain/planning'
import type { PlanningView } from '@shared/types/planning'
import { Page } from '../components/layout/Page'
import { useToast } from '../components/toast/toastContext'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { BlockDialog } from '../features/planning/BlockDialog'
import { MonthPicker } from '../features/planning/MonthPicker'
import { NewRdvDialog } from '../features/planning/NewRdvDialog'
import { WeekGrid } from '../features/planning/WeekGrid'
import { ReconcilePanel } from '../features/reconcile/ReconcilePanel'
import { cn } from '../lib/cn'
import { notifyDataChanged, useDataChanged } from '../lib/dataEvents'
import { staggerItem } from '../lib/motion'
import { todayIso } from '../lib/today'

/** Planning (SPEC §3): two weeks of appointments, blocks, « Nouveau RDV » and « À rapprocher ». */
export function PlanningPage() {
  const toast = useToast()
  const today = todayIso()
  const [monday, setMonday] = useState(() => mondayOf(today))
  const [view, setView] = useState<PlanningView | null>(null)
  const [newRdv, setNewRdv] = useState<string | null>(null)
  const [block, setBlock] = useState<string | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)

  const load = useCallback(() => {
    void window.api.planning.weeks(monday).then(setView)
  }, [monday])
  useEffect(load, [load])
  useDataChanged(load)

  const weeksShown = view?.agenda.weeks ?? 2
  const allDays = view?.weeks.flatMap((w) => w.days) ?? []
  const total = view?.weeks.reduce((n, w) => n + w.count, 0) ?? 0
  const first = allDays[0]?.date ?? monday
  const last = allDays.at(-1)?.date ?? addDays(monday, 12)
  const step = 7

  return (
    <Page>
      <motion.div variants={staggerItem} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title">Planning</h1>
          <p className="mt-1 text-[14px] text-ink-500">
            {rangeLabel(first, last)} · {total} rendez-vous
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-[14px] bg-surface-rail p-1 shadow-rail">
            <button
              type="button"
              aria-label="Semaine précédente"
              onClick={() => setMonday(addDays(monday, -step))}
              className="btn btn-ghost btn-ink h-11 w-11 px-0"
            >
              <Icon name="chevronLeft" size={17} />
            </button>
            <button
              type="button"
              onClick={() => setMonday(mondayOf(today))}
              className={cn(
                'btn min-h-[44px] rounded-[10px] px-3 text-[14px]',
                monday === mondayOf(today) ? 'btn-primary' : 'btn-ink bg-transparent text-ink-600',
              )}
            >
              Aujourd’hui
            </button>
            <button
              type="button"
              aria-label="Semaine suivante"
              onClick={() => setMonday(addDays(monday, step))}
              className="btn btn-ghost btn-ink h-11 w-11 px-0"
            >
              <Icon name="chevronRight" size={17} />
            </button>
          </div>
          <MonthPicker monday={monday} weeks={weeksShown} today={today} onPick={setMonday} />
          <Button
            variant="primary"
            icon={<Icon name="plus" size={17} strokeWidth={2.4} />}
            onClick={() => setNewRdv(today)}
          >
            Nouveau RDV
          </Button>
          <Button icon={<Icon name="lock" size={16} />} onClick={() => setBlock(today)}>
            Bloquer une période
          </Button>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-[999_1_640px]">
          {view && (
            <WeekGrid
              key={monday}
              weeks={view.weeks}
              today={today}
              freshId={fresh}
              onAdd={(date) => setNewRdv(date)}
              onUnblock={async (id, label) => {
                await window.api.planning.removeBlock(id)
                toast.show(`${label.charAt(0).toUpperCase()}${label.slice(1)} débloqué`)
                load()
              }}
            />
          )}
        </div>
        <ReconcilePanel />
      </motion.div>

      <NewRdvDialog
        date={newRdv}
        onClose={() => setNewRdv(null)}
        onCreated={(r) => {
          setNewRdv(null)
          setFresh(r.seanceId)
          const target = mondayOf(r.date)
          if (target < monday || target > addDays(monday, 7 * (weeksShown - 1))) setMonday(target)
          else load()
          toast.show(`RDV ajouté : ${r.nom} · ${formatIsoDateFr(r.date)} à ${r.heure}`)
        }}
      />
      <BlockDialog
        from={block}
        onClose={() => setBlock(null)}
        onBlocked={(days) => {
          setBlock(null)
          toast.show(`${days} jour${days > 1 ? 's' : ''} bloqué${days > 1 ? 's' : ''}`)
          load()
          notifyDataChanged()
        }}
      />
    </Page>
  )
}
