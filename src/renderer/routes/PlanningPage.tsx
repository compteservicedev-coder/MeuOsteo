import { formatLongDateFr } from '@shared/domain/dates'
import { ComingSoon } from '../components/layout/ComingSoon'
import { Page } from '../components/layout/Page'
import { PageHeader } from '../components/layout/PageHeader'

export function PlanningPage() {
  return (
    <Page>
      <PageHeader title="Planning" subtitle={formatLongDateFr(new Date())} />
      <ComingSoon icon="calendar" lot="lot 4">
        Deux semaines de rendez-vous alimentées par les e-mails Doctolib, les jours bloqués et le
        panneau « À rapprocher ».
      </ComingSoon>
    </Page>
  )
}
