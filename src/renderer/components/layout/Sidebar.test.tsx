import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { MeuOsteoApi } from '@shared/types/ipc'
import type { UpdateStatus } from '@shared/types/updates'
import { Sidebar } from './Sidebar'

function setup(available: UpdateStatus['available']) {
  const open = vi.fn(async () => undefined)
  const status: UpdateStatus = {
    enabled: true,
    currentVersion: '0.2.0',
    available,
    lastCheckedAt: '2026-11-06T12:00:00Z',
  }
  Object.assign(window, {
    api: {
      app: {
        getTodaySummary: async () => ({ toReconcile: 0, lastBackupAt: null }),
      },
      updates: { getStatus: async () => status, open },
    } as unknown as MeuOsteoApi,
  })
  render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>,
  )
  return open
}

describe('R-28 · nouvelle version dans le menu', () => {
  it('R-28 propose de télécharger la version plus récente', async () => {
    const open = setup({ version: '0.3.0', url: 'https://github.com/x/releases/tag/v0.3.0' })
    await userEvent.click(await screen.findByRole('button', { name: /Nouvelle version 0\.3\.0/ }))
    expect(open).toHaveBeenCalledOnce()
  })

  it('R-28 n’affiche rien quand l’application est à jour', async () => {
    setup(null)
    await screen.findByRole('navigation', { name: 'Navigation principale' })
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByRole('button', { name: /Nouvelle version/ })).toBeNull()
  })
})
