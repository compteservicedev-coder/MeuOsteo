/** R-22 · Sauvegarde: an alert is shown when no backup was made in the last 7 days. */
export const BACKUP_ALERT_DAYS = 7

export function isBackupRecent(lastBackupAt: string | null, now: Date): boolean {
  if (lastBackupAt === null) return false
  return now.getTime() - new Date(lastBackupAt).getTime() < BACKUP_ALERT_DAYS * 24 * 3600 * 1000
}
