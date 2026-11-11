import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { GmailStatus, GmailTestResult } from '@shared/types/invoices'
import { useToast } from '../../components/toast/toastContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'
import { cn } from '../../lib/cn'
import { EASE_SOFT } from '../../lib/motion'

const isGmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

/** Paramètres > Messagerie Gmail (SPEC §8.2): the account used to send invoices and e-mails. */
export function MessagerieTab({ onStatus }: { onStatus?: (s: GmailStatus) => void }) {
  const toast = useToast()
  const [status, setStatus] = useState<GmailStatus | null>(null)
  const [address, setAddress] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [test, setTest] = useState<GmailTestResult | null>(null)
  const [tried, setTried] = useState(false)

  const apply = (s: GmailStatus) => {
    setStatus(s)
    setAddress(s.address)
    setPassword('')
    onStatus?.(s)
  }

  useEffect(() => {
    void window.api.gmail.getStatus().then(apply)
    // Loaded once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!status) return null
  const dirty = address.trim().toLowerCase() !== status.address || password !== ''
  const addressError = tried && !isGmail(address) ? 'Adresse e-mail invalide' : undefined
  const passwordError =
    tried && !status.hasPassword && password.replace(/\s/g, '').length < 16
      ? 'Le mot de passe d’application compte 16 lettres'
      : undefined

  const save = async () => {
    setTried(true)
    if (!isGmail(address) || (!status.hasPassword && password.replace(/\s/g, '').length < 16)) {
      return false
    }
    setSaving(true)
    const next = await window.api.gmail.save({
      address,
      password: password ? password : null,
    })
    setSaving(false)
    apply(next)
    setTried(false)
    toast.show('Messagerie enregistrée')
    return true
  }

  const runTest = async () => {
    if (dirty && !(await save())) return
    setTesting(true)
    setTest(null)
    const r = await window.api.gmail.test()
    setTesting(false)
    setTest(r)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Messagerie Gmail"
        description="Envoi des factures et des e-mails aux patients, depuis votre adresse Gmail"
        actions={
          <span
            className={cn(
              'rounded-pill px-3 py-1 text-[13px] font-extrabold',
              status.connected ? 'bg-aqua-50 text-aqua-ink' : 'bg-red-50 text-red-ink',
            )}
          >
            {status.connected ? 'Connecté' : 'Déconnecté'}
          </span>
        }
      >
        <div className="grid gap-3.5 md:grid-cols-2">
          <Field label="Adresse Gmail" error={addressError}>
            <Input
              type="email"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="cabinet.osteo@gmail.com"
              autoComplete="off"
            />
          </Field>
          <Field
            label="Mot de passe d’application"
            error={passwordError}
            hint={
              status.hasPassword
                ? 'Enregistré et chiffré sur ce PC. Laisser vide pour le garder.'
                : undefined
            }
          >
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={status.hasPassword ? '•••• •••• •••• ••••' : 'abcd efgh ijkl mnop'}
              autoComplete="new-password"
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" disabled={!dirty} loading={saving} onClick={() => void save()}>
            Enregistrer
          </Button>
          <Button
            icon={<Icon name="check" size={16} strokeWidth={2.4} />}
            loading={testing}
            disabled={!status.hasPassword && !password}
            onClick={() => void runTest()}
          >
            {testing ? 'Test en cours…' : 'Tester la connexion'}
          </Button>
          {status.hasPassword && (
            <Button
              variant="ghost"
              onClick={async () => {
                apply(await window.api.gmail.setConnected(!status.connected))
                toast.show(status.connected ? 'Gmail déconnecté' : 'Gmail reconnecté')
              }}
            >
              {status.connected ? 'Déconnecter' : 'Reconnecter'}
            </Button>
          )}
        </div>
        {test && (
          <ul className="flex flex-col gap-2" aria-label="Résultat du test">
            {test.steps.map((s, i) => (
              <motion.li
                key={s.step}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.12, ease: EASE_SOFT }}
                className={cn(
                  'flex items-center gap-2.5 rounded-control px-3 py-2.5 text-[14px] font-semibold',
                  s.ok ? 'bg-aqua-50 text-aqua-ink' : 'bg-red-50 text-red-ink',
                )}
              >
                <Icon name={s.ok ? 'check' : 'alert'} size={16} strokeWidth={2.6} />
                {s.detail}
              </motion.li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Comment créer le mot de passe d’application (5 min)">
        <ol className="flex flex-col gap-2.5 text-[15px] text-ink-600">
          {[
            'Activer la validation en deux étapes sur le compte Google.',
            'Ouvrir la page « Mots de passe des applications » du compte Google, créer « MeuOsteo » et copier le code de 16 lettres.',
            'Dans MeuOsteo, saisir l’adresse Gmail et ce code, puis « Tester la connexion ».',
          ].map((text, i) => (
            <li key={text} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-royal-50 text-[13px] font-extrabold text-royal-700">
                {i + 1}
              </span>
              <span className="pt-0.5">{text}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}
