import { formatRecoveryKey } from '@shared/domain/accessCode'
import { formatIsoDateFr, isoDateInParis } from '@shared/domain/dates'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { cn } from '../../lib/cn'

interface RecoveryKeyDisplayProps {
  recoveryKey: string
  tone: 'dark' | 'light'
  onDone: () => void
}

/** R-21: the recovery key is shown once, with an invitation to print it. */
export function RecoveryKeyDisplay({ recoveryKey, tone, onDone }: RecoveryKeyDisplayProps) {
  const printed = formatRecoveryKey(recoveryKey)
  const dark = tone === 'dark'
  return (
    <div className="flex flex-col gap-4">
      <p className={cn('text-[14px] leading-relaxed', dark ? 'text-nav-soft' : 'text-ink-600')}>
        Elle permet de réinitialiser le code en cas d’oubli. Elle n’est affichée qu’une seule fois :
        imprimez-la ou recopiez-la, puis rangez-la à l’abri, loin de l’ordinateur.
      </p>
      <p
        aria-label={`Clé de secours : ${printed.split('').join(' ')}`}
        className={cn(
          'select-all whitespace-nowrap rounded-2xl px-3 py-4 text-center font-mono text-[18px] font-bold tracking-[0.04em]',
          dark ? 'bg-white/10 text-white' : 'bg-surface-mist text-royal-700 shadow-field',
        )}
      >
        {printed}
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant={dark ? 'onDark' : 'secondary'}
          icon={<Icon name="printer" size={18} />}
          onClick={() => window.print()}
        >
          Imprimer
        </Button>
        <Button variant="primary" onClick={onDone}>
          J’ai noté ma clé
        </Button>
      </div>
      <div className="print-only">
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>MeuOsteo · Clé de secours</h1>
        <p style={{ marginTop: 16, fontSize: 14 }}>
          Imprimée le {formatIsoDateFr(isoDateInParis(new Date()))}. Elle permet de réinitialiser le
          code d’accès de MeuOsteo. À conserver à l’abri.
        </p>
        <p style={{ marginTop: 24, fontSize: 28, fontFamily: 'monospace', fontWeight: 700 }}>
          {printed}
        </p>
      </div>
    </div>
  )
}
