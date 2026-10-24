/** Lower-cases and strips accents, so that « infirmiere » finds « Infirmière ». */
export function foldForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
}

/** Search key stored on each patient (`patients.search_key`): folded « nom prénom ». */
export function patientSearchKey(nom: string, prenom: string): string {
  return foldForSearch(`${nom} ${prenom}`)
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/** Initials for avatars: « Camille Roux » → « CR ». */
export function initials(...names: string[]): string {
  return names
    .flatMap((n) => n.split(/[\s-]+/))
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}
