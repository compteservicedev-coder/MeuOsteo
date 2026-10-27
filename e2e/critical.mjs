/* global DataTransfer -- built inside the page by page.evaluateHandle. */
/**
 * Parcours critique (ROADMAP lot 5) on the built application, with an empty, throw-away data
 * folder: opening → new patient → session done → documents → practice details → invoice issued (PDF
 * archived) → register → « Supprimer la facture ». Run with `npm run e2e` (Linux: `xvfb-run -a`).
 */
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron } from 'playwright'

const userData = mkdtempSync(join(tmpdir(), 'meuosteo-e2e-'))
const app = await electron.launch({
  args: ['.', '--no-sandbox'],
  env: { ...process.env, NODE_OPTIONS: '', MEUOSTEO_USER_DATA: userData },
})
const page = await app.firstWindow()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

const steps = []
async function step(name, run) {
  const started = Date.now()
  try {
    await run()
    steps.push(`✓ ${name} (${Date.now() - started} ms)`)
  } catch (error) {
    await page.screenshot({ path: join(userData, 'failure.png') }).catch(() => {})
    console.error(`✗ ${name}\n${error.message}\nCapture : ${join(userData, 'failure.png')}`)
    await app.close()
    process.exit(1)
  }
}

const nav = (name) => page.getByRole('navigation').getByRole('link', { name }).click()
const today = new Date().toISOString().slice(0, 10)

await step('ouverture : code d’accès reporté, planning', async () => {
  await page.getByRole('button', { name: 'Plus tard' }).click({ timeout: 20000 })
  await page.getByRole('button', { name: 'Ouvrir mon planning' }).click()
  await page.getByRole('heading', { name: 'Planning', level: 1 }).waitFor()
})

await step('informations du cabinet', async () => {
  await nav('Paramètres')
  await page.getByRole('tab', { name: /Cabinet & factures/ }).click()
  await page.getByLabel('Prénom et nom').fill('Praticienne Fictive')
  await page.getByLabel('Adresse du cabinet').fill('1 rue de l’Essai, 94300 Vincennes')
  await page.getByLabel('N° ADELI').fill('000000000')
  await page.getByLabel('SIRET').fill('00000000000000')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await page.getByText('Cabinet et factures enregistrés').waitFor()
})

await step('nouveau patient avec adresse', async () => {
  await nav('Patients')
  await page.getByRole('button', { name: 'Nouveau patient' }).click()
  await page.getByLabel('Nom *', { exact: true }).fill('Essai')
  await page.getByLabel('Prénom *', { exact: true }).fill('Camille')
  await page.getByLabel('Date de naissance *').fill('1990-03-12')
  await page.getByLabel('Adresse', { exact: true }).fill('8 rue des Lilas')
  await page.getByLabel('Code postal', { exact: true }).fill('94300')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await page.getByText('Fiche patient créée').waitFor()
})

await step('séance du jour réalisée', async () => {
  await page.getByRole('button', { name: 'Nouvelle' }).click()
  await page.getByLabel('Motif', { exact: true }).fill('Lombalgie')
  await page
    .getByRole('group', { name: 'Paiement' })
    .getByRole('button', { name: 'Chèque' })
    .click()
  await page.getByRole('button', { name: 'Séance réalisée' }).click()
  await page.getByText('Séance réalisée · elle est maintenant verrouillée').waitFor()
})

await step('documents (R-26) : glisser-déposer, aperçu', async () => {
  await page.getByRole('button', { name: /^Documents \(0\)$/ }).click()
  const drawer = page.getByRole('dialog', { name: 'Documents' })
  const files = await page.evaluateHandle(() => {
    const dt = new DataTransfer()
    dt.items.add(new File(['Retour du Dr Lune : RAS.'], 'Courrier Dr Lune.txt'))
    dt.items.add(new File(['%PDF-1.4'], 'IRM_lombaire.pdf', { type: 'application/pdf' }))
    return dt
  })
  await drawer.getByText('Glissez des fichiers ici').dispatchEvent('drop', { dataTransfer: files })
  await page.getByText('2 documents ajoutés').waitFor()
  await drawer.getByRole('button', { name: 'Aperçu de « IRM lombaire »' }).waitFor()
  await drawer.getByRole('button', { name: 'Aperçu de « Courrier Dr Lune »' }).click()
  await page.getByText('Retour du Dr Lune : RAS.').waitFor()
  await page.keyboard.press('Escape')
  await page.getByText('Retour du Dr Lune : RAS.').waitFor({ state: 'detached' })
  await drawer.getByRole('button', { name: 'Fermer' }).click()
  await page.getByRole('button', { name: /^Documents \(2\)$/ }).waitFor()
})

await step('émission de la facture et PDF archivé', async () => {
  await page.getByRole('button', { name: 'Générer la facture' }).click()
  const dialog = page.getByRole('dialog', { name: 'Émettre la facture' })
  await dialog.getByText(/provisoire/).waitFor()
  await dialog.getByRole('button', { name: 'Émettre la facture' }).click()
  await page.getByText(/N° \d{4}-0001 émise et enregistrée/).waitFor({ timeout: 30000 })
  const year = today.slice(0, 4)
  const pdf = join(userData, 'factures', year, `${year}-0001.pdf`)
  if (!existsSync(pdf)) throw new Error(`PDF absent : ${pdf}`)
  await page.getByRole('button', { name: 'Terminer' }).click()
})

await step('registre et « Supprimer la facture »', async () => {
  await page.getByRole('button', { name: 'Voir la facture' }).click()
  await page.getByRole('heading', { name: /^Factures de / }).waitFor()
  await page.getByRole('button', { name: 'Supprimer la facture…' }).click()
  await page.getByRole('button', { name: 'Supprimer', exact: true }).click()
  await page.getByText(/^Facture \d{4}-0001 supprimée$/).waitFor()
  const files = readdirSync(join(userData, 'factures', today.slice(0, 4)))
  if (!files.some((f) => f.startsWith('AV-'))) throw new Error('PDF de l’avoir absent')
})

await step('sauvegarde chiffrée', async () => {
  await nav('Paramètres')
  await page.getByRole('tab', { name: /Sauvegarde/ }).click()
  await page.getByRole('button', { name: 'Sauvegarder maintenant' }).click()
  await page.getByText(/Sauvegarde MeuOsteo_.*\.mosave enregistrée/).waitFor()
})

await step('journal (R-20) filtré sur les factures', async () => {
  await page.getByRole('tab', { name: /Journal/ }).click()
  const filter = page.getByRole('group', { name: 'Filtrer le journal' })
  await filter.getByRole('button', { name: 'Factures' }).click()
  if (
    (await filter.getByRole('button', { name: 'Factures' }).getAttribute('aria-pressed')) !== 'true'
  ) {
    throw new Error('Filtre Factures non appliqué')
  }
  await page.getByText(/Facture \d{4}-0001 supprimée \(avoir AV-\d{4}-0001\)/).waitFor()
  await page.getByText(/Facture \d{4}-0001 émise \(60 €\)/).waitFor()
})

await app.close()
console.log(steps.join('\n'))
if (errors.length > 0) {
  console.error('Erreurs dans la console :', errors)
  process.exit(1)
}
rmSync(userData, { recursive: true, force: true })
console.log('Parcours critique OK')
