/**
 * Paramètres > Messagerie Gmail: address, application password (encrypted by safeStorage, never
 * logged nor sent to the renderer), label and frequency. Used by SMTP sending (lot 3) and the
 * IMAP synchronisation (lot 4).
 */
import { SETTINGS_SUBJECT } from '@shared/domain/journal'
import type { GmailSettingsInput, GmailStatus } from '@shared/types/invoices'
import type { AppDatabase } from '../db/client'
import { addJournalLine } from '../db/repositories/journalRepository'
import { getSetting, setSetting } from '../db/repositories/settingsRepository'
import type { GmailCredentials } from './mailer'
import { DEFAULT_GMAIL, gmailSettingSchema, type GmailSetting } from './settingsSchemas'

export interface SecretBox {
  encrypt(plain: string): string
  decrypt(encrypted: string): string
}

/** « abcd efgh ijkl mnop » as shown by Google → `abcdefghijklmnop`. */
export const normalizeAppPassword = (value: string) => value.replace(/\s+/g, '')

export class GmailSettingsService {
  constructor(
    private readonly db: AppDatabase,
    private readonly secrets: SecretBox,
    private readonly now: () => Date = () => new Date(),
  ) {}

  setting(): GmailSetting {
    return getSetting(this.db, 'gmail', gmailSettingSchema, DEFAULT_GMAIL)
  }

  private write(value: GmailSetting): void {
    setSetting(this.db, 'gmail', value)
  }

  status(): GmailStatus {
    const s = this.setting()
    return {
      address: s.address,
      hasPassword: s.passwordEnc !== null,
      label: s.label,
      frequency: s.frequency,
      connected: s.connected && s.passwordEnc !== null && s.address !== '',
    }
  }

  save(input: GmailSettingsInput): GmailStatus {
    const current = this.setting()
    const password = input.password === null ? null : normalizeAppPassword(input.password)
    const address = input.address.trim().toLowerCase()
    this.write({
      ...current,
      address,
      passwordEnc: password ? this.secrets.encrypt(password) : current.passwordEnc,
      label: input.label.trim() || DEFAULT_GMAIL.label,
      frequency: input.frequency,
      connected: Boolean(address && (password || current.passwordEnc)),
      // Another account: start the reading again.
      lastUid: address === current.address ? current.lastUid : {},
    })
    addJournalLine(
      this.db,
      { type: 'reglage', subject: SETTINGS_SUBJECT, action: 'Connexion Gmail configurée' },
      this.now(),
    )
    return this.status()
  }

  setConnected(connected: boolean): GmailStatus {
    const current = this.setting()
    this.write({ ...current, connected: connected && current.passwordEnc !== null })
    addJournalLine(
      this.db,
      {
        type: 'reglage',
        subject: SETTINGS_SUBJECT,
        action: connected ? 'Connexion Gmail rétablie' : 'Connexion Gmail déconnectée',
      },
      this.now(),
    )
    return this.status()
  }

  /** Decrypted credentials, only while connected. */
  credentials(): GmailCredentials | null {
    const s = this.setting()
    if (!s.connected || !s.passwordEnc || !s.address) return null
    try {
      return { address: s.address, password: this.secrets.decrypt(s.passwordEnc) }
    } catch {
      return null
    }
  }

  setLastUid(mailboxKey: string, uid: number): void {
    const s = this.setting()
    this.write({ ...s, lastUid: { ...s.lastUid, [mailboxKey]: uid } })
  }
}
