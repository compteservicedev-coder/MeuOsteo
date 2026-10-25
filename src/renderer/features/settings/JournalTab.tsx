import { useEffect, useState } from 'react'
import { formatDateTimeFr } from '@shared/domain/dates'
import { JOURNAL_TYPE_LABELS, type JournalType } from '@shared/domain/journal'
import type { JournalEntry } from '@shared/types/pilotage'
import { useToast } from '../../components/toast/toastContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Icon } from '../../components/ui/Icon'
import { Segmented } from '../../components/ui/Segmented'

const FILTERS: Array<{ value: JournalType | 'all'; label: string }> = [
  { value: 'all', label: 'Tout' },
  { value: 'patient', label: 'Patients' },
  { value: 'facture', label: 'Factures' },
  { value: 'verrouillage', label: 'Déverrouillages' },
  { value: 'reglage', label: 'Réglages' },
]

const DOT: Record<JournalType, string> = {
  patient: 'bg-royal-500 shadow-[0_0_0_4px_rgba(59,108,246,0.15)]',
  facture: 'bg-[#14B8A6] shadow-[0_0_0_4px_rgba(20,184,166,0.15)]',
  verrouillage: 'bg-amber-500 shadow-[0_0_0_4px_rgba(224,146,47,0.18)]',
  reglage: 'bg-[#8E99B3] shadow-[0_0_0_4px_rgba(142,153,179,0.2)]',
}

/** Paramètres > Journal (SPEC §8.6, R-20). */
export function JournalTab() {
  const toast = useToast()
  const [filter, setFilter] = useState<JournalType | 'all'>('all')
  const [lines, setLines] = useState<JournalEntry[]>([])
  const [retention, setRetention] = useState<12 | 24 | 36>(24)

  useEffect(() => {
    void window.api.journal.list(filter === 'all' ? null : filter).then(setLines)
  }, [filter])
  useEffect(() => {
    void window.api.journal.getRetention().then(setRetention)
  }, [])

  return (
    <Card
      title="Journal d’activité"
      description="Patients, factures, déverrouillages et réglages sensibles"
    >
      <Segmented label="Filtrer le journal" value={filter} onChange={setFilter} options={FILTERS} />
      <ul className="flex max-h-[460px] flex-col overflow-y-auto">
        {lines.map((l) => (
          <li key={l.id} className="flex items-start gap-3 border-b border-[#EDF0F6] py-2.5">
            <span
              aria-hidden="true"
              className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[l.type]}`}
            />
            <span className="min-w-0 grow">
              <span className="text-[14px]">
                <b>{l.subject}</b> · {l.action}
              </span>
              <span className="block text-[12px] text-ink-500">
                {formatDateTimeFr(new Date(l.at))} · {JOURNAL_TYPE_LABELS[l.type]}
              </span>
            </span>
          </li>
        ))}
        {lines.length === 0 && <li className="py-3 text-[14px] text-ink-500">Aucune ligne.</li>}
      </ul>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-label text-ink-600">Conservation</span>
          <Segmented
            label="Conservation"
            value={retention}
            onChange={async (v) => {
              setRetention(await window.api.journal.setRetention(v))
              toast.show(`Journal conservé ${v} mois`)
            }}
            options={[12, 24, 36].map((n) => ({ value: n as 12 | 24 | 36, label: `${n} mois` }))}
          />
        </div>
        <Button
          icon={<Icon name="download" size={16} />}
          onClick={async () => {
            const r = await window.api.journal.export()
            if (r.ok) toast.show('Journal exporté')
          }}
        >
          Exporter le journal (CSV)
        </Button>
      </div>
      <p className="text-[12px] text-ink-500">
        Une ligne par action, jamais de contenu médical · environ 20 Ko par an
      </p>
    </Card>
  )
}
