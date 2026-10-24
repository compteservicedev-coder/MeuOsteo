import { useState } from 'react'
import { PinPad, type PinPadOutcome } from './PinPad'
import { RecoveryResetForm } from './RecoveryResetForm'
import { describeAttemptFailure } from './messages'

interface UnlockViewProps {
  pinLength: number
  lockoutRemainingMs: number
  onUnlocked: () => void
}

/** « Bonjour, entrez votre code », with the « Code oublié ? » path (recovery key). */
export function UnlockView({ pinLength, lockoutRemainingMs, onUnlocked }: UnlockViewProps) {
  const [mode, setMode] = useState<'pin' | 'recovery'>('pin')
  const [lockedUntil] = useState(() =>
    lockoutRemainingMs > 0 ? Date.now() + lockoutRemainingMs : null,
  )

  if (mode === 'recovery') {
    return <RecoveryResetForm onDone={onUnlocked} onCancel={() => setMode('pin')} />
  }

  const unlock = async (pin: string): Promise<PinPadOutcome> => {
    const result = await window.api.security.unlock(pin)
    if (result.ok) {
      onUnlocked()
      return { ok: true }
    }
    return {
      ok: false,
      message: describeAttemptFailure(result),
      ...(result.reason === 'locked_out' ? { lockedUntil: Date.now() + result.retryInMs } : {}),
    }
  }

  return (
    <PinPad
      title="Bonjour, entrez votre code"
      length={pinLength}
      lockedUntil={lockedUntil}
      onSubmit={unlock}
      footer={
        <button
          type="button"
          onClick={() => setMode('recovery')}
          className="min-h-[44px] rounded-[10px] px-3 text-[13px] font-bold text-nav-soft underline-offset-4 hover:text-white hover:underline"
        >
          Code oublié ?
        </button>
      }
    />
  )
}
