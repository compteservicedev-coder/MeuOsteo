import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { formatIsoDateFr } from '@shared/domain/dates'
import type { MergeField, MergePicks, MergeSide } from '@shared/domain/duplicates'
import type { DuplicateTask, MergeComparison, MergeRecordSummary } from '@shared/types/reconcile'
import { useToast } from '../../components/toast/toastContext'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Icon } from '../../components/ui/Icon'
import { Spinner } from '../../components/ui/Spinner'
import { cn } from '../../lib/cn'
import { EASE_SOFT } from '../../lib/motion'

interface MergeDialogProps {
  task: DuplicateTask | null
  onClose: () => void
  /** The pair is settled (merged or marked as different people). */
  onResolved: () => void
}

const recordLine = (r: MergeRecordSummary) =>
  [
    r.imported
      ? 'Importée de l’ancien outil'
      : `Créée le ${formatIsoDateFr(r.createdAt.slice(0, 10))}`,
    r.seances === 1 ? '1 séance' : `${r.seances} séances`,
    r.lastSeance && `dernière le ${formatIsoDateFr(r.lastSeance)}`,
  ]
    .filter(Boolean)
    .join(' · ')

/** « Doublon possible » (SPEC §3, R-19): the two records side by side, then the merge. */
export function MergeDialog({ task, onClose, onResolved }: MergeDialogProps) {
  const toast = useToast()
  const [comparison, setComparison] = useState<MergeComparison | null>(null)
  const [picks, setPicks] = useState<MergePicks | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setComparison(null)
    setConfirming(false)
    setError(null)
    if (!task) return
    let alive = true
    void window.api.reconcile.compareDuplicates(task.a.id, task.b.id).then((c) => {
      if (!alive) return
      if (!c) {
        onResolved()
        return
      }
      setComparison(c)
      setPicks(c.picks)
    })
    return () => {
      alive = false
    }
  }, [task, onResolved])

  const valueOf = (field: MergeField) => {
    const row = comparison?.rows.find((r) => r.field === field)
    if (!row || !picks) return ''
    return picks[field] === 'a' ? row.a : row.b
  }
  const mergeName = `${valueOf('prenom')} ${valueOf('nom')}`.trim()

  const notSame = async () => {
    if (!comparison) return
    await window.api.reconcile.ignoreDuplicate(comparison.a.id, comparison.b.id)
    toast.show('Noté : ces deux fiches ne seront plus signalées')
    onResolved()
  }

  const merge = async () => {
    if (!comparison || !picks || busy) return
    setBusy(true)
    const result = await window.api.reconcile.mergeDuplicates({
      keepId: comparison.a.id,
      removeId: comparison.b.id,
      picks,
    })
    setBusy(false)
    if (result.ok) {
      toast.show(
        `Fiches fusionnées : ${result.name} · ${result.seances === 1 ? '1 séance' : `${result.seances} séances`} · inscrit au journal`,
      )
      onResolved()
      return
    }
    setConfirming(false)
    setError(
      result.reason === 'same_day_conflict'
        ? `Les deux fiches ont une séance le même jour (${result.dates.map(formatIsoDateFr).join(', ')}) : annulez ou supprimez l’une d’elles avant de fusionner.`
        : 'Une des deux fiches n’existe plus.',
    )
  }

  const seancesTotal = comparison ? comparison.a.seances + comparison.b.seances : 0

  return (
    <Dialog
      open={task !== null}
      onOpenChange={(open) => !open && onClose()}
      className="max-w-[900px] bg-surface-panel"
      title={
        <>
          <span className="block text-[12px] font-bold uppercase tracking-[0.06em] text-cyan-500">
            Doublon possible
          </span>
          Comparer et fusionner deux fiches
        </>
      }
    >
      {!comparison || !picks ? (
        <div role="status" className="flex items-center gap-2.5 py-6 text-[14px] font-bold">
          <Spinner className="text-royal-600" /> Chargement des deux fiches…
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-[110px_repeat(2,minmax(0,1fr))] items-stretch gap-2.5 min-[700px]:grid-cols-[140px_repeat(2,minmax(0,1fr))]">
            <span />
            <RecordHeader label="FICHE A" tone="text-royal-600" record={comparison.a} />
            <RecordHeader label="FICHE B" tone="text-cyan-500" record={comparison.b} />
            {comparison.rows.map((row) => (
              <MergeRowView
                key={row.field}
                label={row.label}
                a={row.a}
                b={row.b}
                same={row.same}
                pick={picks[row.field]}
                onPick={(side) => setPicks({ ...picks, [row.field]: side })}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-x-[18px] gap-y-2 rounded-2xl bg-royal-50 px-4 py-3.5 text-[14px] text-royal-700">
            <span className="font-extrabold">Résultat : {mergeName}</span>
            <span>
              {seancesTotal === 1 ? '1 séance réunie' : `${seancesTotal} séances réunies`}
            </span>
            <span>Commentaires mis bout à bout</span>
            <span>Factures inchangées</span>
          </div>

          {(error || comparison.conflictDates.length > 0) && (
            <p
              role="alert"
              className="flex gap-2 rounded-2xl bg-red-50 px-3.5 py-3 text-[14px] font-bold text-red-ink"
            >
              <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
              {error ??
                `Les deux fiches ont une séance le même jour (${comparison.conflictDates.map(formatIsoDateFr).join(', ')}) : annulez ou supprimez l’une d’elles avant de fusionner.`}
            </p>
          )}

          <AnimatePresence mode="wait" initial={false}>
            {confirming ? (
              <motion.div
                key="confirm"
                role="alertdialog"
                aria-labelledby="t-merge"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE_SOFT }}
                className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-[#E9C9A0] bg-gradient-to-b from-[#FFF6EA] to-[#FBE8CF] py-3 pl-4 pr-3 text-[#5A3205]"
              >
                <span
                  id="t-merge"
                  className="flex-[1_1_320px] text-[14px] font-bold leading-[1.45]"
                >
                  Fusion définitive : la fiche B disparaît, ses séances et son commentaire
                  rejoignent la fiche conservée. Opération inscrite au journal.
                </span>
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy} onClick={() => setConfirming(false)}>
                    Retour
                  </Button>
                  <Button
                    size="sm"
                    className="bg-gradient-to-b from-amber-500 to-[#B86A12] text-white"
                    loading={busy}
                    onClick={() => void merge()}
                  >
                    Confirmer la fusion
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="actions"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-wrap justify-between gap-2.5"
              >
                <Button onClick={() => void notSame()}>Ce ne sont pas les mêmes personnes</Button>
                <Button
                  variant="primary"
                  disabled={comparison.conflictDates.length > 0}
                  onClick={() => setConfirming(true)}
                >
                  Fusionner les fiches…
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </Dialog>
  )
}

function RecordHeader({
  label,
  tone,
  record,
}: {
  label: string
  tone: string
  record: MergeRecordSummary
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-white px-3.5 py-3 shadow-[0_10px_26px_-18px_rgba(15,30,70,0.35)]">
      <span className={cn('text-[12px] font-extrabold', tone)}>
        {label} · n° {record.shortNo}
      </span>
      <span className="text-[13px] text-ink-600">{recordLine(record)}</span>
    </div>
  )
}

function MergeRowView({
  label,
  a,
  b,
  same,
  pick,
  onPick,
}: {
  label: string
  a: string
  b: string
  same: boolean
  pick: MergeSide
  onPick: (side: MergeSide) => void
}) {
  const option = (side: MergeSide, value: string) => {
    const on = pick === side
    return (
      <button
        type="button"
        aria-pressed={on}
        aria-label={`${label} : garder ${value || 'vide'} (fiche ${side.toUpperCase()})`}
        onClick={() => onPick(side)}
        className={cn(
          'btn btn-ink min-h-[46px] justify-start rounded-control border-2 px-3.5 py-2 text-left text-[14px]',
          on
            ? 'border-royal-500 bg-surface-hover font-bold text-ink-900 shadow-[0_8px_18px_-12px_rgba(31,79,216,0.8)]'
            : 'border-line bg-white font-medium text-ink-500',
        )}
      >
        {value || <span className="italic">(vide)</span>}
      </button>
    )
  }
  return (
    <>
      <span className="flex items-center text-[13px] font-bold text-ink-600">{label}</span>
      {same ? (
        <div className="col-span-2 flex min-h-[46px] items-center gap-2 rounded-control bg-aqua-50 px-3.5 text-[14px] font-semibold text-aqua-ink">
          <Icon name="check" size={15} strokeWidth={3} />
          {a}
          <span className="ml-auto text-[12px] opacity-80">identique</span>
        </div>
      ) : (
        <>
          {option('a', a)}
          {option('b', b)}
        </>
      )}
    </>
  )
}
