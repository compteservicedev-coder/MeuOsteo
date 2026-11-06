/**
 * R-28 · Nouvelle version: asks GitHub for the latest release (one anonymous GET, no data about
 * the practice), at most once a day, and remembers what it found. Errors stay silent: the
 * application works the same offline.
 */
import { z } from 'zod'
import {
  LATEST_RELEASE_API,
  isCheckDue,
  isNewerVersion,
  isOwnReleaseUrl,
  parseVersion,
} from '@shared/domain/updates'
import type { UpdateStatus } from '@shared/types/updates'
import type { AppDatabase } from '../db/client'
import { getSetting, setSetting } from '../db/repositories/settingsRepository'
import { log } from '../logger'

const settingSchema = z.object({
  enabled: z.boolean(),
  lastCheckedAt: z.string().nullable(),
  latest: z.object({ version: z.string(), url: z.string() }).nullable(),
})
type UpdateSetting = z.infer<typeof settingSchema>
const DEFAULT_SETTING: UpdateSetting = { enabled: true, lastCheckedAt: null, latest: null }

const releaseSchema = z.object({ tag_name: z.string(), html_url: z.string() })

export type FetchLike = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

export class UpdateChecker {
  private running: Promise<UpdateStatus> | null = null

  constructor(
    private readonly deps: {
      db: AppDatabase
      currentVersion: string
      fetch: FetchLike
      now?: () => Date
    },
  ) {}

  private now() {
    return this.deps.now?.() ?? new Date()
  }

  private setting(): UpdateSetting {
    return getSetting(this.deps.db, 'update_check', settingSchema, DEFAULT_SETTING)
  }

  status(): UpdateStatus {
    const s = this.setting()
    const latest = s.latest
    return {
      enabled: s.enabled,
      currentVersion: this.deps.currentVersion,
      available:
        s.enabled && latest && isNewerVersion(latest.version, this.deps.currentVersion)
          ? latest
          : null,
      lastCheckedAt: s.lastCheckedAt,
    }
  }

  setEnabled(enabled: boolean): UpdateStatus {
    setSetting(this.deps.db, 'update_check', { ...this.setting(), enabled })
    return this.status()
  }

  /** At start-up and from the interface: checks when due (or when `force`), then the status. */
  check(force = false): Promise<UpdateStatus> {
    const s = this.setting()
    if (!s.enabled || (!force && !isCheckDue(s.lastCheckedAt, this.now()))) {
      return Promise.resolve(this.status())
    }
    this.running ??= this.ask().finally(() => (this.running = null))
    return this.running
  }

  private async ask(): Promise<UpdateStatus> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    try {
      const res = await this.deps.fetch(LATEST_RELEASE_API, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'MeuOsteo' },
        signal: controller.signal,
      })
      // 404: nothing published yet. Anything else is retried at the next start.
      if (!res.ok && res.status !== 404) {
        log.warn(`Update check: HTTP ${res.status}`)
        return this.status()
      }
      const release = res.ok ? releaseSchema.safeParse(await res.json()) : null
      const latest =
        release?.success &&
        parseVersion(release.data.tag_name) &&
        isOwnReleaseUrl(release.data.html_url)
          ? { version: release.data.tag_name.replace(/^v/, ''), url: release.data.html_url }
          : null
      setSetting(this.deps.db, 'update_check', {
        ...this.setting(),
        lastCheckedAt: this.now().toISOString(),
        latest,
      })
      return this.status()
    } catch {
      log.warn('Update check: GitHub unreachable')
      return this.status()
    } finally {
      clearTimeout(timer)
    }
  }
}
