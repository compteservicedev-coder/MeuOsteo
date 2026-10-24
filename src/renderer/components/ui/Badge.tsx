import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-royal-50 text-royal-700',
  success: 'bg-aqua-50 text-aqua-ink',
  warning: 'bg-amber-50 text-amber-ink',
  danger: 'bg-red-50 text-red-ink',
  info: 'bg-surface-mist text-ink-600',
}

const DOTS: Record<BadgeTone, string> = {
  neutral: 'bg-royal-600',
  success: 'bg-[#14B8A6]',
  warning: 'bg-amber-500',
  danger: 'bg-red-600',
  info: 'bg-ink-500',
}

interface BadgeProps {
  tone?: BadgeTone
  /** Small coloured dot before the text (the text always carries the meaning). */
  dot?: boolean
  className?: string
  children: ReactNode
}

export function Badge({ tone = 'neutral', dot = false, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 py-1 text-[12px] font-bold',
        TONES[tone],
        className,
      )}
    >
      {dot && <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', DOTS[tone])} />}
      {children}
    </span>
  )
}
