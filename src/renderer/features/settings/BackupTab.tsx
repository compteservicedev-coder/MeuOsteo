import { useEffect, useState } from 'react'
import { formatDateTimeFr } from '@shared/domain/dates'
import type { BackupStatus } from '@shared/types/pilotage'
import { notifyDataChanged } from '../../lib/dataEvents'
import { useToast } from '../../components/toast/toastContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Dialog } from '../../components/ui/Dialog'
import { Field, Input, Select } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'

const RESTORE_ERRORS: Record<string, string> = {
  wrong_key: 'Ce fichier a été chiffré avec une autre clé.',
  corrupt: 'Ce fichier est abîmé : il ne peut pas être restauré.',
  unreadable: 'Ce fichier ne peut pas être lu.',
  file_unknown: 'Choisissez à nouveau le fichier.',
}

/** Paramètres > Sauvegarde (SPEC §8.5, R-22). */
export function BackupTab() {
  const toast = useToast()
  const [status, setStatus] = useState<BackupStatus | null>(null)
  const [progress, setProgress] = useState(false)
  const [keyShown, setKeyShown] = useState<string | null>(null)
  const [needKey, setNeedKey] = useState<string | null>(null)
  const [keyText, setKeyText] = useState('')
  const [keyError, setKeyError] = useState<string | null>(null)
  const [restarting, setRestarting] = useState(false)

  useEffect(() => {
    void window.api.backup.getStatus().then(setStatus)
  }, [])

  if (!status) return null
  const last = status.lastAt ? formatDateTimeFr(new Date(status.lastAt)) : 'aucune'

  const restored = (r: { patients: number; seances: number }) => {
    setNeedKey(null)
    setRestarting(true)
    toast.show(`Sauvegarde vérifiée (${r.patients} patients, ${r.seances} séances) · redémarrage…`)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title="Sauvegarde" description="Copie chiffrée de la base, à chaque fermeture">
        <Field
          label="Dossier de sauvegarde"
          hint={`${status.keep} dernières copies conservées · dernière : ${last}`}
        >
          <div className="flex gap-2">
            <Input readOnly value={status.folder} className="grow" />
            <Button onClick={async () => setStatus(await window.api.backup.chooseFolder())}>
              Parcourir…
            </Button>
          </div>
        </Field>
        <p className="text-[13px] text-ink-500">
          Conseil : choisissez une clé USB, un disque externe ou un dossier synchronisé (OneDrive…)
          pour garder une copie hors de ce PC. Les fichiers restent chiffrés.
        </p>
        <Field label="Copies conservées">
          <Select
            value={String(status.keep)}
            onChange={async (e) =>
              setStatus(await window.api.backup.setKeep(Number(e.target.value)))
            }
          >
            {[10, 30, 60, 90].map((n) => (
              <option key={n} value={n}>
                {n} copies
              </option>
            ))}
          </Select>
        </Field>
        {progress && (
          <div
            role="progressbar"
            aria-label="Sauvegarde en cours"
            className="h-2 overflow-hidden rounded-pill bg-surface-rail"
          >
            <div className="h-full w-full animate-pulse rounded-pill bg-primary motion-reduce:animate-none" />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            icon={<Icon name="download" size={16} />}
            loading={progress}
            onClick={async () => {
              setProgress(true)
              const r = await window.api.backup.run()
              notifyDataChanged()
              setProgress(false)
              setStatus(await window.api.backup.getStatus())
              toast.show(
                r.ok
                  ? `Sauvegarde ${r.name} enregistrée`
                  : 'Sauvegarde impossible : vérifiez le dossier',
                r.ok ? 'success' : 'error',
              )
            }}
          >
            Sauvegarder maintenant
          </Button>
          <Button
            icon={<Icon name="history" size={16} />}
            disabled={restarting}
            onClick={async () => {
              const r = await window.api.backup.restore()
              if (r.ok) restored(r)
              else if (r.reason === 'wrong_key' && r.fileId) {
                setKeyText('')
                setKeyError(null)
                setNeedKey(r.fileId)
              } else if (r.reason !== 'canceled')
                toast.show(RESTORE_ERRORS[r.reason] ?? 'Restauration impossible', 'error')
            }}
          >
            Restaurer une sauvegarde…
          </Button>
        </div>
        {status.files.length > 0 && (
          <ul className="flex flex-col text-[13px] text-ink-600">
            {status.files.slice(0, 5).map((f) => (
              <li
                key={f.name}
                className="flex justify-between gap-3 border-b border-[#EDF0F6] py-1.5"
              >
                <span className="truncate">{f.name}</span>
                <span className="tabular-nums">
                  {Math.max(1, Math.round(f.sizeBytes / 1024))} Ko
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Clé de sauvegarde"
        description="Indispensable pour restaurer une sauvegarde sur un autre ordinateur"
      >
        <p className="text-[14px] text-ink-600">
          Les sauvegardes sont chiffrées avec la clé de cette base. Sur ce PC, elle est connue de
          l’application. Pour restaurer sur un nouvel ordinateur (panne, vol), il faudra la saisir :
          imprimez-la et rangez-la avec la clé de secours.
        </p>
        <Button
          className="self-start"
          icon={<Icon name="key" size={16} />}
          onClick={async () => setKeyShown(await window.api.backup.showKey())}
        >
          Afficher la clé de sauvegarde…
        </Button>
      </Card>

      <Dialog
        open={keyShown !== null}
        onOpenChange={(o) => !o && setKeyShown(null)}
        title="Clé de sauvegarde"
        description="À imprimer ou recopier, puis à ranger en lieu sûr. Ne l’envoyez pas par e-mail."
        footer={
          <>
            <Button onClick={() => window.print()}>Imprimer</Button>
            <Button variant="primary" onClick={() => setKeyShown(null)}>
              C’est noté
            </Button>
          </>
        }
      >
        <p className="break-all rounded-2xl bg-surface-mist px-4 py-3 font-mono text-[15px] font-bold leading-relaxed tracking-[0.04em]">
          {keyShown}
        </p>
      </Dialog>

      <Dialog
        open={needKey !== null}
        onOpenChange={(o) => !o && setNeedKey(null)}
        title="Saisir la clé de sauvegarde"
        description="Cette sauvegarde vient d’un autre ordinateur : saisissez la clé imprimée depuis celui-ci."
        footer={
          <>
            <Button onClick={() => setNeedKey(null)}>Annuler</Button>
            <Button
              variant="primary"
              disabled={keyText.replace(/[\s-]/g, '').length !== 64}
              onClick={async () => {
                const r = await window.api.backup.restoreWithKey(needKey!, keyText)
                if (r.ok) restored(r)
                else setKeyError(RESTORE_ERRORS[r.reason] ?? 'Restauration impossible')
              }}
            >
              Restaurer
            </Button>
          </>
        }
      >
        <Field label="Clé de sauvegarde (64 caractères)" error={keyError ?? undefined}>
          <Input
            value={keyText}
            onChange={(e) => setKeyText(e.target.value)}
            className="font-mono"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        <p className="text-[13px] text-ink-500">
          L’état actuel est d’abord sauvegardé, puis l’application redémarre sur la sauvegarde
          choisie.
        </p>
      </Dialog>
    </div>
  )
}
