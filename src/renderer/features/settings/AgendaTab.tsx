import { useEffect, useState } from 'react'
import {
  WEEK_DAYS,
  WEEK_DAY_LABELS,
  type AgendaSettings,
  type WeekDay,
} from '@shared/domain/planning'
import { useToast } from '../../components/toast/toastContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input, Select } from '../../components/ui/Field'
import { Switch } from '../../components/ui/Switch'
import { cn } from '../../lib/cn'

/** Paramètres > Agenda (SPEC §8.4). */
export function AgendaTab() {
  const toast = useToast()
  const [saved, setSaved] = useState<AgendaSettings | null>(null)
  const [value, setValue] = useState<AgendaSettings | null>(null)

  useEffect(() => {
    void window.api.agenda.get().then((a) => {
      setSaved(a)
      setValue(a)
    })
  }, [])

  if (!value || !saved) return null
  const dirty = JSON.stringify(value) !== JSON.stringify(saved)
  const invalid = value.days.length === 0 || value.closing <= value.opening
  const toggleDay = (d: WeekDay) =>
    setValue({
      ...value,
      days: value.days.includes(d)
        ? value.days.filter((x) => x !== d)
        : WEEK_DAYS.filter((x) => x === d || value.days.includes(x)),
    })

  return (
    <Card title="Agenda" description="Affichage du planning et valeurs par défaut des séances">
      <div className="flex flex-col gap-2">
        <span id="l-days" className="text-label text-ink-600">
          Jours de consultation
        </span>
        <div role="group" aria-labelledby="l-days" className="flex flex-wrap gap-1.5">
          {WEEK_DAYS.map((d) => {
            const on = value.days.includes(d)
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDay(d)}
                className={cn(
                  'btn min-h-[44px] min-w-[64px] rounded-[11px] px-3 text-[14px]',
                  on
                    ? 'btn-primary pop'
                    : 'btn-ink border border-line-strong bg-white text-ink-600',
                )}
              >
                {WEEK_DAY_LABELS[d]}
              </button>
            )
          })}
        </div>
      </div>
      <div className="grid gap-3.5 sm:grid-cols-4">
        <Field label="Ouverture">
          <Input
            type="time"
            value={value.opening}
            onChange={(e) => setValue({ ...value, opening: e.target.value })}
          />
        </Field>
        <Field
          label="Fermeture"
          error={value.closing <= value.opening ? 'Après l’ouverture' : undefined}
        >
          <Input
            type="time"
            value={value.closing}
            onChange={(e) => setValue({ ...value, closing: e.target.value })}
          />
        </Field>
        <Field label="Durée d’une séance">
          <Select
            value={String(value.durationMinutes)}
            onChange={(e) =>
              setValue({ ...value, durationMinutes: Number(e.target.value) as 45 | 60 | 75 })
            }
          >
            <option value="45">45 min</option>
            <option value="60">1 h</option>
            <option value="75">1 h 15</option>
          </Select>
        </Field>
        <Field label="Planning affiché">
          <Select
            value={String(value.weeks)}
            onChange={(e) => setValue({ ...value, weeks: Number(e.target.value) as 1 | 2 })}
          >
            <option value="1">1 semaine</option>
            <option value="2">2 semaines</option>
          </Select>
        </Field>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-mist px-4 py-3">
        <span id="l-auto" className="text-[14px] font-semibold">
          Rattacher automatiquement les RDV quand nom, téléphone et e-mail concordent
        </span>
        <Switch
          aria-labelledby="l-auto"
          checked={value.autoAttach}
          onCheckedChange={(autoAttach) => setValue({ ...value, autoAttach })}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button disabled={!dirty} onClick={() => setValue(saved)}>
          Annuler
        </Button>
        <Button
          variant="primary"
          disabled={!dirty || invalid}
          onClick={async () => {
            const next = await window.api.agenda.save(value)
            setSaved(next)
            setValue(next)
            toast.show('Agenda enregistré')
          }}
        >
          Enregistrer
        </Button>
      </div>
    </Card>
  )
}
