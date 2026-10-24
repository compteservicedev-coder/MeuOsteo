import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState, type ReactNode } from 'react'
import type { StartupState } from '@shared/types/app'
import type { SecurityStatus } from '@shared/types/security'
import { cn } from '../../lib/cn'
import { LockOverlay } from './LockOverlay'
import { SecurityProvider } from './SecurityContext'
import { SetupView } from './SetupView'
import { SplashBackdrop, SplashBrand } from './SplashFrame'
import { StartupErrorView } from './StartupErrorView'
import { TodaySummaryView } from './TodaySummaryView'
import { UnlockView } from './UnlockView'

type Phase = 'intro' | 'error' | 'unlock' | 'setup' | 'summary' | 'app'

/** About 2.5 s of animation (SPEC §2); a simple fade when reduced motion is requested. */
const INTRO_MS = 2600
const INTRO_REDUCED_MS = 700

function afterIntro(security: SecurityStatus): Phase {
  if (security.enabled) return 'unlock'
  if (!security.setupDone) return 'setup'
  return 'summary'
}

/**
 * Opening sequence (Splash.dc.html): animation → code (R-21) or first-launch setup → « Résumé du
 * jour » → application. « Passer » skips the animation and the summary, never the code.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion()
  const [startup, setStartup] = useState<StartupState | null>(null)
  const [introDone, setIntroDone] = useState(false)
  const [skipped, setSkipped] = useState(false)
  const [phase, setPhase] = useState<Phase>('intro')
  const [security, setSecurity] = useState<SecurityStatus | null>(null)

  useEffect(() => {
    void window.api.app.getStartupState().then(setStartup)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(
      () => setIntroDone(true),
      reduceMotion ? INTRO_REDUCED_MS : INTRO_MS,
    )
    return () => window.clearTimeout(timer)
  }, [reduceMotion])

  useEffect(() => {
    if (phase !== 'intro' || !introDone || !startup) return
    if (!startup.ok) {
      setPhase('error')
      return
    }
    setSecurity(startup.security)
    const next = afterIntro(startup.security)
    setPhase(next === 'summary' && skipped ? 'app' : next)
  }, [phase, introDone, startup, skipped])

  /** After the code or the setup: fresh status, then the summary (or the app if skipped). */
  const proceed = async () => {
    setSecurity(await window.api.security.getStatus())
    setPhase(skipped ? 'app' : 'summary')
  }

  if (phase === 'app' && security) {
    return (
      <SecurityProvider initialStatus={security}>
        <motion.div
          className="h-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          {children}
        </motion.div>
        <LockOverlay />
      </SecurityProvider>
    )
  }

  const loadingStep = startup ? 'Prêt' : 'Ouverture de la base…'

  return (
    <div className="h-full overflow-y-auto">
      <SplashBackdrop>
        <div
          className={cn(
            'relative z-[1] flex w-full max-w-[460px] flex-col items-center gap-[22px] text-center',
            phase !== 'intro' && 'splash-card-in',
          )}
        >
          <SplashBrand compact={phase !== 'intro'} />
          <p
            className="splash-fade-up -mt-2.5 text-[16px] text-nav-soft"
            style={{ animationDelay: '1.1s' }}
          >
            Le cabinet, au calme.
          </p>

          <AnimatePresence mode="wait">
            <motion.div
              key={phase}
              className="flex w-full flex-col items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {phase === 'intro' && (
                <div
                  role="status"
                  aria-label={`Chargement : ${loadingStep}`}
                  className="splash-fade-up w-[220px]"
                  style={{ animationDelay: '1.2s' }}
                >
                  <div className="relative h-1.5 overflow-hidden rounded-pill bg-white/[0.12]">
                    <div
                      className="splash-bar absolute inset-0 rounded-pill bg-[linear-gradient(90deg,#5EEAD4,#22C3D6,#3B6CF6)]"
                      style={{ transform: `scaleX(${startup ? 1 : 0.45})` }}
                    />
                    <div className="splash-shine absolute bottom-0 top-0 w-2/5 bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.7),rgba(255,255,255,0))]" />
                  </div>
                  <p className="mt-3 text-[13px] text-nav-muted">{loadingStep}</p>
                </div>
              )}
              {phase === 'error' && startup && !startup.ok && (
                <StartupErrorView error={startup.error} />
              )}
              {phase === 'unlock' && security?.pinLength && (
                <UnlockView
                  pinLength={security.pinLength}
                  lockoutRemainingMs={security.lockoutRemainingMs}
                  onUnlocked={() => void proceed()}
                />
              )}
              {phase === 'setup' && <SetupView onDone={() => void proceed()} />}
              {phase === 'summary' && <TodaySummaryView onOpen={() => setPhase('app')} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {phase === 'intro' && (
          <div className="absolute bottom-[18px] left-0 right-0 z-[2] flex justify-center">
            <button
              type="button"
              onClick={() => {
                setSkipped(true)
                setIntroDone(true)
              }}
              className="inline-flex min-h-[44px] items-center rounded-[10px] bg-white/[0.08] px-3 text-[13px] font-bold text-nav-soft hover:text-white"
            >
              Passer
            </button>
          </div>
        )}
      </SplashBackdrop>
    </div>
  )
}
