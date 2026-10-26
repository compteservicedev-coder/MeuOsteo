import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatIsoDateFr } from '@shared/domain/dates'
import {
  ANOMALY_LABELS,
  DDN_MIN_DATE,
  parseFrenchDate,
  type ImportAnomaly,
  type ImportAnomalyKind,
} from '@shared/domain/legacyImport'
import type { LegacyImportReport, LegacyImportResult } from '@shared/types/legacyImport'
import { useToast } from '../../components/toast/toastContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Icon } from '../../components/ui/Icon'
import { Spinner } from '../../components/ui/Spinner'
import { cn } from '../../lib/cn'
import { notifyDataChanged } from '../../lib/dataEvents'
import { EASE_SOFT } from '../../lib/motion'

type ImportState =
  | { step: 'idle' }
  | { step: 'analyzing'; fileName: string }
  | { step: 'error'; message: string }
  | { step: 'report'; report: LegacyImportReport }
  | { step: 'importing'; report: LegacyImportReport }
  | { step: 'done'; result: Extract<LegacyImportResult, { ok: true }> }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`

const drop = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.35, ease: EASE_SOFT },
}

/** Paramètres > Données & import (SPEC §8.7, docs/MIGRATION.md). */
export function LegacyImportTab() {
  return <LegacyImportCard />
}

function LegacyImportCard() {
  const toast = useToast()
  const navigate = useNavigate()
  const [state, setState] = useState<ImportState>({ step: 'idle' })
  const [typed, setTyped] = useState<Record<string, string>>({})
  const [refused, setRefused] = useState<string | null>(null)
  const [shake, setShake] = useState(0)

  const choose = async () => {
    const file = await window.api.legacyImport.chooseFile()
    if (file.canceled) return
    setTyped({})
    setRefused(null)
    setState({ step: 'analyzing', fileName: file.fileName })
    const result = await window.api.legacyImport.analyze(file.fileId)
    if (result.ok) return setState({ step: 'report', report: result.report })
    setState({
      step: 'error',
      message:
        result.reason === 'tables_missing'
          ? `Ce fichier ne contient pas ${result.missing.length > 1 ? 'les tableaux' : 'le tableau'} ${result.missing.join(' et ')} de MeuOsteo v1.04.`
          : result.reason === 'columns_missing'
            ? `Colonnes introuvables : ${result.missing.join(', ')}.`
            : 'Ce fichier ne peut pas être lu. Vérifiez qu’il s’agit bien du classeur MeuOsteo (.xlsm), fermé dans Excel.',
    })
  }

  const runImport = async (report: LegacyImportReport, corrections: Record<string, string>) => {
    setState({ step: 'importing', report })
    const result = await window.api.legacyImport.run({ fileId: report.fileId, corrections })
    if (result.ok) {
      setState({ step: 'done', result })
      notifyDataChanged()
      toast.show(`Historique importé · ${result.patients} patients, ${result.seances} séances`)
      return
    }
    setState({ step: 'report', report })
    setShake((n) => n + 1)
    setRefused(
      result.reason === 'database_not_empty'
        ? 'La base contient déjà des patients : import refusé.'
        : result.reason === 'file_unknown'
          ? 'Le fichier n’est plus disponible : choisissez-le à nouveau.'
          : 'Certaines dates sont à saisir ou à corriger.',
    )
  }

  return (
    <Card
      title="Reprise de l’historique"
      description="Importer les patients et séances de l’ancien outil Excel"
    >
      <AnimatePresence mode="wait" initial={false}>
        {state.step === 'idle' || state.step === 'error' ? (
          <motion.div key="idle" {...drop} className="flex flex-col gap-3">
            {state.step === 'error' && (
              <p
                role="alert"
                className="flex gap-2 rounded-2xl bg-red-50 px-3.5 py-3 text-[14px] font-bold text-red-ink"
              >
                <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
                {state.message}
              </p>
            )}
            <Button
              variant="primary"
              className="self-start"
              icon={<Icon name="download" size={18} />}
              onClick={() => void choose()}
            >
              Choisir le fichier MeuOsteo (.xlsm)…
            </Button>
          </motion.div>
        ) : state.step === 'analyzing' ? (
          <motion.div
            key="analyzing"
            {...drop}
            role="status"
            className="flex items-center gap-2.5 rounded-2xl bg-surface-mist px-3.5 py-3 text-[14px] font-bold"
          >
            <Spinner className="text-royal-600" />
            Analyse de {state.fileName}…
          </motion.div>
        ) : state.step === 'done' ? (
          <motion.div
            key="done"
            {...drop}
            role="status"
            className="flex flex-col gap-2 rounded-2xl bg-gradient-to-b from-aqua-50 to-[#C9F2EA] px-4 py-3.5 text-[14px] text-aqua-ink"
          >
            <span className="font-extrabold">
              Historique importé : {state.result.patients} patients, {state.result.seances} séances
            </span>
            {state.result.datesToFix > 0 && (
              <span>
                {plural(state.result.datesToFix, 'séance importée', 'séances importées')} avec une
                date à corriger
              </span>
            )}
            {state.result.duplicates > 0 ? (
              <>
                <span>
                  {plural(state.result.duplicates, 'doublon possible', 'doublons possibles')} à
                  vérifier dans « À rapprocher »
                </span>
                <Button size="sm" className="mt-1 self-start" onClick={() => navigate('/planning')}>
                  Ouvrir « À rapprocher »
                </Button>
              </>
            ) : (
              <span>Aucun doublon possible.</span>
            )}
          </motion.div>
        ) : (
          <motion.div key="report" {...drop}>
            <ImportReport
              report={state.report}
              importing={state.step === 'importing'}
              typed={typed}
              onType={(key, text) => {
                setRefused(null)
                setTyped((t) => ({ ...t, [key]: text }))
              }}
              refused={refused}
              shakeSignal={shake}
              onCancel={() => setState({ step: 'idle' })}
              onImport={(corrections) => void runImport(state.report, corrections)}
              onRefuse={(message) => {
                setShake((n) => n + 1)
                setRefused(message)
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

interface ImportReportProps {
  report: LegacyImportReport
  importing: boolean
  typed: Record<string, string>
  onType: (key: string, text: string) => void
  refused: string | null
  shakeSignal: number
  onCancel: () => void
  onImport: (corrections: Record<string, string>) => void
  onRefuse: (message: string) => void
}

/** Step 2 of MIGRATION.md: counts, anomalies, possible duplicates, ignored fields. */
function ImportReport({
  report,
  importing,
  typed,
  onType,
  refused,
  shakeSignal,
  onCancel,
  onImport,
  onRefuse,
}: ImportReportProps) {
  const [details, setDetails] = useState(false)
  const groups = useMemo(() => groupAnomalies(report.anomalies), [report.anomalies])
  const count = (kind: ImportAnomalyKind) => groups.get(kind)?.length ?? 0
  const invalidYears = [
    ...new Set(
      (groups.get('seance_date_invalid') ?? []).map((a) => a.value.match(/\d{4}/)?.[0] ?? a.value),
    ),
  ]
  const blocked = report.existingPatients > 0

  const check = (key: string): { iso: string | null; error: string | null } => {
    const text = typed[key]?.trim() ?? ''
    if (!text) return { iso: null, error: null }
    const iso = parseFrenchDate(text)
    if (!iso) return { iso: null, error: 'Date invalide (JJ/MM/AAAA)' }
    const [min, max] = key.startsWith('ddn:')
      ? [DDN_MIN_DATE, report.today]
      : [report.seanceDateRange.min, report.seanceDateRange.max]
    if (iso < min || iso > max) {
      return {
        iso: null,
        error: `Hors période (${formatIsoDateFr(min)} – ${formatIsoDateFr(max)})`,
      }
    }
    return { iso, error: null }
  }

  const submit = () => {
    const corrections: Record<string, string> = {}
    let invalid = 0
    let missingDdn = 0
    for (const anomaly of report.anomalies) {
      if (!anomaly.correctionKey) continue
      const { iso, error } = check(anomaly.correctionKey)
      if (error) invalid++
      else if (iso) corrections[anomaly.correctionKey] = iso
      else if (anomaly.kind === 'patient_ddn_invalid') missingDdn++
    }
    if (invalid || missingDdn) {
      setDetails(true)
      return onRefuse(
        [
          invalid && `${plural(invalid, 'date')} à corriger`,
          missingDdn && `${plural(missingDdn, 'date de naissance', 'dates de naissance')} à saisir`,
        ]
          .filter(Boolean)
          .join(' · '),
      )
    }
    onImport(corrections)
  }

  const lines: string[] = []
  if (count('seance_date_invalid')) {
    lines.push(
      `${plural(count('seance_date_invalid'), 'date invalide', 'dates invalides')} à corriger (années ${invalidYears.map((y) => `« ${y} »`).join(' et ')})`,
    )
  }
  if (count('seance_date_missing'))
    lines.push(plural(count('seance_date_missing'), 'séance sans date', 'séances sans date'))
  if (count('patient_ddn_invalid')) {
    lines.push(
      `${plural(count('patient_ddn_invalid'), 'date de naissance', 'dates de naissance')} à saisir avant l’import`,
    )
  }
  if (count('seance_prix_missing')) {
    lines.push(
      `${plural(count('seance_prix_missing'), 'séance sans prix', 'séances sans prix')} : tarif par défaut`,
    )
  }
  if (count('seance_orphan')) {
    lines.push(
      `${plural(count('seance_orphan'), 'séance orpheline', 'séances orphelines')} (patient inconnu) : non importée${count('seance_orphan') > 1 ? 's' : ''}`,
    )
  }
  if (count('seance_same_day')) {
    lines.push(
      `${plural(count('seance_same_day'), 'séance', 'séances')} le même jour qu’une autre : conservée${count('seance_same_day') > 1 ? 's' : ''}`,
    )
  }
  if (report.duplicates) {
    lines.push(
      `${plural(report.duplicates, 'doublon possible', 'doublons possibles')} envoyé${report.duplicates > 1 ? 's' : ''} dans « À rapprocher »`,
    )
  }
  lines.push(...report.notes)
  const others = [...groups.keys()].filter(
    (k) =>
      ![
        'seance_date_invalid',
        'seance_date_missing',
        'patient_ddn_invalid',
        'seance_prix_missing',
        'seance_orphan',
        'seance_same_day',
      ].includes(k),
  )
  for (const kind of others) lines.push(`${ANOMALY_LABELS[kind].title} : ${count(kind)}`)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-2xl bg-gradient-to-b from-aqua-50 to-[#C9F2EA] px-4 py-3.5 text-[14px] text-aqua-ink">
        <span className="font-extrabold">
          Prêt à importer : {report.patients} patients · {report.seances} séances
        </span>
        {lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
        <span className="text-[13px] opacity-80">Fichier : {report.fileName}</span>
      </div>

      {report.anomalies.length > 0 && (
        <Button
          size="sm"
          variant="ghost"
          className="self-start"
          aria-expanded={details}
          onClick={() => setDetails((d) => !d)}
        >
          {details ? 'Masquer le détail' : `Voir le détail (${report.anomalies.length})`}
        </Button>
      )}
      <AnimatePresence initial={false}>
        {details && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE_SOFT }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3">
              {[...groups.entries()].map(([kind, anomalies]) => (
                <AnomalyGroup
                  key={kind}
                  kind={kind}
                  anomalies={anomalies}
                  typed={typed}
                  onType={onType}
                  check={check}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {blocked ? (
        <p
          role="alert"
          className="flex gap-2 rounded-2xl bg-amber-50 px-3.5 py-3 text-[14px] font-bold text-amber-ink"
        >
          <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
          La base contient déjà {plural(report.existingPatients, 'patient')} : la reprise de
          l’historique est réservée à une base vide.
        </p>
      ) : (
        refused && (
          <p role="alert" className="text-[14px] font-bold text-red-ink">
            {refused}
          </p>
        )
      )}
      <div className="flex flex-wrap gap-2">
        {!blocked && (
          <Button
            variant="primary"
            size="sm"
            loading={importing}
            shakeSignal={shakeSignal}
            onClick={submit}
          >
            Importer
          </Button>
        )}
        <Button size="sm" disabled={importing} onClick={onCancel}>
          Annuler
        </Button>
      </div>
      {importing && (
        <p role="status" className="text-[13px] text-ink-500">
          Import en cours : une seule opération, rien n’est écrit en cas d’échec.
        </p>
      )}
    </div>
  )
}

function groupAnomalies(anomalies: ImportAnomaly[]) {
  const groups = new Map<ImportAnomalyKind, ImportAnomaly[]>()
  for (const kind of Object.keys(ANOMALY_LABELS) as ImportAnomalyKind[]) {
    const list = anomalies.filter((a) => a.kind === kind)
    if (list.length) groups.set(kind, list)
  }
  return groups
}

function AnomalyGroup({
  kind,
  anomalies,
  typed,
  onType,
  check,
}: {
  kind: ImportAnomalyKind
  anomalies: ImportAnomaly[]
  typed: Record<string, string>
  onType: (key: string, text: string) => void
  check: (key: string) => { iso: string | null; error: string | null }
}) {
  const { title, help } = ANOMALY_LABELS[kind]
  return (
    <section className="rounded-2xl bg-surface-mist px-4 py-3">
      <h3 className="text-[14px] font-extrabold">
        {title} ({anomalies.length})
      </h3>
      <p className="text-[13px] text-ink-500">{help}</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {anomalies.map((a) => {
          const key = a.correctionKey
          const { error } = key ? check(key) : { error: null }
          return (
            <li
              key={`${a.kind}-${a.line}-${a.value}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px]"
            >
              <span className="min-w-[200px] flex-1">
                <span className="text-ink-500">Ligne {a.line} · </span>
                <span className="font-bold">{a.who}</span>
                {a.value ? ` · « ${a.value} »` : kind.includes('date') ? ' · vide' : ''}
              </span>
              {key && (
                <span className="flex flex-wrap items-center gap-2">
                  <input
                    className={cn('field min-h-[44px] w-[140px] bg-white')}
                    placeholder="JJ/MM/AAAA"
                    inputMode="numeric"
                    aria-label={`Date corrigée, ligne ${a.line}`}
                    aria-invalid={Boolean(error) || undefined}
                    value={typed[key] ?? ''}
                    onChange={(e) => onType(key, e.target.value)}
                  />
                  {a.suggestion && !typed[key] && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onType(key, formatIsoDateFr(a.suggestion!))}
                    >
                      Reprendre {formatIsoDateFr(a.suggestion)}
                    </Button>
                  )}
                  {error && <span className="text-[13px] font-bold text-red-ink">{error}</span>}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
