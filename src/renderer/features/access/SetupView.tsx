import { useState } from 'react'
import { PinPad, type PinPadOutcome } from './PinPad'
import { RecoveryKeyDisplay } from './RecoveryKeyDisplay'

interface SetupViewProps {
  onDone: () => void
}

/**
 * First launch: choose the access code (4 to 6 digits), confirm it, then read the recovery key
 * once. « Plus tard » leaves the code off (Paramètres > Sécurité).
 */
export function SetupView({ onDone }: SetupViewProps) {
  const [step, setStep] = useState<'choose' | 'confirm' | 'key'>('choose')
  const [firstPin, setFirstPin] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [mismatch, setMismatch] = useState(false)

  const later = async () => {
    await window.api.security.skipSetup()
    onDone()
  }

  if (step === 'key') {
    return (
      <section
        aria-labelledby="h-key"
        className="splash-card-in flex w-full max-w-[460px] flex-col gap-3 rounded-[28px] border border-white/15 bg-white/[0.08] p-6 text-left backdrop-blur-[14px]"
      >
        <h2 id="h-key" className="text-[18px] font-extrabold">
          Votre clé de secours
        </h2>
        <RecoveryKeyDisplay recoveryKey={recoveryKey} tone="dark" onDone={onDone} />
      </section>
    )
  }

  const choose = async (pin: string): Promise<PinPadOutcome> => {
    setFirstPin(pin)
    setMismatch(false)
    setStep('confirm')
    return { ok: true }
  }

  const confirm = async (pin: string): Promise<PinPadOutcome> => {
    if (pin !== firstPin) {
      setMismatch(true)
      setStep('choose')
      return { ok: false, message: 'Les deux codes ne correspondent pas' }
    }
    const result = await window.api.security.enable(pin)
    if (!result.ok) return { ok: false, message: 'Ce code ne peut pas être utilisé' }
    setRecoveryKey(result.recoveryKey)
    setStep('key')
    return { ok: true }
  }

  const laterLink = (
    <button
      type="button"
      onClick={() => void later()}
      className="min-h-[44px] rounded-[10px] px-3 text-[13px] font-bold text-nav-soft underline-offset-4 hover:text-white hover:underline"
    >
      Plus tard
    </button>
  )

  return step === 'choose' ? (
    <PinPad
      key="choose"
      title="Choisissez votre code d’accès"
      subtitle={
        mismatch
          ? 'Les deux codes ne correspondaient pas : recommencez.'
          : '4 à 6 chiffres, demandés à l’ouverture et après une période d’inactivité.'
      }
      length={null}
      onSubmit={choose}
      footer={laterLink}
    />
  ) : (
    <PinPad
      key="confirm"
      title="Confirmez votre code"
      subtitle="Saisissez-le une seconde fois."
      length={firstPin.length}
      onSubmit={confirm}
    />
  )
}
