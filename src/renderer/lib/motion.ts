import type { Transition, Variants } from 'framer-motion'

/** Default curve of the charter: cubic-bezier(.2,.8,.2,1). */
export const EASE_SOFT = [0.2, 0.8, 0.2, 1] as const

export const enterTransition: Transition = { duration: 0.55, ease: EASE_SOFT }

/** Screen entrance: elements appear in cascade, 60 ms apart (fade + 16 px + scale .98). */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: enterTransition },
}
