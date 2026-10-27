import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BILAN_MODES,
  BILAN_MODE_LABELS,
  DEFAULT_BUDGET,
  formatPercentBp,
  monthLabelFr,
  parseAmountCents,
  shiftMonth,
  type BilanMode,
  type BudgetSettings,
  type LineOverride,
} from '@shared/domain/bilan'
import { formatIsoDateFr } from '@shared/domain/dates'
import { formatEuros } from '@shared/domain/invoice'
import type { BilanView } from '@shared/types/bilan'
import { Page } from '../components/layout/Page'
import { PageHeader } from '../components/layout/PageHeader'
import { useToast } from '../components/toast/toastContext'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Field'
import { Icon } from '../components/ui/Icon'
import { BudgetSettingsDrawer } from '../features/bilan/BudgetSettingsDrawer'
import { cn } from '../lib/cn'
import { staggerItem } from '../lib/motion'
import { todayIso } from '../lib/today'

const card = 'rounded-card-lg border border-line-faint bg-white shadow-card'

function Row({
  label,
  cents,
  sign,
  strong,
  tone,
}: {
  label: string
  cents: number
  sign?: '+' | '−'
  strong?: boolean
  tone?: 'save' | 'salary' | 'deficit'
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-3 py-1.5 text-[14px]',
        strong && 'mt-1 rounded-xl px-3 py-2.5 text-[15px] font-extrabold',
        tone === 'save' && 'bg-royal-50 text-royal-700',
        tone === 'salary' && 'bg-aqua-50 text-aqua-ink',
        tone === 'deficit' && 'bg-red-50 text-red-ink',
        !strong && 'text-ink-600',
      )}
    >
      <span>{label}</span>
      <span className="whitespace-nowrap tabular-nums">
        {sign && cents > 0 ? `${sign} ` : ''}
        {formatEuros(cents)}
      </span>
    </div>
  )
}

/** R-27 · Bilan mensuel: encaissements du mois, récapitulatif, épargne et salaire. */
export function BilanPage() {
  const toast = useToast()
  const [month, setMonth] = useState(() => todayIso().slice(0, 7))
  const [view, setView] = useState<BilanView | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')

  const load = useCallback(() => void window.api.bilan.view(month).then(setView), [month])
  useEffect(load, [load])

  const setLine = async (seanceId: string, change: LineOverride) =>
    setView(await window.api.bilan.setLine(month, seanceId, change))

  const addExpense = async () => {
    const cents = parseAmountCents(amount)
    if (!label.trim() || cents === null || !view) {
      toast.show('Indiquez un libellé et un montant', 'error')
      return
    }
    setView(
      await window.api.bilan.setExceptional(month, [
        ...view.exceptional,
        { id: crypto.randomUUID(), label: label.trim().slice(0, 80), cents },
      ]),
    )
    setLabel('')
    setAmount('')
  }

  const exportXlsx = async () => {
    const r = await window.api.bilan.export(month)
    if (r.ok) toast.show('Bilan exporté')
    else if (r.reason === 'error') toast.show('Export impossible', 'error')
  }

  const budget: BudgetSettings = view?.budget ?? DEFAULT_BUDGET
  const r = view?.result
  const configured =
    budget.cotisationsBp > 0 || budget.fixedCosts.length > 0 || budget.provisions.length > 0
  const allIncluded = view ? view.lines.every((l) => l.included) : false

  return (
    <Page fill>
      <PageHeader
        title="Bilan mensuel"
        subtitle="Les séances encaissées dans le mois, à cocher, puis ce qu’il faut garder et ce que vous pouvez vous verser."
        actions={
          <>
            <div className="flex items-center gap-1 rounded-control bg-white p-1 shadow-card">
              <button
                type="button"
                aria-label="Mois précédent"
                onClick={() => setMonth((m) => shiftMonth(m, -1))}
                className="btn btn-ghost btn-ink h-11 w-11 px-0"
              >
                <Icon name="chevronLeft" size={18} />
              </button>
              <span
                aria-live="polite"
                className="min-w-[150px] text-center text-[15px] font-extrabold first-letter:uppercase"
              >
                {monthLabelFr(month)}
              </span>
              <button
                type="button"
                aria-label="Mois suivant"
                onClick={() => setMonth((m) => shiftMonth(m, 1))}
                className="btn btn-ghost btn-ink h-11 w-11 px-0"
              >
                <Icon name="chevronRight" size={18} />
              </button>
            </div>
            <Button icon={<Icon name="settings" size={16} />} onClick={() => setSettingsOpen(true)}>
              Réglages du calcul
            </Button>
            <Button
              variant="primary"
              icon={<Icon name="download" size={16} />}
              onClick={() => void exportXlsx()}
            >
              Exporter (Excel)
            </Button>
          </>
        }
      />

      <motion.div
        variants={staggerItem}
        className="flex flex-wrap items-stretch gap-[18px] lg:min-h-0 lg:flex-1 lg:flex-nowrap"
      >
        <section
          aria-labelledby="h-encaissements"
          className={cn(card, 'flex min-w-0 flex-[999_1_560px] flex-col lg:min-h-0')}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 id="h-encaissements" className="text-section">
                Encaissements du mois
              </h2>
              <p className="text-[13px] text-ink-500">
                {view
                  ? `${view.includedCount} séance${view.includedCount > 1 ? 's' : ''} retenue${view.includedCount > 1 ? 's' : ''} sur ${view.lines.length} · ${formatEuros(view.revenueCents)}`
                  : ' '}
              </p>
            </div>
            {view && view.lines.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void window.api.bilan.setAll(month, !allIncluded).then(setView)}
              >
                {allIncluded ? 'Tout décocher' : 'Tout cocher'}
              </Button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-auto lg:overflow-y-auto">
            {view?.lines.length === 0 && (
              <p className="px-5 py-10 text-center text-[15px] text-ink-500">
                Aucune séance encaissée en {monthLabelFr(month)}.
              </p>
            )}
            {view && view.lines.length > 0 && (
              <table className="w-full border-collapse text-[14px]">
                <thead className="sticky top-0 z-[1] bg-white">
                  <tr className="text-left text-[12px] font-extrabold uppercase tracking-[0.05em] text-ink-500">
                    <th scope="col" className="w-[52px] px-4 py-2.5">
                      <span className="sr-only">Retenue</span>
                    </th>
                    <th scope="col" className="px-2 py-2.5">
                      Encaissée le
                    </th>
                    <th scope="col" className="px-2 py-2.5">
                      Patient
                    </th>
                    <th scope="col" className="px-2 py-2.5">
                      Moyen de paiement
                    </th>
                    <th scope="col" className="px-2 py-2.5 text-right">
                      Montant
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Facture
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {view.lines.map((l) => (
                    <tr
                      key={l.seanceId}
                      className={cn(
                        'border-t border-line transition-colors',
                        !l.included && 'bg-surface-mist text-ink-500',
                      )}
                    >
                      <td className="px-4 py-1.5">
                        <label className="relative flex h-11 w-11 cursor-pointer items-center justify-center">
                          <input
                            type="checkbox"
                            checked={l.included}
                            onChange={(e) =>
                              void setLine(l.seanceId, { included: e.target.checked })
                            }
                            className="h-5 w-5 accent-royal-600"
                          />
                          <span className="sr-only">
                            Compter la séance de {l.patientNom} du {formatIsoDateFr(l.date)}
                          </span>
                        </label>
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">
                        {l.encaisseLe ? (
                          formatIsoDateFr(l.encaisseLe)
                        ) : (
                          <Badge tone="warning">En attente</Badge>
                        )}
                        {l.encaisseLe && l.encaisseLe !== l.date && (
                          <span className="block text-[12px] text-ink-500">
                            séance du {formatIsoDateFr(l.date)}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <Link
                          to={`/patients/${l.patientId}?seance=${l.seanceId}`}
                          className="font-bold text-ink-900 hover:text-royal-700 hover:underline"
                        >
                          {l.patientNom}
                        </Link>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <Select
                            aria-label={`Moyen de paiement de ${l.patientNom}`}
                            value={l.mode}
                            onChange={(e) =>
                              void setLine(l.seanceId, { mode: e.target.value as BilanMode })
                            }
                            className="h-11 min-w-[150px] py-0 text-[14px]"
                          >
                            {BILAN_MODES.map((m) => (
                              <option key={m} value={m}>
                                {BILAN_MODE_LABELS[m]}
                              </option>
                            ))}
                          </Select>
                          {l.modeChanged && (
                            <span
                              className="text-[12px] font-bold text-royal-700"
                              title="Corrigé dans ce bilan seulement : la séance n’est pas modifiée"
                            >
                              corrigé
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right font-bold tabular-nums">
                        {formatEuros(l.montantCents)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-1.5 text-ink-500">
                        {l.numero ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-[18px] lg:min-h-0 lg:flex-[0_0_clamp(360px,30vw,460px)] lg:overflow-y-auto">
          <section aria-labelledby="h-recap" className={cn(card, 'px-5 py-4')}>
            <h2 id="h-recap" className="text-section">
              Par moyen de paiement
            </h2>
            <div className="mt-2 flex flex-col">
              {view?.recap.map((m) => (
                <div
                  key={m.mode}
                  className="flex items-baseline justify-between border-b border-line py-2 text-[14px] last:border-0"
                >
                  <span className="text-ink-600">
                    {BILAN_MODE_LABELS[m.mode]} <span className="text-ink-500">· {m.count}</span>
                  </span>
                  <span className="font-bold tabular-nums">{formatEuros(m.cents)}</span>
                </div>
              ))}
              <div className="flex items-baseline justify-between pt-2 text-[15px] font-extrabold">
                <span>Total retenu</span>
                <span className="tabular-nums">{formatEuros(view?.revenueCents ?? 0)}</span>
              </div>
            </div>
          </section>

          <section aria-labelledby="h-calcul" className={cn(card, 'px-5 py-4')}>
            <div className="flex items-center justify-between gap-2">
              <h2 id="h-calcul" className="text-section">
                Épargne & salaire
              </h2>
              {!configured && (
                <Button size="sm" variant="ghost" onClick={() => setSettingsOpen(true)}>
                  Saisir mes frais
                </Button>
              )}
            </div>
            {r && (
              <div className="mt-2 flex flex-col">
                <Row label="Chiffre d’affaires retenu" cents={r.revenueCents} />
                <Row
                  label={`Cotisations (${formatPercentBp(budget.cotisationsBp)} %)`}
                  cents={r.cotisationsCents}
                  sign="−"
                />
                {budget.reserveBp > 0 && (
                  <Row
                    label={`Réserve de sécurité (${formatPercentBp(budget.reserveBp)} %)`}
                    cents={r.reserveCents}
                    sign="−"
                  />
                )}
                <Row
                  label="Frais annuels (1/12 mis de côté)"
                  cents={r.fixedAnnualShareCents}
                  sign="−"
                />
                <Row label="Provisions du mois" cents={r.provisionsCents} sign="−" />
                <Row label="À garder sur le compte pro" cents={r.toSaveCents} strong tone="save" />
                <Row label="Frais fixes mensuels" cents={r.fixedMonthlyCents} sign="−" />
                <Row label="Dépenses exceptionnelles" cents={r.exceptionalCents} sign="−" />
                {r.deficitCents > 0 ? (
                  <Row
                    label="Mois non couvert : il manque"
                    cents={r.deficitCents}
                    strong
                    tone="deficit"
                  />
                ) : (
                  <Row label="Salaire possible" cents={r.salaryCents} strong tone="salary" />
                )}
              </div>
            )}
          </section>

          <section aria-labelledby="h-depenses" className={cn(card, 'px-5 py-4')}>
            <h2 id="h-depenses" className="text-section">
              Dépenses exceptionnelles du mois
            </h2>
            <p className="text-[13px] text-ink-500">Achat de matériel, réparation, formation…</p>
            <ul className="mt-2 flex flex-col">
              {view?.exceptional.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-2 border-b border-line py-1 text-[14px]"
                >
                  <span className="min-w-0 truncate">{e.label}</span>
                  <span className="flex items-center gap-1">
                    <span className="font-bold tabular-nums">{formatEuros(e.cents)}</span>
                    <button
                      type="button"
                      aria-label={`Retirer ${e.label}`}
                      onClick={() =>
                        void window.api.bilan
                          .setExceptional(
                            month,
                            view.exceptional.filter((x) => x.id !== e.id),
                          )
                          .then(setView)
                      }
                      className="btn btn-ghost btn-ink h-11 w-11 px-0 text-ink-500 hover:text-red-ink"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <form
              className="mt-3 flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void addExpense()
              }}
            >
              <Input
                aria-label="Libellé de la dépense"
                placeholder="Libellé"
                value={label}
                maxLength={80}
                onChange={(e) => setLabel(e.target.value)}
                className="min-w-0 flex-[2_1_140px]"
              />
              <Input
                aria-label="Montant de la dépense en euros"
                placeholder="Montant €"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-[110px] flex-[0_0_110px] text-right"
              />
              <Button type="submit" size="sm" icon={<Icon name="plus" size={15} />}>
                Ajouter
              </Button>
            </form>
          </section>
        </div>
      </motion.div>

      <BudgetSettingsDrawer
        open={settingsOpen}
        settings={budget}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => {
          setSettingsOpen(false)
          load()
        }}
      />
    </Page>
  )
}
