import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { staggerContainer } from '../../lib/motion'

/** Screen container: its direct `staggerItem` children enter in cascade. */
export function Page({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="mx-auto flex w-full max-w-[1280px] flex-col gap-5"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  )
}
