import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDays, formatIsoDateFr, isoDateInParis, timeInParis } from '@shared/domain/dates'
import { mondayOf, rangeLabel } from '@shared/domain/planning'
import type { PlanningView, SyncStatus } from '@shared/types/planning'
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

const SYNC_ERRORS: Record<NonNullable<SyncStatus['error']>, string> = {
  auth: 'Gmail refuse l’adresse ou le mot de passe',
  network: 'Gmail injoignable, nouvel essai bientôt',
  label: 'Libellé Gmail introuvable',
  other: 'Synchronisation impossible',
}

function syncLabel(s: SyncStatus | null): string {
  if (!s || s.state === 'off') return 'Gmail non configuré'
  if (s.state === 'running') return 'Synchronisation…'
  if (s.state === 'error' && s.error) return SYNC_ERRORS[s.error]
  if (!s.lastSyncAt) return 'Jamais synchronisé'
  const at = new Date(s.lastSyncAt)
  const day = isoDateInParis(at)
  return `Dernière synchro ${day === todayIso() ? '' : `${formatIsoDateFr(day)} `}à ${timeInParis(at)}`
}

/** Planning (SPEC §3): two weeks of appointments, blocks, « Nouveau RDV » and « À rapprocher ». */
export function PlanningPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const today = todayIso()
  const [monday, setMonday] = useState(() => mondayOf(today))
  const [view, setView] = useState<PlanningView | null>(null)
  const [sync, setSync] = useState<SyncStatus | null>(null)
  const [newRdv, setNewRdv] = useState<string | null>(null)
  const [block, setBlock] = useState<string | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const [requested, setRequested] = useState<string | null>(null)

  const load = useCallback(() => {
    void window.api.planning.weeks(monday).then(setView)
  }, [monday])
  useEffect(load, [load])
  useDataChanged(load)

  useEffect(() => {
    void window.api.sync.getStatus().then(setSync)
    return window.api.sync.onStatus((s) => {
      setSync(s)
      if (s.state === 'idle' && s.lastChanges > 0) notifyDataChanged()
    })
  }, [])

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

      <motion.div
        variants={staggerItem}
        className="flex flex-wrap items-center gap-3 rounded-2xl border border-line-faint bg-white px-4 py-2.5 shadow-card"
      >
        <Button
          size="sm"
          disabled={!sync || sync.state === 'off' || sync.state === 'running'}
          icon={
            <Icon
              name="refresh"
              size={16}
              className={cn(sync?.state === 'running' && 'animate-spin motion-reduce:animate-none')}
            />
          }
          onClick={async () => {
            const s = await window.api.sync.run()
            setSync(s)
            if (s.state === 'idle') {
              toast.show(
                s.lastChanges > 0
                  ? `${s.lastChanges} RDV Doctolib mis à jour`
                  : 'Planning à jour avec Gmail',
              )
              notifyDataChanged()
            }
          }}
        >
          Synchroniser
        </Button>
        <span
          role="status"
          className={cn(
            'text-[13px]',
            sync?.state === 'error' ? 'font-semibold text-red-ink' : 'text-ink-500',
          )}
        >
          {syncLabel(sync)}
          {sync && sync.unrecognized > 0
            ? ` · ${sync.unrecognized} e-mail${sync.unrecognized > 1 ? 's' : ''} non reconnu${sync.unrecognized > 1 ? 's' : ''}`
            : ''}
        </span>
        {sync?.state === 'off' && (
          <button
            type="button"
            className="text-[13px] font-bold text-royal-600"
            onClick={() => navigate('/parametres?onglet=messagerie')}
          >
            Configurer Gmail →
          </button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          icon={<Icon name="upload" size={16} />}
          onClick={async () => {
            const r = await window.api.doctolib.importExport()
            if (r.ok) {
              const x = r.report
              toast.show(
                `${x.rows} RDV lus · ${x.created} rattachés · ${x.pending} à rapprocher · ${x.cancelled} annulés`,
              )
              notifyDataChanged()
            } else if (r.reason === 'columns') {
              toast.show('Colonnes « Date » et « Patient » introuvables dans ce fichier', 'error')
            } else if (r.reason === 'unreadable') {
              toast.show('Ce fichier ne peut pas être lu', 'error')
            }
          }}
        >
          Importer un export Doctolib
        </Button>
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
              onReconcile={setRequested}
              onUnblock={async (id, label) => {
                await window.api.planning.removeBlock(id)
                toast.show(`${label.charAt(0).toUpperCase()}${label.slice(1)} débloqué`)
                load()
              }}
            />
          )}
        </div>
        <ReconcilePanel requestedKey={requested} onRequestHandled={() => setRequested(null)} />
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
          toast.show(
            `RDV ajouté : ${r.nom} · ${formatIsoDateFr(r.date)} à ${r.heure} · pensez à le réserver dans Doctolib`,
          )
        }}
      />
      <BlockDialog
        from={block}
        onClose={() => setBlock(null)}
        onBlocked={(days) => {
          setBlock(null)
          toast.show(
            `${days} jour${days > 1 ? 's' : ''} bloqué${days > 1 ? 's' : ''} · pensez à Doctolib`,
          )
          load()
          notifyDataChanged()
        }}
      />
    </Page>
  )
}
