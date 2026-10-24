import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useShakeClass } from '../../hooks/useShakeClass'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'onDark'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary btn-ink',
  danger: 'btn-danger',
  ghost: 'btn-ghost btn-ink',
  onDark: 'btn-on-dark',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-[44px] px-3 text-[14px] rounded-[11px]',
  md: 'min-h-[46px] px-4',
  lg: 'min-h-[56px] px-7 text-[17px] rounded-[18px]',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Shows a spinner and marks the button busy. */
  loading?: boolean
  icon?: ReactNode
  /** Increment to make the button shake (refused validation). */
  shakeSignal?: number
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    icon,
    shakeSignal = 0,
    className,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  const shakeClass = useShakeClass(shakeSignal)
  return (
    <button
      ref={ref}
      type={type}
      className={cn('btn', VARIANTS[variant], SIZES[size], shakeClass, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  )
})
