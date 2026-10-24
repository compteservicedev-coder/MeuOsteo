import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatIsoDateFr } from '@shared/domain/dates'
import { formatEuros } from '@shared/domain/invoice'
import { InvoiceDocument } from '@shared/invoice/InvoiceDocument'
import type { InvoicePreview, IssueResult } from '@shared/types/invoices'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Icon } from '../../components/ui/Icon'
import { Spinner } from '../../components/ui/Spinner'
import { Switch } from '../../components/ui/Switch'
import { useToast } from '../../components/toast/toastContext'
import { cn } from '../../lib/cn'
import { EASE_SOFT } from '../../lib/motion'
import { BLOCKER_MESSAGES, sendErrorMessage } from './messages'

interface IssueInvoiceDialogProps {
  seanceId: string | null
  patientId: string
  onClose: () => void
  /** The invoice was issued: the record reloads its sessions and history. */
  onIssued: () => void
}

type Step = 'preview' | 'emitting' | 'done'

/** « Émettre la facture » (SPEC §5.5), opened only from « Générer la facture » (R-10). */
export function IssueInvoiceDialog({
  seanceId,
  patientId,
  onClose,
  onIssued,
}: IssueInvoiceDialogProps) {
  const toast = useToast()
  const [preview, setPreview] = useState<InvoicePreview | null>(null)
  const [send, setSend] = useState(false)
  const [step, setStep] = useState<Step>('preview')
  const [result, setResult] = useState<Extract<IssueResult, { ok: true }> | null>(null)

  useEffect(() => {
    if (!seanceId) return
    setPreview(null)
    setStep('preview')
    setResult(null)
    void window.api.invoices.preview(seanceId).then((p) => {
      setPreview(p)
      setSend(p.ok && Boolean(p.email) && p.mailConfigured)
    })
  }, [seanceId])

  const close = () => {
    if (step !== 'emitting') onClose()
  }

  const emit = async () => {
    if (!seanceId) return
    setStep('emitting')
    const r = await window.api.invoices.issue(seanceId, { send: canSend && send })
    if (!r.ok) {
      setStep('preview')
      toast.show(
        r.reason === 'blocked'
          ? BLOCKER_MESSAGES[r.blockers[0]!]
          : r.reason === 'cabinet_incomplete'
            ? 'Complétez d’abord les informations du cabinet dans Paramètres'
            : 'Séance introuvable',
        'error',
      )
      return
    }
    setResult(r)
    setStep('done')
    onIssued()
    if (!r.pdf) toast.show('Facture émise, mais le PDF n’a pas pu être généré', 'error')
  }

  const ok = preview?.ok ? preview : null
  const canSend = Boolean(ok?.email && ok.mailConfigured)
  const sending = canSend && send
  const doc = ok
    ? result
      ? { ...ok.document, numero: result.numero, provisional: false }
      : ok.document
    : null
  const pending = ok?.reglement === 'attente'

  return (
    <Dialog
      open={seanceId !== null}
      onOpenChange={(o) => !o && close()}
      title={step === 'done' ? 'Facture émise' : 'Émettre la facture'}
      className="max-w-[980px] bg-[linear-gradient(180deg,#F7F9FC,#EEF2F8)]"
    >
      {preview && !preview.ok && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-[14px] font-semibold text-amber-ink">
          {preview.reason === 'blocked'
            ? BLOCKER_MESSAGES[preview.blockers[0]!]
            : 'Cette séance est introuvable.'}
        </p>
      )}
      {!preview && (
        <div className="flex justify-center py-16 text-royal-600">
          <Spinner />
        </div>
      )}
      {ok && doc && (
        <div className="flex flex-wrap items-start gap-[18px]">
          <div className="relative min-w-0 flex-[1_1_440px] overflow-hidden rounded-lg shadow-[0_2px_4px_rgba(15,30,70,0.06),0_28px_56px_-28px_rgba(15,30,70,0.45)]">
            <InvoiceDocument data={doc} />
            <AnimatePresence>
              {step === 'done' && (
                <motion.div
                  aria-hidden="true"
                  initial={{ opacity: 0, scale: 1.6, rotate: -16 }}
                  animate={{ opacity: 1, scale: 1, rotate: -8 }}
                  transition={{ duration: 0.45, ease: [0.3, 1.5, 0.5, 1] }}
                  className="absolute right-[34px] top-[120px] rounded-[10px] border-[3px] border-royal-600 bg-white/85 px-4 py-2 text-[18px] font-extrabold tracking-[0.08em] text-royal-600"
                >
                  ÉMISE
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3.5">
            <dl className="flex flex-col gap-2.5 rounded-[18px] bg-white px-[18px] py-4 text-[14px] shadow-[inset_0_1px_0_#FFFFFF,0_10px_26px_-18px_rgba(15,30,70,0.35)]">
              <Row label="Patient">{doc.patientNom}</Row>
              <Row label="Séance">
                {formatIsoDateFr(doc.dateSeance)} · {ok.motif || '—'}
              </Row>
              <Row label="Montant">
                <span className="font-extrabold">{formatEuros(doc.montantCents)}</span>
              </Row>
              <Row label="Règlement">
                <span
                  className={cn(
                    'rounded-pill px-2.5 py-0.5 text-[13px] font-bold',
                    pending ? 'bg-amber-50 text-amber-ink' : 'bg-aqua-50 text-aqua-ink',
                  )}
                >
                  {ok.reglementSummary}
                </span>
              </Row>
              <div className="flex justify-between gap-2.5 border-t border-[#EDF0F6] pt-2.5">
                <dt className="text-ink-500">Numéro</dt>
                <dd className="text-right font-extrabold tabular-nums">
                  {result ? result.numero : `${ok.document.numero} · attribué à l’émission`}
                </dd>
              </div>
            </dl>

            {step === 'preview' && (
              <>
                {ok.missingCabinet.length > 0 && (
                  <div className="flex flex-col gap-2 rounded-2xl border border-[#E9C9A0] bg-[linear-gradient(180deg,#FFF6EA,#FBE8CF)] px-4 py-3 text-[14px] text-[#5A3205]">
                    <span className="font-bold">
                      Mentions obligatoires manquantes : {ok.missingCabinet.join(', ')}.
                    </span>
                    <Link
                      to="/parametres?onglet=cabinet"
                      className="font-bold text-royal-600 hover:text-royal-700"
                      onClick={onClose}
                    >
                      Compléter dans Paramètres → Cabinet & factures
                    </Link>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-[inset_0_1px_0_#FFFFFF,0_10px_26px_-18px_rgba(15,30,70,0.35)]">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span id="l-send" className="text-[14px] font-bold">
                      Envoyer par e-mail à l’émission
                    </span>
                    <span className="text-[12px] text-ink-500">
                      {!ok.email
                        ? 'Pas d’e-mail dans la fiche patient'
                        : !ok.mailConfigured
                          ? 'Gmail n’est pas configuré (Paramètres > Messagerie Gmail)'
                          : ok.email}
                    </span>
                  </span>
                  <Switch
                    aria-labelledby="l-send"
                    checked={sending}
                    disabled={!canSend}
                    onCheckedChange={setSend}
                  />
                </div>
                <p className="flex gap-2 rounded-2xl bg-royal-50 px-3.5 py-3 text-[13px] leading-normal text-ink-600">
                  <Icon name="lock" size={16} className="mt-0.5 shrink-0 text-royal-600" />
                  Une fois émise, la facture reçoit son numéro définitif et ne peut plus être
                  modifiée ni supprimée. En cas d’erreur, elle pourra être supprimée depuis l’onglet
                  Factures.
                </p>
                <div className="flex flex-wrap justify-end gap-2.5">
                  <Button onClick={close}>Annuler</Button>
                  <Button
                    variant="primary"
                    disabled={ok.missingCabinet.length > 0}
                    icon={<Icon name={sending ? 'mail' : 'invoice'} size={17} />}
                    onClick={() => void emit()}
                  >
                    {sending ? 'Émettre et envoyer' : 'Émettre la facture'}
                  </Button>
                </div>
              </>
            )}

            {step === 'emitting' && (
              <motion.div
                role="status"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE_SOFT }}
                className="flex items-center gap-3 rounded-2xl bg-white px-[18px] py-4 text-[14px] font-bold text-ink-900 shadow-card"
              >
                <span className="text-royal-600">
                  <Spinner />
                </span>
                {sending
                  ? 'Attribution du numéro, génération du PDF et envoi…'
                  : 'Attribution du numéro et génération du PDF…'}
              </motion.div>
            )}

            {step === 'done' && result && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE_SOFT }}
                className="flex flex-col gap-3"
              >
                <div
                  role="status"
                  className="flex flex-col gap-2 rounded-2xl bg-[linear-gradient(180deg,#E3FAF5,#C9F2EA)] px-[18px] py-4 text-[14px] font-bold text-aqua-ink shadow-[inset_0_1px_0_#FFFFFF,0_12px_26px_-16px_rgba(15,76,69,0.6)]"
                >
                  <span className="flex items-center gap-2">
                    <Icon name="check" size={17} strokeWidth={2.6} />
                    Facture N° {result.numero} émise et enregistrée
                  </span>
                  {result.sent?.ok && (
                    <span className="flex items-center gap-2">
                      <Icon name="mail" size={17} />
                      Envoyée à {result.sent.to}
                    </span>
                  )}
                </div>
                {result.sent && !result.sent.ok && (
                  <p className="rounded-2xl bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-ink">
                    E-mail non envoyé : {sendErrorMessage(result.sent.error)}. Vous pourrez la
                    renvoyer depuis l’onglet Factures.
                  </p>
                )}
                <div className="flex flex-wrap gap-2.5">
                  <Button
                    className="flex-[1_1_140px]"
                    icon={<Icon name="download" size={16} />}
                    onClick={async () => {
                      const r = await window.api.invoices.savePdf(result.factureId)
                      if (r.ok) toast.show('PDF enregistré')
                      else if (r.reason === 'error') toast.show('PDF indisponible', 'error')
                    }}
                  >
                    Télécharger le PDF
                  </Button>
                  <Button
                    className="flex-[1_1_100px]"
                    icon={<Icon name="printer" size={16} />}
                    onClick={() => void window.api.invoices.print(result.factureId)}
                  >
                    Imprimer
                  </Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <Link
                    to={`/factures?patient=${patientId}&facture=${result.factureId}`}
                    className="text-[14px] font-bold text-royal-600 hover:text-royal-700"
                    onClick={onClose}
                  >
                    Voir ses factures →
                  </Link>
                  <Button variant="primary" onClick={onClose}>
                    Terminer
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </Dialog>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2.5">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right font-bold">{children}</dd>
    </div>
  )
}
