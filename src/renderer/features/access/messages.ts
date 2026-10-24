import type { AttemptFailure } from '@shared/types/security'

export function describeAttemptFailure(
  failure: AttemptFailure,
  wrongLabel = 'Code incorrect',
): string {
  if (failure.reason === 'locked_out') {
    return `Trop d’essais. Réessayez dans ${Math.ceil(failure.retryInMs / 1000)} s`
  }
  const left = failure.attemptsLeft
  return left <= 2
    ? `${wrongLabel}, réessayez · encore ${left} essai${left > 1 ? 's' : ''} avant une attente de 30 s`
    : `${wrongLabel}, réessayez`
}
