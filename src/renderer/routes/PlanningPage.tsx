import { motion } from 'framer-motion'
import { formatLongDateFr } from '@shared/domain/dates'
import { ComingSoon } from '../components/layout/ComingSoon'
import { Page } from '../components/layout/Page'
import { PageHeader } from '../components/layout/PageHeader'
import { ReconcilePanel } from '../features/reconcile/ReconcilePanel'
import { staggerItem } from '../lib/motion'

export function PlanningPage() {
  return (
    <Page>
      <PageHeader title="Planning" subtitle={formatLongDateFr(new Date())} />
      <motion.div variants={staggerItem} className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-[999_1_560px]">
          <ComingSoon icon="calendar" lot="lot 4">
            Deux semaines de rendez-vous alimentées par les e-mails Doctolib et les jours bloqués.
          </ComingSoon>
        </div>
        <ReconcilePanel />
      </motion.div>
    </Page>
  )
}
