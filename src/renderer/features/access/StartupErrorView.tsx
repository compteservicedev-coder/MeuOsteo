import type { StartupError } from '@shared/types/app'
import { Icon } from '../../components/ui/Icon'

const MESSAGES: Record<StartupError, { title: string; body: string }> = {
  key_unavailable: {
    title: 'La clé de la base est illisible',
    body: 'Elle est protégée par la session Windows qui l’a créée. Ouvrez MeuOsteo depuis cette session, ou restaurez une sauvegarde.',
  },
  key_protection_unavailable: {
    title: 'Le chiffrement de Windows est indisponible',
    body: 'MeuOsteo protège la clé de la base avec le chiffrement de la session Windows, qui ne répond pas. Redémarrez l’ordinateur puis relancez MeuOsteo.',
  },
  database_unavailable: {
    title: 'La base de données n’a pas pu être ouverte',
    body: 'Fermez puis relancez MeuOsteo. Si le problème continue, restaurez une sauvegarde.',
  },
}

export function StartupErrorView({ error }: { error: StartupError }) {
  const { title, body } = MESSAGES[error]
  return (
    <section
      role="alert"
      className="splash-card-in flex w-full max-w-[420px] flex-col items-center gap-3 rounded-[28px] border border-white/15 bg-white/[0.08] p-6 text-center backdrop-blur-[14px]"
    >
      <Icon name="alert" size={32} className="text-[#FFB4A8]" />
      <h2 className="text-[18px] font-extrabold">{title}</h2>
      <p className="text-[14px] leading-relaxed text-nav-soft">{body}</p>
      <p className="text-[13px] text-nav-muted">Vos données n’ont pas été modifiées.</p>
    </section>
  )
}
