/** R-28 · what the interface shows about a newer version. */
export interface UpdateStatus {
  enabled: boolean
  currentVersion: string
  /** A newer published version, or null (none, not checked yet, or check off). */
  available: { version: string; url: string } | null
  lastCheckedAt: string | null
}
