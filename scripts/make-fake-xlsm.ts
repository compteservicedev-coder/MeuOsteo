/**
 * `npm run make:fake-xlsm -- [fichier] [--patients 299] [--seances 512]`: writes a fake
 * MeuOsteo v1.04 workbook to try the import (Paramètres > Données & import). Never committed:
 * `*.xlsm` is in .gitignore.
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildFakeLegacyWorkbook } from './fakeLegacyWorkbook'

function option(args: string[], name: string, fallback: number): number {
  const index = args.indexOf(`--${name}`)
  const value = index >= 0 ? Number(args[index + 1]) : fallback
  if (!Number.isInteger(value) || value <= 0) throw new Error(`--${name} attend un nombre entier`)
  return value
}

async function main(args: string[]): Promise<void> {
  const file = resolve(
    args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) ??
      'MeuOsteo_fictif.xlsm',
  )
  const patients = option(args, 'patients', 299)
  const seances = option(args, 'seances', 512)
  writeFileSync(file, await buildFakeLegacyWorkbook({ patients, seances }))
  process.stdout.write(
    `Classeur fictif écrit : ${file} (${patients} patients, ${seances} séances)\n`,
  )
}

main(process.argv.slice(2)).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
