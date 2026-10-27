import { useEffect, useState } from 'react'
import { formatIsoDateFr } from '@shared/domain/dates'
import { DOCUMENT_CATEGORY_LABELS, formatBytesFr } from '@shared/domain/documents'
import type { DocumentView, EmailPreview } from '@shared/types/documents'
import { Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import { Icon } from '../../../components/ui/Icon'
import { Spinner } from '../../../components/ui/Spinner'

type Loaded =
  | { kind: 'loading' }
  | { kind: 'url'; url: string }
  | { kind: 'text'; text: string }
  | { kind: 'email'; mail: EmailPreview }
  | { kind: 'none' }

function useDocumentContent(doc: DocumentView | null): Loaded {
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' })
  useEffect(() => {
    if (!doc) return
    let url: string | null = null
    let alive = true
    setLoaded({ kind: 'loading' })
    const load = async (): Promise<Loaded> => {
      if (doc.preview === 'email') {
        const mail = await window.api.documents.email(doc.id)
        return mail ? { kind: 'email', mail } : { kind: 'none' }
      }
      if (doc.preview === 'none') return { kind: 'none' }
      const content = await window.api.documents.content(doc.id)
      if (!content) return { kind: 'none' }
      if (doc.preview === 'text') {
        return { kind: 'text', text: new TextDecoder().decode(content.bytes) }
      }
      // A blob URL lives in this window only and is revoked when the preview closes.
      url = URL.createObjectURL(new Blob([new Uint8Array(content.bytes)], { type: content.mime }))
      return { kind: 'url', url }
    }
    void load().then((l) => {
      if (alive) setLoaded(l)
      else if (url) URL.revokeObjectURL(url)
    })
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [doc])
  return loaded
}

function EmailView({ mail }: { mail: EmailPreview }) {
  const rows: Array<[string, string]> = [
    ['De', mail.from],
    ['À', mail.to],
    ['Cc', mail.cc],
    [
      'Date',
      mail.date
        ? new Date(mail.date).toLocaleString('fr-FR', {
            timeZone: 'Europe/Paris',
            dateStyle: 'short',
            timeStyle: 'short',
          })
        : '',
    ],
  ]
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="rounded-2xl border border-line-faint bg-surface-mist px-4 py-3">
        <p className="text-[17px] font-extrabold text-ink-900">{mail.subject || '(sans objet)'}</p>
        <dl className="mt-1 grid grid-cols-[48px_1fr] gap-x-2 gap-y-0.5 text-[14px]">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-bold text-ink-500">{k}</dt>
                <dd className="min-w-0 break-words text-ink-900">{v}</dd>
              </div>
            ))}
        </dl>
        {mail.attachments.length > 0 && (
          <p className="mt-2 text-[13px] text-ink-600">
            Pièces jointes :{' '}
            {mail.attachments.map((a) => `${a.name} (${formatBytesFr(a.sizeBytes)})`).join(', ')}
          </p>
        )}
      </div>
      <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-2xl border border-line-faint bg-white p-4 font-sans text-[15px] leading-relaxed text-ink-900">
        {mail.text || 'Ce message ne contient pas de texte.'}
      </pre>
    </div>
  )
}

interface DocumentPreviewDialogProps {
  doc: DocumentView | null
  onClose: () => void
  onOpen: (doc: DocumentView) => void
  onSaveAs: (doc: DocumentView) => void
}

/** R-26 preview inside the application: images, PDF, e-mails (.eml) and text. */
export function DocumentPreviewDialog({
  doc,
  onClose,
  onOpen,
  onSaveAs,
}: DocumentPreviewDialogProps) {
  const loaded = useDocumentContent(doc)
  return (
    <Dialog
      open={doc !== null}
      onOpenChange={(open) => !open && onClose()}
      title={doc?.titre ?? ''}
      description={
        doc
          ? `${DOCUMENT_CATEGORY_LABELS[doc.categorie]} · ${formatIsoDateFr(doc.docDate)} · ${formatBytesFr(doc.sizeBytes)}`
          : undefined
      }
      className="h-[min(900px,92vh)] max-w-[min(1100px,94vw)] overflow-hidden"
      footer={
        doc && (
          <>
            <Button icon={<Icon name="download" size={16} />} onClick={() => onSaveAs(doc)}>
              Enregistrer sous…
            </Button>
            <Button
              variant="primary"
              icon={<Icon name="external" size={16} />}
              onClick={() => onOpen(doc)}
            >
              Ouvrir avec le logiciel du PC
            </Button>
          </>
        )
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {loaded.kind === 'loading' && (
          <div className="flex flex-1 items-center justify-center text-ink-500">
            <Spinner />
          </div>
        )}
        {loaded.kind === 'url' && doc?.preview === 'image' && (
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-2xl bg-surface-mist p-2">
            <img
              src={loaded.url}
              alt={doc.titre}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        )}
        {loaded.kind === 'url' && doc?.preview === 'pdf' && (
          <iframe
            src={loaded.url}
            title={doc.titre}
            className="min-h-0 w-full flex-1 rounded-2xl border border-line-faint bg-white"
          />
        )}
        {loaded.kind === 'text' && (
          <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-2xl border border-line-faint bg-white p-4 font-sans text-[15px] leading-relaxed text-ink-900">
            {loaded.text}
          </pre>
        )}
        {loaded.kind === 'email' && <EmailView mail={loaded.mail} />}
        {loaded.kind === 'none' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <Icon name="file" size={40} className="text-ink-500" />
            <p className="text-[15px] text-ink-600">
              Ce type de fichier ne s’affiche pas dans MeuOsteo.
              <br />« Ouvrir avec le logiciel du PC » l’ouvre dans Word, la visionneuse photo…
            </p>
          </div>
        )}
      </div>
    </Dialog>
  )
}
