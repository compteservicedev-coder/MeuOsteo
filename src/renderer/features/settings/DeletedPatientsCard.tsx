import { useEffect, useState } from 'react'
import { formatIsoDateFr } from '@shared/domain/dates'
import type { DeletedPatientView } from '@shared/types/patients'
import { useToast } from '../../components/toast/toastContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'

/** R-14: a deleted record can be restored here during the 30 days before its purge. */
export function DeletedPatientsCard() {
  const toast = useToast()
  const [list, setList] = useState<DeletedPatientView[] | null>(null)
  const load = () => void window.api.patients.listDeleted().then(setList)
  useEffect(load, [])

  return (
    <Card title="Patients supprimés" description="Restaurables pendant 30 jours, puis purgés définitivement">
      {list?.length === 0 && <p className="text-[15px] text-ink-500">Aucune fiche supprimée.</p>}
      <ul className="flex flex-col gap-2">
        {list?.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface-mist px-4 py-3">
            <span className="flex min-w-0 flex-[1_1_220px] flex-col">
              <span className="font-bold">
                {p.prenom} {p.nom}
              </span>
              <span className="text-[13px] text-ink-500">
                Supprimé le {formatIsoDateFr(p.deletedAt.slice(0, 10))} · {p.seances} séance{p.seances > 1 ? 's' : ''} ·
                purge dans {p.daysLeft} jour{p.daysLeft > 1 ? 's' : ''}
              </span>
            </span>
            <Button
              size="sm"
              onClick={async () => {
                await window.api.patients.restore(p.id)
                toast.show(`Fiche de ${p.prenom} ${p.nom} restaurée`)
                load()
              }}
            >
              Restaurer
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
