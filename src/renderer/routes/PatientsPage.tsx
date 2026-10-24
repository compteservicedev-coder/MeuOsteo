import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { formatIsoDateFr, formatLongDateFr } from '@shared/domain/dates'
import { ageLabel, formatPhone } from '@shared/domain/patient'
import { parseSearchQuery, professionMatches } from '@shared/domain/search'
import type { PatientListItem, TodayAppointment } from '@shared/types/patients'
import { Page } from '../components/layout/Page'
import { useToast } from '../components/toast/toastContext'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { PatientEditDrawer } from '../features/patients/PatientEditDrawer'
import { cn } from '../lib/cn'
import { staggerItem } from '../lib/motion'
import { todayIso } from '../lib/today'

const COLUMNS = 'grid grid-cols-[2fr_0.7fr_1.4fr_1.4fr_1.2fr] gap-3'

/** « Camille Roux » typed in the search box prefills the new record. */
function nameFromQuery(q: string): { nom: string; prenom: string } {
  const words = q.trim().split(/\s+/).filter((w) => !/\d/.test(w))
  if (words.length === 0) return { nom: '', prenom: '' }
  if (words.length === 1) return { nom: words[0]!, prenom: '' }
  return { prenom: words[0]!, nom: words.slice(1).join(' ') }
}

export function PatientsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ items: PatientListItem[]; truncated: boolean } | null>(null)
  const [recent, setRecent] = useState<PatientListItem[]>([])
  const [today, setToday] = useState<TodayAppointment[]>([])
  const [count, setCount] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const requestId = useRef(0)
  const todayDate = todayIso()

  useEffect(() => {
    void window.api.patients.recent().then(setRecent)
    void window.api.patients.today().then(setToday)
    void window.api.patients.count().then(setCount)
  }, [])

  // Ctrl+K (from any screen) lands here with the focus in the search box.
  const focusSignal = (location.state as { focusSearch?: number } | null)?.focusSearch
  useEffect(() => {
    searchRef.current?.focus()
  }, [focusSignal])

  // Live filtering; answers that arrive late are ignored.
  useEffect(() => {
    const id = ++requestId.current
    if (!query.trim()) {
      setResults(null)
      return
    }
    void window.api.patients.search(query).then((r) => {
      if (id === requestId.current) setResults(r)
    })
  }, [query])

  const parsed = parseSearchQuery(query)
  const rows = results ? results.items : recent
  const searching = results !== null
  const listTitle = searching ? 'Résultats' : 'Consultés récemment'

  return (
    <Page>
      <motion.div
        variants={staggerItem}
        className="relative overflow-hidden rounded-[24px] bg-hero px-[30px] pb-[78px] pt-7 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_24px_44px_-20px_rgba(23,51,143,0.75)]"
      >
        <div aria-hidden="true" className="absolute -right-[70px] -top-[110px] h-[300px] w-[300px] rounded-full bg-white/[0.07]" />
        <div aria-hidden="true" className="absolute -bottom-[140px] right-[120px] h-[240px] w-[240px] rounded-full bg-white/[0.05]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[14px] text-nav-soft">{formatLongDateFr(new Date())}</p>
            <h1 className="mt-1 text-[30px] font-extrabold tracking-[-0.01em]">Patients</h1>
            <p className="mt-1.5 text-[15px] text-[#DCE6FD]">
              {today.length === 0
                ? 'Aucun rendez-vous aujourd’hui'
                : `${today.length} rendez-vous aujourd’hui`}
              {count !== null && ` · ${count} patient${count > 1 ? 's' : ''} suivi${count > 1 ? 's' : ''}`}
            </p>
          </div>
          <Button
            size="lg"
            icon={<Icon name="plus" size={18} strokeWidth={2.4} />}
            className="!min-h-[48px] !rounded-[14px] !px-5 !text-[15px] !text-royal-700"
            onClick={() => setCreating(true)}
          >
            Nouveau patient
          </Button>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="relative mx-[22px] -mt-[66px] flex flex-col gap-2">
        <label htmlFor="patient-search" className="pl-1 text-label text-[#DCE6FD]">
          Rechercher un patient
        </label>
        <div className="flex min-h-[60px] items-center gap-3 rounded-2xl border border-line-faint bg-white px-[18px] shadow-[0_2px_4px_rgba(15,30,70,0.05),0_22px_44px_-22px_rgba(15,30,70,0.45)] transition-shadow focus-within:border-royal-600 focus-within:shadow-[0_0_0_4px_rgba(31,79,216,0.18),0_24px_50px_-20px_rgba(15,30,70,0.45)]">
          <Icon name="search" size={22} strokeWidth={2.2} className="shrink-0 text-royal-600" />
          <input
            ref={searchRef}
            id="patient-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom, prénom, téléphone, commune ou métier…"
            autoComplete="off"
            className="min-w-0 grow bg-transparent text-[17px] text-ink-900 outline-none placeholder:text-ink-500"
          />
          <kbd className="rounded-lg bg-surface-rail px-2 py-1 text-[12px] font-semibold text-ink-500 shadow-[inset_0_-1px_0_rgba(15,30,70,0.1)]">
            Ctrl K
          </kbd>
        </div>
      </motion.div>

      <div className="flex flex-wrap items-start gap-[22px]">
        <motion.section
          variants={staggerItem}
          aria-labelledby="h-res"
          className="min-w-0 flex-[999_1_480px] overflow-hidden rounded-card border border-line-faint bg-white shadow-card"
        >
          <div className="flex items-center justify-between border-b border-[#EDF0F6] px-[22px] py-[18px]">
            <h2 id="h-res" className="text-[16px] font-bold">
              {listTitle}
            </h2>
            <span className="rounded-pill bg-royal-50 px-2.5 py-1 text-[13px] font-semibold text-royal-700" aria-live="polite">
              {searching && results?.truncated ? `${rows.length}+ résultats` : `${rows.length} résultat(s)`}
            </span>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[560px] px-2 pb-2.5 pt-1.5">
              <div className={cn(COLUMNS, 'px-3.5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-500')} aria-hidden="true">
                <span>Patient</span>
                <span>Âge</span>
                <span>Commune</span>
                <span>Portable</span>
                <span>Dernière séance</span>
              </div>
              <ul aria-label={listTitle}>
                {rows.map((p) => {
                  const highlight = professionMatches(p.profession, parsed)
                  return (
                    <li key={p.id}>
                      <Link
                        to={`/patients/${p.id}`}
                        className={cn(
                          COLUMNS,
                          'min-h-[56px] items-center rounded-control px-3.5 text-[15px] text-ink-900 transition-[background,transform] duration-200 hover:translate-x-1 hover:bg-surface-hover',
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <Avatar prenom={p.prenom} nom={p.nom} />
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate font-semibold">
                              {p.prenom} {p.nom}
                            </span>
                            {p.profession && (
                              <span
                                className={cn(
                                  'self-start truncate text-[12px]',
                                  highlight ? 'rounded-md bg-royal-50 px-1.5 font-bold text-royal-700' : 'text-ink-500',
                                )}
                              >
                                {p.profession}
                              </span>
                            )}
                          </span>
                        </span>
                        <span className="text-ink-600">{ageLabel(p.ddn, todayDate)}</span>
                        <span className="truncate text-ink-600">{p.commune ?? '—'}</span>
                        <span className="text-ink-600">{p.portable ? formatPhone(p.portable) : '—'}</span>
                        <span className="text-ink-600">{p.lastSeance ? formatIsoDateFr(p.lastSeance) : '—'}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
              {searching && rows.length === 0 && (
                <p className="px-3.5 py-7 text-[15px] text-ink-500">
                  Aucun patient trouvé.{' '}
                  <button type="button" className="font-semibold text-royal-600 underline-offset-2 hover:underline" onClick={() => setCreating(true)}>
                    Créer une fiche
                  </button>
                </p>
              )}
              {!searching && rows.length === 0 && (
                <p className="px-3.5 py-7 text-[15px] text-ink-500">
                  Les fiches que vous ouvrez apparaîtront ici. Recherchez un patient pour commencer.
                </p>
              )}
            </div>
          </div>
        </motion.section>

        <motion.section
          variants={staggerItem}
          aria-labelledby="h-today"
          className="min-w-0 flex-[1_1_300px] overflow-hidden rounded-card border border-line-faint bg-white shadow-card"
        >
          <div className="flex items-center justify-between border-b border-[#EDF0F6] px-[22px] py-[18px]">
            <h2 id="h-today" className="text-[16px] font-bold">
              Aujourd’hui
            </h2>
            <Link to="/planning" className="text-[13px] font-bold text-royal-600 hover:text-royal-700">
              Planning →
            </Link>
          </div>
          <ul className="flex flex-col gap-1 px-2.5 pb-1 pt-2">
            {today.map((r) => (
              <li key={r.seanceId}>
                <Link
                  to={`/patients/${r.patientId}?seance=${r.seanceId}`}
                  className="flex min-h-[62px] items-center gap-3.5 rounded-2xl px-3 py-2 text-ink-900 transition-[background,transform] duration-200 hover:translate-x-1 hover:bg-surface-hover"
                >
                  <span className="flex h-11 w-[54px] shrink-0 items-center justify-center rounded-control bg-[linear-gradient(180deg,#F3F7FC,#E6EDF7)] text-[14px] font-extrabold text-royal-700 shadow-[inset_0_1px_0_#FFFFFF,0_2px_6px_-2px_rgba(15,30,70,0.2)]">
                    {r.heure ?? '—'}
                  </span>
                  <span className="flex min-w-0 grow flex-col gap-0.5">
                    <span className="truncate text-[15px] font-semibold">
                      {r.prenom} {r.nom}
                    </span>
                    <span className="truncate text-[13px] text-ink-500">{r.motif ?? 'Motif à saisir'}</span>
                  </span>
                  {r.isNew && (
                    <span className="rounded-pill bg-[linear-gradient(180deg,#FFF6EA,#FBE8CF)] px-2.5 py-1 text-[12px] font-bold text-amber-ink">
                      Nouveau
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          {today.length === 0 && (
            <p className="px-[22px] pb-5 pt-1 text-[14px] text-ink-500">Aucun rendez-vous aujourd’hui.</p>
          )}
          <div className="h-3" />
        </motion.section>
      </div>

      <PatientEditDrawer
        open={creating}
        onClose={() => setCreating(false)}
        detail={null}
        initial={nameFromQuery(query)}
        onSaved={(id) => {
          setCreating(false)
          toast.show('Fiche patient créée')
          navigate(`/patients/${id}`)
        }}
        onOpenExisting={(id) => {
          setCreating(false)
          navigate(`/patients/${id}`)
        }}
      />
    </Page>
  )
}
