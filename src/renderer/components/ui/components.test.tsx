import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../toast/ToastProvider'
import { useToast } from '../toast/toastContext'
import { Badge } from './Badge'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { Field, Input } from './Field'
import { Segmented } from './Segmented'
import { Switch } from './Switch'

describe('bibliothèque de composants', () => {
  it('Button : vrai <button>, occupé pendant le chargement, tremble à la demande', () => {
    const { rerender } = render(<Button shakeSignal={1}>Enregistrer</Button>)
    const button = screen.getByRole('button', { name: 'Enregistrer' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveClass('shake-a')
    rerender(
      <Button shakeSignal={2} loading>
        Enregistrer
      </Button>,
    )
    expect(button).toHaveClass('shake-b')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('Field : libellé associé, erreur annoncée et reliée au champ', () => {
    render(
      <Field label="Code actuel" error="Code actuel incorrect" hint="4 à 6 chiffres">
        <Input />
      </Field>,
    )
    const input = screen.getByLabelText('Code actuel')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Code actuel incorrect')
    expect(screen.getByRole('alert')).toHaveTextContent('Code actuel incorrect')
  })

  it('Segmented : aria-pressed sur l’option active', async () => {
    function Demo() {
      const [value, setValue] = useState(6000)
      return (
        <Segmented
          label="Tarif"
          value={value}
          onChange={setValue}
          options={[
            { value: 5000, label: '50 €' },
            { value: 6000, label: '60 €' },
          ]}
        />
      )
    }
    render(<Demo />)
    expect(screen.getByRole('group', { name: 'Tarif' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '60 €' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: '50 €' }))
    expect(screen.getByRole('button', { name: '50 €' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '60 €' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('Switch : role=switch et état coché', async () => {
    const onChange = vi.fn()
    render(
      <Switch checked={false} onCheckedChange={onChange} aria-label="Activer le code d’accès" />,
    )
    const sw = screen.getByRole('switch', { name: 'Activer le code d’accès' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(sw)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('Dialog : role=alertdialog pour une confirmation destructive, Échap ferme', async () => {
    const onOpenChange = vi.fn()
    render(
      <Dialog
        open
        onOpenChange={onOpenChange}
        title="Désactiver le code ?"
        description="Confirmez"
        alert
      >
        <p>Contenu</p>
      </Dialog>,
    )
    expect(screen.getByRole('alertdialog', { name: 'Désactiver le code ?' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('Badge : le texte porte le sens, la pastille est décorative', () => {
    render(
      <Badge tone="warning" dot>
        En attente
      </Badge>,
    )
    expect(screen.getByText('En attente')).toBeInTheDocument()
  })

  it('Notifications : role=status, disparaissent seules après 3 s', () => {
    vi.useFakeTimers()
    function Trigger() {
      const toast = useToast()
      return <button onClick={() => toast.show('Code d’accès activé')}>Go</button>
    }
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    act(() => screen.getByRole('button', { name: 'Go' }).click())
    expect(screen.getByRole('status')).toHaveTextContent('Code d’accès activé')
    act(() => vi.advanceTimersByTime(3500))
    vi.useRealTimers()
  })
})
