import { describe, expect, it } from 'vitest'
import {
  binAction,
  displayStatus,
  editability,
  existingSessionMessage,
  listTag,
  markDoneErrors,
  sameDaySeance,
  shortStatusLabel,
  statusLabel,
  tarifLabel,
} from './seance'

const TODAY = '2026-10-24'

describe('séances (règles R-01 à R-08)', () => {
  it('R-01 statut affiché selon le statut stocké et la date', () => {
    const planned = (date: string) => ({ date, status: 'planned' as const, paiement: null })
    expect(displayStatus(planned('2026-10-30'), TODAY)).toBe('upcoming')
    expect(displayStatus(planned(TODAY), TODAY)).toBe('today')
    expect(displayStatus(planned('2026-10-16'), TODAY)).toBe('to_complete')
    expect(statusLabel(planned('2026-10-30'), TODAY)).toBe('À venir')
    expect(statusLabel(planned(TODAY), TODAY)).toBe('Aujourd’hui')
    expect(statusLabel(planned('2026-10-16'), TODAY)).toBe('À compléter')
  })

  it('R-01 séance réalisée : statut de paiement, annulée : « Annulée »', () => {
    const done = { date: '2026-10-09', status: 'done' as const }
    expect(statusLabel({ ...done, paiement: 'cheque' }, TODAY)).toBe('Réglée · chèque')
    expect(statusLabel({ ...done, paiement: 'virement_attente' }, TODAY)).toBe(
      'Paiement en attente',
    )
    expect(shortStatusLabel({ ...done, paiement: 'virement_recu' }, TODAY)).toBe('Virement')
    expect(shortStatusLabel({ ...done, paiement: 'virement_attente' }, TODAY)).toBe('En attente')
    expect(statusLabel({ date: TODAY, status: 'cancelled', paiement: null }, TODAY)).toBe('Annulée')
  })

  it('R-01 étiquette « Facturée » s’il existe une facture active, sinon l’origine du RDV', () => {
    expect(listTag({ status: 'done', source: 'doctolib', heure: '11:30', invoiced: true })).toBe(
      'Facturée',
    )
    expect(
      listTag({ status: 'done', source: 'doctolib', heure: '11:30', invoiced: false }),
    ).toBeNull()
    expect(
      listTag({ status: 'planned', source: 'doctolib', heure: '11:30', invoiced: false }),
    ).toBe('Doctolib · 11:30')
    expect(listTag({ status: 'planned', source: 'manual', heure: null, invoiced: false })).toBe(
      'Hors Doctolib',
    )
  })

  it('R-02 « Séance réalisée » exige date passée ou du jour, motif et paiement', () => {
    expect(markDoneErrors({ date: TODAY, motif: 'Lombalgie', paiement: 'cheque' }, TODAY)).toEqual(
      [],
    )
    expect(
      markDoneErrors({ date: '2026-10-25', motif: 'Lombalgie', paiement: 'cheque' }, TODAY),
    ).toEqual(['future'])
    expect(markDoneErrors({ date: TODAY, motif: '  ', paiement: null }, TODAY)).toEqual([
      'motif_missing',
      'payment_missing',
    ])
  })

  it('R-02 une séance gratuite exige aussi un mode de paiement (maquette : « geste offert · Espèces »)', () => {
    expect(markDoneErrors({ date: TODAY, motif: 'Torticolis', paiement: null }, TODAY)).toEqual([
      'payment_missing',
    ])
    expect(tarifLabel(0)).toBe('Gratuit')
    expect(tarifLabel(6000)).toBe('60 €')
  })

  it('R-03 une séance réalisée est en lecture seule, sauf en mode « Modifier »', () => {
    expect(editability({ status: 'done' }, { editing: false, invoiced: false })).toEqual({
      fields: false,
      dateAndTarif: false,
    })
    expect(editability({ status: 'done' }, { editing: true, invoiced: false })).toEqual({
      fields: true,
      dateAndTarif: true,
    })
    expect(editability({ status: 'planned' }, { editing: false, invoiced: false }).fields).toBe(
      true,
    )
    expect(editability({ status: 'cancelled' }, { editing: false, invoiced: false }).fields).toBe(
      false,
    )
  })

  it('R-04 séance facturée : date et tarif restent bloqués en modification, sauf déverrouillage', () => {
    expect(editability({ status: 'done' }, { editing: true, invoiced: true })).toEqual({
      fields: true,
      dateAndTarif: false,
    })
    expect(
      editability({ status: 'done' }, { editing: true, invoiced: true, unlocked: true })
        .dateAndTarif,
    ).toBe(true)
  })

  it('R-06 R-07 corbeille : annuler une séance à venir, supprimer une réalisée, jamais si facturée', () => {
    expect(binAction({ status: 'planned', invoiced: false })).toBe('cancel')
    expect(binAction({ status: 'done', invoiced: false })).toBe('delete')
    expect(binAction({ status: 'done', invoiced: true })).toBeNull()
    expect(binAction({ status: 'cancelled', invoiced: false })).toBeNull()
  })

  it('R-08 au plus une séance non annulée par patient et par jour', () => {
    const seances = [
      { id: 'a', date: TODAY, status: 'cancelled' as const },
      { id: 'b', date: '2026-10-16', status: 'done' as const },
    ]
    expect(sameDaySeance(seances, TODAY)).toBeUndefined()
    const withToday = [...seances, { id: 'c', date: TODAY, status: 'planned' as const }]
    expect(sameDaySeance(withToday, TODAY)?.id).toBe('c')
    expect(sameDaySeance(withToday, TODAY, 'c')).toBeUndefined()
    expect(existingSessionMessage({ date: TODAY, source: 'doctolib', heure: '11:30' })).toBe(
      'Une séance existe déjà le 24/10/2026 (RDV Doctolib 11:30) : ouverte au lieu d’en créer une seconde',
    )
  })
})
