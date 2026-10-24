import { describe, expect, it } from 'vitest'
import type { InvoiceRow } from '@shared/types/invoices'
import { displayValue, exportRows, matchesSearch, monthLabel, sortValue, yearsOf } from './register'

const row: InvoiceRow = {
  id: 'F1',
  numero: '2026-0142',
  dateEmission: '2026-10-23',
  patientId: 'P1',
  patientNom: 'Élise Martin',
  montantCents: 6000,
  statut: 'emise',
  reglement: 'attente',
  modePaiement: 'virement',
  statusKey: 'wait',
  envoi: 'E-mail',
  envoiLabel: 'E-mail · 23/10 à 17:52',
  seanceId: 'S1',
  dateSeance: '2026-10-23',
  deletedAt: null,
  modifiedAt: null,
}

describe('Registre des factures (SPEC §6)', () => {
  it('affiche, filtre et regroupe sur des valeurs lisibles', () => {
    expect(monthLabel('2026-10-23')).toBe('Octobre 2026')
    expect(displayValue(row, 'date')).toBe('Octobre 2026')
    expect(displayValue(row, 'montant')).toBe('60,00 €')
    expect(displayValue(row, 'statut')).toBe('En attente')
    expect(sortValue(row, 'montant')).toBe(6000)
  })

  it('recherche par patient (sans accents) ou par numéro', () => {
    expect(matchesSearch(row, 'elise')).toBe(true)
    expect(matchesSearch(row, '0142')).toBe(true)
    expect(matchesSearch(row, 'roux')).toBe(false)
    expect(yearsOf([row, { ...row, dateEmission: '2025-01-02' }])).toEqual(['2026', '2025'])
  })

  it('« Exporter la sélection » reprend les colonnes affichées', () => {
    expect(exportRows([row])[1]).toEqual([
      '2026-0142',
      '23/10/2026',
      'Élise Martin',
      '60,00',
      'En attente',
      'E-mail · 23/10 à 17:52',
      '23/10/2026',
    ])
  })
})
