import { motion } from 'framer-motion'
import { useEffect, useState, type ReactNode } from 'react'
import { formatIsoDateFr, formatIsoDateLongFr, formatRelativeDayFr } from '@shared/domain/dates'
import {
  CANCEL_REASONS,
  PAIEMENT_OPTIONS,
  binAction,
  displayStatus,
  editability,
  statusLabel,
  tarifLabel,
} from '@shared/domain/seance'
import { UNLOCK_REASONS, invoiceAction, type UnlockReason } from '@shared/domain/invoice'
import type { SeanceView } from '@shared/types/patients'
import { Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import { Input, Textarea } from '../../../components/ui/Field'
import { Icon } from '../../../components/ui/Icon'
import { Segmented } from '../../../components/ui/Segmented'
import { cn } from '../../../lib/cn'
import { EASE_SOFT, staggerItem } from '../../../lib/motion'
import type { SeanceDraft } from './seanceDraft'
import { STATUS_BADGE } from './statusStyles'

export interface SeanceDetailProps {
  seance: SeanceView
  draft: SeanceDraft
  onChange: (patch: Partial<SeanceDraft>) => void
  /** 1 for the oldest session. */
  position: number
  total: number
  fresh: boolean
  editing: boolean
  dirty: boolean
  busy: boolean
  tarifs: number[]
  addressComplete: boolean
  today: string
  doneShake: number
  /** Key that changes with the selected session (slide-in animation). */
  swap: number
  bin: 'cancel' | 'delete' | null
  onAskBin: () => void
  onBackBin: () => void
  onConfirmBin: (reason: string | null) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSave: () => void
  onMarkDone: () => void
  onRestore: () => void
  onCompleteAddress: () => void
  /** R-04: reason given to unlock date and tarif of the invoiced session, or `null`. */
  unlocked: UnlockReason | null
  onUnlock: (reason: UnlockReason) => Promise<boolean>
  onGenerateInvoice: () => void
  onViewInvoice: () => void
}

function Banner({
  tone,
  children,
}: {
  tone: 'grey' | 'amber' | 'cyan' | 'muted'
  children: ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: EASE_SOFT }}
      className={cn(
        'flex flex-wrap items-center justify-between gap-2.5 rounded-control py-2 pl-3 pr-2 text-[13px]',
        tone === 'grey' && 'bg-[#F0F4FA] text-ink-600',
        tone === 'amber' &&
          'border border-[#E9C9A0] bg-[linear-gradient(180deg,#FFF6EA,#FBE8CF)] text-[#5A3205]',
        tone === 'cyan' &&
          'border border-[rgba(14,165,198,0.25)] bg-[linear-gradient(180deg,#EEFBFD,#E0F7FB)] py-2.5 text-[#0B5F73]',
        tone === 'muted' && 'bg-[#EDF0F6] text-ink-600',
      )}
    >
      {children}
    </motion.div>
  )
}

/** What the footer says about invoicing (R-10), next to the invoice buttons. */
function invoiceHint(
  s: SeanceView,
  today: string,
  editing: boolean,
  addressComplete: boolean,
): { text: string; warn: boolean } {
  const status = displayStatus(s, today)
  if (s.status === 'cancelled') return { text: 'Séance annulée : non facturable', warn: false }
  if (s.status === 'planned') {
    if (status === 'upcoming')
      return { text: 'Facturation possible une fois la séance réalisée', warn: false }
    if (status === 'today')
      return { text: 'Validez la séance une fois réalisée pour pouvoir la facturer', warn: false }
    return { text: 'Séance passée non validée : complétez-la puis validez-la', warn: false }
  }
  if (editing) return { text: 'Enregistrer reverrouille la séance', warn: false }
  if (s.invoice) {
    const reglement = s.paiement === 'virement_attente' ? 'en attente de règlement' : 'acquittée'
    return {
      text: `Facture N° ${s.invoice.numero} · ${(s.tarifCents / 100).toFixed(2).replace('.', ',')} € · ${reglement}`,
      warn: false,
    }
  }
  if (s.tarifCents === 0) return { text: 'Séance gratuite : aucune facture à émettre', warn: false }
  if (!addressComplete)
    return {
      text: 'Adresse du patient incomplète : elle est obligatoire sur la facture',
      warn: true,
    }
  return { text: 'Pas encore de facture pour cette séance', warn: false }
}

/** Centre column (SPEC §5.3): header, state banner, fields and footer of the selected session. */
export function SeanceDetail(props: SeanceDetailProps) {
  const { seance: s, draft, onChange, editing, dirty, today, bin } = props
  const [reason, setReason] = useState<string | null>(null)
  useEffect(() => setReason(null), [bin, s.id])
  const [unlockAsk, setUnlockAsk] = useState(false)
  const [unlockReason, setUnlockReason] = useState<UnlockReason | null>(null)
  const [unlocking, setUnlocking] = useState(false)

  const invoiced = s.invoice !== null
  const { fields, dateAndTarif } = editability(s, {
    editing,
    invoiced: invoiced && !props.unlocked,
  })
  const footerAction = invoiceAction(
    { status: s.status, tarifCents: s.tarifCents, invoiced },
    { editing, addressComplete: props.addressComplete },
  )
  const status = displayStatus(s, today)
  const action = binAction({ status: s.status, invoiced })
  const isDone = s.status === 'done'
  const hint = invoiceHint(s, today, editing, props.addressComplete)
  const tarifs = [...new Set([...props.tarifs, draft.tarifCents])].sort((a, b) => a - b)
  const dateFr = formatIsoDateFr(s.date)

  return (
    <motion.section
      variants={staggerItem}
      aria-labelledby="h-seance"
      className="flex min-w-0 flex-[999_1_420px] flex-col rounded-card-lg border border-line-faint bg-white px-[22px] py-5 shadow-[inset_0_1px_0_#FFFFFF,0_1px_2px_rgba(15,30,70,0.06),0_22px_46px_-22px_rgba(15,30,70,0.35)] lg:overflow-y-auto"
    >
      <motion.div
        key={props.swap}
        initial={{ opacity: 0, x: 18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: EASE_SOFT }}
        className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:gap-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-[#0B7F99]">
              {props.fresh ? 'Nouvelle séance' : `Séance ${props.position} sur ${props.total}`}
            </p>
            <h2 id="h-seance" className="mt-0.5 text-[20px] font-extrabold">
              Séance du {formatIsoDateLongFr(draft.date || s.date)}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dirty && (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 rounded-pill bg-amber-50 px-2.5 py-1 text-[12px] font-bold text-amber-ink"
              >
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-500" />
                Non enregistré
              </span>
            )}
            <span
              key={status}
              className={cn(
                'pop inline-flex items-center rounded-pill px-[11px] py-[5px] text-[12px] font-extrabold tracking-[0.02em]',
                STATUS_BADGE[status],
              )}
            >
              {statusLabel(s, today)}
            </span>
            <span className="text-[13px] font-semibold text-ink-500">
              {formatRelativeDayFr(s.date, today)}
              {s.heure ? ` · ${s.heure}` : ''}
            </span>
            {action && !editing && !bin && (
              <button
                type="button"
                onClick={props.onAskBin}
                aria-label={action === 'delete' ? 'Supprimer la séance' : 'Annuler la séance'}
                title={action === 'delete' ? 'Supprimer la séance' : 'Annuler la séance'}
                className="btn btn-secondary btn-ink h-11 w-11 px-0 text-ink-600"
              >
                <Icon name="trash" size={16} />
              </button>
            )}
          </div>
        </div>

        {isDone && !editing && (
          <Banner tone="grey">
            <span className="flex items-center gap-2">
              <Icon name="lock" size={15} strokeWidth={2.4} className="shrink-0" />
              Séance réalisée, verrouillée pour éviter toute modification involontaire.
              {s.invoice ? ` Facture N° ${s.invoice.numero}.` : ''}
            </span>
            <Button
              size="sm"
              icon={<Icon name="edit" size={15} strokeWidth={2.2} />}
              onClick={props.onStartEdit}
            >
              Modifier
            </Button>
          </Banner>
        )}
        {isDone && editing && (
          <Banner tone="amber">
            <span className="flex items-center gap-2 py-1.5">
              <Icon name="edit" size={15} strokeWidth={2.4} className="shrink-0" />
              {s.invoice
                ? props.unlocked
                  ? `Modification en cours · date et tarif déverrouillés (${props.unlocked.toLowerCase()}).`
                  : `Modification en cours · date et tarif restent liés à la facture N° ${s.invoice.numero}.`
                : 'Modification d’une séance réalisée en cours.'}
            </span>
            {s.invoice && !props.unlocked && (
              <Button
                size="sm"
                icon={<Icon name="key" size={15} />}
                onClick={() => {
                  setUnlockReason(null)
                  setUnlockAsk(true)
                }}
              >
                Déverrouiller date et tarif…
              </Button>
            )}
          </Banner>
        )}
        {s.status === 'planned' && status !== 'to_complete' && (
          <Banner tone="cyan">
            <span className="flex items-center gap-2">
              <Icon name="calendar" size={15} strokeWidth={2.4} className="shrink-0" />
              {status === 'today'
                ? `RDV aujourd’hui${s.heure ? ` à ${s.heure}` : ''}. Préparez vos notes, puis validez une fois la séance réalisée.`
                : `RDV du ${dateFr}${s.heure ? ` à ${s.heure}` : ''}. Vous pouvez déjà y noter ce que vous voulez préparer.`}
            </span>
          </Banner>
        )}
        {s.status === 'cancelled' && (
          <Banner tone="muted">
            <span className="flex items-center gap-2">
              <Icon name="close" size={15} strokeWidth={2.4} className="shrink-0" />
              Séance annulée
              {s.cancelReason ? ` · ${s.cancelReason.toLowerCase()}` : ''}
              {s.cancelledAt ? ` · le ${formatIsoDateFr(s.cancelledAt.slice(0, 10))}` : ''}. Les
              annotations sont conservées.
            </span>
            <Button size="sm" onClick={props.onRestore}>
              Rétablir la séance
            </Button>
          </Banner>
        )}

        <div className="flex flex-wrap gap-3">
          <div className="flex flex-[1_1_170px] flex-col gap-1.5">
            <label htmlFor="s-date" className="text-label text-ink-600">
              Date
            </label>
            <Input
              id="s-date"
              type="date"
              value={draft.date}
              max={isDone ? today : undefined}
              disabled={!dateAndTarif}
              onChange={(e) => onChange({ date: e.target.value })}
            />
          </div>
          <div className="flex flex-[3_1_260px] flex-col gap-1.5">
            <label htmlFor="s-motif" className="text-label text-ink-600">
              Motif
            </label>
            <Input
              id="s-motif"
              value={draft.motif}
              disabled={!fields}
              onChange={(e) => onChange({ motif: e.target.value })}
              placeholder="Motif de consultation"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 lg:min-h-[96px] lg:flex-[1_1_0]">
          <label htmlFor="s-an" className="text-label text-ink-600">
            Anamnèse
          </label>
          <Textarea
            id="s-an"
            rows={4}
            className="lg:min-h-[64px] lg:flex-[1_1_0] lg:resize-none"
            value={draft.anamnese}
            disabled={!fields}
            onChange={(e) => onChange({ anamnese: e.target.value })}
            placeholder={fields ? 'Histoire de la plainte, contexte, évolution…' : ''}
          />
        </div>
        <div className="flex flex-col gap-1.5 lg:min-h-[96px] lg:flex-[1_1_0]">
          <label htmlFor="s-pr" className="text-label text-ink-600">
            Pratique
          </label>
          <Textarea
            id="s-pr"
            rows={4}
            className="lg:min-h-[64px] lg:flex-[1_1_0] lg:resize-none"
            value={draft.pratique}
            disabled={!fields}
            onChange={(e) => onChange({ pratique: e.target.value })}
            placeholder={fields ? 'Tests, techniques, conseils…' : ''}
          />
        </div>
        <div className="flex flex-wrap gap-[18px]">
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-label text-ink-600">Tarif</legend>
            <Segmented
              label="Tarif"
              value={draft.tarifCents}
              disabled={!dateAndTarif}
              onChange={(v) => onChange({ tarifCents: v })}
              options={tarifs.map((t) => ({ value: t, label: tarifLabel(t) }))}
            />
          </fieldset>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-label text-ink-600">Paiement</legend>
            <Segmented
              label="Paiement"
              value={draft.paiement}
              disabled={!fields}
              onChange={(v) => onChange({ paiement: v })}
              options={PAIEMENT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
          </fieldset>
        </div>

        {bin ? (
          <motion.div
            role="alertdialog"
            aria-labelledby="t-bin"
            aria-describedby="p-bin"
            initial={{ opacity: 0, y: 20, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: EASE_SOFT }}
            className="flex flex-col gap-3 rounded-2xl border border-red-600/30 bg-[linear-gradient(180deg,#FFF5F5,#FDE8E8)] px-4 py-3.5 shadow-[0_14px_30px_-16px_rgba(194,39,45,0.55)]"
          >
            <span id="t-bin" className="text-[15px] font-extrabold text-red-ink">
              {bin === 'delete'
                ? `Supprimer la séance du ${dateFr} ?`
                : `Annuler la séance du ${dateFr} ?`}
            </span>
            <span id="p-bin" className="text-[14px] text-[#7A1015]">
              {bin === 'delete'
                ? 'Elle disparaîtra de la fiche avec ses notes cliniques. Action définitive, inscrite au journal.'
                : 'Elle restera visible dans la liste, barrée, avec ses annotations. Vous pourrez la rétablir.'}
            </span>
            {bin === 'cancel' && (
              <div role="group" aria-label="Motif d’annulation" className="flex flex-wrap gap-2">
                {CANCEL_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={reason === r}
                    onClick={() => setReason(r)}
                    className={cn(
                      'btn min-h-[44px] rounded-[11px] px-3 text-[13px]',
                      reason === r
                        ? 'btn-danger pop'
                        : 'btn-ink border border-red-600/25 bg-white text-[#7A1015]',
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button size="sm" onClick={props.onBackBin}>
                Retour
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={bin === 'cancel' && !reason}
                loading={props.busy}
                onClick={() => props.onConfirmBin(reason)}
              >
                {bin === 'delete' ? 'Supprimer définitivement' : 'Annuler la séance'}
              </Button>
            </div>
          </motion.div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EDF0F6] pt-3.5">
            <span
              className={cn(
                'text-[14px]',
                hint.warn ? 'font-semibold text-amber-ink' : 'text-ink-500',
              )}
            >
              {hint.text}
            </span>
            <div className="flex flex-wrap gap-2">
              {s.status === 'planned' && (
                <>
                  <Button disabled={!dirty} loading={props.busy && dirty} onClick={props.onSave}>
                    Enregistrer
                  </Button>
                  <Button
                    variant="primary"
                    disabled={draft.date > today}
                    shakeSignal={props.doneShake}
                    icon={<Icon name="check" size={17} strokeWidth={2.6} />}
                    onClick={props.onMarkDone}
                  >
                    Séance réalisée
                  </Button>
                </>
              )}
              {isDone && editing && (
                <>
                  <Button onClick={props.onCancelEdit}>Annuler</Button>
                  <Button variant="primary" loading={props.busy} onClick={props.onSave}>
                    Enregistrer
                  </Button>
                </>
              )}
              {footerAction === 'complete_address' && (
                <Button
                  className="!border-[rgba(224,146,47,0.45)] !bg-[linear-gradient(180deg,#FFFFFF,#FFF6EA)] !text-[#7A4207]"
                  icon={<Icon name="pin" size={16} />}
                  onClick={props.onCompleteAddress}
                >
                  Compléter l’adresse
                </Button>
              )}
              {footerAction === 'generate' && (
                <Button
                  variant="primary"
                  icon={<Icon name="invoice" size={17} strokeWidth={2.2} />}
                  onClick={props.onGenerateInvoice}
                >
                  Générer la facture
                </Button>
              )}
              {footerAction === 'view' && (
                <Button icon={<Icon name="invoice" size={17} />} onClick={props.onViewInvoice}>
                  Voir la facture
                </Button>
              )}
            </div>
          </div>
        )}
      </motion.div>
      <Dialog
        alert
        open={unlockAsk}
        onOpenChange={setUnlockAsk}
        title="Déverrouiller la date et le tarif ?"
        description={`Cette séance est liée à la facture N° ${s.invoice?.numero ?? ''}. Si vous changez la date ou le tarif, la facture sera marquée « modifiée » et son PDF régénéré. Le déverrouillage est inscrit au journal avec son motif.`}
        footer={
          <>
            <Button onClick={() => setUnlockAsk(false)}>Retour</Button>
            <Button
              variant="primary"
              disabled={!unlockReason}
              loading={unlocking}
              onClick={async () => {
                if (!unlockReason) return
                setUnlocking(true)
                const ok = await props.onUnlock(unlockReason)
                setUnlocking(false)
                if (ok) setUnlockAsk(false)
              }}
            >
              Déverrouiller
            </Button>
          </>
        }
      >
        <div role="group" aria-label="Motif du déverrouillage" className="flex flex-wrap gap-2">
          {UNLOCK_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={unlockReason === r}
              onClick={() => setUnlockReason(r)}
              className={cn(
                'btn min-h-[44px] rounded-[11px] px-3.5 text-[14px]',
                unlockReason === r
                  ? 'pop border-0 bg-[linear-gradient(180deg,#E0922F,#B86A12)] text-white shadow-[0_6px_14px_-8px_rgba(184,106,18,0.9)]'
                  : 'btn-ink border border-[#E9C9A0] bg-[#FFF6EA] text-[#7A4207]',
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </Dialog>
    </motion.section>
  )
}
