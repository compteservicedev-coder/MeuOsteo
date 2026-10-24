import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import {
  LOCK_AFTER_CHOICES,
  PIN_CHANGE_MESSAGES,
  type LockAfterMinutes,
} from '@shared/domain/accessCode'
import type { AttemptFailure } from '@shared/types/security'
import { useToast } from '../../components/toast/toastContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Dialog } from '../../components/ui/Dialog'
import { Field, Input, Select } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'
import { Switch } from '../../components/ui/Switch'
import { RecoveryKeyDisplay } from '../access/RecoveryKeyDisplay'
import { useSecurity } from '../access/securityState'
import { describeAttemptFailure } from '../access/messages'
import { changeCodeSchema, currentCodeSchema, newCodeSchema } from '../access/pinFormSchemas'

const LOCK_LABELS: Record<string, string> = {
  '5': '5 minutes d’inactivité',
  '15': '15 minutes d’inactivité',
  '30': '30 minutes d’inactivité',
  null: 'Jamais (seulement à l’ouverture)',
}

const pinInputProps = {
  type: 'password',
  inputMode: 'numeric',
  maxLength: 6,
  className: 'bg-white text-[18px] tracking-[0.3em]',
} as const

const isAttemptFailure = (r: { ok: boolean; reason?: string }): r is AttemptFailure =>
  r.reason === 'wrong_code' || r.reason === 'locked_out'

/** Paramètres > Sécurité (SPEC §8.1, R-21). */
export function SecurityTab() {
  const { status, refresh } = useSecurity()
  const toast = useToast()
  const [dialog, setDialog] = useState<'enable' | 'disable' | 'regenerate' | null>(null)
  const [changing, setChanging] = useState(false)

  const setLockAfter = async (value: string) => {
    const minutes = (value === 'null' ? null : Number(value)) as LockAfterMinutes
    await window.api.security.setLockAfter(minutes)
    await refresh()
    toast.show(
      minutes === null
        ? 'Verrouillage seulement à l’ouverture'
        : `Verrouillage après ${minutes} min d’inactivité`,
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card
        title={<span id="h-code">Code d’accès</span>}
        description="Demandé à l’ouverture et après une période d’inactivité"
        actions={
          <Switch
            checked={status.enabled}
            onCheckedChange={(on) => setDialog(on ? 'enable' : 'disable')}
            aria-label="Activer le code d’accès"
          />
        }
      >
        {status.enabled && (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Verrouiller après" className="min-w-[220px] flex-1">
                <Select
                  value={String(status.lockAfterMinutes)}
                  onChange={(e) => void setLockAfter(e.target.value)}
                >
                  {LOCK_AFTER_CHOICES.map((choice) => (
                    <option key={String(choice)} value={String(choice)}>
                      {LOCK_LABELS[String(choice)]}
                    </option>
                  ))}
                </Select>
              </Field>
              {!changing && <Button onClick={() => setChanging(true)}>Modifier le code…</Button>}
            </div>
            {changing && (
              <ChangeCodeForm
                onClose={() => setChanging(false)}
                onSaved={async () => {
                  setChanging(false)
                  await refresh()
                  toast.show('Nouveau code enregistré · demandé dès la prochaine ouverture')
                }}
              />
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-mist px-4 py-3">
              <div className="flex items-center gap-2.5 text-[14px] text-ink-600">
                <Icon name="key" size={18} className="text-royal-600" />
                Clé de secours : imprimée à l’activation, elle réinitialise le code en cas d’oubli.
              </div>
              <Button size="sm" onClick={() => setDialog('regenerate')}>
                Générer une nouvelle clé…
              </Button>
            </div>
          </>
        )}
        <p className="flex gap-2 rounded-2xl bg-aqua-50 px-3.5 py-3 text-[13px] leading-normal text-aqua-ink">
          <Icon name="shieldPlain" size={16} strokeWidth={2.2} className="mt-0.5 shrink-0" />
          La base de données est chiffrée sur cet ordinateur. Le code protège l’ouverture de
          l’application ; en cas d’oubli, une clé de secours (à imprimer à l’installation) permet de
          le réinitialiser.
        </p>
      </Card>

      <EnableCodeDialog
        open={dialog === 'enable'}
        onClose={() => setDialog(null)}
        onEnabled={async () => {
          await refresh()
          toast.show('Code d’accès activé')
        }}
      />
      <CurrentCodeDialog
        open={dialog === 'disable'}
        onClose={() => setDialog(null)}
        title="Désactiver le code d’accès ?"
        description="MeuOsteo s’ouvrira sans code. La base reste chiffrée sur cet ordinateur."
        confirmLabel="Désactiver le code"
        danger
        action={(pin) => window.api.security.disable(pin)}
        onSuccess={async () => {
          setDialog(null)
          setChanging(false)
          await refresh()
          toast.show('Code d’accès désactivé')
        }}
      />
      <RegenerateKeyDialog open={dialog === 'regenerate'} onClose={() => setDialog(null)} />
    </div>
  )
}

function ChangeCodeForm({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [shake, setShake] = useState(0)
  const { register, handleSubmit, setError, formState } = useForm<z.infer<typeof changeCodeSchema>>(
    {
      resolver: zodResolver(changeCodeSchema),
      mode: 'onTouched',
      defaultValues: { current: '', next: '', confirm: '' },
    },
  )
  const { errors, isSubmitting } = formState

  const submit = handleSubmit(
    async (values) => {
      const result = await window.api.security.changeCode(values)
      if (result.ok) return onSaved()
      setShake((n) => n + 1)
      if (isAttemptFailure(result)) {
        setError('current', {
          message:
            result.reason === 'wrong_code'
              ? describeAttemptFailure(result, PIN_CHANGE_MESSAGES.current_wrong)
              : describeAttemptFailure(result),
        })
      } else if (result.reason === 'invalid_input' && result.errors[0]) {
        const first = result.errors[0]
        setError(
          first === 'confirm_mismatch'
            ? 'confirm'
            : first.startsWith('current')
              ? 'current'
              : 'next',
          {
            message: PIN_CHANGE_MESSAGES[first],
          },
        )
      }
    },
    () => setShake((n) => n + 1),
  )

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-3 rounded-2xl bg-surface-mist p-4 shadow-[inset_0_1px_3px_rgba(15,30,70,0.08)]"
    >
      <div className="flex flex-wrap gap-3">
        <Field label="Code actuel" error={errors.current?.message} className="min-w-[140px] flex-1">
          <Input {...pinInputProps} autoComplete="current-password" {...register('current')} />
        </Field>
        <Field label="Nouveau code" error={errors.next?.message} className="min-w-[140px] flex-1">
          <Input {...pinInputProps} autoComplete="new-password" {...register('next')} />
        </Field>
        <Field
          label="Confirmation"
          error={errors.confirm?.message}
          className="min-w-[140px] flex-1"
        >
          <Input {...pinInputProps} autoComplete="new-password" {...register('confirm')} />
        </Field>
      </div>
      <p className="text-[13px] text-ink-500">4 à 6 chiffres, différent du code actuel.</p>
      <div className="flex justify-end gap-2">
        <Button size="sm" onClick={onClose}>
          Annuler
        </Button>
        <Button
          size="sm"
          type="submit"
          variant="primary"
          loading={isSubmitting}
          shakeSignal={shake}
        >
          Enregistrer le nouveau code
        </Button>
      </div>
    </form>
  )
}

function EnableCodeDialog({
  open,
  onClose,
  onEnabled,
}: {
  open: boolean
  onClose: () => void
  onEnabled: () => Promise<void>
}) {
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null)
  const [shake, setShake] = useState(0)
  const { register, handleSubmit, reset, formState } = useForm<z.infer<typeof newCodeSchema>>({
    resolver: zodResolver(newCodeSchema),
    mode: 'onTouched',
    defaultValues: { next: '', confirm: '' },
  })
  const { errors, isSubmitting } = formState

  const close = () => {
    reset()
    setRecoveryKey(null)
    onClose()
  }

  const submit = handleSubmit(
    async ({ next }) => {
      const result = await window.api.security.enable(next)
      if (!result.ok) return setShake((n) => n + 1)
      setRecoveryKey(result.recoveryKey)
      await onEnabled()
    },
    () => setShake((n) => n + 1),
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close()}
      title={recoveryKey ? 'Votre clé de secours' : 'Activer le code d’accès'}
      description={
        recoveryKey ? undefined : 'Il sera demandé à l’ouverture et après une période d’inactivité.'
      }
    >
      {recoveryKey ? (
        <RecoveryKeyDisplay recoveryKey={recoveryKey} tone="light" onDone={close} />
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <Field
              label="Nouveau code"
              error={errors.next?.message}
              className="min-w-[140px] flex-1"
            >
              <Input {...pinInputProps} autoComplete="new-password" {...register('next')} />
            </Field>
            <Field
              label="Confirmation"
              error={errors.confirm?.message}
              className="min-w-[140px] flex-1"
            >
              <Input {...pinInputProps} autoComplete="new-password" {...register('confirm')} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={close}>Annuler</Button>
            <Button type="submit" variant="primary" loading={isSubmitting} shakeSignal={shake}>
              Activer le code
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}

interface CurrentCodeDialogProps {
  open: boolean
  onClose: () => void
  title: string
  description: string
  confirmLabel: string
  danger?: boolean
  action: (pin: string) => Promise<{ ok: true } | AttemptFailure | { ok: false; reason: string }>
  onSuccess: () => Promise<void> | void
}

/** Asks the current code before a sensitive change (R-21). */
function CurrentCodeDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  danger = false,
  action,
  onSuccess,
}: CurrentCodeDialogProps) {
  const [shake, setShake] = useState(0)
  const { register, handleSubmit, reset, setError, formState } = useForm<
    z.infer<typeof currentCodeSchema>
  >({
    resolver: zodResolver(currentCodeSchema),
    defaultValues: { current: '' },
  })
  const { errors, isSubmitting } = formState

  const close = () => {
    reset()
    onClose()
  }

  const submit = handleSubmit(
    async ({ current }) => {
      const result = await action(current)
      if (result.ok) {
        reset()
        return onSuccess()
      }
      setShake((n) => n + 1)
      setError('current', {
        message: isAttemptFailure(result) ? describeAttemptFailure(result) : 'Action impossible',
      })
    },
    () => setShake((n) => n + 1),
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close()}
      title={title}
      description={description}
      alert={danger}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Code actuel" error={errors.current?.message}>
          <Input {...pinInputProps} autoComplete="current-password" {...register('current')} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={close}>Annuler</Button>
          <Button
            type="submit"
            variant={danger ? 'danger' : 'primary'}
            loading={isSubmitting}
            shakeSignal={shake}
          >
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function RegenerateKeyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null)
  const close = () => {
    setRecoveryKey(null)
    onClose()
  }
  if (recoveryKey) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && close()} title="Votre nouvelle clé de secours">
        <RecoveryKeyDisplay
          recoveryKey={recoveryKey}
          tone="light"
          onDone={() => {
            close()
            toast.show('Nouvelle clé de secours enregistrée · l’ancienne ne fonctionne plus')
          }}
        />
      </Dialog>
    )
  }
  return (
    <CurrentCodeDialog
      open={open}
      onClose={close}
      title="Générer une nouvelle clé de secours"
      description="L’ancienne clé ne fonctionnera plus. La nouvelle ne sera affichée qu’une fois."
      confirmLabel="Générer la clé"
      action={async (pin) => {
        const result = await window.api.security.regenerateRecoveryKey(pin)
        if (result.ok) setRecoveryKey(result.recoveryKey)
        return result.ok ? { ok: true } : result
      }}
      onSuccess={() => undefined}
    />
  )
}
