import { useEffect, useRef, useState } from 'react'
import { formatIsoDateFr } from '@shared/domain/dates'
import { ageLabel } from '@shared/domain/patient'
import { EMPTY_PATIENT_DRAFT, type PatientErrors } from '@shared/domain/patientValidation'
import type { NewRdvError } from '@shared/domain/planning'
import type { PatientListItem } from '@shared/types/patients'
import type { DaySlots } from '@shared/types/planning'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Field, Input } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'
import { cn } from '../../lib/cn'
import { todayIso } from '../../lib/today'

const MESSAGES: Record<NewRdvError, string> = {
  patient: 'Choisissez un patient',
  date: 'Choisissez une date',
  past: 'La date est passée',
  closed: 'Le cabinet est fermé ce jour-là',
  heure: 'Choisissez une heure',
  slot: 'Créneau indisponible',
  same_day: 'a déjà un RDV ce jour-là : une seule séance par patient et par jour.',
}

interface NewRdvDialogProps {
  /** Date proposed when the window opens, `null` when closed. */
  date: string | null
  onClose: () => void
  onCreated: (r: { seanceId: string; date: string; heure: string; nom: string }) => void
}

/** « Nouveau rendez-vous » (SPEC §3, R-24): a manual session. */
export function NewRdvDialog({ date, onClose, onCreated }: NewRdvDialogProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PatientListItem[]>([])
  const [patient, setPatient] = useState<{ id: string; nom: string } | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({ nom: '', prenom: '', ddn: '' })
  const [draftErrors, setDraftErrors] = useState<PatientErrors>({})
  const [day, setDay] = useState('')
  const [heure, setHeure] = useState('')
  const [motif, setMotif] = useState('')
  const [slots, setSlots] = useState<DaySlots | null>(null)
  const [errors, setErrors] = useState<NewRdvError[]>([])
  const [shake, setShake] = useState(0)
  const [busy, setBusy] = useState(false)
  const req = useRef(0)

  useEffect(() => {
    if (date === null) return
    setQuery('')
    setPatient(null)
    setCreating(false)
    setDay(date)
    setHeure('')
    setMotif('')
    setErrors([])
  }, [date])

  useEffect(() => {
    const id = ++req.current
    const run = query.trim()
      ? window.api.patients.search(query).then((r) => r.items)
      : window.api.patients.recent()
    void run.then((items) => id === req.current && setResults(items.slice(0, 6)))
  }, [query])

  // A corrected field drops its message.
  useEffect(() => setErrors([]), [patient, day, heure])

  useEffect(() => {
    if (!day) {
      setSlots(null)
      return
    }
    void window.api.planning.daySlots(day, patient?.id ?? null).then(setSlots)
  }, [day, patient])

  const createPatient = async () => {
    const r = await window.api.patients.create({ ...EMPTY_PATIENT_DRAFT, ...draft })
    if (!r.ok) {
      setDraftErrors(r.errors)
      return
    }
    setPatient({ id: r.id, nom: `${draft.prenom} ${draft.nom}` })
    setCreating(false)
  }

  const save = async () => {
    if (!patient) {
      setErrors(['patient'])
      setShake((n) => n + 1)
      return
    }
    setBusy(true)
    const r = await window.api.planning.createRdv({
      patientId: patient.id,
      date: day,
      heure,
      motif,
    })
    setBusy(false)
    if (!r.ok) {
      setErrors(r.errors)
      setShake((n) => n + 1)
      return
    }
    onCreated({ seanceId: r.seanceId, date: day, heure, nom: patient.nom })
  }

  const err = (e: NewRdvError) => errors.includes(e)
  const today = todayIso()

  return (
    <Dialog
      open={date !== null}
      onOpenChange={(o) => !o && onClose()}
      title="Nouveau rendez-vous"
      description="Planning"
      className="max-w-[640px]"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span id="l-patient" className="text-label text-ink-600">
            Patient *
          </span>
          {patient ? (
            <div className="flex items-center justify-between gap-3 rounded-control bg-royal-50 px-3.5 py-2.5">
              <span className="font-bold text-royal-700">{patient.nom}</span>
              <Button size="sm" onClick={() => setPatient(null)}>
                Changer
              </Button>
            </div>
          ) : creating ? (
            <div className="grid gap-3 rounded-2xl bg-surface-mist p-3.5 sm:grid-cols-3">
              <Field label="Nom *" error={draftErrors.nom}>
                <Input
                  value={draft.nom}
                  onChange={(e) => setDraft({ ...draft, nom: e.target.value })}
                />
              </Field>
              <Field label="Prénom *" error={draftErrors.prenom}>
                <Input
                  value={draft.prenom}
                  onChange={(e) => setDraft({ ...draft, prenom: e.target.value })}
                />
              </Field>
              <Field label="Date de naissance *" error={draftErrors.ddn}>
                <Input
                  type="date"
                  value={draft.ddn}
                  onChange={(e) => setDraft({ ...draft, ddn: e.target.value })}
                />
              </Field>
              <div className="flex gap-2 sm:col-span-3">
                <Button size="sm" onClick={() => setCreating(false)}>
                  Retour
                </Button>
                <Button size="sm" variant="primary" onClick={() => void createPatient()}>
                  Créer la fiche
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Input
                aria-labelledby="l-patient"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un patient"
                aria-invalid={err('patient') || undefined}
              />
              <ul aria-label="Patients" className="flex flex-col gap-1">
                {results.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setPatient({ id: p.id, nom: `${p.prenom} ${p.nom}` })}
                      className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-control px-3 text-left hover:bg-surface-hover"
                    >
                      <span className="font-semibold">
                        {p.prenom} {p.nom}
                      </span>
                      <span className="text-[13px] text-ink-500">
                        {ageLabel(p.ddn, today)}
                        {p.commune ? ` · ${p.commune}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
                {query.trim() && (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        const words = query.trim().split(/\s+/)
                        setDraft({
                          prenom: words.length > 1 ? words[0]! : '',
                          nom: words.length > 1 ? words.slice(1).join(' ') : words[0]!,
                          ddn: '',
                        })
                        setDraftErrors({})
                        setCreating(true)
                      }}
                      className="flex min-h-[44px] w-full items-center gap-2 rounded-control px-3 text-left font-bold text-royal-600 hover:bg-royal-50"
                    >
                      <Icon name="plus" size={15} strokeWidth={2.6} />
                      Nouveau patient « {query.trim()} »
                    </button>
                  </li>
                )}
              </ul>
            </>
          )}
          {err('patient') && (
            <p className="text-[13px] font-bold text-red-ink">{MESSAGES.patient}</p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Date *"
            error={
              err('date')
                ? MESSAGES.date
                : err('past')
                  ? MESSAGES.past
                  : err('closed')
                    ? MESSAGES.closed
                    : undefined
            }
          >
            <Input
              type="date"
              min={today}
              value={day}
              onChange={(e) => {
                setDay(e.target.value)
                setHeure('')
              }}
            />
          </Field>
          <Field label="Motif">
            <Input
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Facultatif"
            />
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-label text-ink-600">
            Heure *
            {slots ? <span className="font-normal text-ink-500"> · {slots.summary}</span> : null}
          </span>
          {slots && slots.slots.length === 0 && (
            <p className="text-[14px] text-ink-500">Le cabinet est fermé ce jour-là.</p>
          )}
          <div
            role="radiogroup"
            aria-label="Heure"
            className="grid grid-cols-[repeat(auto-fill,minmax(68px,1fr))] gap-1.5"
          >
            {slots?.slots.map((s) => (
              <button
                key={s.heure}
                type="button"
                role="radio"
                aria-checked={heure === s.heure}
                disabled={!s.free}
                title={s.reason ?? undefined}
                onClick={() => setHeure(s.heure)}
                className={cn(
                  'min-h-[40px] rounded-[10px] text-[13px] font-bold tabular-nums transition-colors',
                  heure === s.heure
                    ? 'pop bg-primary text-white shadow-primary'
                    : s.free
                      ? 'border border-line-strong bg-white text-ink-900 hover:border-royal-500 hover:bg-royal-50'
                      : 'cursor-not-allowed border border-dashed border-line-strong bg-[repeating-linear-gradient(135deg,#F3F5F9_0_5px,#FFFFFF_5px_10px)] text-ink-500 line-through',
                )}
              >
                {s.heure}
              </button>
            ))}
          </div>
          {(err('heure') || err('slot')) && (
            <p className="text-[13px] font-bold text-red-ink">
              {err('heure') ? MESSAGES.heure : MESSAGES.slot}
            </p>
          )}
          {err('same_day') && patient && (
            <p className="text-[13px] font-bold text-red-ink">
              {patient.nom} {MESSAGES.same_day}
            </p>
          )}
        </div>

        <p className="rounded-2xl border border-[#E9C9A0] bg-[linear-gradient(180deg,#FFF6EA,#FBE8CF)] px-4 py-3 text-[13px] leading-normal text-[#5A3205]">
          <b>Agenda en ligne :</b> si vous en utilisez un, réservez-y aussi ce créneau pour qu’un
          patient ne puisse pas le prendre. La séance est créée tout de suite dans la fiche patient.
        </p>

        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" loading={busy} shakeSignal={shake} onClick={() => void save()}>
            {heure && day
              ? `Ajouter le RDV du ${formatIsoDateFr(day)} à ${heure}`
              : 'Ajouter le RDV'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
