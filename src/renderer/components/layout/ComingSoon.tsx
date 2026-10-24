import { motion } from 'framer-motion'
import { staggerItem } from '../../lib/motion'
import { Icon, type IconName } from '../ui/Icon'

interface ComingSoonProps {
  icon: IconName
  lot: string
  children: string
}

/** Empty route of the lot 0 shell: says which lot brings the screen. */
export function ComingSoon({ icon, lot, children }: ComingSoonProps) {
  return (
    <motion.section
      variants={staggerItem}
      className="flex flex-col items-center gap-3 rounded-card-lg border border-line-faint bg-white px-6 py-14 text-center shadow-card"
    >
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-royal-50 text-royal-600"
      >
        <Icon name={icon} size={26} />
      </span>
      <h2 className="text-section">Cet écran arrive au {lot}</h2>
      <p className="max-w-[460px] text-[15px] text-ink-600">{children}</p>
    </motion.section>
  )
}
