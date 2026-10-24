import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { staggerItem } from '../../lib/motion'

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <motion.div variants={staggerItem} className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-title">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  )
}
