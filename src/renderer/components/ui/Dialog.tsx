import * as RadixDialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { EASE_SOFT } from '../../lib/motion'
import { Icon } from './Icon'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  /** `role=alertdialog`: destructive confirmations. Closing by the overlay is then disabled. */
  alert?: boolean
  footer?: ReactNode
  className?: string
  children?: ReactNode
}

/** Modal window: zoom 0.95 → 1 with a fade, blurred veil rgba(10,20,51,.5), focus trapped. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  alert = false,
  footer,
  className,
  children,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RadixDialog.Portal forceMount>
            <RadixDialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-40 bg-[rgba(10,20,51,0.5)] backdrop-blur-[4px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              />
            </RadixDialog.Overlay>
            <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center p-5">
              <RadixDialog.Content
                asChild
                forceMount
                role={alert ? 'alertdialog' : 'dialog'}
                onPointerDownOutside={alert ? (event) => event.preventDefault() : undefined}
                {...(description ? {} : { 'aria-describedby': undefined })}
              >
                <motion.div
                  className={cn(
                    'pointer-events-auto flex max-h-full w-full max-w-[480px] flex-col gap-4 overflow-y-auto rounded-[26px] bg-white p-6 shadow-[0_40px_90px_-30px_rgba(6,14,40,0.7)]',
                    className,
                  )}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.3, ease: EASE_SOFT }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <RadixDialog.Title className="text-[20px] font-extrabold">
                        {title}
                      </RadixDialog.Title>
                      {description && (
                        <RadixDialog.Description className="mt-1 text-[14px] text-ink-600">
                          {description}
                        </RadixDialog.Description>
                      )}
                    </div>
                    <RadixDialog.Close
                      className="btn btn-ghost btn-ink -mr-2 -mt-2 h-11 w-11 shrink-0 px-0 text-ink-500"
                      aria-label="Fermer"
                    >
                      <Icon name="close" size={18} />
                    </RadixDialog.Close>
                  </div>
                  {children}
                  {footer && <div className="flex flex-wrap justify-end gap-2">{footer}</div>}
                </motion.div>
              </RadixDialog.Content>
            </div>
          </RadixDialog.Portal>
        )}
      </AnimatePresence>
    </RadixDialog.Root>
  )
}
