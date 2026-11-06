import { z } from 'zod'
import {
  cancelReasonSchema,
  commentSchema,
  duplicateQuerySchema,
  idSchema,
  patientDraftSchema,
  relationSchema,
  searchQuerySchema,
  seanceChangesSchema,
  tagsSchema,
} from '@shared/types/schemas'
import { communesForCp } from '../db/communes'
import type { createRegistrar } from './register'

/** Patients, sessions and communes. Every call is refused while the interface is locked. */
export function registerPatientHandlers(register: ReturnType<typeof createRegistrar>): void {
  const none = z.tuple([])
  const byId = z.tuple([idSchema])

  register('patients:search', z.tuple([searchQuerySchema]), ({ patients }, q) => patients.search(q))
  register('patients:recent', none, ({ patients }) => patients.recent())
  register('patients:all', none, ({ patients }) => patients.all())
  register('patients:today', none, ({ patients }) => patients.todayAppointments())
  register('patients:count', none, ({ patients }) => patients.activeCount())
  register('patients:get', byId, ({ patients }, id) => patients.get(id))
  register('patients:create', z.tuple([patientDraftSchema]), ({ patients }, draft) =>
    patients.create(draft),
  )
  register('patients:update', z.tuple([idSchema, patientDraftSchema]), ({ patients }, id, draft) =>
    patients.update(id, draft),
  )
  register('patients:duplicates', z.tuple([duplicateQuerySchema]), ({ patients }, q) =>
    patients.duplicates(q),
  )
  register('patients:mark-opened', byId, ({ patients }, id) => patients.markOpened(id))
  register('patients:set-comment', z.tuple([idSchema, commentSchema]), ({ patients }, id, text) =>
    patients.setComment(id, text),
  )
  register('patients:set-antecedents', z.tuple([idSchema, tagsSchema]), ({ patients }, id, tags) =>
    patients.setAntecedents(id, tags),
  )
  register('patients:delete', byId, ({ patients }, id) => patients.softDelete(id))
  register('patients:restore', byId, ({ patients }, id) => patients.restore(id))
  register('patients:list-deleted', none, ({ patients }) => patients.listDeleted())
  register('patients:journal', byId, ({ patients }, id) => patients.journalFor(id))
  register(
    'patients:link-candidates',
    z.tuple([idSchema, searchQuerySchema]),
    ({ patients }, id, q) => patients.linkCandidates(id, q),
  )
  register(
    'patients:add-link',
    z.tuple([idSchema, idSchema, relationSchema]),
    ({ patients }, id, otherId, relation) => patients.addLink(id, otherId, relation),
  )
  register('patients:remove-link', z.tuple([idSchema, idSchema]), ({ patients }, id, otherId) =>
    patients.removeLink(id, otherId),
  )
  register('communes:by-cp', z.tuple([z.string().max(10)]), ({ db }, cp) => communesForCp(db, cp))

  register('seances:create-today', byId, ({ seances }, patientId) => seances.createToday(patientId))
  register('seances:save', z.tuple([idSchema, seanceChangesSchema]), ({ seances }, id, changes) =>
    seances.save(id, changes),
  )
  register(
    'seances:mark-done',
    z.tuple([idSchema, seanceChangesSchema]),
    ({ seances }, id, changes) => seances.markDone(id, changes),
  )
  register('seances:cancel', z.tuple([idSchema, cancelReasonSchema]), ({ seances }, id, reason) =>
    seances.cancel(id, reason),
  )
  register('seances:restore', byId, ({ seances }, id) => seances.restore(id))
  register('seances:delete', byId, ({ seances }, id) => seances.delete(id))
}
