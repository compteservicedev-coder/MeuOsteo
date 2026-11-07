/**
 * Synchronisation Gmail (GMAIL_DOCTOLIB.md §2 – 3): IMAP on the Doctolib label only, read-only
 * (no message is changed, moved or marked as read), incremental by UIDVALIDITY and last UID, the
 * last 90 days on the first run. Network errors retry with a growing delay, silently: only the
 * status shows it. Logs hold counts and a short digest of unrecognised e-mails, never a subject
 * nor an address.
 */
import { createHash } from 'node:crypto'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { z } from 'zod'
import type { SyncStatus } from '@shared/types/planning'
import type { AppDatabase } from '../db/client'
import { getSetting, setSetting } from '../db/repositories/settingsRepository'
import { log } from '../logger'
import { connectionCodeOf } from '../systemCertificates'
import type { RdvPipeline } from './doctolib/pipeline'
import { parseDoctolibMail, type MailInput } from './doctolibParser'
import type { GmailSettingsService } from './gmail'

const FIRST_RUN_DAYS = 90

const syncStateSchema = z.object({
  lastSyncAt: z.string().nullable(),
  unrecognized: z.number().int(),
})

export type MailOutcome = 'ingested' | 'unchanged' | 'unrecognized' | 'incomplete'

/** One raw message (RFC 822) through the parsers and the rapprochement pipeline. */
export async function processRawMail(raw: Buffer, pipeline: RdvPipeline): Promise<MailOutcome> {
  const parsed = await simpleParser(raw, { skipImageLinks: true, skipTextToHtml: true })
  const mail: MailInput = {
    messageId:
      parsed.messageId ?? `no-id:${parsed.date?.toISOString() ?? ''}:${parsed.subject ?? ''}`,
    from: parsed.from?.value[0]?.address?.toLowerCase() ?? '',
    subject: parsed.subject ?? '',
    text: parsed.text ?? '',
    html: typeof parsed.html === 'string' ? parsed.html : '',
    date: parsed.date ?? null,
  }
  const outcome = parseDoctolibMail(mail)
  if (!outcome.ok) {
    // Never the subject (a patient's name) nor a raw id that may embed it: a short digest only.
    const ref = createHash('sha256').update(mail.messageId).digest('hex').slice(0, 12)
    log.warn(`Doctolib e-mail ${outcome.reason}: ${ref}`)
    return outcome.reason
  }
  const result = pipeline.ingest(outcome.rdv, {
    messageId: mail.messageId,
    receivedAt: (mail.date ?? new Date()).toISOString(),
  })
  return result.outcome === 'unchanged' ? 'unchanged' : 'ingested'
}

export function imapErrorOf(error: unknown): NonNullable<SyncStatus['error']> {
  const e = error as {
    authenticationFailed?: boolean
    code?: string
    serverResponseCode?: string
    mailboxMissing?: boolean
  }
  if (e?.authenticationFailed) return 'auth'
  if (e?.serverResponseCode === 'NONEXISTENT' || e?.mailboxMissing) return 'label'
  if (
    ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'NoConnection'].includes(
      e?.code ?? '',
    )
  )
    return 'network'
  return 'other'
}

export class GmailSync {
  private running: Promise<SyncStatus> | null = null
  private timer: NodeJS.Timeout | null = null
  private failures = 0
  private current: SyncStatus

  constructor(
    private readonly deps: {
      db: AppDatabase
      gmail: GmailSettingsService
      pipeline: RdvPipeline
      onStatus?: (status: SyncStatus) => void
      now?: () => Date
    },
  ) {
    const saved = getSetting(deps.db, 'sync_state', syncStateSchema, {
      lastSyncAt: null,
      unrecognized: 0,
    })
    this.current = {
      state: deps.gmail.credentials() ? 'idle' : 'off',
      lastSyncAt: saved.lastSyncAt,
      unrecognized: saved.unrecognized,
      error: null,
      lastChanges: 0,
    }
  }

  private now() {
    return this.deps.now?.() ?? new Date()
  }

  status(): SyncStatus {
    if (!this.deps.gmail.credentials() && this.current.state !== 'running') {
      return { ...this.current, state: 'off', error: null }
    }
    return this.current
  }

  private set(status: Partial<SyncStatus>) {
    this.current = { ...this.current, ...status }
    this.deps.onStatus?.(this.status())
  }

  private client() {
    const c = this.deps.gmail.credentials()
    if (!c) return null
    return new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user: c.address, pass: c.password },
      logger: false,
      connectionTimeout: 20_000,
      greetingTimeout: 15_000,
      socketTimeout: 60_000,
    })
  }

  /** « Tester la connexion », step 2: messages under the label. */
  async countLabel(): Promise<
    | { ok: true; count: number }
    | { ok: false; error: NonNullable<SyncStatus['error']>; code: string }
  > {
    const client = this.client()
    if (!client) return { ok: false, error: 'auth', code: '' }
    try {
      await client.connect()
      const status = await client.status(this.deps.gmail.setting().label, { messages: true })
      return { ok: true, count: status ? (status.messages ?? 0) : 0 }
    } catch (error) {
      const code = connectionCodeOf(error)
      log.warn(`Gmail test: IMAP connection failed (${code || 'no code'})`)
      return { ok: false, error: imapErrorOf(error), code }
    } finally {
      await client.logout().catch(() => undefined)
    }
  }

  /** « Synchroniser »: one run at a time; a second call waits for the first. */
  run(): Promise<SyncStatus> {
    this.running ??= this.doRun().finally(() => {
      this.running = null
    })
    return this.running
  }

  private async doRun(): Promise<SyncStatus> {
    const client = this.client()
    if (!client) {
      this.set({ state: 'off', error: null })
      return this.status()
    }
    this.set({ state: 'running' })
    const setting = this.deps.gmail.setting()
    let changes = 0
    let unrecognized = 0
    let processed = 0
    try {
      await client.connect()
      const lock = await client.getMailboxLock(setting.label, { readOnly: true })
      try {
        const mailbox = client.mailbox
        const uidValidity = mailbox ? String(mailbox.uidValidity) : '0'
        const stateKey = `${setting.label}:${uidValidity}`
        const lastUid = setting.lastUid[stateKey] ?? 0
        const found = lastUid
          ? await client.search({ uid: `${lastUid + 1}:*` }, { uid: true })
          : await client.search(
              { since: new Date(this.now().getTime() - FIRST_RUN_DAYS * 86_400_000) },
              { uid: true },
            )
        const uids = (found || []).filter((u) => u > lastUid).sort((a, b) => a - b)
        let maxUid = lastUid
        if (uids.length > 0) {
          for await (const message of client.fetch(
            uids,
            { source: true, uid: true },
            { uid: true },
          )) {
            if (!message.source) continue
            const outcome = await processRawMail(message.source, this.deps.pipeline)
            processed++
            if (outcome === 'ingested') changes++
            if (outcome === 'unrecognized' || outcome === 'incomplete') unrecognized++
            maxUid = Math.max(maxUid, message.uid)
          }
        }
        if (maxUid > lastUid) this.deps.gmail.setLastUid(stateKey, maxUid)
      } finally {
        lock.release()
      }
      await client.logout()
      this.failures = 0
      const saved = {
        lastSyncAt: this.now().toISOString(),
        unrecognized: this.current.unrecognized + unrecognized,
      }
      setSetting(this.deps.db, 'sync_state', saved)
      log.info(
        `Gmail sync: ${processed} message(s), ${changes} change(s), ${unrecognized} unrecognised`,
      )
      this.set({ state: 'idle', error: null, lastChanges: changes, ...saved })
    } catch (error) {
      await client.logout().catch(() => undefined)
      this.failures++
      const kind = imapErrorOf(error)
      log.warn(`Gmail sync failed (${kind})`)
      this.set({ state: 'error', error: kind })
    }
    return this.status()
  }

  /** At start-up, then every 5 or 15 minutes (Paramètres); retries 1, 2, 4… minutes after errors. */
  start(): void {
    this.stop()
    const tick = async () => {
      await this.run()
      const frequency = this.deps.gmail.setting().frequency
      const retry = Math.min(2 ** Math.max(0, this.failures - 1), 30)
      const minutes = this.current.state === 'error' ? retry : frequency
      if (minutes > 0) this.timer = setTimeout(() => void tick(), minutes * 60_000)
    }
    this.timer = setTimeout(() => void tick(), 5_000)
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }
}
