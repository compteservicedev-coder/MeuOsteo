import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import { formatIsoDateFr } from '@shared/domain/dates'
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  MAX_DOCUMENT_BYTES,
  formatBytesFr,
  type DocumentCategory,
} from '@shared/domain/documents'
import type {
  AddDocumentsResult,
  DocumentChanges,
  DocumentUpload,
  DocumentView,
} from '@shared/types/documents'
import { useToast } from '../../../components/toast/toastContext'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Drawer } from '../../../components/ui/Drawer'
import { Field, Input, Select } from '../../../components/ui/Field'
import { Icon, type IconName } from '../../../components/ui/Icon'
import { cn } from '../../../lib/cn'
import { DocumentPreviewDialog } from './DocumentPreviewDialog'

const REFUSAL: Record<AddDocumentsResult['refused'][number]['reason'], string> = {
  empty: 'fichier vide',
  too_large: `plus de ${formatBytesFr(MAX_DOCUMENT_BYTES)}`,
  unreadable: 'illisible',
}

const ICONS: Record<DocumentView['preview'], IconName> = {
  image: 'image',
  pdf: 'invoice',
  email: 'mail',
  text: 'file',
  none: 'file',
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`

interface DocumentsDrawerProps {
  open: boolean
  onClose: () => void
  patientId: string
  patientName: string
  onCountChange: (count: number) => void
}

/** R-26 « Documents » of a record: drop or choose files, filter, preview, rename, delete. */
export function DocumentsDrawer({
  open,
  onClose,
  patientId,
  patientName,
  onCountChange,
}: DocumentsDrawerProps) {
  const toast = useToast()
  const [docs, setDocs] = useState<DocumentView[] | null>(null)
  const [filter, setFilter] = useState<DocumentCategory | null>(null)
  const [editing, setEditing] = useState<{ id: string; draft: DocumentChanges } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [preview, setPreview] = useState<DocumentView | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    const list = await window.api.documents.list(patientId)
    setDocs(list)
    onCountChange(list.length)
  }, [patientId, onCountChange])

  useEffect(() => {
    if (open) void reload()
  }, [open, reload])

  const counts = useMemo(() => {
    const m = new Map<DocumentCategory, number>()
    for (const d of docs ?? []) m.set(d.categorie, (m.get(d.categorie) ?? 0) + 1)
    return m
  }, [docs])
  const shown = (docs ?? []).filter((d) => !filter || d.categorie === filter)

  const report = (r: AddDocumentsResult | null, extraRefused: AddDocumentsResult['refused']) => {
    if (!r) {
      toast.show('Cette fiche ne peut plus recevoir de documents', 'error')
      return
    }
    const refused = [...extraRefused, ...r.refused]
    if (r.added.length)
      toast.show(`${plural(r.added.length, 'document')} ajouté${r.added.length > 1 ? 's' : ''}`)
    if (refused.length) {
      toast.show(
        `Non ajouté : ${refused.map((f) => `${f.name} (${REFUSAL[f.reason]})`).join(', ')}`,
        'error',
      )
    }
    if (r.added.length === 1 && !refused.length) {
      // The title and category are guessed: offer to correct them right away.
      const d = r.added[0]!
      setEditing({
        id: d.id,
        draft: { titre: d.titre, categorie: d.categorie, docDate: d.docDate },
      })
    }
  }

  const addFiles = async (files: File[]) => {
    if (!files.length) return
    setBusy(true)
    try {
      const refused: AddDocumentsResult['refused'] = []
      const uploads: DocumentUpload[] = []
      for (const f of files.slice(0, 50)) {
        // Checked here first: a heavy file is never read nor sent.
        if (f.size > MAX_DOCUMENT_BYTES) refused.push({ name: f.name, reason: 'too_large' })
        else if (f.size === 0) refused.push({ name: f.name, reason: 'empty' })
        else uploads.push({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })
      }
      const r = uploads.length
        ? await window.api.documents.add(patientId, uploads)
        : { added: [], refused: [] }
      report(r, refused)
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const choose = async () => {
    setBusy(true)
    try {
      const r = await window.api.documents.chooseAndAdd(patientId)
      report(r, [])
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const saveEdit = async () => {
    if (!editing) return
    if (!editing.draft.titre.trim()) {
      toast.show('Le titre est obligatoire', 'error')
      return
    }
    const updated = await window.api.documents.update(editing.id, editing.draft)
    if (!updated) toast.show('Document introuvable', 'error')
    setEditing(null)
    await reload()
  }

  const remove = async (id: string) => {
    await window.api.documents.delete(id)
    setConfirmDelete(null)
    toast.show('Document supprimé')
    await reload()
  }

  const openExternally = async (doc: DocumentView) => {
    const r = await window.api.documents.open(doc.id)
    if (!r.ok) toast.show('Aucun logiciel du PC ne sait ouvrir ce fichier', 'error')
  }

  const saveAs = async (doc: DocumentView) => {
    const r = await window.api.documents.saveAs(doc.id)
    if (r.ok) toast.show('Copie enregistrée')
    else if (r.reason === 'error') toast.show('Enregistrement impossible', 'error')
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    void addFiles(Array.from(event.dataTransfer.files))
  }

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(o) => !o && onClose()}
        title="Documents"
        description={`${patientName} · radios, comptes-rendus, courriers, e-mails… Chiffrés avec la base et inclus dans chaque sauvegarde.`}
        className="max-w-[760px]"
      >
        <div
          className="flex min-h-full flex-col gap-4"
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
          }}
          onDrop={onDrop}
        >
          <div
            className={cn(
              'flex flex-col items-center gap-2 rounded-card border-2 border-dashed px-4 py-5 text-center transition-colors',
              dragging ? 'border-royal-500 bg-royal-50' : 'border-line bg-white',
            )}
          >
            <Icon name="upload" size={26} className="text-royal-600" />
            <p className="text-[15px] font-bold text-ink-900">
              Glissez des fichiers ici
              <span className="font-semibold text-ink-500">
                {' '}
                · PDF, photos, Word, e-mails (.eml)…
              </span>
            </p>
            <Button variant="primary" size="sm" loading={busy} onClick={() => void choose()}>
              Ajouter des fichiers…
            </Button>
            <p className="text-[13px] text-ink-500">
              {formatBytesFr(MAX_DOCUMENT_BYTES)} maximum par fichier. Pour un e-mail Gmail : ⋮ › «
              Télécharger le message », puis glissez le fichier .eml.
            </p>
          </div>

          {docs && docs.length > 0 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par catégorie">
              {[null, ...DOCUMENT_CATEGORIES.filter((c) => counts.has(c))].map((c) => (
                <button
                  key={c ?? 'all'}
                  type="button"
                  aria-pressed={filter === c}
                  onClick={() => setFilter(c)}
                  className={cn(
                    'min-h-[44px] rounded-pill px-3.5 text-[14px] font-bold transition-colors',
                    filter === c
                      ? 'bg-royal-600 text-white'
                      : 'bg-white text-ink-600 shadow-card hover:bg-royal-50 hover:text-royal-700',
                  )}
                >
                  {c ? DOCUMENT_CATEGORY_LABELS[c] : 'Tous'} ({c ? counts.get(c) : docs.length})
                </button>
              ))}
            </div>
          )}

          {docs?.length === 0 && (
            <p className="py-6 text-center text-[15px] text-ink-500">
              Aucun document pour l’instant.
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {shown.map((d) =>
              editing?.id === d.id ? (
                <li
                  key={d.id}
                  className="flex flex-col gap-3 rounded-card border border-royal-500 bg-white p-4 shadow-card"
                >
                  <Field label="Titre">
                    <Input
                      value={editing.draft.titre}
                      maxLength={120}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          draft: { ...editing.draft, titre: e.target.value },
                        })
                      }
                      onKeyDown={(e) => e.key === 'Enter' && void saveEdit()}
                    />
                  </Field>
                  <div className="flex flex-wrap gap-3">
                    <Field label="Catégorie" className="flex-[1_1_200px]">
                      <Select
                        value={editing.draft.categorie}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            draft: {
                              ...editing.draft,
                              categorie: e.target.value as DocumentCategory,
                            },
                          })
                        }
                      >
                        {DOCUMENT_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {DOCUMENT_CATEGORY_LABELS[c]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Date du document" className="flex-[1_1_160px]">
                      <Input
                        type="date"
                        value={editing.draft.docDate}
                        onChange={(e) =>
                          e.target.value &&
                          setEditing({
                            ...editing,
                            draft: { ...editing.draft, docDate: e.target.value },
                          })
                        }
                      />
                    </Field>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Annuler
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => void saveEdit()}>
                      Enregistrer
                    </Button>
                  </div>
                </li>
              ) : (
                <li
                  key={d.id}
                  className="flex items-center gap-3 rounded-card border border-line-faint bg-white py-2 pl-3 pr-2 shadow-card"
                >
                  <button
                    type="button"
                    onClick={() => setPreview(d)}
                    aria-label={`Aperçu de « ${d.titre} »`}
                    className="flex min-h-[48px] min-w-0 flex-1 items-center gap-3 rounded-control text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-500/30"
                    title="Aperçu"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-royal-50 text-royal-600">
                      <Icon name={ICONS[d.preview]} size={19} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-bold text-ink-900">
                        {d.titre}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2 text-[13px] text-ink-500">
                        <Badge tone="neutral" className="py-0.5">
                          {DOCUMENT_CATEGORY_LABELS[d.categorie]}
                        </Badge>
                        {formatIsoDateFr(d.docDate)} · {formatBytesFr(d.sizeBytes)}
                      </span>
                    </span>
                  </button>
                  {confirmDelete === d.id ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-[13px] font-bold text-red-ink">Supprimer ?</span>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                        Non
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => void remove(d.id)}>
                        Supprimer
                      </Button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center">
                      <button
                        type="button"
                        aria-label={`Ouvrir « ${d.titre} » avec le logiciel du PC`}
                        title="Ouvrir avec le logiciel du PC"
                        onClick={() => void openExternally(d)}
                        className="btn btn-ghost btn-ink h-11 w-11 px-0 text-ink-500"
                      >
                        <Icon name="external" size={17} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Modifier « ${d.titre} »`}
                        title="Renommer, classer, dater"
                        onClick={() =>
                          setEditing({
                            id: d.id,
                            draft: { titre: d.titre, categorie: d.categorie, docDate: d.docDate },
                          })
                        }
                        className="btn btn-ghost btn-ink h-11 w-11 px-0 text-ink-500"
                      >
                        <Icon name="edit" size={17} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Supprimer « ${d.titre} »`}
                        title="Supprimer"
                        onClick={() => setConfirmDelete(d.id)}
                        className="btn btn-ghost btn-ink h-11 w-11 px-0 text-ink-500 hover:text-red-ink"
                      >
                        <Icon name="trash" size={17} />
                      </button>
                    </div>
                  )}
                </li>
              ),
            )}
          </ul>
        </div>
      </Drawer>
      <DocumentPreviewDialog
        doc={preview}
        onClose={() => setPreview(null)}
        onOpen={(d) => void openExternally(d)}
        onSaveAs={(d) => void saveAs(d)}
      />
    </>
  )
}
