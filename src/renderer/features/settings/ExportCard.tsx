import { useEffect, useState } from 'react'
import { useToast } from '../../components/toast/toastContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Icon } from '../../components/ui/Icon'

/** Paramètres > Données & import: « Export & application » (SPEC §8.7). */
export function ExportCard() {
  const toast = useToast()
  const [version, setVersion] = useState('')
  useEffect(() => {
    void window.api.app.getStartupState().then((s) => s.ok && setVersion(s.version))
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
    </Card>
  )
}
