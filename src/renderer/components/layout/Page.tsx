import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { staggerContainer } from '../../lib/motion'

/**
 * Screen container: its direct `staggerItem` children enter in cascade. `fill` makes the screen
 * fit the window height (from 1024 px wide), so only its panels scroll, never the whole page.
 */
export function Page({ children, fill = false }: { children: ReactNode; fill?: boolean }) {
  return (
    <motion.div
      className={cn(
        'mx-auto flex w-full flex-col gap-5',
        fill ? 'max-w-[1680px] lg:h-full lg:min-h-0 lg:gap-4' : 'max-w-[1280px]',
      )}
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  )
}
