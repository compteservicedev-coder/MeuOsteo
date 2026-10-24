import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Link,
  useBlocker,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { formatIsoDateFr } from '@shared/domain/dates'
import { isAddressComplete } from '@shared/domain/patient'
import {
  MARK_DONE_MESSAGES,
  compareSeancesDesc,
  existingSessionMessage,
  markDoneErrors,
} from '@shared/domain/seance'
import type { PatientDetail, SeanceFailure, SeanceView } from '@shared/types/patients'
import { Page } from '../components/layout/Page'
import { useToast } from '../components/toast/toastContext'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { PatientEditDrawer } from '../features/patients/PatientEditDrawer'
import { ADDRESS_FIELDS } from '../features/patients/draft'
import { CommentPanel } from '../features/patients/fiche/CommentPanel'
import { FicheBanner } from '../features/patients/fiche/FicheBanner'
import { HistoryPanel } from '../features/patients/fiche/HistoryPanel'
import { PendingChangesDialog } from '../features/patients/fiche/PendingChangesDialog'
import { SeanceDetail } from '../features/patients/fiche/SeanceDetail'
import { SeanceList } from '../features/patients/fiche/SeanceList'
import {
  changesOf,
  draftOf,
  isDirty,
  type SeanceDraft,
} from '../features/patients/fiche/seanceDraft'
import { staggerItem } from '../lib/motion'
import { todayIso } from '../lib/today'

interface TrailEntry {
  id: string
  name: string
}

type PendingAction = { kind: 'select'; id: string } | { kind: 'create' } | { kind: 'route' }

type DrawerState = { reason: { message: string; fields: typeof ADDRESS_FIELDS } | null } | null

/** Session selected on arrival: the one asked for, today's, the last past one, or the newest. */
function defaultSelection(d: PatientDetail, wanted: string | null, today: string): string | null {
  if (wanted && d.seances.some((s) => s.id === wanted)) return wanted
  const todays = d.seances.find((s) => s.date === today && s.status !== 'cancelled')
  return (todays ?? d.seances.find((s) => s.date <= today) ?? d.seances[0])?.id ?? null
}

function failureMessage(f: SeanceFailure, prenom: string): string {
  switch (f.reason) {
    case 'same_day':
      return `${prenom} a déjà une séance ce jour-là`
    case 'locked':
      return 'La date et le tarif restent liés à la facture'
    case 'invalid_date':
      return 'Date invalide : une séance réalisée ne peut pas être dans le futur'
    case 'mark_done':
      return MARK_DONE_MESSAGES[f.errors[0]!]
    case 'invoiced':
      return 'Une séance facturée ne peut pas être supprimée : supprimez d’abord la facture'
    case 'not_found':
      return 'Séance introuvable'
    default:
      return 'Cette séance ne peut pas être modifiée'
  }
}

/** /patients/:id — remounted for each record, so that no state leaks from one to the next. */
export function FichePage() {
  const { id } = useParams()
  return <FicheScreen key={id} id={id!} />
}

function FicheScreen({ id }: { id: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const toast = useToast()
  const today = todayIso()
  const trail = (location.state as { trail?: TrailEntry[] } | null)?.trail ?? []

  const [detail, setDetail] = useState<PatientDetail | null | undefined>(undefined)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<SeanceDraft | null>(null)
  const [editing, setEditing] = useState(false)
  const [bin, setBin] = useState<'cancel' | 'delete' | null>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [freshId, setFreshId] = useState<string | null>(null)
  const [swap, setSwap] = useState(0)
  const [doneShake, setDoneShake] = useState(0)
  const [drawer, setDrawer] = useState<DrawerState>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyVersion, setHistoryVersion] = useState(0)
  const [flash, setFlash] = useState(0)

  const selected = detail?.seances.find((s) => s.id === selectedId)
  const dirty = isDirty(draft, selected)
  const prenom = detail?.patient.prenom ?? ''

  const reload = useCallback(async () => {
    const d = await window.api.patients.get(id)
    setDetail(d)
    return d
  }, [id])

  const select = (seance: SeanceView | undefined) => {
    setSelectedId(seance?.id ?? null)
    setDraft(seance ? draftOf(seance) : null)
    setEditing(false)
    setBin(null)
    setSwap((n) => n + 1)
  }

  useEffect(() => {
    void reload().then((d) => {
      if (!d || d.patient.deletedAt) return
      void window.api.patients.markOpened(id)
      const first = defaultSelection(d, searchParams.get('seance'), today)
      select(d.seances.find((s) => s.id === first))
    })
    // Loaded once per record (the component is keyed by id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applySeance = (updated: SeanceView) => {
    setDetail((d) =>
      d
        ? {
            ...d,
            seances: d.seances
              .map((s) => (s.id === updated.id ? updated : s))
              .sort(compareSeancesDesc),
          }
        : d,
    )
    setDraft(draftOf(updated))
  }

  // ── Session actions ────────────────────────────────────────────────────

  const save = async (): Promise<boolean> => {
    if (!selected || !draft) return false
    const changes = changesOf(draft, selected)
    const wasEditing = editing
    if (Object.keys(changes).length === 0) {
      if (wasEditing) {
        setEditing(false)
        toast.show('Modifications enregistrées · séance reverrouillée')
      }
      return true
    }
    setBusy(true)
    const result = await window.api.seances.save(selected.id, changes)
    setBusy(false)
    if (!result.ok) {
      toast.show(failureMessage(result, prenom), 'error')
      return false
    }
    applySeance(result.seance)
    setEditing(false)
    toast.show(
      wasEditing ? 'Modifications enregistrées · séance reverrouillée' : 'Séance enregistrée',
    )
    return true
  }

  const markDone = async () => {
    if (!selected || !draft) return
    const errors = markDoneErrors(draft, today)
    if (errors.length > 0) {
      setDoneShake((n) => n + 1)
      toast.show(MARK_DONE_MESSAGES[errors.find((e) => e !== 'future') ?? errors[0]!], 'error')
      return
    }
    setBusy(true)
    const result = await window.api.seances.markDone(selected.id, changesOf(draft, selected))
    setBusy(false)
    if (!result.ok) {
      setDoneShake((n) => n + 1)
      toast.show(failureMessage(result, prenom), 'error')
      return
    }
    applySeance(result.seance)
    toast.show('Séance réalisée · elle est maintenant verrouillée')
  }

  const create = async () => {
    const result = await window.api.seances.createToday(id)
    if (!result.ok) return
    if (result.existing) {
      select(detail?.seances.find((s) => s.id === result.seance.id) ?? result.seance)
      toast.show(existingSessionMessage(result.seance), 'info')
      return
    }
    setDetail((d) =>
      d ? { ...d, seances: [...d.seances, result.seance].sort(compareSeancesDesc) } : d,
    )
    setFreshId(result.seance.id)
    select(result.seance)
  }

  const perform = (action: PendingAction) => {
    if (action.kind === 'select') select(detail?.seances.find((s) => s.id === action.id))
    else if (action.kind === 'create') void create()
    else if (blocker.state === 'blocked') blocker.proceed()
  }

  /** R-05: unsaved changes ask « Rester / Ne pas enregistrer / Enregistrer » first. */
  const guard = (action: PendingAction) => {
    if (dirty) setPending(action)
    else perform(action)
  }

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (blocker.state === 'blocked') setPending({ kind: 'route' })
  }, [blocker.state])

  const resolvePending = async (choice: 'stay' | 'discard' | 'save') => {
    const action = pending
    setPending(null)
    if (!action) return
    if (choice === 'stay') {
      if (action.kind === 'route' && blocker.state === 'blocked') blocker.reset()
      return
    }
    if (choice === 'save' && !(await save())) {
      if (action.kind === 'route' && blocker.state === 'blocked') blocker.reset()
      return
    }
    if (choice === 'discard' && selected) {
      setDraft(draftOf(selected))
      setEditing(false)
    }
    perform(action)
  }

  const confirmBin = async (reason: string | null) => {
    if (!selected) return
    const dateFr = formatIsoDateFr(selected.date)
    setBusy(true)
    if (bin === 'delete') {
      const result = await window.api.seances.delete(selected.id)
      setBusy(false)
      if (!result.ok) {
        toast.show(failureMessage(result, prenom), 'error')
        return
      }
      const rest = detail!.seances.filter((s) => s.id !== selected.id)
      const index = detail!.seances.findIndex((s) => s.id === selected.id)
      setDetail((d) => (d ? { ...d, seances: rest } : d))
      select(rest[Math.min(index, rest.length - 1)])
      setHistoryVersion((n) => n + 1)
      toast.show(`Séance du ${dateFr} supprimée`)
      return
    }
    const result = await window.api.seances.cancel(selected.id, reason ?? '')
    setBusy(false)
    if (!result.ok) {
      toast.show(failureMessage(result, prenom), 'error')
      return
    }
    applySeance(result.seance)
    setBin(null)
    toast.show(
      `Séance du ${dateFr} annulée${selected.source === 'doctolib' ? ' · pensez à Doctolib' : ''}`,
    )
  }

  const restore = async () => {
    if (!selected) return
    const result = await window.api.seances.restore(selected.id)
    if (!result.ok) {
      toast.show(failureMessage(result, prenom), 'error')
      return
    }
    applySeance(result.seance)
    toast.show(`Séance du ${formatIsoDateFr(selected.date)} rétablie`)
  }

  // Ctrl+S saves the session being edited (SPEC §1).
  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Record actions ─────────────────────────────────────────────────────

  const openRelative = (relativeId: string) => {
    if (dirty || editing || drawer) {
      toast.show('Enregistrez ou abandonnez vos modifications avant de changer de fiche', 'error')
      return
    }
    const name = detail ? `${detail.patient.prenom} ${detail.patient.nom}` : ''
    navigate(`/patients/${relativeId}`, { state: { trail: [...trail, { id, name }] } })
  }

  const goBack = () => {
    const last = trail.at(-1)
    if (!last) return
    if (dirty || editing) {
      toast.show('Enregistrez ou abandonnez vos modifications avant de changer de fiche', 'error')
      return
    }
    navigate(`/patients/${last.id}`, { state: { trail: trail.slice(0, -1) } })
  }

  // ── Render ─────────────────────────────────────────────────────────────

  if (detail === undefined) return null
  if (detail === null) {
    return (
      <Page>
        <motion.div variants={staggerItem} className="rounded-card-lg bg-white p-8 shadow-card">
          <h1 className="text-section">Cette fiche n’existe plus.</h1>
          <Link to="/patients" className="mt-3 inline-block font-bold text-royal-600">
            Retour aux patients
          </Link>
        </motion.div>
      </Page>
    )
  }

  const p = detail.patient
  const name = `${p.prenom} ${p.nom}`

  if (p.deletedAt) {
    return (
      <Page>
        <motion.section
          variants={staggerItem}
          aria-labelledby="h-gone"
          className="mx-auto mt-10 flex w-full max-w-[520px] flex-col items-center gap-3 rounded-[26px] bg-white px-8 py-10 text-center shadow-card"
        >
          <span
            aria-hidden="true"
            className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-red-50 text-red-600"
          >
            <Icon name="trash" size={26} />
          </span>
          <h1 id="h-gone" className="text-[22px] font-extrabold">
            {name} a été supprimé(e)
          </h1>
          <p className="text-[15px] text-ink-600">
            Les factures restent consultables dans le registre. Une ligne a été ajoutée au journal.
            La fiche reste récupérable pendant 30 jours (Paramètres &gt; Données &amp; import).
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button
              onClick={async () => {
                await window.api.patients.restore(id)
                const d = await reload()
                if (d) select(d.seances.find((s) => s.id === defaultSelection(d, null, today)))
                toast.show('Suppression annulée')
              }}
            >
              Annuler la suppression
            </Button>
            <Link to="/patients" className="btn btn-primary">
              Retour aux patients
            </Link>
          </div>
        </motion.section>
      </Page>
    )
  }

  const index = selected ? detail.seances.findIndex((s) => s.id === selected.id) : -1

  return (
    <Page>
      <FicheBanner
        detail={detail}
        flash={flash}
        historyOpen={historyOpen}
        backTo={trail.at(-1) ?? null}
        onEdit={() => setDrawer({ reason: null })}
        onToggleHistory={() => setHistoryOpen((o) => !o)}
        onOpenRelative={openRelative}
        onBack={goBack}
      />
      {historyOpen && (
        <HistoryPanel
          patientId={id}
          version={historyVersion}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      <div className="flex flex-wrap items-stretch gap-[18px]">
        <SeanceList
          seances={detail.seances}
          selectedId={selectedId}
          freshId={freshId}
          today={today}
          onSelect={(sid) => {
            if (sid !== selectedId) guard({ kind: 'select', id: sid })
          }}
          onCreate={() => guard({ kind: 'create' })}
        />
        {selected && draft ? (
          <SeanceDetail
            seance={selected}
            draft={draft}
            onChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
            position={detail.seances.length - index}
            total={detail.seances.length}
            fresh={selected.id === freshId}
            editing={editing}
            dirty={dirty}
            busy={busy}
            tarifs={detail.tarifsCents}
            addressComplete={isAddressComplete(p)}
            today={today}
            doneShake={doneShake}
            swap={swap}
            bin={bin}
            onAskBin={() => setBin(selected.status === 'done' ? 'delete' : 'cancel')}
            onBackBin={() => setBin(null)}
            onConfirmBin={(reason) => void confirmBin(reason)}
            onStartEdit={() => setEditing(true)}
            onCancelEdit={() => {
              setDraft(draftOf(selected))
              setEditing(false)
            }}
            onSave={() => void save()}
            onMarkDone={() => void markDone()}
            onRestore={() => void restore()}
            onCompleteAddress={() =>
              setDrawer({
                reason: {
                  message:
                    'L’adresse complète (rue, code postal, commune) est obligatoire pour émettre une facture.',
                  fields: ADDRESS_FIELDS,
                },
              })
            }
          />
        ) : (
          <motion.section
            variants={staggerItem}
            className="flex min-w-0 flex-[999_1_420px] flex-col items-center justify-center gap-2 rounded-card-lg border border-line-faint bg-white p-10 text-center shadow-card"
          >
            <h2 className="text-section">Aucune séance</h2>
            <p className="text-[15px] text-ink-600">
              Les RDV Doctolib apparaîtront ici. « Nouvelle » crée une séance du jour, hors
              Doctolib.
            </p>
          </motion.section>
        )}
        <CommentPanel
          patientId={id}
          sexe={p.sexe}
          initialComment={p.commentaire ?? ''}
          initialUpdatedAt={p.commentaireUpdatedAt}
          initialTags={p.antecedentsTags}
        />
      </div>

      <PatientEditDrawer
        open={drawer !== null}
        onClose={() => setDrawer(null)}
        detail={detail}
        reason={drawer?.reason ?? null}
        onSaved={(_id, changed) => {
          setDrawer(null)
          void reload()
          setHistoryVersion((n) => n + 1)
          if (changed.length > 0) {
            setFlash((n) => n + 1)
            toast.show('Fiche patient mise à jour')
          }
        }}
        onRelativesChanged={() => {
          void reload()
          setHistoryVersion((n) => n + 1)
        }}
        onDeleted={() => {
          setDrawer(null)
          void reload()
        }}
      />

      <PendingChangesDialog
        open={pending !== null}
        dateFr={selected ? formatIsoDateFr(selected.date) : ''}
        onStay={() => void resolvePending('stay')}
        onDiscard={() => void resolvePending('discard')}
        onSave={() => void resolvePending('save')}
      />
    </Page>
  )
}
