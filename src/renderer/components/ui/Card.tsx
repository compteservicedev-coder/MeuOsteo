import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode
  description?: ReactNode
  /** Right-hand side of the card header (switch, button…). */
  actions?: ReactNode
  headingLevel?: 2 | 3
}

/** White card with the charter's relief (radius 22 px, layered shadow). */
export function Card({
  title,
  description,
  actions,
  headingLevel = 2,
  className,
  children,
  ...props
}: CardProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <section
      className={cn(
        'flex flex-col gap-4 rounded-card-lg border border-line-faint bg-white px-6 py-[22px] shadow-card',
        className,
      )}
      {...props}
    >
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3.5">
          <div className="min-w-0">
            {title && <Heading className="text-section">{title}</Heading>}
            {description && <p className="mt-0.5 text-[13px] text-ink-500">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}
