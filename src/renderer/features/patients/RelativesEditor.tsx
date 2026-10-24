import { useState } from 'react'
import { relationLabel } from '@shared/domain/relatives'
import type { RelativeView } from '@shared/types/patients'
import { useToast } from '../../components/toast/toastContext'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { cn } from '../../lib/cn'
import { LinkRelativeDialog } from './LinkRelativeDialog'

interface RelativesEditorProps {
  patientId: string
  patientName: string
  relatives: RelativeView[]
  onChanged: () => void
}

/**
 * « Proches » section of the edit panel (R-25). Each link added or removed is confirmed, then
 * saved at once on both records, independently of « Enregistrer » / « Annuler ».
 */
export function RelativesEditor({ patientId, patientName, relatives, onChanged }: RelativesEditorProps) {
  const toast = useToast()
  const [asking, setAsking] = useState<string | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)

  const remove = async (relative: RelativeView) => {
    await window.api.patients.removeLink(patientId, relative.patientId)
    setAsking(null)
    toast.show(`Lien avec ${relative.prenom} ${relative.nom} retiré (sur les deux fiches)`)
    onChanged()
  }

  return (
    <fieldset className="flex flex-col gap-2.5 rounded-[18px] bg-white p-[18px] shadow-[inset_0_1px_0_#FFFFFF,0_10px_26px_-18px_rgba(15,30,70,0.35)]">
      <legend className="float-left mb-1 w-full text-[15px] font-extrabold">Proches</legend>
      <span className="text-[12px] text-ink-500">
        Liens vers d’autres fiches patients. Chaque ajout ou retrait est confirmé puis enregistré tout
        de suite, sur les deux fiches.
      </span>
      {relatives.map((r) => {
        const name = `${r.prenom} ${r.nom}`
        const isAsking = asking === r.patientId
        return (
          <div
            key={r.patientId}
            className={cn(
              'flex flex-wrap items-center gap-2.5 rounded-2xl px-2.5 py-2',
              isAsking ? 'bg-[#FFFAFA] shadow-[inset_0_0_0_1px_rgba(194,39,45,0.2)]' : 'bg-surface-field',
            )}
          >
            <Avatar prenom={r.prenom} nom={r.nom} size="sm" />
            <span className="flex min-w-0 flex-[1_1_140px] flex-col">
              <span className="font-bold">{name}</span>
              <span className="text-[12px] text-ink-500">{relationLabel(r.relation)}</span>
            </span>
            {isAsking ? (
              <div role="alertdialog" aria-label={`Retirer le lien avec ${name}`} className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold text-red-ink">
                  Retirer le lien avec {name} ? Il disparaîtra aussi de sa fiche.
                </span>
                <span className="flex gap-2">
                  <Button size="sm" onClick={() => setAsking(null)}>
                    Garder
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => void remove(r)}>
                    Retirer le lien
                  </Button>
                </span>
              </div>
            ) : (
              <Button
                size="sm"
                aria-label={`Retirer le lien avec ${name}`}
                className="!text-red-ink"
                onClick={() => setAsking(r.patientId)}
              >
                Retirer…
              </Button>
            )}
          </div>
        )
      })}
      {relatives.length === 0 && <span className="text-[14px] text-ink-500">Aucun proche lié.</span>}
      <Button
        className="self-start"
        icon={<Icon name="plus" size={16} strokeWidth={2.6} />}
        onClick={() => setLinkOpen(true)}
      >
        Lier un proche…
      </Button>
      <LinkRelativeDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        patientId={patientId}
        patientName={patientName}
        onLinked={onChanged}
      />
    </fieldset>
  )
}
