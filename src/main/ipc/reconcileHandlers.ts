import { z } from 'zod'
import { isoDateInParis } from '@shared/domain/dates'
import { mergeRequestSchema, patientIdSchema } from '@shared/types/reconcile'
import {
  getMergeComparison,
  ignoreDuplicatePair,
  listDuplicateTasks,
  mergeDuplicatePair,
} from '../db/repositories/duplicateRepository'
import { log } from '../logger'
import type { createRegistrar } from './register'

/** « À rapprocher » (SPEC §3) and the merge of duplicates (R-19). */
export function registerReconcileHandlers(register: ReturnType<typeof createRegistrar>): void {
  register('reconcile:list-tasks', z.tuple([]), ({ db, pipeline }) => ({
    duplicates: listDuplicateTasks(db),
    doctolib: pipeline.pendingTasks(),
    alerts: pipeline.alerts(isoDateInParis(new Date())),
  }))

  register('duplicates:compare', z.tuple([patientIdSchema, patientIdSchema]), ({ db }, a, b) =>
    getMergeComparison(db, a, b),
  )

  register('duplicates:ignore', z.tuple([patientIdSchema, patientIdSchema]), ({ db }, a, b) =>
    ignoreDuplicatePair(db, a, b),
  )

  register('duplicates:merge', z.tuple([mergeRequestSchema]), ({ db }, request) => {
    const result = mergeDuplicatePair(db, request)
    if (!result.ok) log.warn(`Merge refused (${result.reason})`)
    return result
  })
}
