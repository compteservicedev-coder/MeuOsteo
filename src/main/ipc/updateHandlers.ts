import { shell } from 'electron'
import { z } from 'zod'
import { RELEASES_URL, isOwnReleaseUrl } from '@shared/domain/updates'
import type { createRegistrar } from './register'

/** R-28 · Nouvelle version. */
export function registerUpdateHandlers(register: ReturnType<typeof createRegistrar>): void {
  const none = z.tuple([])
  register('updates:get-status', none, ({ updates }) => updates.status())
  register('updates:check', none, ({ updates }) => updates.check(true))
  register('updates:set-enabled', z.tuple([z.boolean()]), ({ updates }, enabled) =>
    updates.setEnabled(enabled),
  )
  // Opens the release page in the browser: only a page of the project itself, never a URL
  // coming from the renderer.
  register('updates:open', none, async ({ updates }) => {
    const url = updates.status().available?.url
    await shell.openExternal(url && isOwnReleaseUrl(url) ? url : RELEASES_URL)
  })
}
