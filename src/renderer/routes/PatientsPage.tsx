import { ComingSoon } from '../components/layout/ComingSoon'
import { Page } from '../components/layout/Page'
import { PageHeader } from '../components/layout/PageHeader'

export function PatientsPage() {
  return (
    <Page>
      <PageHeader title="Patients" subtitle="Recherche rapide et fiches patients" />
      <ComingSoon icon="users" lot="lot 1">
        Recherche par nom, prénom, téléphone, commune ou métier, « Consultés récemment » et fiche
        patient complète.
      </ComingSoon>
    </Page>
  )
}
