import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { formatDateTimeFr, formatIsoDateFr } from '@shared/domain/dates'
import { INVOICE_STATUS_LABELS, formatEuros } from '@shared/domain/invoice'
import { InvoiceDocument } from '@shared/invoice/InvoiceDocument'
import type { InvoiceDetail } from '@shared/types/invoices'
import { useToast } from '../../components/toast/toastContext'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { Spinner } from '../../components/ui/Spinner'
import { cn } from '../../lib/cn'
import { EASE_SOFT } from '../../lib/motion'
import { sendErrorMessage } from './messages'

interface InvoiceDetailPanelProps {
  id: string
  onClose: () => void
  /** Something changed (status, sending): the register reloads. */
  onChanged: () => void
  onOpenSeance: (patientId: string, seanceId: string) => void
}

/** Detail of the selected invoice (SPEC §6): preview, links, history and actions. */
export function InvoiceDetailPanel({
  id,
  onClose,
  onChanged,
  onOpenSeance,
}: InvoiceDetailPanelProps) {
  const toast = useToast()
  const [detail, setDetail] = useState<InvoiceDetail | null | undefined>(undefined)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)

  const load = useCallback(async () => setDetail(await window.api.invoices.detail(id)), [id])
  useEffect(() => {
    setConfirm(false)
    void load()
  }, [load])

  if (detail === undefined) {
    return (
      <div className="flex justify-center rounded-card-lg bg-white p-10 text-royal-600 shadow-card">
        <Spinner />
      </div>
    )
  }
  if (detail === null) {
    return <p className="rounded-card-lg bg-white p-6 shadow-card">Facture introuvable.</p>
  }

  const { row } = detail
  const deleted = row.statut === 'deleted'
  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key)
    try {
      await action()
    } finally {
      setBusy(null)
    }
  }

  const resend = () =>
    run('send', async () => {
      const r = await window.api.invoices.send(id)
      if (r.ok) toast.show(`Facture envoyée à ${r.to}`)
      else toast.show(`Envoi impossible : ${sendErrorMessage(r.error)}`, 'error')
      await load()
      onChanged()
    })

  const sentLines = detail.envois.filter((e) => e.ok)
  const failed = detail.envois.filter((e) => !e.ok).at(-1)
  const ref = deleted
    ? `Supprimée le ${formatIsoDateFr(row.deletedAt!.slice(0, 10))}${detail.avoirNumero ? ` · avoir ${detail.avoirNumero}` : ''}`
    : row.modifiedAt
      ? `Modifiée le ${formatIsoDateFr(row.modifiedAt.slice(0, 10))}${detail.modifiedNote ? ` (${detail.modifiedNote.toLowerCase()})` : ''}`
      : '—'

  return (
    <section
      aria-labelledby="h-inv"
      className="flex flex-col gap-4 rounded-card-lg border border-line-faint bg-white px-5 py-[18px] shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-[#0B7F99]">
            Note d’honoraires
          </p>
          <h2 id="h-inv" className={cn('text-[20px] font-extrabold', deleted && 'line-through')}>
            N° {row.numero}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le détail"
          className="btn btn-ghost btn-ink -mr-2 h-11 w-11 px-0 text-ink-500"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      <div className="relative h-[360px] overflow-hidden rounded-lg border border-line shadow-[0_18px_36px_-24px_rgba(15,30,70,0.45)]">
        <div
          aria-hidden="true"
          className="pointer-events-none origin-top-left"
          style={{ width: 620, transform: `scale(${PREVIEW_SCALE})` }}
        >
          <InvoiceDocument data={detail.document} stamp={deleted ? 'SUPPRIMÉE' : null} />
        </div>
      </div>

      <dl className="flex flex-col gap-2 text-[14px]">
        <Line label="Séance">
          {detail.seanceExists && row.patientId && row.seanceId ? (
            <button
              type="button"
              className="font-bold text-royal-600 hover:text-royal-700"
              onClick={() => onOpenSeance(row.patientId!, row.seanceId!)}
            >
              {formatIsoDateFr(row.dateSeance)} · ouvrir →
            </button>
          ) : (
            formatIsoDateFr(row.dateSeance)
          )}
        </Line>
        <Line label="Montant">{formatEuros(row.montantCents)}</Line>
        <Line label="Statut">{INVOICE_STATUS_LABELS[row.statusKey]}</Line>
        <Line label="Envoi">
          {sentLines.length === 0 ? (
            'Non envoyé'
          ) : (
            <span className="flex flex-col items-end">
              {sentLines.map((e) => (
                <span key={e.at}>
                  {e.canal === 'email' ? `E-mail à ${e.destinataire}` : 'Imprimée'} ·{' '}
                  {formatDateTimeFr(new Date(e.at))}
                </span>
              ))}
            </span>
          )}
        </Line>
        {failed && sentLines.every((e) => e.at < failed.at) && (
          <p className="rounded-control bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-ink">
            Dernier envoi échoué le {formatDateTimeFr(new Date(failed.at))}
          </p>
        )}
        <Line label="Lien">{ref}</Line>
      </dl>

      {!confirm && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            icon={<Icon name="download" size={15} />}
            loading={busy === 'pdf'}
            onClick={() =>
              void run('pdf', async () => {
                const r = await window.api.invoices.openPdf(id)
                if (!r.ok) toast.show('PDF indisponible', 'error')
              })
            }
          >
            PDF
          </Button>
          {!deleted && (
            <Button
              size="sm"
              icon={<Icon name="mail" size={15} />}
              loading={busy === 'send'}
              disabled={!detail.email || !detail.mailConfigured}
              title={
                !detail.email
                  ? 'Pas d’e-mail dans la fiche patient'
                  : !detail.mailConfigured
                    ? 'Gmail n’est pas configuré'
                    : undefined
              }
              onClick={() => void resend()}
            >
              Renvoyer
            </Button>
          )}
          <Button
            size="sm"
            icon={<Icon name="printer" size={15} />}
            loading={busy === 'print'}
            onClick={() =>
              void run('print', async () => {
                await window.api.invoices.print(id)
                await load()
                onChanged()
              })
            }
          >
            Imprimer
          </Button>
          {row.statusKey === 'wait' && (
            <Button
              size="sm"
              variant="primary"
              icon={<Icon name="check" size={15} strokeWidth={2.6} />}
              loading={busy === 'paid'}
              onClick={() =>
                void run('paid', async () => {
                  const r = await window.api.invoices.markPaid(id)
                  if (r.ok) toast.show(`Facture ${row.numero} acquittée`)
                  await load()
                  onChanged()
                })
              }
            >
              Marquer le virement comme reçu
            </Button>
          )}
          {!deleted && (
            <Button
              size="sm"
              className="!text-red-ink"
              icon={<Icon name="trash" size={15} />}
              onClick={() => setConfirm(true)}
            >
              Supprimer la facture…
            </Button>
          )}
        </div>
      )}

      {confirm && (
        <motion.div
          role="alertdialog"
          aria-labelledby="t-del-inv"
          aria-describedby="p-del-inv"
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: EASE_SOFT }}
          className="flex flex-col gap-3 rounded-2xl border border-red-600/30 bg-[linear-gradient(180deg,#FFF5F5,#FDE8E8)] px-4 py-3.5"
        >
          <span id="t-del-inv" className="text-[15px] font-extrabold text-red-ink">
            Supprimer la facture {row.numero} ({formatEuros(row.montantCents)}) ?
          </span>
          <span id="p-del-inv" className="text-[14px] text-[#7A1015]">
            Elle restera visible dans la liste, barrée, avec la mention « supprimée ». La séance
            pourra être refacturée. Inscrit au journal.
          </span>
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => setConfirm(false)}>
              Retour
            </Button>
            <Button
              size="sm"
              variant="danger"
              loading={busy === 'delete'}
              onClick={() =>
                void run('delete', async () => {
                  const r = await window.api.invoices.delete(id)
                  setConfirm(false)
                  if (r.ok) toast.show(`Facture ${row.numero} supprimée`)
                  else toast.show('Cette facture ne peut pas être supprimée', 'error')
                  await load()
                  onChanged()
                })
              }
            >
              Supprimer
            </Button>
          </div>
        </motion.div>
      )}
    </section>
  )
}

/** The A4 template is laid out at 620 px and shown at half size. */
const PREVIEW_SCALE = 0.49

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  )
}
