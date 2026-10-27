import { useEffect, useState } from 'react'
import {
  BUDGET_PERIODS,
  formatPercentBp,
  parseAmountCents,
  parsePercentBp,
  type BudgetItem,
  type BudgetPeriod,
  type BudgetSettings,
} from '@shared/domain/bilan'
import { useToast } from '../../components/toast/toastContext'
import { Button } from '../../components/ui/Button'
import { Drawer } from '../../components/ui/Drawer'
import { Field, Input, Select } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'

interface RowDraft {
  id: string
  label: string
  amount: string
  period: BudgetPeriod
}

const toDraft = (i: BudgetItem): RowDraft => ({
  id: i.id,
  label: i.label,
  amount: (i.cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0 }).replace(/\s/g, ' '),
  period: i.period,
})

const PERIOD_LABELS: Record<BudgetPeriod, string> = { mensuel: 'par mois', annuel: 'par an' }

/** Parses the rows; returns the index of the first invalid one. */
function parseRows(
  rows: RowDraft[],
): { ok: true; items: BudgetItem[] } | { ok: false; at: number } {
  const items: BudgetItem[] = []
  for (const [i, r] of rows.entries()) {
    if (!r.label.trim() && !r.amount.trim()) continue
    const cents = parseAmountCents(r.amount)
    if (!r.label.trim() || cents === null) return { ok: false, at: i }
    items.push({ id: r.id, label: r.label.trim().slice(0, 80), cents, period: r.period })
  }
  return { ok: true, items }
}

function ItemsEditor({
  legend,
  hint,
  rows,
  onChange,
  invalidAt,
  addLabel,
}: {
  legend: string
  hint: string
  rows: RowDraft[]
  onChange: (rows: RowDraft[]) => void
  invalidAt: number | null
  addLabel: string
}) {
  const update = (i: number, patch: Partial<RowDraft>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-section">{legend}</legend>
      <p className="-mt-1 text-[13px] text-ink-500">{hint}</p>
      {rows.map((r, i) => (
        <div key={r.id} className="flex flex-wrap items-center gap-2">
          <Input
            aria-label={`${legend} : libellé`}
            placeholder="Libellé"
            value={r.label}
            maxLength={80}
            aria-invalid={invalidAt === i || undefined}
            onChange={(e) => update(i, { label: e.target.value })}
            className="min-w-[160px] flex-[2_1_200px]"
          />
          <Input
            aria-label={`${legend} : montant en euros`}
            placeholder="Montant €"
            inputMode="decimal"
            value={r.amount}
            aria-invalid={invalidAt === i || undefined}
            onChange={(e) => update(i, { amount: e.target.value })}
            className="w-[120px] flex-[0_0_120px] text-right tabular-nums"
          />
          <Select
            aria-label={`${legend} : périodicité`}
            value={r.period}
            onChange={(e) => update(i, { period: e.target.value as BudgetPeriod })}
            className="w-[120px] flex-[0_0_120px]"
          >
            {BUDGET_PERIODS.map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABELS[p]}
              </option>
            ))}
          </Select>
          <button
            type="button"
            aria-label={`Retirer ${r.label || 'la ligne'}`}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
            className="btn btn-ghost btn-ink h-11 w-11 px-0 text-ink-500 hover:text-red-ink"
          >
            <Icon name="trash" size={17} />
          </button>
        </div>
      ))}
      <div>
        <Button
          size="sm"
          variant="ghost"
          icon={<Icon name="plus" size={15} />}
          onClick={() =>
            onChange([
              ...rows,
              { id: crypto.randomUUID(), label: '', amount: '', period: 'mensuel' },
            ])
          }
        >
          {addLabel}
        </Button>
      </div>
    </fieldset>
  )
}

interface BudgetSettingsDrawerProps {
  open: boolean
  settings: BudgetSettings
  onClose: () => void
  onSaved: (settings: BudgetSettings) => void
}

/** R-27 « Réglages du calcul »: rates, fixed costs and provisions, common to every month. */
export function BudgetSettingsDrawer({
  open,
  settings,
  onClose,
  onSaved,
}: BudgetSettingsDrawerProps) {
  const toast = useToast()
  const [cotisations, setCotisations] = useState('')
  const [reserve, setReserve] = useState('')
  const [fixed, setFixed] = useState<RowDraft[]>([])
  const [provisions, setProvisions] = useState<RowDraft[]>([])
  const [errors, setErrors] = useState<{
    cotisations?: string
    reserve?: string
    fixed?: number
    provisions?: number
  }>({})

  useEffect(() => {
    if (!open) return
    setCotisations(formatPercentBp(settings.cotisationsBp))
    setReserve(formatPercentBp(settings.reserveBp))
    setFixed(settings.fixedCosts.map(toDraft))
    setProvisions(settings.provisions.map(toDraft))
    setErrors({})
  }, [open, settings])

  const save = async () => {
    const cotisationsBp = parsePercentBp(cotisations || '0')
    const reserveBp = parsePercentBp(reserve || '0')
    const f = parseRows(fixed)
    const p = parseRows(provisions)
    const next = {
      ...(cotisationsBp === null ? { cotisations: 'Un pourcentage entre 0 et 100' } : {}),
      ...(reserveBp === null ? { reserve: 'Un pourcentage entre 0 et 100' } : {}),
      ...(f.ok ? {} : { fixed: f.at }),
      ...(p.ok ? {} : { provisions: p.at }),
    }
    setErrors(next)
    if (cotisationsBp === null || reserveBp === null || !f.ok || !p.ok) {
      if (!f.ok || !p.ok) toast.show('Chaque ligne a besoin d’un libellé et d’un montant', 'error')
      return
    }
    const saved = await window.api.bilan.saveBudget({
      cotisationsBp,
      reserveBp,
      fixedCosts: f.items,
      provisions: p.items,
    })
    toast.show('Réglages du calcul enregistrés')
    onSaved(saved)
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Réglages du calcul"
      description="Communs à tous les mois. Les montants annuels sont ramenés au mois (÷ 12)."
      className="max-w-[680px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={() => void save()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-4">
          <Field
            label="Cotisations sociales (% du CA)"
            hint="Le taux de l’URSSAF ou de votre comptable"
            error={errors.cotisations}
            className="flex-[1_1_220px]"
          >
            <Input
              inputMode="decimal"
              value={cotisations}
              onChange={(e) => setCotisations(e.target.value)}
              placeholder="ex. 24,6"
            />
          </Field>
          <Field
            label="Réserve de sécurité (% du CA)"
            hint="Matelas mis de côté chaque mois, facultatif"
            error={errors.reserve}
            className="flex-[1_1_220px]"
          >
            <Input
              inputMode="decimal"
              value={reserve}
              onChange={(e) => setReserve(e.target.value)}
              placeholder="ex. 5"
            />
          </Field>
        </div>
        <ItemsEditor
          legend="Frais fixes"
          hint="Loyer, logiciel, téléphone, assurance RCP, expert-comptable… Les frais annuels sont épargnés chaque mois jusqu’à leur échéance."
          rows={fixed}
          onChange={setFixed}
          invalidAt={errors.fixed ?? null}
          addLabel="Ajouter un frais fixe"
        />
        <ItemsEditor
          legend="Provisions"
          hint="Sommes mises de côté pour plus tard : CFE, impôt, formation, renouvellement du matériel, congés…"
          rows={provisions}
          onChange={setProvisions}
          invalidAt={errors.provisions ?? null}
          addLabel="Ajouter une provision"
        />
      </div>
    </Drawer>
  )
}
