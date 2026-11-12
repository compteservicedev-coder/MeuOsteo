/**
 * R-28 · Nouvelle version: once a day at most, the application asks GitHub for the latest
 * published release and offers its download. Nothing about the practice or its patients is sent.
 */

/** The GitHub repository that publishes MeuOsteo (`owner/name`). */
export const SOURCE_REPOSITORY = 'compteservicedev-coder/MeuOsteo'
export const SOURCE_URL = `https://github.com/${SOURCE_REPOSITORY}`
export const RELEASES_URL = `${SOURCE_URL}/releases`
export const LATEST_RELEASE_API = `https://api.github.com/repos/${SOURCE_REPOSITORY}/releases/latest`

/** A day between two checks; the check at start-up waits for it too. */
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

/** « v1.2.3 » or « 1.2.3 » → [1, 2, 3]; null for anything else (pre-releases are ignored). */
export function parseVersion(value: string): [number, number, number] | null {
  const m = /^v?(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/.exec(value.trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/** R-28 true when `latest` is a strictly higher version than `current`. */
export function isNewerVersion(latest: string, current: string): boolean {
  const a = parseVersion(latest)
  const b = parseVersion(current)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) {
    if (a[i]! !== b[i]!) return a[i]! > b[i]!
  }
  return false
}

/** R-28 the page opened by « Télécharger » must be a release page of the project itself. */
export function isOwnReleaseUrl(url: string): boolean {
  return url === RELEASES_URL || url.startsWith(`${RELEASES_URL}/`)
}

/** R-28 a check is due when it is on and the last one is more than a day old. */
export function isCheckDue(lastCheckedAt: string | null, now: Date): boolean {
  if (!lastCheckedAt) return true
  const last = Date.parse(lastCheckedAt)
  return Number.isNaN(last) || now.getTime() - last >= UPDATE_CHECK_INTERVAL_MS
}
