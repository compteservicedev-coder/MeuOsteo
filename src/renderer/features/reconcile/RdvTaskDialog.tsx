import { useEffect, useState } from 'react'
import { DUPLICATE_CRITERION_LABELS } from '@shared/domain/creationDuplicates'
import { formatIsoDateFr, formatIsoDateLongFr } from '@shared/domain/dates'
import { formatPhone } from '@shared/domain/patient'
import { EMPTY_PATIENT_DRAFT, type PatientErrors } from '@shared/domain/patientValidation'
import type { PendingRdvTask } from '@shared/types/reconcile'
import type { DuplicateView } from '@shared/types/patients'
import type { RdvCandidates } from '@shared/types/planning'
import { useToast } from '../../components/toast/toastContext'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Field, Input } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'
import { Spinner } from '../../components/ui/Spinner'
import { Switch } from '../../components/ui/Switch'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { cn } from '../../lib/cn'

interface RdvTaskDialogProps {
  task: PendingRdvTask | null
  onClose: () => void
  onResolved: () => void
}

const CHECK_LABELS = { nom: 'Nom', initiale: 'Initiale', telephone: 'Téléphone', email: 'E-mail' }

function DoctolibTag() {
  return (
    <span className="ml-1.5 rounded-md bg-[#E0F7FB] px-1.5 py-0.5 text-[10px] font-extrabold tracking-[0.06em] text-[#0B5F73]">
      DOCTOLIB
    </span>
  )
}

/** « Nouveau patient » and « Plusieurs fiches possibles » (SPEC §3, R-18). */
export function RdvTaskDialog({ task, onClose, onResolved }: RdvTaskDialogProps) {
  const toast = useToast()
  const [data, setData] = useState<RdvCandidates | null>(null)
  const [mode, setMode] = useState<'choose' | 'create'>('choose')
  const [choice, setChoice] = useState<string | null>(null)
  const [remember, setRemember] = useState(true)
  const [form, setForm] = useState({ nom: '', prenom: '', ddn: '', portable: '', email: '' })
  const [errors, setErrors] = useState<PatientErrors>({})
  const [busy, setBusy] = useState(false)
  const [duplicates, setDuplicates] = useState<DuplicateView[]>([])

  useEffect(() => {
    if (!task) return
    setData(null)
    setErrors({})
    setChoice(null)
    setRemember(true)
    void window.api.doctolib.candidates(task.key).then((d) => {
      setData(d)
      if (!d) return
      setForm({ ...d.prefill, ddn: '' })
      setMode(task.match === 'pending_new' || d.candidates.length === 0 ? 'create' : 'choose')
      setChoice(d.candidates[0]?.patientId ?? null)
    })
  }, [task])

  // R-17: live duplicate check while the record is typed.
  const watched = useDebouncedValue(form, 350)
  useEffect(() => {
    if (mode !== 'create' || (!watched.nom && !watched.portable && !watched.email)) {
      setDuplicates([])
      return
    }
    void window.api.patients
      .duplicates({ ...watched, fixe: '' })
      .then(setDuplicates)
      .catch(() => setDuplicates([]))
  }, [watched, mode])

  const attach = async (patientId: string, rememberIt: boolean, name: string) => {
    if (!task) return
    setBusy(true)
    const r = await window.api.doctolib.attach(task.key, patientId, rememberIt)
    setBusy(false)
    if (!r.ok) {
      toast.show('Ce RDV ne peut plus être rattaché', 'error')
      return
    }
    toast.show(`RDV rattaché à ${name}`)
    onResolved()
  }

  const create = async () => {
    if (!task) return
    setBusy(true)
    const r = await window.api.doctolib.createAndAttach(task.key, {
      ...EMPTY_PATIENT_DRAFT,
      ...form,
    })
    setBusy(false)
    if (!r.ok) {
      if (r.reason === 'invalid') setErrors(r.errors)
      else toast.show('Ce RDV est introuvable', 'error')
      return
    }
    toast.show(`Fiche créée pour ${form.prenom} ${form.nom} · RDV rattaché`)
    onResolved()
  }

  const rdv = data?.rdv
  const chosen = data?.candidates.find((c) => c.patientId === choice)

  return (
    <Dialog
      open={task !== null}
      onOpenChange={(o) => !o && onClose()}
      title={mode === 'create' ? 'Nouveau patient' : 'Plusieurs fiches possibles'}
      description={
        mode === 'create'
          ? 'Aucune fiche ne correspond à ce RDV Doctolib.'
          : 'Choisissez la fiche à laquelle rattacher ce RDV.'
      }
      className="max-w-[860px]"
    >
      {!data && (
        <div className="flex justify-center py-10 text-royal-600">
          <Spinner />
        </div>
      )}
      {rdv && (
        <div className="flex flex-wrap items-start gap-4">
          <section
            aria-label="Reçu de Doctolib"
            className="flex flex-[1_1_240px] flex-col gap-1.5 rounded-[18px] border border-[rgba(14,165,198,0.25)] bg-[linear-gradient(180deg,#EEFBFD,#E0F7FB)] px-[18px] py-4 text-[14px] text-[#0B5F73]"
          >
            <span className="text-[11px] font-extrabold uppercase tracking-[0.06em]">
              Reçu de Doctolib
            </span>
            <span className="text-[17px] font-extrabold text-ink-900">{rdv.nomAffiche}</span>
            <span className="font-semibold">
              {formatIsoDateLongFr(rdv.date)}
              {rdv.heure ? ` à ${rdv.heure}` : ''}
            </span>
            {rdv.motif && <span>Motif : {rdv.motif}</span>}
            {rdv.telephone && <span>{formatPhone(rdv.telephone)}</span>}
            {rdv.email && <span className="break-all">{rdv.email}</span>}
          </section>

          {mode === 'choose' && (
            <div className="flex min-w-0 flex-[2_1_380px] flex-col gap-3">
              <ul role="radiogroup" aria-label="Fiches possibles" className="flex flex-col gap-2">
                {data.candidates.map((c) => {
                  const on = c.patientId === choice
                  return (
                    <li key={c.patientId}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setChoice(c.patientId)}
                        className={cn(
                          'flex w-full flex-col gap-2 rounded-2xl border px-4 py-3 text-left transition-[background,box-shadow] duration-200',
                          on
                            ? 'border-royal-500 bg-royal-50 shadow-[0_0_0_3px_rgba(59,108,246,0.18)]'
                            : 'border-line bg-white hover:bg-surface-hover',
                        )}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="text-[15px] font-extrabold">
                            {c.prenom} {c.nom}
                          </span>
                          <span className="rounded-pill bg-white px-2.5 py-0.5 text-[13px] font-extrabold text-royal-700 shadow-secondary">
                            {c.score}/4
                          </span>
                        </span>
                        <span className="text-[13px] text-ink-500">
                          Né(e) le {formatIsoDateFr(c.ddn)}
                          {c.lastSeance
                            ? ` · dernière séance le ${formatIsoDateFr(c.lastSeance)}`
                            : ''}
                        </span>
                        <span className="flex flex-wrap gap-1.5">
                          {(Object.keys(CHECK_LABELS) as Array<keyof typeof CHECK_LABELS>).map(
                            (k) => (
                              <span
                                key={k}
                                className={cn(
                                  'rounded-pill px-2 py-0.5 text-[12px] font-bold',
                                  c.checks[k]
                                    ? 'bg-aqua-50 text-aqua-ink'
                                    : 'bg-red-50 text-red-ink',
                                )}
                              >
                                {c.checks[k] ? '✓' : '✗'} {CHECK_LABELS[k]}
                              </span>
                            ),
                          )}
                        </span>
                        {c.note && (
                          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-ink">
                            <Icon name="alert" size={14} />
                            {c.note}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-card">
                <span className="flex flex-col">
                  <span id="l-remember" className="text-[14px] font-bold">
                    Mémoriser ce choix
                  </span>
                  <span className="text-[12px] text-ink-500">
                    Les prochains RDV de ce contact Doctolib seront rattachés à la même fiche
                  </span>
                </span>
                <Switch
                  aria-labelledby="l-remember"
                  checked={remember}
                  onCheckedChange={setRemember}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="min-h-[44px] text-[14px] font-bold text-royal-600 hover:text-royal-700"
                  onClick={() => setMode('create')}
                >
                  Aucune ne correspond : créer une fiche
                </button>
                <Button
                  variant="primary"
                  disabled={!chosen}
                  loading={busy}
                  onClick={() =>
                    chosen &&
                    void attach(chosen.patientId, remember, `${chosen.prenom} ${chosen.nom}`)
                  }
                >
                  {chosen ? `Rattacher à ${chosen.prenom} ${chosen.nom}` : 'Rattacher'}
                </Button>
              </div>
            </div>
          )}

          {mode === 'create' && (
            <form
              className="flex min-w-0 flex-[2_1_380px] flex-col gap-3"
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                void create()
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label={
                    <>
                      Nom *<DoctolibTag />
                    </>
                  }
                  error={errors.nom}
                >
                  <Input
                    value={form.nom}
                    onChange={(e) => setForm({ ...form, nom: e.target.value })}
                  />
                </Field>
                <Field
                  label={
                    <>
                      Prénom *<DoctolibTag />
                    </>
                  }
                  error={errors.prenom}
                >
                  <Input
                    value={form.prenom}
                    onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                  />
                </Field>
                <Field
                  label="Date de naissance *"
                  error={errors.ddn}
                  hint="Doctolib ne la transmet pas"
                >
                  <Input
                    type="date"
                    value={form.ddn}
                    onChange={(e) => setForm({ ...form, ddn: e.target.value })}
                  />
                </Field>
                <Field
                  label={
                    <>
                      Portable
                      <DoctolibTag />
                    </>
                  }
                  error={errors.portable}
                >
                  <Input
                    type="tel"
                    value={form.portable}
                    onChange={(e) => setForm({ ...form, portable: e.target.value })}
                  />
                </Field>
                <Field
                  label={
                    <>
                      E-mail
                      <DoctolibTag />
                    </>
                  }
                  error={errors.email}
                  className="sm:col-span-2"
                >
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </Field>
              </div>
              {duplicates.length > 0 && (
                <div className="flex flex-col gap-2 rounded-2xl border border-[#E9C9A0] bg-[#FFF6EA] px-4 py-3">
                  <span className="text-[14px] font-extrabold text-amber-ink">
                    Une fiche ressemble à ce patient
                  </span>
                  {duplicates.map((d) => (
                    <div key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[14px]">
                        <b>
                          {d.prenom} {d.nom}
                        </b>{' '}
                        · né(e) le {formatIsoDateFr(d.ddn)} ·{' '}
                        {d.criteria.map((c) => DUPLICATE_CRITERION_LABELS[c]).join(', ')}
                      </span>
                      <Button
                        size="sm"
                        loading={busy}
                        onClick={() => void attach(d.id, true, `${d.prenom} ${d.nom}`)}
                      >
                        C’est cette personne : rattacher
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[13px] text-ink-500">
                Le reste de la fiche (adresse, situation, profession…) pourra être complété pendant
                la séance. L’adresse sera demandée au moment de facturer.
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                {data.candidates.length > 0 && (
                  <Button onClick={() => setMode('choose')}>Voir les fiches possibles</Button>
                )}
                <Button onClick={onClose}>Annuler</Button>
                <Button type="submit" variant="primary" loading={busy}>
                  Créer la fiche et rattacher le RDV
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </Dialog>
  )
}
