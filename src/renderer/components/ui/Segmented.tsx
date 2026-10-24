import { cn } from '../../lib/cn'

export interface SegmentedOption<T> {
  value: T
  label: string
}

interface SegmentedProps<T> {
  /** Accessible name of the group. */
  label: string
  options: ReadonlyArray<SegmentedOption<T>>
  value: T
  onChange: (value: T) => void
  className?: string
}

/** Hollow rail with one raised blue option (tarif, paiement, filtres). `aria-pressed` per option. */
export function Segmented<T extends string | number | null>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex flex-wrap gap-1 rounded-[14px] bg-surface-rail p-1 shadow-rail',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'btn min-h-[44px] rounded-[10px] px-3 text-[14px]',
              active ? 'btn-primary pop' : 'btn-ink bg-transparent text-ink-600 hover:text-ink-900',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
