import tls from 'node:tls'
import { log } from './logger'

/**
 * Gmail (IMAP 993, SMTP 465) goes through Node's TLS, which only knows its own list of
 * authorities, whereas the browser also trusts the certificates installed in Windows. Antivirus
 * software that scans e-mail (Avast, Kaspersky, ESET…) re-signs these connections with its own
 * authority, installed in Windows: without it, the connection is refused. Same rule as the
 * browser: Node's list plus the system's.
 */
export function trustSystemCertificates(): void {
  try {
    const system = tls.getCACertificates('system')
    if (system.length === 0) return
    tls.setDefaultCACertificates([...tls.getCACertificates('default'), ...system])
    log.info(`TLS: ${system.length} system certificate(s) trusted`)
  } catch (error) {
    log.warn('TLS: system certificates unavailable', error instanceof Error ? error.message : '')
  }
}

/** Technical code of a connection error, shown in « Tester la connexion »; never a message. */
export function connectionCodeOf(error: unknown): string {
  const e = error as { code?: unknown; serverResponseCode?: unknown } | null
  const code =
    typeof e?.code === 'string'
      ? e.code
      : typeof e?.serverResponseCode === 'string'
        ? e.serverResponseCode
        : ''
  return /^[A-Za-z0-9_-]{1,40}$/.test(code) ? code : ''
}

/** Certificate refused: an antivirus or a filtering network sits between the PC and Gmail. */
export const isCertificateCode = (code: string) =>
  /CERT|SELF_SIGNED|UNABLE_TO_(GET|VERIFY)|ERR_TLS/i.test(code)
