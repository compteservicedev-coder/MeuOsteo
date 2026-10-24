import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  formatEurosShort,
  formatTarifList,
  isAdeli,
  isSiret,
  parseTarif,
  parseTarifList,
} from '@shared/domain/invoice'
import type { InvoiceSettingsView } from '@shared/types/invoices'
import { useToast } from '../../components/toast/toastContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Dialog } from '../../components/ui/Dialog'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'

const schema = z
  .object({
    // Saved even when incomplete: the banner lists what invoices still need.
    nom: z.string(),
    titre: z.string().trim().min(1, 'Titre obligatoire'),
    adresse: z.string(),
    telephone: z.string(),
    adeli: z.string().refine((v) => !v.trim() || isAdeli(v), 'Le n° ADELI compte 9 chiffres'),
    siret: z.string().refine((v) => !v.trim() || isSiret(v), 'Le SIRET compte 14 chiffres'),
    defaultTarif: z.string().refine((v) => parseTarif(v) !== null, 'Tarif invalide (ex. 60 €)'),
    autresTarifs: z.string(),
    mentionTva: z.string().trim().min(1, 'Mention obligatoire'),
    subject: z.string().trim().min(1, 'Objet obligatoire'),
    body: z.string().trim().min(1, 'Texte obligatoire'),
  })
  .superRefine((v, ctx) => {
    const list = parseTarifList(v.autresTarifs)
    if (!list.ok) {
      ctx.addIssue({
        code: 'custom',
        path: ['autresTarifs'],
        message: `« ${list.bad} » n’est pas un tarif`,
      })
    }
  })

type FormValues = z.infer<typeof schema>

function toForm(s: InvoiceSettingsView): FormValues {
  return {
    ...s.cabinet,
    defaultTarif: formatEurosShort(s.tarifs.defaultCents),
    autresTarifs: formatTarifList(s.tarifs.list, s.tarifs.defaultCents),
    mentionTva: s.mentionTva,
    subject: s.emailTemplate.subject,
    body: s.emailTemplate.body,
  }
}

/** Paramètres > Cabinet & factures (SPEC §8.3). */
export function CabinetTab() {
  const toast = useToast()
  const [settings, setSettings] = useState<InvoiceSettingsView | null>(null)
  const [startOpen, setStartOpen] = useState(false)
  const [startValue, setStartValue] = useState('')
  const form = useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onBlur' })
  const { register, handleSubmit, reset, formState } = form
  const errors = formState.errors

  useEffect(() => {
    void window.api.invoices.getSettings().then((s) => {
      setSettings(s)
      reset(toForm(s))
    })
  }, [reset])

  const save = handleSubmit(async (v) => {
    const defaultCents = parseTarif(v.defaultTarif)!
    const list = parseTarifList(v.autresTarifs)
    const next = await window.api.invoices.saveSettings({
      cabinet: {
        nom: v.nom,
        titre: v.titre,
        adresse: v.adresse,
        telephone: v.telephone,
        adeli: v.adeli.replace(/\s/g, ''),
        siret: v.siret.replace(/\s/g, ''),
      },
      tarifs: { list: list.ok ? list.cents : [], defaultCents },
      mentionTva: v.mentionTva,
      emailTemplate: { subject: v.subject, body: v.body },
    })
    setSettings(next)
    reset(toForm(next))
    toast.show('Cabinet et factures enregistrés')
  })

  if (!settings) return null
  const start = Number(startValue)
  const year = settings.nextNumber.slice(0, 4)

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => void save(e)} noValidate>
      <Card title="Cabinet" description="Apparaît sur chaque facture">
        {settings.missingCabinet.length > 0 && (
          <p className="flex items-center gap-2 rounded-control bg-amber-50 px-3 py-2.5 text-[14px] font-semibold text-amber-ink">
            <Icon name="alert" size={16} />À compléter avant la première facture :{' '}
            {settings.missingCabinet.join(', ')}.
          </p>
        )}
        <div className="grid gap-3.5 md:grid-cols-2">
          <Field label="Prénom et nom" error={errors.nom?.message}>
            <Input {...register('nom')} placeholder="[Prénom NOM]" autoComplete="off" />
          </Field>
          <Field label="Titre" error={errors.titre?.message}>
            <Input {...register('titre')} />
          </Field>
          <Field
            label="Adresse du cabinet"
            error={errors.adresse?.message}
            className="md:col-span-2"
          >
            <Input {...register('adresse')} placeholder="[Adresse, code postal, ville]" />
          </Field>
          <Field label="Téléphone" error={errors.telephone?.message}>
            <Input {...register('telephone')} type="tel" placeholder="[Téléphone]" />
          </Field>
          <Field label="N° ADELI" error={errors.adeli?.message}>
            <Input {...register('adeli')} inputMode="numeric" placeholder="[9 chiffres]" />
          </Field>
          <Field label="SIRET" error={errors.siret?.message}>
            <Input {...register('siret')} inputMode="numeric" placeholder="[14 chiffres]" />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-label text-ink-600">Signature</span>
          {settings.signature && (
            <img
              src={settings.signature}
              alt="Signature actuelle"
              className="max-h-[60px] max-w-[200px] rounded-md border border-line bg-white object-contain p-1"
            />
          )}
          <Button
            size="sm"
            icon={<Icon name="edit" size={15} />}
            onClick={async () => setSettings(await window.api.invoices.chooseSignature())}
          >
            {settings.hasSignature ? 'Remplacer la signature' : 'Ajouter une image de signature'}
          </Button>
          {settings.hasSignature && (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => setSettings(await window.api.invoices.removeSignature())}
            >
              Retirer
            </Button>
          )}
        </div>
      </Card>

      <Card title="Facturation & tarifs">
        <div className="grid gap-3.5 md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-label text-ink-600">Prochain numéro</span>
            <span className="flex min-h-[46px] items-center rounded-control bg-surface-rail px-3.5 text-[16px] font-extrabold tabular-nums text-ink-900 shadow-rail">
              {settings.nextNumber}
            </span>
            {settings.canSetStart && (
              <button
                type="button"
                onClick={() => {
                  setStartValue('')
                  setStartOpen(true)
                }}
                className="self-start text-[13px] font-bold text-royal-600 hover:text-royal-700"
              >
                Reprendre une numérotation existante…
              </button>
            )}
          </div>
          <Field label="Tarif par défaut" error={errors.defaultTarif?.message}>
            <Input {...register('defaultTarif')} />
          </Field>
          <Field label="Autres tarifs" error={errors.autresTarifs?.message}>
            <Input {...register('autresTarifs')} />
          </Field>
        </div>
        <Field label="Mention en pied de facture" error={errors.mentionTva?.message}>
          <Input {...register('mentionTva')} />
        </Field>
        <Field label="Objet de l’e-mail d’envoi" error={errors.subject?.message}>
          <Input {...register('subject')} />
        </Field>
        <Field
          label="Modèle de l’e-mail d’envoi"
          error={errors.body?.message}
          hint="{prénom} et {date} sont remplacés automatiquement"
        >
          <Textarea rows={5} {...register('body')} />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EDF0F6] pt-3.5">
          <Button
            icon={<Icon name="download" size={16} />}
            onClick={async () => {
              const r = await window.api.invoices.exportAccounting()
              if (r.ok) toast.show('Export comptable enregistré')
              else if (r.reason === 'error') toast.show('Export impossible', 'error')
            }}
          >
            Exporter les factures pour le comptable
          </Button>
          <div className="flex gap-2">
            <Button disabled={!formState.isDirty} onClick={() => reset(toForm(settings))}>
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!formState.isDirty}
              loading={formState.isSubmitting}
            >
              Enregistrer
            </Button>
          </div>
        </div>
      </Card>

      <Dialog
        open={startOpen}
        onOpenChange={setStartOpen}
        title="Reprendre une numérotation existante"
        description={`Si vous avez déjà émis des factures en ${year} avec un autre outil, indiquez le numéro de la prochaine. Ce choix n’est possible qu’avant la première facture de l’année dans MeuOsteo.`}
        footer={
          <>
            <Button onClick={() => setStartOpen(false)}>Annuler</Button>
            <Button
              variant="primary"
              disabled={!Number.isInteger(start) || start < 1 || start > 9999}
              onClick={async () => {
                setSettings(await window.api.invoices.setNumberingStart(start))
                setStartOpen(false)
                toast.show(`Prochain numéro : ${year}-${String(start).padStart(4, '0')}`)
              }}
            >
              Valider
            </Button>
          </>
        }
      >
        <Field label={`Numéro de la prochaine facture (${year}-…)`}>
          <Input
            inputMode="numeric"
            value={startValue}
            onChange={(e) => setStartValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="143"
          />
        </Field>
      </Dialog>
    </form>
  )
}
