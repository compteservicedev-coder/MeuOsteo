import * as RadixSwitch from '@radix-ui/react-switch'
import { cn } from '../../lib/cn'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** Accessible name when there is no visible label (`aria-labelledby` otherwise). */
  'aria-label'?: string
  'aria-labelledby'?: string
  disabled?: boolean
  id?: string
}

/** `role=switch` toggle from the mock-up: 56 × 32 px, springy knob. */
export function Switch({ checked, onCheckedChange, disabled, ...aria }: SwitchProps) {
  return (
    <RadixSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        'relative h-8 w-14 shrink-0 rounded-pill border-0 p-0 transition-[background] duration-300 disabled:opacity-50',
        checked
          ? 'bg-primary shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),0_6px_14px_-8px_rgba(31,79,216,0.9)]'
          : 'bg-line-strong shadow-[inset_0_2px_4px_rgba(15,30,70,0.18)]',
      )}
      {...aria}
    >
      <RadixSwitch.Thumb
        className={cn(
          'absolute left-1 top-1 block h-6 w-6 rounded-pill bg-[linear-gradient(180deg,#FFFFFF,#EDF2F9)] shadow-[0_3px_8px_rgba(0,0,0,0.25)]',
          'transition-transform duration-[380ms] ease-[cubic-bezier(.3,1.5,.5,1)]',
          checked ? 'translate-x-6' : 'translate-x-0',
        )}
      />
    </RadixSwitch.Root>
  )
}
