import * as RadixDialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { EASE_SOFT } from '../../lib/motion'
import { Icon } from './Icon'

interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  /** Sticky bottom bar (Annuler / Enregistrer). */
  footer?: ReactNode
  className?: string
  children?: ReactNode
}

/** Side panel that slides in from the right (patient editing, details). */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  footer,
  className,
  children,
}: DrawerProps) {
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
            <RadixDialog.Content
              asChild
              forceMount
              {...(description ? {} : { 'aria-describedby': undefined })}
            >
              <motion.div
                className={cn(
                  'fixed inset-y-0 right-0 z-40 flex w-full max-w-[580px] flex-col rounded-l-[26px] bg-surface-panel shadow-[-30px_0_60px_-20px_rgba(6,14,40,0.55)]',
                  className,
                )}
                initial={{ x: '105%' }}
                animate={{ x: 0 }}
                exit={{ x: '105%' }}
                transition={{ duration: 0.45, ease: EASE_SOFT }}
              >
                <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-6">
                  <div className="min-w-0">
                    <RadixDialog.Title className="text-[22px] font-extrabold">
                      {title}
                    </RadixDialog.Title>
                    {description && (
                      <RadixDialog.Description className="mt-1 text-[14px] text-ink-600">
                        {description}
                      </RadixDialog.Description>
                    )}
                  </div>
                  <RadixDialog.Close
                    className="btn btn-ghost btn-ink -mr-2 h-11 w-11 shrink-0 px-0 text-ink-500"
                    aria-label="Fermer"
                  >
                    <Icon name="close" size={18} />
                  </RadixDialog.Close>
                </div>
                <div className="flex-1 overflow-y-auto px-6 pb-6">{children}</div>
                {footer && (
                  <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-white/70 px-6 py-4">
                    {footer}
                  </div>
                )}
              </motion.div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        )}
      </AnimatePresence>
    </RadixDialog.Root>
  )
}
