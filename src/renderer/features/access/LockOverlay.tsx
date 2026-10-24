import * as RadixDialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { SplashBackdrop } from './SplashFrame'
import { UnlockView } from './UnlockView'
import { useSecurity } from './securityState'

/**
 * Automatic lock (SPEC §2): the code screen comes back over the application. The application stays
 * mounted underneath, so nothing being typed is lost. It is a Radix modal so that it sits above any
 * open dialog, traps the focus and hides the rest from assistive technologies.
 */
export function LockOverlay() {
  const { status, refresh } = useSecurity()
  const open = status.locked && status.pinLength !== null

  return (
    <RadixDialog.Root open={open}>
      <AnimatePresence>
        {open && (
          <RadixDialog.Portal forceMount>
            <RadixDialog.Content
              asChild
              forceMount
              aria-describedby={undefined}
              onEscapeKeyDown={(event) => event.preventDefault()}
              onPointerDownOutside={(event) => event.preventDefault()}
              onInteractOutside={(event) => event.preventDefault()}
            >
              <motion.div
                className="fixed inset-0 z-[70] overflow-y-auto"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <SplashBackdrop className="min-h-full">
                  <div className="relative z-[1] flex flex-col items-center gap-5">
                    <RadixDialog.Title className="sr-only">
                      MeuOsteo est verrouillé
                    </RadixDialog.Title>
                    <div
                      aria-hidden="true"
                      className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-logo text-[26px] font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_14px_30px_-12px_rgba(34,195,214,0.9)]"
                    >
                      M
                    </div>
                    <UnlockView
                      pinLength={status.pinLength!}
                      lockoutRemainingMs={status.lockoutRemainingMs}
                      onUnlocked={() => void refresh()}
                    />
                  </div>
                </SplashBackdrop>
              </motion.div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        )}
      </AnimatePresence>
    </RadixDialog.Root>
  )
}
