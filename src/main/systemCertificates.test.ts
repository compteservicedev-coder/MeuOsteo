import { describe, expect, it } from 'vitest'
import { connectionCodeOf, isCertificateCode } from './systemCertificates'

describe('connexion Gmail : diagnostic', () => {
  it('garde le code technique d’une erreur, jamais son message', () => {
    expect(connectionCodeOf({ code: 'SELF_SIGNED_CERT_IN_CHAIN', message: 'x@y.fr' })).toBe(
      'SELF_SIGNED_CERT_IN_CHAIN',
    )
    expect(connectionCodeOf({ serverResponseCode: 'AUTHENTICATIONFAILED' })).toBe(
      'AUTHENTICATIONFAILED',
    )
    expect(connectionCodeOf({ code: 'texte libre avec espaces' })).toBe('')
    expect(connectionCodeOf(new Error('boom'))).toBe('')
    expect(connectionCodeOf(null)).toBe('')
  })

  it('reconnaît un certificat refusé (antivirus qui analyse les e-mails)', () => {
    for (const code of [
      'SELF_SIGNED_CERT_IN_CHAIN',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
      'CERT_HAS_EXPIRED',
      'ERR_TLS_CERT_ALTNAME_INVALID',
    ]) {
      expect(isCertificateCode(code), code).toBe(true)
    }
    expect(isCertificateCode('ETIMEDOUT')).toBe(false)
    expect(isCertificateCode('')).toBe(false)
  })
})

describe('connexion Gmail : classement des erreurs IMAP', () => {
  it('classe les délais dépassés et connexions coupées d’imapflow en problème de réseau', async () => {
    const { imapErrorOf } = await import('./services/gmailSync')
    for (const code of [
      'CONNECT_TIMEOUT',
      'GREETING_TIMEOUT',
      'ETIMEOUT',
      'ClosedAfterConnectTLS',
      'EHOSTUNREACH',
    ]) {
      expect(imapErrorOf({ code }), code).toBe('network')
    }
    expect(imapErrorOf({ authenticationFailed: true })).toBe('auth')
    expect(imapErrorOf({ serverResponseCode: 'NONEXISTENT' })).toBe('label')
    expect(imapErrorOf({ code: 'ParserError' })).toBe('other')
  })
})
