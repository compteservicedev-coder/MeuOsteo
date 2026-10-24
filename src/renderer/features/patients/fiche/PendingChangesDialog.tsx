import { Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'

interface PendingChangesDialogProps {
  open: boolean
  dateFr: string
  onStay: () => void
  onDiscard: () => void
  onSave: () => void
}

/** R-05 · Changing session, creating one or leaving the record with unsaved changes. */
export function PendingChangesDialog({ open, dateFr, onStay, onDiscard, onSave }: PendingChangesDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onStay()}
      alert
      title="Modifications non enregistrées"
      description={`La séance du ${dateFr} contient des modifications qui n’ont pas été enregistrées. Que voulez-vous en faire ?`}
      footer={
        <>
          <Button onClick={onStay}>Rester</Button>
          <Button onClick={onDiscard}>Ne pas enregistrer</Button>
          <Button variant="primary" onClick={onSave}>
            Enregistrer
          </Button>
        </>
      }
    />
  )
}
