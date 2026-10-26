import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDateTimeFr } from '@shared/domain/dates'
import { JOURNAL_TYPE_LABELS, type JournalType } from '@shared/domain/journal'
import type { JournalLineView } from '@shared/types/patients'
import { Icon } from '../../../components/ui/Icon'
import { EASE_SOFT } from '../../../lib/motion'

const DOT: Record<JournalType, string> = {
  patient: 'bg-royal-500 shadow-[0_0_0_4px_rgba(59,108,246,0.15)]',
  facture: 'bg-[#14B8A6] shadow-[0_0_0_4px_rgba(20,184,166,0.15)]',
  verrouillage: 'bg-amber-500 shadow-[0_0_0_4px_rgba(224,146,47,0.18)]',
  reglage: 'bg-[#8E99B3] shadow-[0_0_0_4px_rgba(142,153,179,0.2)]',
}

/** « Historique » of the record (R-20): one line per action, never any medical content. */
export function HistoryPanel({
  patientId,
  version,
  onClose,
}: {
  patientId: string
  version: number
  onClose: () => void
}) {
  const [lines, setLines] = useState<JournalLineView[] | null>(null)
  useEffect(() => {
    void window.api.patients.journal(patientId).then(setLines)
  }, [patientId, version])

  return (
    <motion.section
      aria-labelledby="h-hist"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_SOFT }}
      className="flex shrink-0 flex-col gap-3 rounded-card-lg border border-line-faint bg-white px-6 py-5 shadow-card lg:max-h-[34%] lg:overflow-y-auto"
    >
      <div className="flex items-center justify-between">
        <h2 id="h-hist" className="text-section">
          Historique de la fiche
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer l’historique"
          className="btn btn-ghost btn-ink h-11 w-11 px-0 text-ink-500"
        >
          <Icon name="close" size={18} />
        </button>
      </div>
      <ul className="flex flex-col gap-2.5">
        {lines?.map((l) => (
          <li key={l.id} className="flex gap-3">
            <span
              aria-hidden="true"
              className={`mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full ${DOT[l.type]}`}
            />
            <span className="flex flex-col">
              <span className="text-[14px] font-semibold">{l.action}</span>
              <span className="text-[12px] text-ink-500">
                {formatDateTimeFr(new Date(l.at))} · {JOURNAL_TYPE_LABELS[l.type]}
              </span>
            </span>
          </li>
        ))}
        {lines?.length === 0 && (
          <li className="text-[14px] text-ink-500">Aucune action enregistrée.</li>
        )}
      </ul>
      <p className="flex flex-wrap justify-between gap-2 border-t border-[#EDF0F6] pt-3 text-[12px] text-ink-500">
        Une ligne par action, sans contenu médical · 24 mois
        <Link to="/parametres" className="font-bold text-royal-600 hover:text-royal-700">
          Journal complet →
        </Link>
      </p>
    </motion.section>
  )
}
