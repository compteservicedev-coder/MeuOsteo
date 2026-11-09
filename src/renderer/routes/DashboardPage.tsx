import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { isBackupRecent } from '@shared/domain/backup'
import { formatIsoDateFr } from '@shared/domain/dates'
import { INVOICE_STATUS_LABELS, formatEuros, formatEurosShort } from '@shared/domain/invoice'
import { MONTHS_LONG } from '@shared/domain/planning'
import { evolutionLabel, type YearComparison } from '@shared/domain/revenue'
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
  const [years, setYears] = useState<YearComparison | null>(null)
  const load = useCallback(
    () =>
      void window.api.dashboard.get().then((v) => {
        setView(v)
        setYears(v.years)
      }),
    [],
  )
  useEffect(load, [load])
  const showYear = (year: number) => void window.api.dashboard.year(year).then(setYears)

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
  const max = Math.max(1, ...(years?.months.flatMap((r) => [r.cents, r.previousCents]) ?? [1]))
  const thisYear = Number(today.slice(0, 4))

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
          label="Chiffre d’affaires réalisé"
          value={formatEurosShort(Math.round(revenue) * 100)}
          sub={
            view
              ? view.monthPendingCents > 0
                ? `dont ${formatEurosShort(view.monthPendingCents)} en attente de virement`
                : 'Séances réalisées du mois'
              : ''
          }
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

      <div className="flex flex-wrap items-stretch gap-[18px]">
        <motion.section
          variants={staggerItem}
          aria-labelledby="h-ca"
          className="min-w-0 flex-[999_1_520px] rounded-card-lg border border-line-faint bg-white px-6 py-5 shadow-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="h-ca" className="text-section">
              Chiffre d’affaires {years ? `${years.year} vs ${years.year - 1}` : ''}
            </h2>
            {years && view && (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  aria-label="Année précédente"
                  disabled={years.year <= view.firstYear}
                  onClick={() => showYear(years.year - 1)}
                >
                  <Icon name="chevronLeft" size={16} />
                </Button>
                <Button
                  size="sm"
                  aria-label="Année suivante"
                  disabled={years.year >= thisYear}
                  onClick={() => showYear(years.year + 1)}
                >
                  <Icon name="chevronRight" size={16} />
                </Button>
              </div>
            )}
          </div>
          {years && <YearSummary years={years} />}
          <div className="mt-2 flex items-center gap-4 text-[12px] text-ink-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-[linear-gradient(180deg,#22C3D6,#1F4FD8)]" />
              {years?.year}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-[#CBD3E1]" />
              {years ? years.year - 1 : ''}
            </span>
            <span>· survolez un mois</span>
          </div>
          <div
            role="list"
            aria-label="Chiffre d’affaires par mois"
            className="mt-3 flex h-[210px] items-end gap-1.5"
          >
            {years?.months.map((r, i) => {
              const label = SHORT_MONTHS[r.month - 1]!
              const current = years.year === thisYear && i === month0
              const shown = hover === i || current
              return (
                <div
                  key={`${years.year}-${r.month}`}
                  role="listitem"
                  aria-label={`${label} ${years.year} : ${formatEurosShort(r.cents)} ; ${years.year - 1} : ${formatEurosShort(r.previousCents)}`}
                  className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  <span
                    className={cn(
                      'flex flex-col items-center text-[10px] font-bold tabular-nums leading-tight transition-opacity',
                      shown ? 'opacity-100' : 'opacity-0',
                    )}
                  >
                    <span className="text-ink-900">{formatEurosShort(r.cents)}</span>
                    <span className="text-ink-500">{formatEurosShort(r.previousCents)}</span>
                  </span>
                  <div className="flex w-full max-w-[44px] items-end justify-center gap-[3px]">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: Math.max(2, Math.round((r.previousCents / max) * 150)) }}
                      transition={{ duration: 0.6, delay: 0.2 + i * 0.04, ease: EASE_SOFT }}
                      className="w-1/2 rounded-[6px_6px_2px_2px] bg-[#CBD3E1]"
                    />
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{
                        height:
                          years.year === thisYear && i > month0
                            ? 0
                            : Math.max(2, Math.round((r.cents / max) * 150)),
                      }}
                      transition={{ duration: 0.6, delay: 0.25 + i * 0.04, ease: EASE_SOFT }}
                      className="w-1/2 rounded-[6px_6px_2px_2px] bg-[linear-gradient(180deg,#22C3D6,#1F4FD8)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                    />
                  </div>
                  <span
                    className={cn(
                      'text-[11px]',
                      current ? 'font-extrabold text-royal-700' : 'text-ink-500',
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
          className="flex min-w-0 flex-[1_1_320px] flex-col rounded-card-lg border border-line-faint bg-white px-5 py-5 shadow-card"
        >
          <h2 id="h-wait" className="text-section">
            Paiements en attente
            {pendingLeft.length > 0 && (
              <span className="ml-2 text-[13px] font-semibold text-ink-500">
                {pendingLeft.length}
              </span>
            )}
          </h2>
          {/* The list scrolls inside the card: the card keeps the height of the chart. */}
          <div className="relative mt-2 min-h-[240px] flex-1">
            <ul
              tabIndex={pendingLeft.length > 4 ? 0 : undefined}
              aria-label="Liste des paiements en attente"
              className="absolute inset-0 overflow-y-auto overscroll-contain rounded-control pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <AnimatePresence initial={false}>
                {pendingLeft.map((p) => (
                  <motion.li
                    key={p.seanceId}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.4, ease: EASE_SOFT }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-[#EDF0F6] py-3">
                      <Link
                        to={`/patients/${p.patientId}?seance=${p.seanceId}`}
                        className="min-w-0"
                      >
                        <span className="block truncate font-bold">{p.nom}</span>
                        <span className="block text-[13px] text-ink-500">
                          Séance du{' '}
                          {p.date.startsWith(today.slice(0, 4))
                            ? formatIsoDateFr(p.date).slice(0, 5)
                            : formatIsoDateFr(p.date)}{' '}
                          · {formatEurosShort(p.montantCents)} · virement
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
              {view && pendingLeft.length === 0 && (
                <li className="flex items-center gap-2 py-4 text-[14px] font-bold text-aqua-ink">
                  <Icon name="check" size={17} strokeWidth={3} />
                  Tout est réglé.
                </li>
              )}
            </ul>
          </div>
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

/** « 2026 au 24/10 : 28 400 € · 2025 à la même date : 25 100 € (+13 %) ». */
function YearSummary({ years: y }: { years: YearComparison }) {
  const now = y.toDate
  const cents = now ? now.cents : y.totalCents
  const previous = now ? now.previousCents : y.previousTotalCents
  const evolution = evolutionLabel(cents, previous)
  const until = now ? `${now.until.slice(3, 5)}/${now.until.slice(0, 2)}` : ''
  return (
    <p className="mt-1 text-[13px] text-ink-600">
      <b className="text-ink-900">
        {y.year}
        {now ? ` au ${until}` : ''} : {formatEurosShort(cents)}
      </b>{' '}
      · {y.year - 1}
      {now ? ' à la même date' : ''} : {formatEurosShort(previous)}
      {evolution && (
        <span
          className={cn(
            'ml-1.5 rounded-pill px-2 py-0.5 text-[12px] font-bold',
            cents >= previous ? 'bg-aqua-50 text-aqua-ink' : 'bg-amber-50 text-amber-ink',
          )}
        >
          {evolution}
        </span>
      )}
      {now && (
        <span className="text-ink-500">
          {' '}
          · {y.year - 1} sur l’année : {formatEurosShort(y.previousTotalCents)}
        </span>
      )}
    </p>
  )
}
