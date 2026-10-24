import { useEffect, useId, useState } from 'react'
import { ageLabel } from '@shared/domain/patient'
import { RELATION_OPTIONS, reciprocitySentence, type Relation } from '@shared/domain/relatives'
import type { LinkCandidate } from '@shared/types/patients'
import { useToast } from '../../components/toast/toastContext'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Input } from '../../components/ui/Field'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { cn } from '../../lib/cn'
import { todayIso } from '../../lib/today'

interface LinkRelativeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: string
  patientName: string
  onLinked: () => void
}

/**
 * « Est un proche de… » (R-25): existing records only, never a creation from here. The link is
 * confirmed, then saved at once on both records.
 */
export function LinkRelativeDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
  onLinked,
}: LinkRelativeDialogProps) {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<LinkCandidate[]>([])
  const [selected, setSelected] = useState<LinkCandidate | null>(null)
  const [relation, setRelation] = useState<Relation | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const debounced = useDebouncedValue(query, 120)
  const searchId = useId()
  const relationId = useId()
  const today = todayIso()

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelected(null)
    setRelation(null)
    setConfirming(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    let alive = true
    void window.api.patients.linkCandidates(patientId, debounced).then((list) => {
      if (alive) setCandidates(list)
    })
    return () => {
      alive = false
    }
  }, [open, patientId, debounced])

  const ready = selected !== null && relation !== null
  const otherName = selected ? `${selected.prenom} ${selected.nom}` : ''

  const save = async () => {
    if (!selected || !relation) return
    setSaving(true)
    const result = await window.api.patients.addLink(patientId, selected.id, relation)
    setSaving(false)
    if (!result.ok) {
      toast.show('Ce lien ne peut pas être ajouté', 'error')
      setConfirming(false)
      return
    }
    const label = RELATION_OPTIONS.find((o) => o.value === relation)!.label.toLowerCase()
    toast.show(`${otherName} lié(e) comme ${label} · lien ajouté sur les deux fiches`)
    onOpenChange(false)
    onLinked()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Lier un proche"
      description={patientName}
      className="max-w-[520px]"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={searchId} className="text-label text-ink-600">
          Est un proche de…
        </label>
        <Input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
          }}
          placeholder="Rechercher un patient existant"
          autoComplete="off"
        />
      </div>
      <div role="listbox" aria-label="Patients" className="flex max-h-[240px] flex-col gap-1 overflow-y-auto">
        {candidates.map((c) => {
          const on = selected?.id === c.id
          return (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={on}
              onClick={() => {
                setSelected(c)
                setConfirming(false)
              }}
              className={cn(
                'flex min-h-[52px] w-full items-center gap-2.5 rounded-control border-2 px-2.5 py-1.5 text-left text-[14px] transition-colors',
                on ? 'pop border-royal-500 bg-surface-hover' : 'border-transparent hover:bg-surface-hover',
              )}
            >
              <Avatar prenom={c.prenom} nom={c.nom} size="sm" />
              <span className="flex min-w-0 flex-col">
                <span className="font-bold">
                  {c.prenom} {c.nom}
                </span>
                <span className="text-[12px] text-ink-500">
                  {[ageLabel(c.ddn, today), c.commune].filter(Boolean).join(' · ')}
                </span>
              </span>
            </button>
          )
        })}
        {candidates.length === 0 && (
          <p className="px-1 py-3 text-[14px] text-ink-500">
            Aucun patient trouvé. Le proche doit d’abord avoir sa propre fiche.
          </p>
        )}
      </div>
      <span id={relationId} className="text-label text-ink-600">
        Lien
      </span>
      <div role="group" aria-labelledby={relationId} className="flex flex-wrap gap-2">
        {RELATION_OPTIONS.map((o) => {
          const on = relation === o.value
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setRelation(o.value)
                setConfirming(false)
              }}
              className={cn(
                'btn min-h-[44px] rounded-[11px] px-3 text-[13px]',
                on ? 'btn-primary pop' : 'btn-ink border border-line-strong bg-white text-ink-600',
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
      {ready && (
        <p className="rounded-2xl bg-surface-mist px-3.5 py-3 text-[13px] leading-normal text-ink-600">
          {reciprocitySentence(patientName, otherName, relation)}
        </p>
      )}
      {confirming ? (
        <div
          role="alertdialog"
          aria-label="Confirmer le lien"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-royal-50 px-4 py-3"
        >
          <span className="text-[14px] font-bold text-royal-700">
            Confirmer le lien ? Les deux fiches seront mises à jour.
          </span>
          <span className="flex gap-2">
            <Button size="sm" onClick={() => setConfirming(false)}>
              Retour
            </Button>
            <Button size="sm" variant="primary" loading={saving} onClick={() => void save()}>
              Confirmer le lien
            </Button>
          </span>
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button variant="primary" disabled={!ready} onClick={() => setConfirming(true)}>
            Lier…
          </Button>
        </div>
      )}
    </Dialog>
  )
}
