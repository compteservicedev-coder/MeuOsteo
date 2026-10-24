import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import {
  communeAfterCpChange,
  suggestCommune,
  type CommuneSuggestion,
} from '@shared/domain/communes'
import { formatIsoDateFr } from '@shared/domain/dates'
import { DUPLICATE_CRITERION_LABELS } from '@shared/domain/creationDuplicates'
import {
  SITUATION_OPTIONS,
  ageLabel,
  bornLabel,
  formatPhone,
  type Situation,
} from '@shared/domain/patient'
import {
  EMPTY_PATIENT_DRAFT,
  errorCountLabel,
  validatePatient,
  type PatientDraft,
  type PatientErrors,
  type PatientField,
} from '@shared/domain/patientValidation'
import type { DuplicateView, PatientDetail } from '@shared/types/patients'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Drawer } from '../../components/ui/Drawer'
import { Field, Input, Select } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'
import { Segmented } from '../../components/ui/Segmented'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { cn } from '../../lib/cn'
import { todayIso } from '../../lib/today'
import { draftFromRecord, sameDraft } from './draft'
import { RelativesEditor } from './RelativesEditor'

interface PatientEditDrawerProps {
  open: boolean
  onClose: () => void
  /** `null`: « Nouveau patient ». */
  detail: PatientDetail | null
  /** Values of a new record (e.g. the name typed in the search box). */
  initial?: Partial<PatientDraft>
  /** Banner explaining why the panel was opened, with the fields to complete. */
  reason?: { message: string; fields: PatientField[] } | null
  onSaved: (id: string, changed: string[]) => void
  onRelativesChanged?: () => void
  onDeleted?: () => void
  /** R-17: « C’est cette personne » opens the existing record instead. */
  onOpenExisting?: (id: string) => void
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3.5 rounded-[18px] bg-white p-[18px] shadow-[inset_0_1px_0_#FFFFFF,0_10px_26px_-18px_rgba(15,30,70,0.35)]">
      <legend className="float-left mb-1 w-full text-[15px] font-extrabold">{title}</legend>
      {children}
    </fieldset>
  )
}

/** Edit panel of a patient record (SPEC §5.1), also used to create one. */
export function PatientEditDrawer({
  open,
  onClose,
  detail,
  initial,
  reason = null,
  onSaved,
  onRelativesChanged,
  onDeleted,
  onOpenExisting,
}: PatientEditDrawerProps) {
  const creating = detail === null
  const base = useMemo(
    () => (detail ? draftFromRecord(detail.patient) : { ...EMPTY_PATIENT_DRAFT, ...initial }),
    // Re-initialise only when the panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, detail?.patient.id],
  )
  const [draft, setDraft] = useState<PatientDraft>(base)
  const [tried, setTried] = useState(false)
  const [errors, setErrors] = useState<PatientErrors>({})
  const [shake, setShake] = useState(0)
  const [saving, setSaving] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [communes, setCommunes] = useState<CommuneSuggestion>({ mode: 'waiting' })
  const [duplicates, setDuplicates] = useState<DuplicateView[]>([])
  const today = todayIso()
  const enfantsLabelId = useId()

  useEffect(() => {
    if (!open) return
    setDraft(base)
    setTried(false)
    setErrors({})
    setConfirmDiscard(false)
    setDuplicates([])
  }, [open, base])

  // R-16: communes of the postal code.
  useEffect(() => {
    let alive = true
    if (!/^\d{5}$/.test(draft.cp)) {
      setCommunes({ mode: 'waiting' })
      return
    }
    void window.api.communes.byCp(draft.cp).then((list) => {
      if (alive) setCommunes(suggestCommune(draft.cp, list))
    })
    return () => {
      alive = false
    }
  }, [draft.cp])

  // R-17: live duplicate check while creating.
  const probe = useDebouncedValue(
    {
      nom: draft.nom,
      prenom: draft.prenom,
      ddn: draft.ddn,
      portable: draft.portable,
      fixe: draft.fixe,
      email: draft.email,
    },
    300,
  )
  useEffect(() => {
    if (!open || !creating) return
    let alive = true
    void window.api.patients.duplicates(probe).then((list) => {
      if (alive) setDuplicates(list)
    })
    return () => {
      alive = false
    }
  }, [open, creating, probe])

  const dirty = !sameDraft(draft, base)
  const highlighted = new Set(reason?.fields ?? [])

  const set = <K extends PatientField>(key: K, value: PatientDraft[K]) => {
    setDraft((d) => {
      const next = { ...d, [key]: value }
      if (tried) setErrors(validatePatient(next, today))
      return next
    })
    setConfirmDiscard(false)
  }

  const setCp = (raw: string) => {
    const cp = raw.replace(/\D/g, '').slice(0, 5)
    set('cp', cp)
    if (/^\d{5}$/.test(cp)) {
      void window.api.communes.byCp(cp).then((list) => {
        setDraft((d) =>
          d.cp === cp
            ? { ...d, commune: communeAfterCpChange(suggestCommune(cp, list), d.commune) }
            : d,
        )
      })
    }
  }

  const requestClose = () => {
    if (dirty && !confirmDiscard) setConfirmDiscard(true)
    else onClose()
  }

  const save = async () => {
    const found = validatePatient(draft, today)
    setTried(true)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setShake((n) => n + 1)
      return
    }
    setSaving(true)
    const result = creating
      ? await window.api.patients.create(draft)
      : await window.api.patients.update(detail.patient.id, draft)
    setSaving(false)
    if (!result.ok) {
      setErrors(result.errors)
      setShake((n) => n + 1)
      return
    }
    onSaved(result.id, result.changed)
  }

  const err = (k: PatientField) => (tried ? errors[k] : undefined)
  const hi = (k: PatientField) =>
    highlighted.has(k) && !draft[k] && !err(k)
      ? '!border-amber-500 !shadow-[0_0_0_4px_rgba(224,146,47,0.16)]'
      : ''
  const errorCount = tried ? Object.keys(errors).length : 0
  const communeOptions =
    communes.mode === 'choice'
      ? communes.communes
      : communes.mode === 'single'
        ? [communes.commune]
        : []
  if (draft.commune && communeOptions.length > 0 && !communeOptions.includes(draft.commune)) {
    communeOptions.unshift(draft.commune)
  }

  const footer = confirmDiscard ? (
    <div
      role="alertdialog"
      aria-label="Abandonner les modifications ?"
      className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl bg-red-50 px-4 py-3"
    >
      <span className="flex items-center gap-2 text-[14px] font-bold text-red-ink">
        <Icon name="alert" size={18} />
        Abandonner les modifications ?
      </span>
      <span className="flex gap-2">
        <Button size="sm" onClick={() => setConfirmDiscard(false)}>
          Continuer l’édition
        </Button>
        <Button size="sm" variant="danger" onClick={onClose}>
          Abandonner
        </Button>
      </span>
    </div>
  ) : (
    <div className="flex w-full flex-wrap items-center justify-end gap-3">
      {errorCount > 0 && (
        <p role="alert" className="mr-auto text-[14px] font-bold text-red-ink">
          {errorCountLabel(errors)}
        </p>
      )}
      <Button onClick={requestClose}>Annuler</Button>
      <Button variant="primary" loading={saving} shakeSignal={shake} onClick={() => void save()}>
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </div>
  )

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => !o && requestClose()}
      title={creating ? 'Nouveau patient' : 'Modifier les informations'}
      description={creating ? 'Créer une fiche' : 'Fiche patient'}
      footer={footer}
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
        className="flex flex-col gap-4"
      >
        {reason && (
          <p className="rounded-2xl bg-[linear-gradient(180deg,#FFF6EA,#FBE8CF)] px-3.5 py-3 text-[14px] font-semibold text-[#5A3205] shadow-[inset_0_1px_0_#FFFFFF]">
            {reason.message}
          </p>
        )}

        <Section title="Identité">
          <div className="flex flex-wrap gap-3">
            <Field label="Nom *" error={err('nom')} className="flex-[1_1_180px]">
              <Input
                value={draft.nom}
                onChange={(e) => set('nom', e.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field label="Prénom *" error={err('prenom')} className="flex-[1_1_180px]">
              <Input
                value={draft.prenom}
                onChange={(e) => set('prenom', e.target.value)}
                autoComplete="off"
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-start gap-3">
            <Field label="Date de naissance *" error={err('ddn')} className="flex-[1_1_200px]">
              <div className="flex items-center gap-3">
                <Input
                  type="date"
                  value={draft.ddn}
                  max={today}
                  onChange={(e) => set('ddn', e.target.value)}
                  className="min-w-0 flex-1"
                />
                <span
                  className="min-w-[56px] text-[14px] font-bold text-royal-700"
                  aria-live="polite"
                >
                  {draft.ddn ? ageLabel(draft.ddn, today) || '—' : '—'}
                </span>
              </div>
            </Field>
            <div className="flex flex-[1_1_200px] flex-col gap-1.5">
              <span aria-hidden="true" className="text-label text-ink-600">
                Sexe
              </span>
              <Segmented
                label="Sexe"
                value={draft.sexe}
                onChange={(v) => set('sexe', draft.sexe === v ? null : v)}
                options={[
                  { value: 'F', label: 'Femme' },
                  { value: 'M', label: 'Homme' },
                ]}
                className="w-full [&>button]:flex-1"
              />
            </div>
          </div>
        </Section>

        <Section title="Situation">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Situation familiale" className="flex-[1_1_200px]">
              <Select
                value={draft.situation ?? ''}
                onChange={(e) => set('situation', (e.target.value || null) as Situation | null)}
              >
                <option value="">Non renseignée</option>
                {SITUATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex flex-col gap-1.5">
              <span id={enfantsLabelId} className="text-label text-ink-600">
                Enfants
              </span>
              <div
                role="group"
                aria-labelledby={enfantsLabelId}
                className="flex items-center gap-1 rounded-[14px] bg-surface-rail p-1 shadow-rail"
              >
                <Button
                  size="sm"
                  aria-label="Un enfant de moins"
                  className="w-11 px-0"
                  onClick={() =>
                    set('enfants', draft.enfants === null ? 0 : Math.max(0, draft.enfants - 1))
                  }
                >
                  −
                </Button>
                <span
                  key={draft.enfants ?? 'x'}
                  className="pop min-w-[40px] text-center text-[16px] font-extrabold"
                  aria-live="polite"
                >
                  {draft.enfants ?? '—'}
                </span>
                <Button
                  size="sm"
                  aria-label="Un enfant de plus"
                  className="w-11 px-0"
                  onClick={() => set('enfants', Math.min(30, (draft.enfants ?? 0) + 1))}
                >
                  +
                </Button>
              </div>
            </div>
          </div>
          <Field label="Profession">
            <Input
              value={draft.profession}
              onChange={(e) => set('profession', e.target.value)}
              placeholder="ex. Infirmière, retraité…"
            />
          </Field>
        </Section>

        <Section title="Coordonnées">
          <Field label="Adresse" error={err('adresse')}>
            <Input
              value={draft.adresse}
              onChange={(e) => set('adresse', e.target.value)}
              placeholder="N° et rue"
              className={hi('adresse')}
            />
          </Field>
          <div className="flex flex-wrap gap-3">
            <Field label="Code postal" error={err('cp')} className="flex-[1_1_120px]">
              <Input
                inputMode="numeric"
                value={draft.cp}
                onChange={(e) => setCp(e.target.value)}
                placeholder="94300"
                className={hi('cp')}
              />
            </Field>
            <Field
              label="Commune"
              className="flex-[2_1_220px]"
              hint={
                communes.mode === 'free'
                  ? 'Aucune commune pour ce code : saisie libre'
                  : 'Proposée automatiquement à partir du code postal (base des communes de l’outil actuel)'
              }
            >
              {communeOptions.length > 0 ? (
                <Select
                  value={draft.commune}
                  onChange={(e) => set('commune', e.target.value)}
                  className={hi('commune')}
                >
                  <option value="">Choisir la commune</option>
                  {communeOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  value={draft.commune}
                  onChange={(e) => set('commune', e.target.value)}
                  placeholder={communes.mode === 'waiting' ? 'Saisir le code postal' : 'Commune'}
                  className={hi('commune')}
                />
              )}
            </Field>
          </div>
          <div className="flex flex-wrap gap-3">
            <Field label="Portable" error={err('portable')} className="flex-[1_1_180px]">
              <Input
                type="tel"
                value={draft.portable}
                onChange={(e) => set('portable', formatPhone(e.target.value))}
                placeholder="06 00 00 00 00"
              />
            </Field>
            <Field label="Téléphone fixe" error={err('fixe')} className="flex-[1_1_180px]">
              <Input
                type="tel"
                value={draft.fixe}
                onChange={(e) => set('fixe', formatPhone(e.target.value))}
                placeholder="01 00 00 00 00"
              />
            </Field>
          </div>
          <Field label="E-mail" error={err('email')} hint="Utilisé pour l’envoi des factures">
            <Input
              type="email"
              value={draft.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="prenom.nom@exemple.fr"
            />
          </Field>
        </Section>

        {creating && duplicates.length > 0 && (
          <section
            aria-labelledby="h-dup"
            className="flex flex-col gap-2.5 rounded-[18px] border border-amber-500/40 bg-amber-50 p-4"
          >
            <h3
              id="h-dup"
              className="flex items-center gap-2 text-[15px] font-extrabold text-amber-ink"
            >
              <Icon name="alert" size={18} />
              Cette personne a peut-être déjà une fiche
            </h3>
            {duplicates.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-3 py-2.5"
              >
                <span className="flex min-w-0 flex-[1_1_200px] flex-col">
                  <span className="font-bold">
                    {d.prenom} {d.nom}
                  </span>
                  <span className="text-[12px] text-ink-500">
                    {bornLabel(null)} {formatIsoDateFr(d.ddn)}
                    {d.commune ? ` · ${d.commune}` : ''} ·{' '}
                    {d.criteria.map((c) => DUPLICATE_CRITERION_LABELS[c]).join(', ')}
                  </span>
                </span>
                {onOpenExisting && (
                  <Button size="sm" onClick={() => onOpenExisting(d.id)}>
                    C’est cette personne : ouvrir sa fiche
                  </Button>
                )}
              </div>
            ))}
          </section>
        )}

        {!creating && (
          <RelativesEditor
            patientId={detail.patient.id}
            patientName={`${detail.patient.prenom} ${detail.patient.nom}`}
            relatives={detail.relatives}
            onChanged={() => onRelativesChanged?.()}
          />
        )}

        <p className="text-[12px] text-ink-500">
          * Champs obligatoires
          {detail
            ? ` · fiche créée le ${formatIsoDateFr(detail.patient.createdAt.slice(0, 10))}`
            : ''}
        </p>

        {!creating && (
          <div className="flex flex-wrap items-center gap-3 rounded-[18px] border border-red-600/20 bg-[#FFFAFA] px-4 py-3.5">
            <span className="flex flex-[1_1_220px] flex-col gap-0.5">
              <span className="font-bold text-red-ink">Supprimer ce patient</span>
              <span className="text-[13px] text-ink-500">
                Fiche, séances et commentaire. Les factures émises sont conservées.
              </span>
            </span>
            <Button size="sm" className={cn('!text-red-ink')} onClick={() => setDeleteOpen(true)}>
              Supprimer…
            </Button>
          </div>
        )}
        {/* Enter submits the form. */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>

      {!creating && (
        <Dialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          alert
          title={`Supprimer ${detail.patient.prenom} ${detail.patient.nom} ?`}
          description={`La fiche, ses ${detail.seances.length} séances et le commentaire inter-séances seront supprimés. Les ${detail.invoiceCount} factures émises restent dans le registre (obligation de conservation). La suppression est inscrite dans le journal. La fiche reste récupérable pendant 30 jours.`}
          footer={
            <>
              <Button onClick={() => setDeleteOpen(false)}>Annuler</Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await window.api.patients.delete(detail.patient.id)
                  setDeleteOpen(false)
                  onDeleted?.()
                }}
              >
                Supprimer le patient
              </Button>
            </>
          }
        />
      )}
    </Drawer>
  )
}
