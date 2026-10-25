import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { isBackupRecent } from '@shared/domain/backup'
import { formatIsoDateFr } from '@shared/domain/dates'
import { INVOICE_STATUS_LABELS, formatEuros, formatEurosShort } from '@shared/domain/invoice'
import { MONTHS_LONG } from '@shared/domain/planning'
import type { DashboardView } from '@shared/types/pilotage'
import { Page } from '../components/layout/Page'
import { PageHeader } from '../components/layout/PageHeader'
import { notifyDataChanged } from '../lib/dataEvents'
import { useToast } from '../components/toast/toastContext'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { useCountUp } from '../hooks/useCountUp'
import { cn } from '../lib/cn'
import { EASE_SOFT, staggerItem } from '../lib/motion'
import { todayIso } from '../lib/today'

const SHORT_MONTHS = [
  'Janv.',
  'Févr.',
  'Mars',
  'Avr.',
  'Mai',
  'Juin',
  'Juil.',
  'Août',
  'Sept.',
  'Oct.',
  'Nov.',
  'Déc.',
]
const BADGE = {
  ok: 'bg-aqua-50 text-aqua-ink',
  wait: 'bg-amber-50 text-amber-ink',
  cancel: 'bg-red-50 text-red-ink',
} as const

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub: string
  tone?: 'amber'
}) {
  return (
    <motion.div
      variants={staggerItem}
      className="flex flex-col gap-1 rounded-card-lg border border-line-faint bg-white px-5 py-[18px] shadow-card"
    >
      <span className="text-[13px] font-semibold text-ink-500">{label}</span>
      <span
        className={cn(
          'text-[30px] font-extrabold tabular-nums',
          tone === 'amber' ? 'text-amber-ink' : 'text-ink-900',
        )}
      >
        {value}
      </span>
      <span className="text-[13px] text-ink-500">{sub}</span>
    </motion.div>
  )
}

/** Tableau de bord (SPEC §7). */
export function DashboardPage() {
  const toast = useToast()
  const [view, setView] = useState<DashboardView | null>(null)
  const [paid, setPaid] = useState<Set<string>>(new Set())
  const [hover, setHover] = useState<number | null>(null)
  const load = useCallback(() => void window.api.dashboard.get().then(setView), [])
  useEffect(load, [load])

  const m = view?.month
  const seances = useCountUp(m?.seances ?? 0)
  const revenue = useCountUp((m?.revenueCents ?? 0) / 100)
  const news = useCountUp(m?.newPatients ?? 0)
  const pendingLeft = view?.pending.filter((p) => !paid.has(p.seanceId)) ?? []
  const pendingTotal = useCountUp(pendingLeft.reduce((n, p) => n + p.montantCents, 0) / 100)
  const today = todayIso()
  const month0 = Number(today.slice(5, 7)) - 1
  const prevName = MONTHS_LONG[(month0 + 11) % 12]!.toLowerCase()
  const diff = m ? m.seances - m.previousSeances : 0
  const max = Math.max(1, ...(view?.revenueByMonth.map((r) => r.cents) ?? [1]))

  return (
    <Page>
      <PageHeader
        title="Tableau de bord"
        subtitle={`${MONTHS_LONG[month0]} ${today.slice(0, 4)}`}
      />

      {view && !isBackupRecent(view.lastBackupAt, new Date()) && (
        <motion.div
          variants={staggerItem}
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E9C9A0] bg-[linear-gradient(180deg,#FFF6EA,#FBE8CF)] px-4 py-3 text-[14px] text-[#5A3205]"
        >
          <span className="flex items-center gap-2 font-semibold">
            <Icon name="alert" size={17} />
            {view.lastBackupAt
              ? `Aucune sauvegarde depuis le ${formatIsoDateFr(view.lastBackupAt.slice(0, 10))}.`
              : 'Aucune sauvegarde pour l’instant.'}{' '}
            Une copie est faite à chaque fermeture de l’application.
          </span>
          <Button
            size="sm"
            onClick={async () => {
              const r = await window.api.backup.run()
              notifyDataChanged()
              toast.show(
                r.ok ? 'Sauvegarde effectuée' : 'Sauvegarde impossible : vérifiez le dossier',
                r.ok ? 'success' : 'error',
              )
              load()
            }}
          >
            Sauvegarder maintenant
          </Button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Séances ce mois"
          value={String(Math.round(seances))}
          sub={m ? `${diff >= 0 ? '+' : '−'}${Math.abs(diff)} vs ${prevName}` : ''}
        />
        <Kpi
          label="Chiffre d’affaires"
          value={formatEurosShort(Math.round(revenue) * 100)}
          sub={view ? `Année : ${formatEurosShort(view.yearRevenueCents)}` : ''}
        />
        <Kpi
          label="Nouveaux patients"
          value={String(Math.round(news))}
          sub={m ? `${m.totalPatients} au total` : ''}
        />
        <Kpi
          label="En attente de paiement"
          value={formatEurosShort(Math.round(pendingTotal) * 100)}
          sub={`${pendingLeft.length} séance(s)`}
          tone={pendingLeft.length > 0 ? 'amber' : undefined}
        />
      </div>

      <div className="flex flex-wrap items-start gap-[18px]">
        <motion.section
          variants={staggerItem}
          aria-labelledby="h-ca"
          className="min-w-0 flex-[999_1_520px] rounded-card-lg border border-line-faint bg-white px-6 py-5 shadow-card"
        >
          <h2 id="h-ca" className="text-section">
            Chiffre d’affaires mensuel
          </h2>
          <p className="text-[13px] text-ink-500">12 derniers mois · survolez une barre</p>
          <div
            role="list"
            aria-label="Chiffre d’affaires par mois"
            className="mt-5 flex h-[230px] items-end gap-2"
          >
            {view?.revenueByMonth.map((r, i) => {
              const last = i === view.revenueByMonth.length - 1
              const label = SHORT_MONTHS[Number(r.month.slice(5, 7)) - 1]!
              return (
                <div
                  key={r.month}
                  role="listitem"
                  aria-label={`${label} ${r.month.slice(0, 4)} : ${formatEurosShort(r.cents)}`}
                  className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  <span
                    className={cn(
                      'text-[11px] font-bold tabular-nums transition-opacity',
                      last || hover === i ? 'text-ink-900 opacity-100' : 'opacity-0',
                    )}
                  >
                    {formatEurosShort(r.cents)}
                  </span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: Math.max(3, Math.round((r.cents / max) * 180)) }}
                    transition={{ duration: 0.7, delay: 0.25 + i * 0.05, ease: EASE_SOFT }}
                    className={cn(
                      'w-full max-w-[40px] rounded-[8px_8px_3px_3px]',
                      last
                        ? 'bg-[linear-gradient(180deg,#22C3D6,#1F4FD8)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_18px_-8px_rgba(31,79,216,0.8)]'
                        : 'bg-[linear-gradient(180deg,#B5EDE4,#6FD6C6)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]',
                    )}
                  />
                  <span
                    className={cn(
                      'text-[11px]',
                      last ? 'font-extrabold text-royal-700' : 'text-ink-500',
                    )}
                  >
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
        </motion.section>

        <motion.section
          variants={staggerItem}
          aria-labelledby="h-wait"
          className="min-w-0 flex-[1_1_320px] rounded-card-lg border border-line-faint bg-white px-5 py-5 shadow-card"
        >
          <h2 id="h-wait" className="text-section">
            Paiements en attente
          </h2>
          <ul className="mt-2">
            <AnimatePresence initial={false}>
              {pendingLeft.map((p) => (
                <motion.li
                  key={p.seanceId}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.4, ease: EASE_SOFT }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-[#EDF0F6] py-3">
                    <Link to={`/patients/${p.patientId}?seance=${p.seanceId}`} className="min-w-0">
                      <span className="block truncate font-bold">{p.nom}</span>
                      <span className="block text-[13px] text-ink-500">
                        Séance du {formatIsoDateFr(p.date).slice(0, 5)} ·{' '}
                        {formatEurosShort(p.montantCents)} · virement
                        {p.numero ? ` · facture ${p.numero}` : ''}
                      </span>
                    </Link>
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (await window.api.dashboard.markReceived(p.seanceId)) {
                          setPaid((s) => new Set(s).add(p.seanceId))
                          toast.show(`Virement de ${p.nom} reçu`)
                        }
                      }}
                    >
                      Marquer reçu
                    </Button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {view && pendingLeft.length === 0 && (
            <p className="flex items-center gap-2 py-4 text-[14px] font-bold text-aqua-ink">
              <Icon name="check" size={17} strokeWidth={3} />
              Tout est réglé.
            </p>
          )}
        </motion.section>
      </div>

      <motion.section
        variants={staggerItem}
        aria-labelledby="h-last"
        className="rounded-card-lg border border-line-faint bg-white px-5 py-5 shadow-card"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="h-last" className="text-section">
            Dernières factures
          </h2>
          <Link
            to="/factures"
            className="text-[14px] font-bold text-royal-600 hover:text-royal-700"
          >
            Toutes les factures →
          </Link>
        </div>
        <ul className="mt-2">
          {view?.lastInvoices.map((f) => (
            <li key={f.id}>
              <Link
                to={`/factures?facture=${f.id}`}
                className="grid min-h-[48px] grid-cols-[1fr_1fr_2fr_1fr_1fr] items-center gap-3 rounded-control px-2 text-[14px] hover:bg-surface-hover"
              >
                <span className="font-bold tabular-nums">{f.numero}</span>
                <span className="text-ink-600">{formatIsoDateFr(f.dateEmission)}</span>
                <span className="truncate font-semibold">{f.patientNom}</span>
                <span className="text-right font-bold tabular-nums">
                  {formatEuros(f.montantCents)}
                </span>
                <span>
                  <span
                    className={cn(
                      'rounded-pill px-2.5 py-0.5 text-[12px] font-bold',
                      BADGE[f.statusKey],
                    )}
                  >
                    {INVOICE_STATUS_LABELS[f.statusKey]}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          {view && view.lastInvoices.length === 0 && (
            <li className="py-3 text-[14px] text-ink-500">Aucune facture pour le moment.</li>
          )}
        </ul>
      </motion.section>
    </Page>
  )
}
