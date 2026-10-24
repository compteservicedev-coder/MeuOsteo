import * as Popover from '@radix-ui/react-popover'
import {
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type GroupingState,
  type Row,
  type SortingState,
} from '@tanstack/react-table'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { formatIsoDateFr } from '@shared/domain/dates'
import { formatEuros, formatEurosShort, registerTotals } from '@shared/domain/invoice'
import type { InvoiceRow } from '@shared/types/invoices'
import { Page } from '../components/layout/Page'
import { useToast } from '../components/toast/toastContext'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { Segmented } from '../components/ui/Segmented'
import { InvoiceDetailPanel } from '../features/invoices/InvoiceDetailPanel'
import {
  REGISTER_COLUMNS,
  displayValue,
  exportRows,
  matchesSearch,
  sortValue,
  yearsOf,
  type ColumnKey,
} from '../features/invoices/register'
import { cn } from '../lib/cn'
import { EASE_SOFT, staggerItem } from '../lib/motion'
import { todayIso } from '../lib/today'

const GRID = 'grid grid-cols-[1fr_1fr_1.6fr_1fr_1fr_1.1fr] gap-2.5'

const STATUS_BADGE = {
  ok: 'bg-aqua-50 text-aqua-ink',
  wait: 'bg-amber-50 text-amber-ink',
  cancel: 'bg-red-50 text-red-ink',
} as const

/** Registre des factures (SPEC §6): consultation only, invoices are issued from a session. */
export function FacturesPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const patientFilter = params.get('patient')
  const [rows, setRows] = useState<InvoiceRow[] | null>(null)
  const [query, setQuery] = useState('')
  const [year, setYear] = useState<string>(() => (patientFilter ? 'all' : todayIso().slice(0, 4)))
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }])
  const [filters, setFilters] = useState<ColumnFiltersState>([])
  const [grouping, setGrouping] = useState<GroupingState>([])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [openCol, setOpenCol] = useState<ColumnKey | null>(null)
  const selectedId = params.get('facture')

  const load = useCallback(async () => setRows(await window.api.invoices.list()), [])
  useEffect(() => {
    void load()
  }, [load])

  const select = (id: string | null) => {
    const next = new URLSearchParams(params)
    if (id) next.set('facture', id)
    else next.delete('facture')
    setParams(next, { replace: true })
  }

  const patientRows = useMemo(
    () => (rows ?? []).filter((r) => !patientFilter || r.patientId === patientFilter),
    [rows, patientFilter],
  )
  const patientName = patientFilter ? (patientRows[0]?.patientNom ?? 'ce patient') : null
  const years = yearsOf(patientRows)
  const base = useMemo(
    () =>
      patientRows.filter(
        (r) => (year === 'all' || r.dateEmission.startsWith(year)) && matchesSearch(r, query),
      ),
    [patientRows, year, query],
  )

  const columns = useMemo<ColumnDef<InvoiceRow, string>[]>(
    () =>
      REGISTER_COLUMNS.map((c) => ({
        id: c.key,
        accessorFn: (r: InvoiceRow) => displayValue(r, c.key),
        sortingFn: (a: Row<InvoiceRow>, b: Row<InvoiceRow>) => {
          const x = sortValue(a.original, c.key)
          const y = sortValue(b.original, c.key)
          return x < y ? -1 : x > y ? 1 : a.original.numero.localeCompare(b.original.numero)
        },
        filterFn: (row: Row<InvoiceRow>, id: string, value: string[]) =>
          !value?.length || value.includes(row.getValue<string>(id)),
        enableGrouping: c.canGroup,
        getGroupingValue: (r: InvoiceRow) => displayValue(r, c.key),
      })),
    [],
  )

  const table = useReactTable({
    data: base,
    columns,
    state: { sorting, columnFilters: filters, grouping },
    onSortingChange: setSorting,
    onColumnFiltersChange: setFilters,
    onGroupingChange: setGrouping,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    groupedColumnMode: false,
    enableSortingRemoval: false,
  })

  const shown = table.getFilteredRowModel().rows.map((r) => r.original)
  const totals = registerTotals(shown)
  const filterOf = (key: ColumnKey) =>
    (filters.find((f) => f.id === key)?.value as string[] | undefined) ?? []
  const setFilter = (key: ColumnKey, values: string[]) =>
    setFilters((fs) => [
      ...fs.filter((f) => f.id !== key),
      ...(values.length ? [{ id: key, value: values }] : []),
    ])
  const chips = filters.flatMap((f) =>
    (f.value as string[]).map((v) => ({ key: f.id as ColumnKey, value: v })),
  )
  const anyFilter = chips.length > 0 || query.trim() !== ''

  const exportSelection = async () => {
    const r = await window.api.invoices.exportSelection(exportRows(shown), `Factures ${todayIso()}`)
    if (r.ok) toast.show(`${shown.length} facture(s) exportée(s)`)
    else if (r.reason === 'error') toast.show('Export impossible', 'error')
  }

  return (
    <Page>
      <motion.div variants={staggerItem} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {patientName && (
            <Link
              to={`/patients/${patientFilter}`}
              className="mb-1 inline-flex items-center gap-1.5 text-[14px] font-bold text-royal-600 hover:text-royal-700"
            >
              <Icon name="arrowLeft" size={16} />
              Fiche de {patientName}
            </Link>
          )}
          <h1 className="text-title">{patientName ? `Factures de ${patientName}` : 'Factures'}</h1>
          <p className="mt-1 text-[14px] text-ink-500">
            Cliquez sur un titre de colonne pour trier, filtrer ou regrouper
          </p>
        </div>
        <Button
          icon={<Icon name="download" size={17} />}
          disabled={shown.length === 0}
          onClick={() => void exportSelection()}
        >
          Exporter la sélection
        </Button>
      </motion.div>

      <motion.p
        variants={staggerItem}
        className="flex flex-wrap items-center gap-2 rounded-2xl border border-[rgba(14,165,198,0.25)] bg-[linear-gradient(180deg,#EEFBFD,#E0F7FB)] px-4 py-3 text-[14px] text-[#0B5F73]"
      >
        <Icon name="invoice" size={16} />
        Registre de consultation : les factures se créent depuis une séance, dans la fiche du
        patient.
        <Link to="/patients" className="font-bold text-royal-600 hover:text-royal-700">
          Ouvrir un patient →
        </Link>
      </motion.p>

      <motion.div variants={staggerItem} className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Kpi label="Factures affichées" value={String(totals.count)} />
        <Kpi label="Total facturé" value={formatEurosShort(totals.totalCents)} />
        <Kpi
          label="En attente de règlement"
          value={formatEurosShort(totals.pendingCents)}
          tone={totals.pendingCents > 0 ? 'amber' : undefined}
        />
        <Kpi label="Supprimées" value={String(totals.deleted)} />
      </motion.div>

      <div className="flex flex-wrap items-start gap-[18px]">
        <motion.section
          variants={staggerItem}
          aria-labelledby="h-list"
          className="min-w-0 flex-[999_1_560px] rounded-card-lg border border-line-faint bg-white shadow-card"
        >
          <div className="flex flex-wrap items-center gap-3 border-b border-[#EDF0F6] px-5 py-4">
            <h2 id="h-list" className="text-section">
              Liste des factures
            </h2>
            <div className="ml-auto flex min-h-[44px] min-w-[220px] flex-[1_1_220px] items-center gap-2 rounded-control border border-line-strong bg-surface-field px-3 focus-within:border-royal-600 focus-within:shadow-focus-field">
              <Icon name="search" size={17} className="text-ink-500" />
              <label htmlFor="inv-q" className="sr-only">
                Rechercher une facture
              </label>
              <input
                id="inv-q"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Patient ou numéro"
                className="min-w-0 grow bg-transparent text-[15px] outline-none placeholder:text-ink-500"
              />
            </div>
            {years.length > 0 && (
              <Segmented
                label="Année"
                value={year}
                onChange={setYear}
                options={[
                  { value: 'all', label: 'Toutes' },
                  ...years.map((y) => ({ value: y, label: y })),
                ]}
              />
            )}
          </div>

          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-5 pt-3">
              {chips.map((c) => (
                <button
                  key={`${c.key}-${c.value}`}
                  type="button"
                  onClick={() =>
                    setFilter(
                      c.key,
                      filterOf(c.key).filter((v) => v !== c.value),
                    )
                  }
                  className="btn btn-ink min-h-[36px] gap-1.5 rounded-pill bg-royal-50 px-3 text-[13px] font-bold text-royal-700 hover:bg-[#D9E5FF]"
                  aria-label={`Retirer le filtre ${c.value}`}
                >
                  {REGISTER_COLUMNS.find((col) => col.key === c.key)!.label} : {c.value}
                  <Icon name="close" size={13} strokeWidth={2.6} />
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFilters([])}
                className="min-h-[36px] px-2 text-[13px] font-bold text-royal-600 hover:text-royal-700"
              >
                Tout effacer
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <div className="min-w-[640px] px-2.5 pb-3 pt-2">
              <div role="row" className={cn(GRID, 'px-2.5 py-1')}>
                {REGISTER_COLUMNS.map((c) => {
                  const column = table.getColumn(c.key)!
                  const sorted = sorting[0]?.id === c.key
                  const filtered = filterOf(c.key).length > 0
                  const grouped = grouping[0] === c.key
                  const open = openCol === c.key
                  const facets = column.getFacetedUniqueValues()
                  const values = [...facets.entries()].sort(([a], [b]) => {
                    const ra = base.find((r) => displayValue(r, c.key) === a)
                    const rb = base.find((r) => displayValue(r, c.key) === b)
                    const x = ra ? sortValue(ra, c.key) : a
                    const y = rb ? sortValue(rb, c.key) : b
                    const order = x < y ? -1 : x > y ? 1 : 0
                    return c.key === 'date' ? -order : order
                  })
                  return (
                    <Popover.Root
                      key={c.key}
                      open={open}
                      onOpenChange={(o) => setOpenCol(o ? c.key : null)}
                    >
                      <Popover.Trigger asChild>
                        <button
                          type="button"
                          aria-label={`Options de la colonne ${c.label}`}
                          className={cn(
                            'btn min-h-[40px] justify-start gap-1.5 whitespace-nowrap rounded-[10px] px-2 text-[12px] font-extrabold uppercase tracking-[0.05em]',
                            c.right && 'justify-end',
                            open
                              ? 'btn-primary'
                              : sorted || filtered || grouped
                                ? 'btn-ink bg-royal-50 text-royal-700'
                                : 'btn-ink bg-transparent text-ink-500 hover:bg-[#E6EEFF] hover:text-royal-700',
                          )}
                        >
                          {c.label}
                          {sorted && <span aria-hidden="true">{sorting[0]!.desc ? '▼' : '▲'}</span>}
                          {filtered && <Icon name="search" size={12} strokeWidth={2.6} />}
                          {grouped && <Icon name="database" size={12} strokeWidth={2.6} />}
                        </button>
                      </Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Content
                          align="start"
                          sideOffset={6}
                          className="z-30 flex w-[290px] flex-col gap-3 rounded-[18px] border border-line-faint bg-white p-4 shadow-[0_24px_50px_-20px_rgba(15,30,70,0.5)]"
                          aria-label={`Options de la colonne ${c.label}`}
                        >
                          <div className="flex flex-col gap-2">
                            <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-ink-500">
                              Trier
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {(['asc', 'desc'] as const).map((dir, i) => {
                                const on = sorted && (sorting[0]!.desc ? 'desc' : 'asc') === dir
                                return (
                                  <button
                                    key={dir}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() =>
                                      setSorting([{ id: c.key, desc: dir === 'desc' }])
                                    }
                                    className={cn(
                                      'btn min-h-[38px] rounded-[10px] px-3 text-[13px]',
                                      on
                                        ? 'btn-primary pop'
                                        : 'btn-ink border border-line-strong bg-white text-ink-600',
                                    )}
                                  >
                                    {dir === 'asc' ? '↑ ' : '↓ '}
                                    {c.sorts[i]}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                          {c.canGroup && (
                            <div className="flex flex-col gap-2">
                              <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-ink-500">
                                Regrouper
                              </span>
                              <button
                                type="button"
                                aria-pressed={grouped}
                                onClick={() => {
                                  setGrouping(grouped ? [] : [c.key])
                                  setCollapsed(new Set())
                                }}
                                className={cn(
                                  'btn min-h-[38px] self-start rounded-[10px] px-3 text-[13px]',
                                  grouped
                                    ? 'btn-primary pop'
                                    : 'btn-ink border border-line-strong bg-white text-ink-600',
                                )}
                              >
                                {grouped
                                  ? 'Ne plus regrouper'
                                  : `Regrouper par ${c.label.toLowerCase()}`}
                              </button>
                            </div>
                          )}
                          {c.canFilter && (
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-ink-500">
                                  Filtrer
                                </span>
                                {filtered && (
                                  <button
                                    type="button"
                                    onClick={() => setFilter(c.key, [])}
                                    className="text-[12px] font-bold text-royal-600"
                                  >
                                    Effacer le filtre
                                  </button>
                                )}
                              </div>
                              <ul className="flex max-h-[220px] flex-col gap-0.5 overflow-y-auto">
                                {values.map(([value, count]) => {
                                  const checked = filterOf(c.key).includes(value)
                                  const inputId = `f-${c.key}-${value}`
                                  return (
                                    <li key={value}>
                                      <label
                                        htmlFor={inputId}
                                        className="flex min-h-[40px] cursor-pointer items-center gap-2.5 rounded-[10px] px-2 text-[14px] hover:bg-surface-hover"
                                      >
                                        <input
                                          id={inputId}
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() =>
                                            setFilter(
                                              c.key,
                                              checked
                                                ? filterOf(c.key).filter((v) => v !== value)
                                                : [...filterOf(c.key), value],
                                            )
                                          }
                                          className="h-[18px] w-[18px] accent-[#1F4FD8]"
                                        />
                                        <span className="grow truncate">{value}</span>
                                        <span className="rounded-pill bg-surface-rail px-2 text-[12px] font-bold text-ink-500">
                                          {count}
                                        </span>
                                      </label>
                                    </li>
                                  )
                                })}
                              </ul>
                            </div>
                          )}
                        </Popover.Content>
                      </Popover.Portal>
                    </Popover.Root>
                  )
                })}
              </div>

              <ul aria-label="Factures">
                {table.getRowModel().rows.map((row) =>
                  row.getIsGrouped() ? (
                    <li key={row.id}>
                      <GroupHeader
                        label={String(row.groupingValue)}
                        rows={row.getLeafRows().map((r) => r.original)}
                        collapsed={collapsed.has(row.id)}
                        onToggle={() =>
                          setCollapsed((s) => {
                            const next = new Set(s)
                            if (next.has(row.id)) next.delete(row.id)
                            else next.add(row.id)
                            return next
                          })
                        }
                      />
                      {!collapsed.has(row.id) && (
                        <ul>
                          {row.subRows.map((r) => (
                            <InvoiceLine
                              key={r.id}
                              row={r.original}
                              selected={r.original.id === selectedId}
                              onSelect={() => select(r.original.id)}
                            />
                          ))}
                        </ul>
                      )}
                    </li>
                  ) : (
                    <InvoiceLine
                      key={row.id}
                      row={row.original}
                      selected={row.original.id === selectedId}
                      onSelect={() => select(row.original.id)}
                    />
                  ),
                )}
              </ul>
              {rows && shown.length === 0 && (
                <p className="px-3 py-8 text-center text-[15px] text-ink-500">
                  {patientRows.length === 0 && !patientFilter
                    ? 'Aucune facture pour le moment. Elles se créent depuis une séance réalisée, avec « Générer la facture ».'
                    : 'Aucune facture ne correspond.'}{' '}
                  {anyFilter && (
                    <button
                      type="button"
                      className="font-bold text-royal-600"
                      onClick={() => {
                        setFilters([])
                        setQuery('')
                      }}
                    >
                      Effacer les filtres
                    </button>
                  )}
                </p>
              )}
            </div>
          </div>
        </motion.section>

        <AnimatePresence>
          {selectedId && (
            <motion.aside
              key={selectedId}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: EASE_SOFT }}
              className="min-w-0 flex-[1_1_340px]"
            >
              <InvoiceDetailPanel
                id={selectedId}
                onClose={() => select(null)}
                onChanged={() => void load()}
                onOpenSeance={(patientId, seanceId) =>
                  navigate(`/patients/${patientId}?seance=${seanceId}`)
                }
              />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </Page>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'amber' }) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-line-faint bg-white px-[18px] py-4 shadow-card">
      <span className="text-[13px] font-semibold text-ink-500">{label}</span>
      <span
        className={cn(
          'text-[24px] font-extrabold tabular-nums',
          tone === 'amber' ? 'text-amber-ink' : 'text-ink-900',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function GroupHeader({
  label,
  rows,
  collapsed,
  onToggle,
}: {
  label: string
  rows: InvoiceRow[]
  collapsed: boolean
  onToggle: () => void
}) {
  const totals = registerTotals(rows)
  return (
    <button
      type="button"
      aria-expanded={!collapsed}
      onClick={onToggle}
      className="mt-1.5 flex min-h-[44px] w-full items-center gap-2.5 rounded-control bg-surface-mist px-3 text-left text-[14px] font-bold text-ink-900 hover:bg-surface-hover"
    >
      <Icon
        name="chevronRight"
        size={16}
        strokeWidth={2.6}
        className={cn('transition-transform duration-300', !collapsed && 'rotate-90')}
      />
      <span className="grow">{label}</span>
      <span className="rounded-pill bg-white px-2 text-[12px] text-ink-500">{rows.length}</span>
      <span className="tabular-nums">{formatEuros(totals.totalCents)}</span>
    </button>
  )
}

function InvoiceLine({
  row,
  selected,
  onSelect,
}: {
  row: InvoiceRow
  selected: boolean
  onSelect: () => void
}) {
  const deleted = row.statut === 'deleted'
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected || undefined}
        className={cn(
          GRID,
          'min-h-[52px] w-full items-center rounded-control px-2.5 text-left text-[15px] transition-[background] duration-200',
          selected ? 'bg-royal-50 shadow-[inset_3px_0_0_#1F4FD8]' : 'hover:bg-surface-hover',
          deleted && 'text-ink-500',
        )}
      >
        <span className={cn('font-bold tabular-nums', deleted && 'line-through')}>
          {row.numero}
        </span>
        <span className="text-ink-600">{formatIsoDateFr(row.dateEmission)}</span>
        <span className={cn('truncate font-semibold', deleted && 'line-through')}>
          {row.patientNom}
        </span>
        <span className={cn('text-right font-bold tabular-nums', deleted && 'line-through')}>
          {formatEuros(row.montantCents)}
        </span>
        <span>
          <span
            className={cn(
              'inline-block rounded-pill px-2.5 py-[3px] text-[12px] font-bold',
              STATUS_BADGE[row.statusKey],
            )}
          >
            {displayValue(row, 'statut')}
          </span>
        </span>
        <span className="truncate text-[13px] text-ink-600">{row.envoi}</span>
      </button>
    </li>
  )
}
