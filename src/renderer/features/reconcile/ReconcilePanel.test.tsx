import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MeuOsteoApi } from '@shared/types/ipc'
import type { MergeComparison, ReconcileTasks } from '@shared/types/reconcile'
import { ToastProvider } from '../../components/toast/ToastProvider'
import { ReconcilePanel } from './ReconcilePanel'

const TASKS: ReconcileTasks = {
  doctolib: [],
  alerts: [],
  duplicates: [
    {
      a: { id: 'A', name: 'Sophie Lambert' },
      b: { id: 'B', name: 'Sophie Lambert-Durand' },
      reasons: ['portable'],
    },
  ],
}

const COMPARISON: MergeComparison = {
  a: {
    id: 'A',
    shortNo: 12,
    imported: true,
    createdAt: '2026-10-24T09:00:00Z',
    seances: 3,
    lastSeance: '2026-10-20',
  },
  b: {
    id: 'B',
    shortNo: 40,
    imported: false,
    createdAt: '2026-09-03T09:00:00Z',
    seances: 1,
    lastSeance: null,
  },
  reasons: ['portable'],
  rows: [
    { field: 'nom', label: 'Nom', a: 'Lambert', b: 'Lambert-Durand', same: false },
    { field: 'prenom', label: 'Prénom', a: 'Sophie', b: 'Sophie', same: true },
    { field: 'email', label: 'E-mail', a: '', b: 'sophie.ld@exemple.fr', same: false },
  ],
  picks: {
    nom: 'a',
    prenom: 'a',
    ddn: 'a',
    sexe: 'a',
    situation: 'a',
    enfants: 'a',
    profession: 'a',
    adresse: 'a',
    portable: 'a',
    fixe: 'a',
    email: 'b',
  },
  conflictDates: [],
}

function mockApi(tasks: ReconcileTasks[]) {
  const reconcile = {
    listTasks: vi.fn(),
    compareDuplicates: vi.fn().mockResolvedValue(COMPARISON),
    ignoreDuplicate: vi.fn().mockResolvedValue({ ok: true }),
    mergeDuplicates: vi
      .fn()
      .mockResolvedValue({ ok: true, keptId: 'A', name: 'Sophie Lambert-Durand', seances: 4 }),
  }
  for (const t of tasks) reconcile.listTasks.mockResolvedValueOnce(t)
  Object.assign(window, { api: { reconcile } as unknown as MeuOsteoApi })
  return reconcile
}

const renderPanel = () =>
  render(
    <ToastProvider>
      <ReconcilePanel />
    </ToastProvider>,
  )

afterEach(() => vi.restoreAllMocks())

describe('« À rapprocher » · doublon possible (Planning.dc.html)', () => {
  it('R-19 compare champ par champ et fusionne après confirmation', async () => {
    const api = mockApi([TASKS, { doctolib: [], alerts: [], duplicates: [] }])
    renderPanel()
    expect(await screen.findByText('Sophie Lambert · Sophie Lambert-Durand')).toBeInTheDocument()
    expect(screen.getByText('Même date de naissance et même portable')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Comparer les fiches' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('identique')).toBeInTheDocument()
    await userEvent.click(
      within(dialog).getByRole('button', { name: /Nom : garder Lambert-Durand/ }),
    )
    expect(within(dialog).getByText('Résultat : Sophie Lambert-Durand')).toBeInTheDocument()

    // The confirmation replaces the buttons.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Fusionner les fiches…' }))
    await userEvent.click(
      await within(dialog).findByRole('button', { name: 'Confirmer la fusion' }),
    )
    await waitFor(() =>
      expect(within(dialog).queryByRole('button', { name: 'Fusionner les fiches…' })).toBeNull(),
    )

    await waitFor(() =>
      expect(api.mergeDuplicates).toHaveBeenCalledWith({
        keepId: 'A',
        removeId: 'B',
        picks: { ...COMPARISON.picks, nom: 'b' },
      }),
    )
    expect(await screen.findByText('Tout est rattaché, aucun doublon.')).toBeInTheDocument()
  })

  it('R-19 « Ce ne sont pas les mêmes personnes » mémorise la paire', async () => {
    const api = mockApi([TASKS, { doctolib: [], alerts: [], duplicates: [] }])
    renderPanel()
    await userEvent.click(await screen.findByRole('button', { name: 'Comparer les fiches' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      await within(dialog).findByRole('button', { name: 'Ce ne sont pas les mêmes personnes' }),
    )
    expect(api.ignoreDuplicate).toHaveBeenCalledWith('A', 'B')
    expect(await screen.findByText('Tout est rattaché, aucun doublon.')).toBeInTheDocument()
  })
})
