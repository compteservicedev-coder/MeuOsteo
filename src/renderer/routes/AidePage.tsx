import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { foldForSearch } from '@shared/domain/text'
import { Page } from '../components/layout/Page'
import { PageHeader } from '../components/layout/PageHeader'
import { Icon } from '../components/ui/Icon'
import { Input } from '../components/ui/Field'
import { GUIDE, type GuideQuestion } from '../features/help/guideContent'
import { cn } from '../lib/cn'
import { staggerItem } from '../lib/motion'

function Answer({ paragraphs }: { paragraphs: string[] }) {
  const blocks: { bullets: string[] | null; text: string }[] = []
  for (const p of paragraphs) {
    if (p.startsWith('• ')) {
      const last = blocks.at(-1)
      if (last?.bullets) last.bullets.push(p.slice(2))
      else blocks.push({ bullets: [p.slice(2)], text: '' })
    } else blocks.push({ bullets: null, text: p })
  }
  return (
    <div className="flex flex-col gap-2 text-[15px] leading-relaxed text-ink-900">
      {blocks.map((b, i) =>
        b.bullets ? (
          <ul key={i} className="ml-5 list-disc space-y-1 marker:text-royal-500">
            {b.bullets.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{b.text}</p>
        ),
      )}
    </div>
  )
}

const matches = (q: GuideQuestion, folded: string) =>
  foldForSearch(`${q.q} ${q.a.join(' ')}`).includes(folded)

/** « Aide & FAQ »: the user guide, by topic, with a search over questions and answers. */
export function AidePage() {
  const [section, setSection] = useState(GUIDE[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const folded = foldForSearch(query).trim()

  const shown = useMemo(() => {
    if (folded) {
      return GUIDE.map((s) => ({
        ...s,
        questions: s.questions.filter((q) => matches(q, folded)),
      })).filter((s) => s.questions.length > 0)
    }
    return GUIDE.filter((s) => s.id === section)
  }, [folded, section])

  return (
    <Page fill>
      <PageHeader
        title="Aide & FAQ"
        subtitle="Le mode d’emploi de MeuOsteo, question par question."
      />
      <motion.div
        variants={staggerItem}
        className="flex flex-wrap items-stretch gap-[18px] lg:min-h-0 lg:flex-1 lg:flex-nowrap"
      >
        <nav
          aria-label="Rubriques de l’aide"
          className="flex flex-[1_1_220px] flex-col gap-1 rounded-card border border-line-faint bg-white p-2 shadow-card lg:flex-[0_0_250px] lg:overflow-y-auto"
        >
          <div className="p-1 pb-2">
            <Input
              type="search"
              aria-label="Rechercher dans l’aide"
              placeholder="Rechercher…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {GUIDE.map((s) => {
            const active = !folded && s.id === section
            return (
              <button
                key={s.id}
                type="button"
                aria-current={active || undefined}
                onClick={() => {
                  setQuery('')
                  setSection(s.id)
                }}
                className={cn(
                  'btn h-[46px] w-full justify-start px-3 text-left text-[15px] font-semibold',
                  active
                    ? 'btn-primary'
                    : 'btn-ink bg-transparent text-ink-600 hover:bg-royal-50 hover:text-royal-700',
                )}
              >
                {s.title}
              </button>
            )
          })}
        </nav>

        <div
          key={folded ? 'search' : section}
          className="flex min-w-0 flex-[999_1_520px] flex-col gap-5 rounded-card-lg border border-line-faint bg-white px-6 py-5 shadow-card lg:overflow-y-auto"
        >
          {shown.length === 0 && (
            <p className="text-[15px] text-ink-500">
              Aucune réponse ne contient « {query.trim()} ».
            </p>
          )}
          {shown.map((s) => (
            <section key={s.id} aria-labelledby={`aide-${s.id}`} className="flex flex-col gap-3">
              <div>
                <h2 id={`aide-${s.id}`} className="text-section">
                  {s.title}
                </h2>
                {!folded && <p className="mt-1 text-[14px] text-ink-500">{s.intro}</p>}
              </div>
              <div className="flex flex-col gap-2">
                {s.questions.map((q) => (
                  <details
                    key={q.q}
                    open={Boolean(folded)}
                    className="group rounded-2xl border border-line-faint bg-surface-mist open:bg-white open:shadow-card"
                  >
                    <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-[15px] font-bold text-ink-900 hover:bg-royal-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-500/30 [&::-webkit-details-marker]:hidden">
                      {q.q}
                      <Icon
                        name="chevronRight"
                        size={16}
                        className="shrink-0 text-ink-500 transition-transform group-open:rotate-90"
                      />
                    </summary>
                    <div className="px-4 pb-4 pt-1">
                      <Answer paragraphs={q.a} />
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      </motion.div>
    </Page>
  )
}
