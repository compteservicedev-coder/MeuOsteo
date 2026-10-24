import { ComingSoon } from '../components/layout/ComingSoon'
import { Page } from '../components/layout/Page'
import { PageHeader } from '../components/layout/PageHeader'

export function FacturesPage() {
  return (
    <Page>
      <PageHeader title="Factures" subtitle="Registre de consultation des notes d’honoraires" />
      <ComingSoon icon="invoice" lot="lot 3">
        Registre des factures émises depuis les séances : tri, filtres, regroupements et export
        comptable.
      </ComingSoon>
    </Page>
  )
}
