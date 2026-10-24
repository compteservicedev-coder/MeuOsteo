import { ComingSoon } from '../components/layout/ComingSoon'
import { Page } from '../components/layout/Page'
import { PageHeader } from '../components/layout/PageHeader'

export function DashboardPage() {
  return (
    <Page>
      <PageHeader title="Tableau de bord" subtitle="Activité du cabinet" />
      <ComingSoon icon="chart" lot="lot 5">
        Séances et chiffre d’affaires du mois, paiements en attente et dernières factures.
      </ComingSoon>
    </Page>
  )
}
