import * as Tabs from '@radix-ui/react-tabs'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { GmailStatus } from '@shared/types/invoices'
import { Page } from '../components/layout/Page'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Icon, type IconName } from '../components/ui/Icon'
import { useSecurity } from '../features/access/securityState'
import { AgendaTab } from '../features/settings/AgendaTab'
import { CabinetTab } from '../features/settings/CabinetTab'
import { DeletedPatientsCard } from '../features/settings/DeletedPatientsCard'
import { MessagerieTab } from '../features/settings/MessagerieTab'
import { LegacyImportTab } from '../features/import/LegacyImportTab'
import { SecurityTab } from '../features/settings/SecurityTab'
import { cn } from '../lib/cn'
import { EASE_SOFT, staggerItem } from '../lib/motion'

interface TabDef {
  id: string
  label: string
  icon: IconName
  /** Lot that brings the tab (placeholder until then). */
  lot?: string
  summary?: string
}

/** Tabs of SPEC §8, in order. */
const TABS: TabDef[] = [
  { id: 'securite', label: 'Sécurité', icon: 'shield' },
  { id: 'messagerie', label: 'Messagerie Gmail', icon: 'mail' },
  { id: 'cabinet', label: 'Cabinet & factures', icon: 'invoice' },
  { id: 'agenda', label: 'Agenda', icon: 'calendar' },
  {
    id: 'sauvegarde',
    label: 'Sauvegarde',
    icon: 'download',
    lot: 'lot 5',
    summary: 'Dossier de sauvegarde, copies conservées, sauvegarde et restauration.',
  },
  {
    id: 'journal',
    label: 'Journal',
    icon: 'history',
    lot: 'lot 5',
    summary: 'Journal complet filtrable, durée de conservation et export CSV.',
  },
  {
    id: 'donnees',
    label: 'Données & import',
    icon: 'database',
  },
]

export function ParametresPage() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState(() => {
    const wanted = params.get('onglet')
    return TABS.some((t) => t.id === wanted) ? wanted! : 'securite'
  })
  const { status } = useSecurity()
  const [gmail, setGmail] = useState<GmailStatus | null>(null)
  useEffect(() => {
    void window.api.gmail.getStatus().then(setGmail)
  }, [])

  return (
    <Page>
      <PageHeader
        title="Paramètres"
        subtitle="Réglés une fois, utilisés partout dans l’application."
      />
      <motion.div variants={staggerItem}>
        <Tabs.Root
          value={tab}
          onValueChange={setTab}
          orientation="vertical"
          className="flex flex-wrap items-start gap-[18px]"
        >
          <Tabs.List
            aria-label="Rubriques des paramètres"
            className="flex flex-[1_1_210px] flex-col gap-1 rounded-card border border-line-faint bg-white p-2 shadow-[inset_0_1px_0_#fff,0_14px_30px_-18px_rgba(15,30,70,0.3)]"
          >
            {TABS.map((t) => {
              const active = t.id === tab
              return (
                <Tabs.Trigger
                  key={t.id}
                  value={t.id}
                  className={cn(
                    'btn h-[46px] w-full justify-start gap-2.5 px-3 text-[15px] font-semibold',
                    active
                      ? 'btn-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_10px_20px_-12px_rgba(31,79,216,0.9)]'
                      : 'btn-ink bg-transparent text-ink-600 hover:bg-royal-50 hover:text-royal-700',
                  )}
                >
                  <Icon name={t.icon} size={18} />
                  <span className="grow text-left">{t.label}</span>
                  {t.id === 'messagerie' && gmail && (
                    <span
                      className={cn(
                        'rounded-pill px-2 py-0.5 text-[11px] font-extrabold',
                        active
                          ? 'bg-white/20 text-white'
                          : gmail.connected
                            ? 'bg-aqua-50 text-aqua-ink'
                            : 'bg-red-50 text-red-ink',
                      )}
                    >
                      {gmail.connected ? 'Connecté' : 'Déconnecté'}
                    </span>
                  )}
                  {t.id === 'securite' && (
                    <span
                      className={cn(
                        'rounded-pill px-2 py-0.5 text-[11px] font-extrabold',
                        active
                          ? 'bg-white/20 text-white'
                          : status.enabled
                            ? 'bg-aqua-50 text-aqua-ink'
                            : 'bg-red-50 text-red-ink',
                      )}
                    >
                      {status.enabled ? 'Actif' : 'Inactif'}
                    </span>
                  )}
                </Tabs.Trigger>
              )
            })}
          </Tabs.List>
          <div className="min-w-0 flex-[999_1_520px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: EASE_SOFT }}
              >
                {TABS.map((t) => (
                  <Tabs.Content key={t.id} value={t.id} className="focus-visible:outline-none">
                    {t.id === 'securite' ? (
                      <SecurityTab />
                    ) : t.id === 'messagerie' ? (
                      <MessagerieTab onStatus={setGmail} />
                    ) : t.id === 'agenda' ? (
                      <AgendaTab />
                    ) : t.id === 'cabinet' ? (
                      <CabinetTab />
                    ) : t.id === 'donnees' ? (
                      <div className="flex flex-col gap-4">
                        <LegacyImportTab />
                        <DeletedPatientsCard />
                      </div>
                    ) : (
                      <Card title={t.label} description={`Disponible au ${t.lot}`}>
                        <p className="text-[15px] text-ink-600">{t.summary}</p>
                      </Card>
                    )}
                  </Tabs.Content>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </Tabs.Root>
      </motion.div>
    </Page>
  )
}
