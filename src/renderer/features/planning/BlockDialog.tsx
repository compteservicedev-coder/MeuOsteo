import { useEffect, useState } from 'react'
import { BLOCK_REASONS, CRENEAU_LABELS, type Creneau } from '@shared/domain/planning'
import type { BlockPreview } from '@shared/types/planning'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Field, Input } from '../../components/ui/Field'
import { cn } from '../../lib/cn'

interface BlockDialogProps {
  /** Start date proposed, `null` when closed. */
  from: string | null
  onClose: () => void
  onBlocked: (days: number) => void
}

const pill = (on: boolean) =>
  cn(
    'btn min-h-[40px] rounded-[10px] px-3 text-[14px]',
    on
      ? 'pop border-0 bg-[linear-gradient(180deg,#E0922F,#B86A12)] text-white shadow-[0_8px_16px_-8px_rgba(184,106,18,0.9)]'
      : 'btn-ink border border-[#E9C9A0] bg-[#FFF6EA] text-[#7A4207]',
  )

/** « Bloquer une période » (SPEC §3, R-23). */
export function BlockDialog({ from, onClose, onBlocked }: BlockDialogProps) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [creneau, setCreneau] = useState<Creneau>('day')
  const [motif, setMotif] = useState<string>('Congés')
  const [preview, setPreview] = useState<BlockPreview | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (from === null) return
    setStart(from)
    setEnd(from)
    setCreneau('day')
    setMotif('Congés')
  }, [from])

  useEffect(() => {
    if (!start || !end) return
    void window.api.planning.previewBlock({ from: start, to: end, creneau, motif }).then(setPreview)
  }, [start, end, creneau, motif])

  const valid = start && end && start <= end && (preview?.days ?? 0) > 0

  return (
    <Dialog
      open={from !== null}
      onOpenChange={(o) => !o && onClose()}
      title="Bloquer une période"
      className="max-w-[540px]"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Du">
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field
          label="Au"
          error={start && end && end < start ? 'La fin est avant le début' : undefined}
        >
          <Input type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
      <div role="group" aria-label="Créneau" className="flex flex-wrap gap-2">
        <span className="w-full text-label text-ink-600">Créneau</span>
        {(Object.keys(CRENEAU_LABELS) as Creneau[]).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={creneau === c}
            className={pill(creneau === c)}
            onClick={() => setCreneau(c)}
          >
            {CRENEAU_LABELS[c]}
            {c === 'am' ? ' (avant 13 h)' : ''}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Motif" className="flex flex-wrap gap-2">
        <span className="w-full text-label text-ink-600">Motif</span>
        {BLOCK_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={motif === r}
            className={pill(motif === r)}
            onClick={() => setMotif(r)}
          >
            {r}
          </button>
        ))}
      </div>
      {preview && preview.conflicts > 0 && (
        <p
          role="status"
          className="rounded-control bg-red-50 px-3 py-2.5 text-[14px] font-semibold text-red-ink"
        >
          {preview.conflicts} RDV déjà prévu{preview.conflicts > 1 ? 's' : ''} sur cette période :
          ils ne sont pas annulés. Prévenez les patients concernés.
        </p>
      )}
      <p className="rounded-2xl border border-[#E9C9A0] bg-[linear-gradient(180deg,#FFF6EA,#FBE8CF)] px-4 py-3 text-[13px] leading-normal text-[#5A3205]">
        Si vous utilisez un agenda en ligne, bloquez-y aussi ces créneaux pour que les patients ne
        puissent pas réserver : l’application ne peut pas le faire à votre place.
      </p>
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Annuler</Button>
        <Button
          variant="primary"
          disabled={!valid}
          loading={busy}
          onClick={async () => {
            setBusy(true)
            const r = await window.api.planning.addBlocks({ from: start, to: end, creneau, motif })
            setBusy(false)
            if (r.ok) onBlocked(r.days)
          }}
        >
          {preview && preview.days > 0
            ? `Bloquer ${preview.days} jour${preview.days > 1 ? 's' : ''}`
            : 'Bloquer'}
        </Button>
      </div>
    </Dialog>
  )
}
