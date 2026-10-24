import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '@shared/domain/accessCode'
import { Icon } from '../../components/ui/Icon'
import { useCountdown } from '../../hooks/useCountdown'
import { useShakeClass } from '../../hooks/useShakeClass'
import { cn } from '../../lib/cn'

export type PinPadOutcome = { ok: true } | { ok: false; message: string; lockedUntil?: number }

interface PinPadProps {
  /** Heading of the card (also the accessible name of the pad). */
  title: string
  subtitle?: ReactNode
  /** Known length: submits as soon as it is reached. `null`: 4 to 6 digits, validated with ✓. */
  length: number | null
  onSubmit: (pin: string) => Promise<PinPadOutcome>
  /** Epoch ms until which the pad is disabled (5 errors → 30 s). */
  lockedUntil?: number | null
  footer?: ReactNode
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'] as const

/**
 * Numeric keypad from Splash.dc.html: one dot per digit, shake then clear on error. Works with the
 * physical keyboard too (digits, Backspace, Enter).
 */
export function PinPad({
  title,
  subtitle,
  length,
  onSubmit,
  lockedUntil = null,
  footer,
}: PinPadProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(0)
  const [busy, setBusy] = useState(false)
  const [blockedUntil, setBlockedUntil] = useState<number | null>(lockedUntil)
  const secondsLeft = useCountdown(blockedUntil)
  const blocked = secondsLeft > 0
  const shakeClass = useShakeClass(shake)
  const maxLength = length ?? PIN_MAX_LENGTH
  const canValidate = length === null && code.length >= PIN_MIN_LENGTH
  const headingId = useId()

  useEffect(() => setBlockedUntil(lockedUntil), [lockedUntil])

  const submit = useCallback(
    async (pin: string) => {
      setBusy(true)
      const outcome = await onSubmit(pin)
      setBusy(false)
      if (outcome.ok) return
      setCode('')
      setError(outcome.message)
      setShake((n) => n + 1)
      if (outcome.lockedUntil) setBlockedUntil(outcome.lockedUntil)
    },
    [onSubmit],
  )

  const press = useCallback(
    (key: (typeof KEYS)[number]) => {
      if (busy || blocked) return
      if (key === 'del') {
        setCode((c) => c.slice(0, -1))
        setError(null)
        return
      }
      if (key === 'ok') {
        if (canValidate) void submit(code)
        return
      }
      if (code.length >= maxLength) return
      const next = code + key
      setCode(next)
      setError(null)
      if (length !== null && next.length === length) {
        // Let the last dot light up before checking.
        setBusy(true)
        window.setTimeout(() => void submit(next), 260)
      }
    },
    [busy, blocked, canValidate, code, length, maxLength, submit],
  )

  // Physical keyboard.
  const pressRef = useRef(press)
  pressRef.current = press
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (/^\d$/.test(event.key)) pressRef.current(event.key as (typeof KEYS)[number])
      else if (event.key === 'Backspace') pressRef.current('del')
      else if (event.key === 'Enter') pressRef.current('ok')
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const dotCount = length ?? Math.min(PIN_MAX_LENGTH, Math.max(PIN_MIN_LENGTH, code.length))
  const message = blocked ? `Trop d’essais. Réessayez dans ${secondsLeft} s` : error

  return (
    <section
      aria-labelledby={headingId}
      className="splash-card-in flex w-full max-w-[340px] flex-col items-center gap-4 rounded-[28px] border border-white/15 bg-white/[0.08] px-[22px] pb-5 pt-[22px] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_40px_80px_-30px_rgba(0,0,0,0.6)] backdrop-blur-[14px]"
    >
      <div className="text-center">
        <h2 id={headingId} className="text-[18px] font-extrabold">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-[13px] text-nav-muted">{subtitle}</p>}
      </div>
      <div
        role="status"
        aria-label={`${code.length} chiffre(s) saisi(s) sur ${length ?? `${PIN_MIN_LENGTH} à ${PIN_MAX_LENGTH}`}`}
        className={cn('flex gap-3.5', shakeClass)}
      >
        {Array.from({ length: dotCount }, (_, i) => {
          const on = i < code.length
          return (
            <span
              key={i}
              className={cn(
                'h-4 w-4 rounded-full transition-[background] duration-200',
                on
                  ? 'splash-dot-on bg-[linear-gradient(180deg,#5EEAD4,#22C3D6)] shadow-[0_0_12px_rgba(94,234,212,0.8)]'
                  : error
                    ? 'border-2 border-[#FFB4A8]'
                    : 'border-2 border-white/45',
              )}
            />
          )
        })}
      </div>
      {message && (
        <p role="alert" className="-mt-1.5 text-center text-[13px] font-bold text-[#FFB4A8]">
          {message}
        </p>
      )}
      <div className="grid grid-cols-[repeat(3,64px)] gap-3">
        {KEYS.map((key) => {
          if (key === 'ok' && length !== null) return <span key={key} aria-hidden="true" />
          const label = key === 'del' ? 'Effacer' : key === 'ok' ? 'Valider' : `Chiffre ${key}`
          return (
            <button
              key={key}
              type="button"
              aria-label={label}
              disabled={busy || blocked || (key === 'ok' && !canValidate)}
              onClick={() => press(key)}
              className={cn(
                'pin-key flex h-16 w-16 items-center justify-center rounded-full text-[24px] font-bold text-white disabled:opacity-40',
                key === 'del'
                  ? 'bg-transparent'
                  : key === 'ok'
                    ? 'bg-[linear-gradient(180deg,#22C3D6,#1F4FD8)] shadow-[0_10px_22px_-10px_rgba(34,195,214,0.9)]'
                    : 'border border-white/15 bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
              )}
            >
              {key === 'del' ? (
                <Icon name="backspace" size={24} />
              ) : key === 'ok' ? (
                <Icon name="check" size={26} strokeWidth={2.8} />
              ) : (
                key
              )}
            </button>
          )
        })}
      </div>
      {footer}
    </section>
  )
}
