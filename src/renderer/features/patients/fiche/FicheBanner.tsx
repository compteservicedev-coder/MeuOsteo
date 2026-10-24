import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { formatIsoDateFr } from '@shared/domain/dates'
import {
  bannerSubtitle,
  bornLabel,
  formatAddress,
  formatPhone,
  isAddressComplete,
} from '@shared/domain/patient'
import { relationLabel } from '@shared/domain/relatives'
import { initials } from '@shared/domain/text'
import type { PatientDetail } from '@shared/types/patients'
import { Icon, type IconName } from '../../../components/ui/Icon'
import { cn } from '../../../lib/cn'
import { staggerItem } from '../../../lib/motion'
import { todayIso } from '../../../lib/today'

interface FicheBannerProps {
  detail: PatientDetail
  /** Increments after a save: the banner lights up briefly. */
  flash: number
  historyOpen: boolean
  backTo: { id: string; name: string } | null
  onEdit: () => void
  onToggleHistory: () => void
  onOpenRelative: (id: string) => void
  onBack: () => void
}

const chipBase = 'inline-flex min-h-[34px] items-center gap-2 rounded-[10px] px-3 text-[13px]'
const glassButton =
  'btn h-auto min-h-[44px] gap-2 rounded-control bg-white/[0.12] px-3.5 text-[14px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] hover:bg-white/[0.22]'

/** Banner of the record (SPEC §5): identity, contact pills, buttons and relatives (R-25). */
export function FicheBanner({
  detail,
  flash,
  historyOpen,
  backTo,
  onEdit,
  onToggleHistory,
  onOpenRelative,
  onBack,
}: FicheBannerProps) {
  const p = detail.patient
  const today = todayIso()
  const name = `${p.prenom} ${p.nom}`
  const oldest = detail.seances.at(-1)?.date ?? p.createdAt
  const chips: Array<{ has: boolean; label: string; add: string; icon: IconName }> = [
    { has: Boolean(p.ddn), label: `${bornLabel(p.sexe)} ${formatIsoDateFr(p.ddn)}`, add: '+ Date de naissance', icon: 'calendar' },
    { has: Boolean(p.portable), label: p.portable ? formatPhone(p.portable) : '', add: 'Ajouter un portable', icon: 'phone' },
    { has: Boolean(p.fixe), label: p.fixe ? `Fixe ${formatPhone(p.fixe)}` : '', add: 'Ajouter un fixe', icon: 'phone' },
    { has: Boolean(p.email), label: p.email ?? '', add: 'Ajouter un e-mail', icon: 'mail' },
    { has: isAddressComplete(p), label: formatAddress(p), add: 'Compléter l’adresse', icon: 'pin' },
  ]

  return (
    <motion.header
      variants={staggerItem}
      className="relative flex flex-col gap-3.5 overflow-hidden rounded-[24px] bg-[linear-gradient(120deg,#2B5BE8_0%,#17338F_70%,#132A6B_100%)] px-[22px] py-[18px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_24px_44px_-22px_rgba(23,51,143,0.8)]"
    >
      <div aria-hidden="true" className="absolute -right-[60px] -top-[120px] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(34,195,214,0.45)_0%,rgba(34,195,214,0)_70%)]" />
      <div aria-hidden="true" className="absolute -bottom-[160px] left-[30%] h-[280px] w-[280px] rounded-full bg-[radial-gradient(circle,rgba(94,234,212,0.18)_0%,rgba(94,234,212,0)_70%)]" />

      <div className="relative flex flex-wrap items-center justify-between gap-3.5">
        <div className="flex items-center gap-3.5">
          <Link
            to="/patients"
            aria-label="Retour à la liste des patients"
            className="btn h-11 w-11 rounded-control bg-white/[0.12] px-0 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] hover:bg-white/[0.22]"
          >
            <Icon name="chevronLeft" size={18} strokeWidth={2.4} />
          </Link>
          <div
            aria-hidden="true"
            className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[linear-gradient(145deg,#5EEAD4,#22C3D6_45%,#3B6CF6)] text-[20px] font-extrabold shadow-[inset_0_2px_0_rgba(255,255,255,0.35),0_0_0_3px_rgba(255,255,255,0.18),0_12px_24px_-8px_rgba(0,0,0,0.5)]"
          >
            {initials(p.prenom, p.nom)}
          </div>
          <motion.div
            key={flash}
            initial={flash ? { backgroundColor: 'rgba(94,234,212,0.55)' } : false}
            animate={{ backgroundColor: 'rgba(94,234,212,0)' }}
            transition={{ duration: 1.4 }}
            className="rounded-control px-1.5 py-0.5"
          >
            <h1 className="text-[26px] font-extrabold tracking-[-0.01em]">{name}</h1>
            <p className="text-[14px] text-nav-soft">{bannerSubtitle(p, today)}</p>
          </motion.div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onEdit} className={glassButton}>
            <Icon name="edit" size={17} />
            Modifier la fiche
          </button>
          <button type="button" onClick={onToggleHistory} aria-expanded={historyOpen} className={glassButton}>
            <Icon name="history" size={17} />
            Historique
          </button>
          <Link to={`/factures?patient=${p.id}`} className={glassButton}>
            <Icon name="invoice" size={17} />
            Ses factures ({detail.invoiceCount})
          </Link>
        </div>
      </div>

      <div className="relative flex flex-wrap items-center gap-2">
        {chips.map((c) =>
          c.has ? (
            <span key={c.add} className={cn(chipBase, 'bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]')}>
              <Icon name={c.icon} size={14} strokeWidth={2.2} className="text-aqua-300" />
              {c.label}
            </span>
          ) : (
            <button
              key={c.add}
              type="button"
              onClick={onEdit}
              className={cn(
                chipBase,
                'min-h-[44px] gap-1.5 border border-dashed border-white/45 font-semibold text-[#DCE6FD] transition-colors hover:border-white/70 hover:bg-white/[0.14]',
              )}
            >
              <Icon name="plus" size={13} strokeWidth={2.6} />
              {c.add}
            </button>
          ),
        )}
        <span className="text-[13px] text-nav-muted">
          {p.sexe === 'F' ? 'Suivie' : 'Suivi'} depuis {oldest.slice(0, 4)} · {detail.seances.length} séance
          {detail.seances.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="relative flex flex-wrap items-center gap-2 border-t border-white/[0.12] pt-2.5">
        <span className="mr-1 text-[12px] font-extrabold uppercase tracking-[0.06em] text-nav-muted">Proches</span>
        {detail.relatives.map((r) => (
          <span key={r.patientId} className="inline-flex items-center rounded-pill bg-white/[0.12] pr-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <button
              type="button"
              onClick={() => onOpenRelative(r.patientId)}
              title={`Ouvrir la fiche de ${r.prenom} ${r.nom}`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-pill pl-1 pr-1.5 text-[13px] font-bold text-white hover:bg-white/10"
            >
              <span aria-hidden="true" className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(145deg,#5EEAD4,#3B6CF6)] text-[11px] font-extrabold">
                {initials(r.prenom, r.nom)}
              </span>
              {r.prenom} {r.nom}
              <span className="font-semibold text-nav-soft">· {relationLabel(r.relation).toLowerCase()}</span>
              <Icon name="chevronRight" size={12} strokeWidth={2.6} className="text-nav-muted" />
            </button>
          </span>
        ))}
        {detail.relatives.length === 0 && (
          <span className="text-[13px] text-nav-muted">Aucun proche lié · à ajouter depuis « Modifier la fiche »</span>
        )}
        {backTo && (
          <button
            type="button"
            onClick={onBack}
            className="pop ml-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-pill bg-[rgba(94,234,212,0.18)] px-3.5 text-[13px] font-bold text-aqua-50 hover:bg-[rgba(94,234,212,0.28)]"
          >
            <Icon name="chevronLeft" size={13} strokeWidth={2.6} />
            Revenir à {backTo.name}
          </button>
        )}
      </div>
    </motion.header>
  )
}
