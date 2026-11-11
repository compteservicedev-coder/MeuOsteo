import { z } from 'zod'
import {
  agendaSettingsSchema,
  blockInputSchema,
  idSchema,
  isoDateSchema,
  newRdvInputSchema,
} from '@shared/types/schemas'
import type { createRegistrar } from './register'

/** Planning (SPEC §3) and Paramètres > Agenda. */
export function registerPlanningHandlers(register: ReturnType<typeof createRegistrar>): void {
  const none = z.tuple([])

  register('planning:weeks', z.tuple([isoDateSchema]), ({ planning }, monday) =>
    planning.weeks(monday),
  )
  register(
    'planning:blocked-dates',
    z.tuple([isoDateSchema, isoDateSchema]),
    ({ planning }, a, b) => planning.blockedDates(a, b),
  )
  register(
    'planning:day-slots',
    z.tuple([isoDateSchema, idSchema.nullable()]),
    ({ planning }, date, patientId) => planning.daySlots(date, patientId),
  )
  register('planning:create-rdv', z.tuple([newRdvInputSchema]), ({ planning }, input) =>
    planning.createRdv(input),
  )
  register('planning:preview-block', z.tuple([blockInputSchema]), ({ planning }, input) =>
    planning.previewBlock(input),
  )
  register('planning:add-blocks', z.tuple([blockInputSchema]), ({ planning }, input) =>
    planning.addBlocks(input),
  )
  register('planning:remove-block', z.tuple([idSchema]), ({ planning }, id) =>
    planning.removeBlock(id),
  )

  register('agenda:get', none, ({ planning }) => planning.agenda())
  register('agenda:save', z.tuple([agendaSettingsSchema]), ({ planning }, value) =>
    planning.saveAgenda(value),
  )
}
