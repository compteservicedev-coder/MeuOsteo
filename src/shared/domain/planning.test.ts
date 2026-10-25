import { describe, expect, it } from 'vitest'
import {
  DEFAULT_AGENDA,
  blockConflicts,
  blockCovers,
  blockDates,
  calendarWeeks,
  cardKind,
  dayLabel,
  mondayOf,
  newRdvErrors,
  rangeLabel,
  slotGrid,
  weekDates,
  weekRange,
  weekTitle,
} from './planning'

describe('Planning · semaines', () => {
  it('affiche lundi à samedi selon les jours d’ouverture', () => {
    expect(mondayOf('2026-10-24')).toBe('2026-10-19')
    expect(mondayOf('2026-10-19')).toBe('2026-10-19')
    expect(weekDates('2026-10-19', DEFAULT_AGENDA)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
    ])
    expect(weekDates('2026-10-19', { days: ['L', 'J'] })).toEqual(['2026-10-19', '2026-10-22'])
  })

  it('titres et libellés de la maquette', () => {
    expect(weekTitle('2026-10-19', '2026-10-24')).toBe('Cette semaine')
    expect(weekTitle('2026-10-26', '2026-10-24')).toBe('Semaine prochaine')
    expect(weekTitle('2026-10-12', '2026-10-24')).toBe('Semaine dernière')
    expect(weekTitle('2026-11-02', '2026-10-24')).toBe('Semaine du 2 nov.')
    expect(weekRange('2026-10-19', '2026-10-24')).toBe('19 au 24 oct.')
    expect(weekRange('2026-10-26', '2026-10-31')).toBe('26 au 31 oct.')
    expect(weekRange('2026-11-30', '2026-12-05')).toBe('30 nov. au 5 déc.')
    expect(rangeLabel('2026-10-19', '2026-10-31')).toBe('19 oct. → 31 oct. 2026')
    expect(dayLabel('2026-10-19')).toBe('Lun. 19')
    expect(dayLabel('2026-11-01')).toBe('Dim. 1 nov.')
  })

  it('calendrier du mois en semaines complètes', () => {
    const weeks = calendarWeeks(2026, 9)
    expect(weeks[0]![0]).toBe('2026-09-28')
    expect(weeks.at(-1)![6]).toBe('2026-11-01')
    expect(weeks).toHaveLength(5)
  })
})

describe('R-23 · blocages', () => {
  it('R-23 matin avant 13 h, après-midi ensuite, journée entière', () => {
    expect(blockCovers('am', '12:30')).toBe(true)
    expect(blockCovers('am', '13:00')).toBe(false)
    expect(blockCovers('pm', '13:00')).toBe(true)
    expect(blockCovers('day', null)).toBe(true)
    expect(blockCovers('pm', null)).toBe(false)
  })

  it('R-23 une période ne bloque que les jours d’ouverture et signale les RDV existants', () => {
    const dates = blockDates('2026-10-30', '2026-11-02', DEFAULT_AGENDA)
    expect(dates).toEqual(['2026-10-30', '2026-10-31', '2026-11-02'])
    const rdv = [
      { date: '2026-10-30', heure: '09:00' },
      { date: '2026-10-30', heure: '15:30' },
      { date: '2026-11-05', heure: '10:00' },
    ]
    expect(blockConflicts(rdv, dates, 'day')).toBe(2)
    expect(blockConflicts(rdv, dates, 'pm')).toBe(1)
  })
})

describe('R-24 · créneaux libres', () => {
  const agenda = { opening: '09:00', closing: '19:00', durationMinutes: 60 as const }

  it('R-24 grille de 30 min, un RDV occupe moins de 60 min de part et d’autre', () => {
    const slots = slotGrid(agenda, [{ heure: '10:30', nom: 'Camille Roux' }], [])
    expect(slots[0]!.heure).toBe('09:00')
    expect(slots.at(-1)!.heure).toBe('18:00')
    const at = (h: string) => slots.find((s) => s.heure === h)!
    expect(at('09:30')).toMatchObject({ free: true })
    expect(at('10:00')).toMatchObject({ free: false, reason: 'Pris · Camille Roux' })
    expect(at('11:00')).toMatchObject({ free: false })
    expect(at('11:30')).toMatchObject({ free: true })
  })

  it('R-24 les créneaux bloqués ne sont pas sélectionnables', () => {
    const slots = slotGrid(agenda, [], [{ creneau: 'pm', motif: 'Formation' }])
    expect(slots.find((s) => s.heure === '12:30')!.free).toBe(true)
    expect(slots.find((s) => s.heure === '13:00')).toMatchObject({
      free: false,
      reason: 'Bloqué · Formation',
    })
  })

  it('R-24 contrôles : patient, date passée, dimanche, créneau, une séance par jour', () => {
    const slots = slotGrid(agenda, [], [])
    const base = {
      patientId: 'P1',
      date: '2026-10-26',
      heure: '10:00',
      today: '2026-10-24',
      agenda: DEFAULT_AGENDA,
      slots,
      patientHasSessionThatDay: false,
    }
    expect(newRdvErrors(base)).toEqual([])
    expect(newRdvErrors({ ...base, patientId: null })).toEqual(['patient'])
    expect(newRdvErrors({ ...base, date: '2026-10-20' })).toEqual(['past'])
    expect(newRdvErrors({ ...base, date: '2026-10-25' })).toEqual(['closed'])
    expect(newRdvErrors({ ...base, heure: '08:00' })).toEqual(['slot'])
    expect(newRdvErrors({ ...base, patientHasSessionThatDay: true })).toEqual(['same_day'])
  })
})

describe('Cartes de RDV', () => {
  it('couleur selon l’état', () => {
    const t = '2026-10-24'
    expect(cardKind({ status: 'cancelled', source: 'doctolib', date: t, today: t })).toBe('off')
    expect(cardKind({ status: 'pending', source: null, date: t, today: t })).toBe('neu')
    expect(cardKind({ status: 'done', source: 'doctolib', date: '2026-10-20', today: t })).toBe(
      'past',
    )
    expect(cardKind({ status: 'planned', source: 'manual', date: t, today: t })).toBe('man')
    expect(cardKind({ status: 'planned', source: 'doctolib', date: t, today: t })).toBe('ok')
  })
})
