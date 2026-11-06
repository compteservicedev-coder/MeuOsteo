import { useEffect, useState } from 'react'
import { formatIsoDateFr } from '@shared/domain/dates'
import { SOURCE_URL } from '@shared/domain/updates'
import type { UpdateStatus } from '@shared/types/updates'
import { useToast } from '../../components/toast/toastContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Icon } from '../../components/ui/Icon'
import { Switch } from '../../components/ui/Switch'

/** Paramètres > Données & import: « Export & application » (SPEC §8.7). */
export function ExportCard() {
  const toast = useToast()
  const [version, setVersion] = useState('')
  const [update, setUpdate] = useState<UpdateStatus | null>(null)
  const [checking, setChecking] = useState(false)
  useEffect(() => {
    void window.api.app.getStartupState().then((s) => s.ok && setVersion(s.version))
    void window.api.updates.getStatus().then(setUpdate)
  }, [])
  return (
    <Card title="Export & application">
      <div className="flex flex-wrap gap-2">
        <Button
          icon={<Icon name="download" size={16} />}
          onClick={async () => {
            const r = await window.api.data.exportAll()
            if (r.ok) toast.show('Export complet enregistré')
            else if (r.reason === 'error') toast.show('Export impossible', 'error')
          }}
        >
          Exporter toutes les données (Excel)
        </Button>
        <Button
          icon={<Icon name="invoice" size={16} />}
          onClick={async () => {
            const r = await window.api.invoices.exportAccounting()
            if (r.ok) toast.show('Export comptable enregistré')
          }}
        >
          Exporter les factures pour le comptable
        </Button>
      </div>
      <p className="text-[13px] text-ink-500">
        MeuOsteo {version} · données sur cet ordinateur uniquement. L’export complet contient les
        notes cliniques : gardez le fichier en lieu sûr.
      </p>
      <p className="text-[13px] text-ink-500">
        Logiciel libre sous licence GNU AGPL-3.0, fourni sans garantie. Code source&nbsp;:{' '}
        <span className="select-all font-semibold text-ink-600">{SOURCE_URL}</span>
      </p>
      {update && (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p id="update-check-label" className="text-[15px] font-bold text-ink-900">
                Signaler les nouvelles versions
              </p>
              <p className="text-[13px] text-ink-500">
                Une fois par jour, MeuOsteo demande à GitHub le numéro de la dernière version. Rien
                d’autre n’est envoyé.
              </p>
            </div>
            <Switch
              aria-labelledby="update-check-label"
              checked={update.enabled}
              onCheckedChange={async (on) => setUpdate(await window.api.updates.setEnabled(on))}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {update.available ? (
              <Button
                variant="primary"
                icon={<Icon name="download" size={16} />}
                onClick={() => void window.api.updates.open()}
              >
                Télécharger la version {update.available.version}
              </Button>
            ) : (
              <Button
                loading={checking}
                disabled={!update.enabled}
                onClick={async () => {
                  setChecking(true)
                  try {
                    const s = await window.api.updates.check()
                    setUpdate(s)
                    if (!s.available) toast.show('MeuOsteo est à jour', 'info')
                  } finally {
                    setChecking(false)
                  }
                }}
              >
                Vérifier maintenant
              </Button>
            )}
            <span className="text-[13px] text-ink-500">
              {update.lastCheckedAt
                ? `Dernière vérification le ${formatIsoDateFr(update.lastCheckedAt.slice(0, 10))}`
                : 'Pas encore vérifié'}
            </span>
          </div>
        </div>
      )}
    </Card>
  )
}
