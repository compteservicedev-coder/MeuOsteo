import type { InvoiceBlocker } from '@shared/domain/invoice'
import type { SendError } from '@shared/types/invoices'

/** R-10: why « Générer la facture » is not possible. */
export const BLOCKER_MESSAGES: Record<InvoiceBlocker, string> = {
  not_done: 'Validez d’abord la séance comme réalisée',
  editing: 'Enregistrez d’abord la séance en cours de modification',
  free: 'Séance gratuite : aucune facture à émettre',
  already_invoiced: 'Cette séance a déjà une facture',
  address: 'Adresse du patient incomplète : elle est obligatoire sur la facture',
}

export function sendErrorMessage(error: SendError): string {
  switch (error) {
    case 'no_email':
      return 'pas d’e-mail dans la fiche patient'
    case 'not_configured':
      return 'Gmail n’est pas configuré (Paramètres > Messagerie Gmail)'
    case 'auth':
      return 'Gmail a refusé l’adresse ou le mot de passe d’application'
    case 'network':
      return 'Gmail est injoignable, vérifiez la connexion internet'
    case 'pdf':
      return 'le PDF n’a pas pu être généré'
    default:
      return 'Gmail a refusé l’envoi'
  }
}
