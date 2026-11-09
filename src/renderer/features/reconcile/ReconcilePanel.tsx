import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { describeDuplicateReasons } from '@shared/domain/duplicates'
import type { DuplicateTask, ReconcileTasks } from '@shared/types/reconcile'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { cn } from '../../lib/cn'
import { notifyDataChanged, useDataChanged } from '../../lib/dataEvents'
import { EASE_SOFT } from '../../lib/motion'
import { MergeDialog } from './MergeDialog'

/** Panel « À rapprocher » (SPEC §3): possible duplicates (R-19); each settled case folds away. */
export function ReconcilePanel() {
  const [tasks, setTasks] = useState<ReconcileTasks | null>(null)
  const [open, setOpen] = useState<DuplicateTask | null>(null)

  const load = useCallback(
    () =>
      window.api.reconcile
        .listTasks()
        .then(setTasks)
        .catch(() => undefined),
    [],
  )
  useEffect(() => {
    void load()
  }, [load])
  useDataChanged(load)

  const resolved = useCallback(() => {
    setOpen(null)
    notifyDataChanged()
    void load()
  }, [load])

  const count = tasks ? tasks.duplicates.length : 0

  return (
    <aside
      aria-labelledby="h-todo"
      className="min-w-0 flex-[1_1_290px] self-start overflow-hidden rounded-card border border-line-faint bg-white shadow-card"
    >
      <h2
        id="h-todo"
        className="flex items-center gap-2.5 border-b border-[#EDF0F6] px-5 py-[18px] text-[16px] font-extrabold"
      >
        À rapprocher
        {count > 0 && (
          <span className="pop rounded-pill bg-gradient-to-b from-amber-500 to-[#B86A12] px-2 py-0.5 text-[12px] font-extrabold text-white">
            {count}
          </span>
        )}
      </h2>
      <ul>
        <AnimatePresence initial={false}>
          {tasks?.duplicates.map((t) => (
            <TaskItem
              key={`${t.a.id}|${t.b.id}`}
              kind="Doublon possible"
              kindStyle="bg-red-50 text-red-ink"
              title={`${t.a.name} · ${t.b.name}`}
              sub={describeDuplicateReasons(t.reasons)}
              action={
                <Button size="sm" onClick={() => setOpen(t)}>
                  Comparer les fiches
                </Button>
              }
            />
          ))}
        </AnimatePresence>
      </ul>
      {tasks && count === 0 && (
        <p className="flex items-center gap-2.5 px-5 py-[22px] text-[14px] font-bold text-aqua-ink">
          <Icon name="check" size={18} strokeWidth={3} />
          Aucun doublon possible.
        </p>
      )}
      <p className="px-5 pb-4 pt-3 text-[12px] leading-normal text-ink-500">
        Deux fiches qui se ressemblent (même date de naissance, nom proche) arrivent ici pour être
        comparées et, si besoin, fusionnées.
      </p>
      <MergeDialog task={open} onClose={() => setOpen(null)} onResolved={resolved} />
    </aside>
  )
}

function TaskItem({
  kind,
  kindStyle,
  title,
  sub,
  action,
}: {
  kind: string
  kindStyle: string
  title: string
  sub: string
  action?: ReactNode
}) {
  return (
    <motion.li
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.4, ease: EASE_SOFT }}
      className="overflow-hidden"
    >
      <div className="flex flex-col gap-2 border-b border-[#EDF0F6] px-5 py-4">
        <span
          className={cn(
            'self-start rounded-pill px-[9px] py-[3px] text-[11px] font-extrabold uppercase tracking-[0.04em]',
            kindStyle,
          )}
        >
          {kind}
        </span>
        <p className="text-[15px] font-extrabold">{title}</p>
        <p className="text-[13px] leading-[1.45] text-ink-500">{sub}</p>
        {action}
      </div>
    </motion.li>
  )
}
