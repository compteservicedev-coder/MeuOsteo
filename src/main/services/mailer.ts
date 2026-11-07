import nodemailer from 'nodemailer'
import type { SendError, SendOutcome } from '@shared/types/invoices'
import { connectionCodeOf } from '../systemCertificates'
import type { InvoiceMailer, MailMessage } from './invoices'

export interface GmailCredentials {
  address: string
  password: string
}

/** nodemailer error codes → what the interface explains. */
export function sendErrorOf(error: unknown): SendError {
  const code = (error as { code?: string } | null)?.code ?? ''
  if (code === 'EAUTH') return 'auth'
  if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'ECONNREFUSED', 'ENOTFOUND'].includes(code))
    return 'network'
  return 'other'
}

function transport(credentials: GmailCredentials) {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: credentials.address, pass: credentials.password },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    // Message content stays out of nodemailer's own logging.
    logger: false,
    disableFileAccess: true,
    disableUrlAccess: true,
  })
}

/** SMTP Gmail (GMAIL_DOCTOLIB.md §2), with the application password kept by safeStorage. */
export function createGmailMailer(credentials: () => GmailCredentials | null): InvoiceMailer & {
  verify(): Promise<SendOutcome>
  sendTest(): Promise<SendOutcome>
} {
  async function send(message: MailMessage): Promise<SendOutcome> {
    const c = credentials()
    if (!c) return { ok: false, error: 'not_configured' }
    try {
      await transport(c).sendMail({
        from: c.address,
        to: message.to,
        subject: message.subject,
        text: message.text,
        attachments: [
          {
            filename: message.attachment.filename,
            content: message.attachment.content,
            contentType: 'application/pdf',
          },
        ],
      })
      return { ok: true, to: message.to }
    } catch (error) {
      return { ok: false, error: sendErrorOf(error) }
    }
  }

  return {
    isConfigured: () => credentials() !== null,
    send,
    async verify() {
      const c = credentials()
      if (!c) return { ok: false, error: 'not_configured' }
      try {
        await transport(c).verify()
        return { ok: true, to: c.address }
      } catch (error) {
        return { ok: false, error: sendErrorOf(error), code: connectionCodeOf(error) }
      }
    },
    async sendTest() {
      const c = credentials()
      if (!c) return { ok: false, error: 'not_configured' }
      try {
        await transport(c).sendMail({
          from: c.address,
          to: c.address,
          subject: 'MeuOsteo · e-mail de test',
          text: 'Cet e-mail confirme que MeuOsteo peut envoyer les factures depuis cette adresse.',
        })
        return { ok: true, to: c.address }
      } catch (error) {
        return { ok: false, error: sendErrorOf(error), code: connectionCodeOf(error) }
      }
    },
  }
}
