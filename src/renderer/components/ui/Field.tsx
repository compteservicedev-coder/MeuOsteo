import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '../../lib/cn'

interface FieldControl {
  id: string
  describedBy: string | undefined
  invalid: boolean
}

const FieldContext = createContext<FieldControl | null>(null)

export interface FieldProps {
  label: ReactNode
  /** Help text under the control. */
  hint?: ReactNode
  /** Error message: the control turns red and the message is announced (`role=alert`). */
  error?: string | undefined
  className?: string
  children: ReactNode
}

/** Label + control + help/error, wired with `htmlFor`, `aria-describedby` and `aria-invalid`. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined
  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
      <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
        <label htmlFor={id} className="text-label text-ink-600">
          {label}
        </label>
        {children}
        {error ? (
          <p id={errorId} role="alert" className="text-[13px] font-bold text-red-ink">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-[13px] text-ink-500">
            {hint}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  )
}

function useFieldControl() {
  const ctx = useContext(FieldContext)
  if (!ctx) return {}
  return {
    id: ctx.id,
    'aria-describedby': ctx.describedBy,
    'aria-invalid': ctx.invalid || undefined,
  }
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn('field', className)} {...useFieldControl()} {...props} />
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return <select ref={ref} className={cn('field', className)} {...useFieldControl()} {...props} />
  },
)

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn('field min-h-[120px] py-3 leading-relaxed', className)}
      {...useFieldControl()}
      {...props}
    />
  )
})
