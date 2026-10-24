import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { isValidRecoveryKey, normalizeRecoveryKey } from '@shared/domain/accessCode'
import { Button } from '../../components/ui/Button'
import { describeAttemptFailure } from './messages'
import { newCodeFields } from './pinFormSchemas'

const schema = z
  .object({
    recoveryKey: z
      .string()
      .refine((v) => isValidRecoveryKey(normalizeRecoveryKey(v)), 'La clé fait 24 caractères'),
    ...newCodeFields,
  })
  .refine((v) => v.next === v.confirm, {
    path: ['confirm'],
    message: 'La confirmation ne correspond pas',
  })

type Values = z.infer<typeof schema>

const darkField =
  'min-h-[46px] w-full rounded-control border border-white/20 bg-white/10 px-3 text-[16px] text-white placeholder:text-nav-muted focus:border-aqua-300 focus:outline-none aria-[invalid=true]:border-[#FFB4A8]'

interface RecoveryResetFormProps {
  onDone: () => void
  onCancel: () => void
}

/** « Code oublié » on the lock screen: recovery key + new code. */
export function RecoveryResetForm({ onDone, onCancel }: RecoveryResetFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [shake, setShake] = useState(0)
  const { register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { recoveryKey: '', next: '', confirm: '' },
  })
  const { errors, isSubmitting } = formState

  const onSubmit = handleSubmit(
    async (values) => {
      const result = await window.api.security.resetWithRecoveryKey(values)
      if (result.ok) return onDone()
      setShake((n) => n + 1)
      setServerError(
        result.reason === 'wrong_code' || result.reason === 'locked_out'
          ? describeAttemptFailure(result, 'Clé de secours incorrecte')
          : 'Vérifiez la clé et le nouveau code',
      )
    },
    () => setShake((n) => n + 1),
  )

  const fieldError = (message?: string) =>
    message ? (
      <span role="alert" className="text-[13px] font-bold text-[#FFB4A8]">
        {message}
      </span>
    ) : null

  return (
    <section
      aria-labelledby="h-recovery"
      className="splash-card-in flex w-full max-w-[380px] flex-col gap-4 rounded-[28px] border border-white/15 bg-white/[0.08] p-[22px] text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_40px_80px_-30px_rgba(0,0,0,0.6)] backdrop-blur-[14px]"
    >
      <div>
        <h2 id="h-recovery" className="text-[18px] font-extrabold">
          Code oublié
        </h2>
        <p className="mt-1 text-[13px] text-nav-muted">
          Saisissez la clé de secours imprimée à l’activation du code, puis choisissez un nouveau
          code.
        </p>
      </div>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-label text-nav-soft">
          Clé de secours
          <input
            {...register('recoveryKey')}
            autoComplete="off"
            spellCheck={false}
            placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
            aria-invalid={Boolean(errors.recoveryKey) || undefined}
            className={`${darkField} font-mono uppercase tracking-[0.06em]`}
          />
          {fieldError(errors.recoveryKey?.message)}
        </label>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5 text-label text-nav-soft">
            Nouveau code
            <input
              {...register('next')}
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.next) || undefined}
              className={`${darkField} tracking-[0.3em]`}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-label text-nav-soft">
            Confirmation
            <input
              {...register('confirm')}
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.confirm) || undefined}
              className={`${darkField} tracking-[0.3em]`}
            />
          </label>
        </div>
        {fieldError(errors.next?.message ?? errors.confirm?.message ?? serverError ?? undefined)}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="onDark" onClick={onCancel}>
            Retour
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting} shakeSignal={shake}>
            Réinitialiser le code
          </Button>
        </div>
      </form>
    </section>
  )
}
