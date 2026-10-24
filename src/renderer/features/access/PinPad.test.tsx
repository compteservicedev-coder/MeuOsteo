import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PinPad } from './PinPad'

describe('pavé de code (Splash.dc.html)', () => {
  it('R-21 affiche un point par chiffre et valide dès que la longueur est atteinte', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true })
    render(<PinPad title="Bonjour, entrez votre code" length={4} onSubmit={onSubmit} />)
    for (const d of '258')
      await userEvent.click(screen.getByRole('button', { name: `Chiffre ${d}` }))
    expect(screen.getByRole('status')).toHaveAccessibleName('3 chiffre(s) saisi(s) sur 4')
    await userEvent.keyboard('0')
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('2580'))
  })

  it('R-21 en cas d’erreur, la saisie s’efface et le message s’affiche', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: false, message: 'Code incorrect, réessayez' })
    render(<PinPad title="Code" length={4} onSubmit={onSubmit} />)
    await userEvent.keyboard('1111')
    expect(await screen.findByRole('alert')).toHaveTextContent('Code incorrect, réessayez')
    expect(screen.getByRole('status')).toHaveAccessibleName('0 chiffre(s) saisi(s) sur 4')
  })

  it('R-21 création : 4 à 6 chiffres, validés avec la touche ✓', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true })
    render(<PinPad title="Choisissez votre code d’accès" length={null} onSubmit={onSubmit} />)
    const ok = screen.getByRole('button', { name: 'Valider' })
    await userEvent.keyboard('123')
    expect(ok).toBeDisabled()
    await userEvent.keyboard('4567')
    expect(screen.getByRole('status')).toHaveAccessibleName('6 chiffre(s) saisi(s) sur 4 à 6')
    await userEvent.click(ok)
    expect(onSubmit).toHaveBeenCalledWith('123456')
  })

  it('R-21 après 5 erreurs, le pavé est bloqué pendant l’attente', () => {
    render(<PinPad title="Code" length={4} onSubmit={vi.fn()} lockedUntil={Date.now() + 30_000} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Trop d’essais. Réessayez dans 30 s')
    expect(screen.getByRole('button', { name: 'Chiffre 1' })).toBeDisabled()
  })
})
