import { describe, expect, it } from 'vitest'
import {
  accountingCsv,
  neutralizeFormula,
  toCsv,
  envoiKind,
  formatAvoirNumber,
  formatEuros,
  formatEurosShort,
  formatInvoiceNumber,
  invoiceAction,
  invoiceBlockers,
  invoiceStatusKey,
  missingCabinetFields,
  modePaiementLabel,
  nextSequence,
  reglementMention,
  reglementOf,
  reglementSummary,
  registerTotals,
  renderEmailTemplate,
  sequenceGaps,
  DEFAULT_EMAIL_TEMPLATE,
  formatTarifList,
  isAdeli,
  isSiret,
  parseTarif,
  parseTarifList,
} from './invoice'

const done = { status: 'done' as const, tarifCents: 6000, invoiced: false }
const ok = { editing: false, addressComplete: true }

describe('R-10 · conditions d’émission', () => {
  it('R-10 une séance réalisée, payante, non facturée et avec adresse complète est facturable', () => {
    expect(invoiceBlockers(done, ok)).toEqual([])
    expect(invoiceAction(done, ok)).toBe('generate')
  })

  it('R-10 refuse une séance non réalisée, en édition, gratuite, déjà facturée ou sans adresse', () => {
    expect(invoiceBlockers({ ...done, status: 'planned' }, ok)).toEqual(['not_done'])
    expect(invoiceBlockers({ ...done, status: 'cancelled' }, ok)).toEqual(['not_done'])
    expect(invoiceBlockers(done, { ...ok, editing: true })).toEqual(['editing'])
    expect(invoiceBlockers({ ...done, tarifCents: 0 }, ok)).toEqual(['free'])
    expect(invoiceBlockers({ ...done, invoiced: true }, ok)).toEqual(['already_invoiced'])
    expect(invoiceBlockers(done, { ...ok, addressComplete: false })).toEqual(['address'])
  })

  it('R-10 le bouton est remplacé par l’action ou la mention qui convient', () => {
    expect(invoiceAction({ ...done, invoiced: true }, ok)).toBe('view')
    expect(invoiceAction({ ...done, tarifCents: 0 }, ok)).toBe('free')
    expect(invoiceAction(done, { ...ok, addressComplete: false })).toBe('complete_address')
    expect(invoiceAction(done, { ...ok, editing: true })).toBeNull()
    expect(invoiceAction({ ...done, status: 'planned' }, ok)).toBeNull()
  })
})

describe('R-11 · numérotation', () => {
  it('R-11 format AAAA-NNNN, séquence par année', () => {
    expect(formatInvoiceNumber(2026, 1)).toBe('2026-0001')
    expect(formatInvoiceNumber(2026, 143)).toBe('2026-0143')
    expect(nextSequence(null)).toBe(1)
    expect(nextSequence(142)).toBe(143)
  })

  it('R-11 détecte un numéro perdu', () => {
    expect(sequenceGaps([1, 2, 3])).toEqual([])
    expect(sequenceGaps([1, 2, 5])).toEqual([3, 4])
    expect(sequenceGaps([])).toEqual([])
  })
})

describe('R-12 · instantané', () => {
  it('R-12 règlement : virement en attente ou paiement absent → règlement attendu', () => {
    expect(reglementOf('virement_attente')).toBe('attente')
    expect(reglementOf(null)).toBe('attente')
    expect(reglementOf('cheque')).toBe('acquittee')
    expect(reglementOf('virement_recu')).toBe('acquittee')
    expect(modePaiementLabel('especes')).toBe('espèces')
    expect(modePaiementLabel('virement_attente')).toBe('virement')
  })

  it('R-12 mention « Acquittée le … » ou « Règlement attendu »', () => {
    expect(
      reglementMention({
        reglement: 'acquittee',
        modePaiement: 'chèque',
        acquitteeLe: '2026-10-09',
      }),
    ).toBe('Acquittée le 09/10/2026 · règlement : chèque.')
    expect(
      reglementMention({
        reglement: 'attente',
        modePaiement: 'virement',
        acquitteeLe: '2026-10-09',
      }),
    ).toBe('Règlement attendu par virement.')
    expect(reglementSummary('acquittee', 'chèque')).toBe('Acquittée · Chèque')
    expect(reglementSummary('attente', 'virement')).toBe('En attente (virement)')
  })

  it('R-12 mentions obligatoires du praticien : nom, adresse, ADELI, SIRET', () => {
    expect(
      missingCabinetFields({
        nom: 'Anne Martin',
        titre: 'Ostéopathe D.O.',
        adresse: '',
        telephone: '',
        adeli: '123456789',
        siret: ' ',
      }),
    ).toEqual(['adresse', 'siret'])
  })
})

describe('R-13 · suppression et avoir', () => {
  it('R-13 avoir AV-AAAA-NNNN, statut « Supprimée »', () => {
    expect(formatAvoirNumber(2026, 2)).toBe('AV-2026-0002')
    expect(invoiceStatusKey({ statut: 'deleted', reglement: 'acquittee' })).toBe('cancel')
    expect(invoiceStatusKey({ statut: 'emise', reglement: 'attente' })).toBe('wait')
  })

  it('R-13 les supprimées ne comptent pas dans le total facturé', () => {
    expect(
      registerTotals([
        { statut: 'emise', reglement: 'acquittee', montantCents: 6000 },
        { statut: 'emise', reglement: 'attente', montantCents: 5500 },
        { statut: 'deleted', reglement: 'acquittee', montantCents: 6000 },
      ]),
    ).toEqual({ count: 3, totalCents: 11500, pendingCents: 5500, deleted: 1 })
  })

  it('R-13 l’avoir figure dans l’export comptable, montant négatif', () => {
    const csv = accountingCsv([
      {
        type: 'Avoir',
        numero: 'AV-2026-0001',
        date: '2026-10-25',
        patient: 'Hugo Bernard',
        montantCents: -6000,
        reglement: '',
        modePaiement: '',
        reference: 'Annule 2026-0118',
      },
      {
        type: 'Facture',
        numero: '2026-0118',
        date: '2026-09-28',
        patient: 'Hugo Bernard',
        montantCents: 6000,
        reglement: 'Acquittée',
        modePaiement: 'chèque',
        reference: 'Annulée par AV-2026-0001',
      },
    ])
    const lines = csv.replace('\uFEFF', '').trim().split('\r\n')
    expect(lines[0]).toBe('Type;Numéro;Date;Patient;Montant;Règlement;Mode de paiement;Référence')
    expect(lines[1]).toBe(
      'Facture;2026-0118;28/09/2026;Hugo Bernard;60,00;Acquittée;chèque;Annulée par AV-2026-0001',
    )
    expect(lines[2]).toBe('Avoir;AV-2026-0001;25/10/2026;Hugo Bernard;-60,00;;;Annule 2026-0118')
  })
})

describe('Envoi et montants', () => {
  it('formate les montants en euros', () => {
    expect(formatEuros(6000)).toBe('60,00 €')
    expect(formatEuros(5250)).toBe('52,50 €')
    expect(formatEuros(125000)).toBe('1 250,00 €')
    expect(formatEuros(-6000)).toBe('−60,00 €')
    expect(formatEurosShort(6000)).toBe('60 €')
    expect(formatEurosShort(5250)).toBe('52,50 €')
  })

  it('remplace {prénom} et {date} dans le modèle d’e-mail', () => {
    const mail = renderEmailTemplate(DEFAULT_EMAIL_TEMPLATE, {
      prenom: 'Camille',
      dateSeance: '2026-10-09',
      signature: 'Anne Martin',
    })
    expect(mail.subject).toBe('Votre note d’honoraires du 09/10/2026')
    expect(mail.body).toContain('Bonjour Camille,')
    expect(mail.body).toContain('pour la séance du 09/10/2026.')
    expect(mail.body.endsWith('Bien cordialement,\nAnne Martin')).toBe(true)
  })

  it('colonne « Envoi » : le dernier envoi réussi', () => {
    expect(envoiKind([])).toBe('Non envoyé')
    expect(envoiKind([{ canal: 'email', ok: false }])).toBe('Non envoyé')
    expect(
      envoiKind([
        { canal: 'email', ok: true },
        { canal: 'print', ok: true },
      ]),
    ).toBe('Imprimée')
  })
})

describe('Paramètres · tarifs et identifiants', () => {
  it('lit les tarifs saisis en texte', () => {
    expect(parseTarif('60 €')).toBe(6000)
    expect(parseTarif('52,5')).toBe(5250)
    expect(parseTarif('Gratuit')).toBe(0)
    expect(parseTarif('soixante')).toBeNull()
    expect(parseTarifList('Gratuit, 50 €, 55 €, 65 €')).toEqual({
      ok: true,
      cents: [0, 5000, 5500, 6500],
    })
    expect(parseTarifList('50 €, beaucoup')).toEqual({ ok: false, bad: 'beaucoup' })
    expect(formatTarifList([0, 5000, 6000], 6000)).toBe('Gratuit, 50 €')
  })

  it('vérifie ADELI (9 chiffres) et SIRET (14 chiffres)', () => {
    expect(isAdeli('94 000 0000')).toBe(true)
    expect(isAdeli('12345')).toBe(false)
    expect(isSiret('123 456 789 00011')).toBe(true)
    expect(isSiret('123')).toBe(false)
  })
})

describe('exports CSV', () => {
  it('neutralise les formules Excel sans toucher aux montants', () => {
    expect(neutralizeFormula('=HYPERLINK("http://x")')).toBe(`'=HYPERLINK("http://x")`)
    expect(neutralizeFormula('+33 6 12')).toBe("'+33 6 12")
    expect(neutralizeFormula('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(neutralizeFormula('-cmd')).toBe("'-cmd")
    expect(neutralizeFormula('-60,00')).toBe('-60,00')
    expect(neutralizeFormula('Camille Roux')).toBe('Camille Roux')
    expect(toCsv([['=1+1', '-60,00']])).toBe("\uFEFF'=1+1;-60,00\r\n")
  })
})
