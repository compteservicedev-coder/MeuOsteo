import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { TRAP_EXPECTATIONS, buildFakeLegacyWorkbook } from '../../../scripts/fakeLegacyWorkbook'
import { LegacyWorkbookError, readLegacyWorkbook, unwrapCell } from './legacyWorkbook'

describe('lecture du classeur MeuOsteo v1.04 (exceljs)', () => {
  it('le classeur fictif est un vrai .xlsm (classeur prenant en charge les macros)', async () => {
    const zip = await JSZip.loadAsync(await buildFakeLegacyWorkbook({ patients: 10, seances: 12 }))
    const types = await zip.file('[Content_Types].xml')!.async('string')
    expect(types).toContain('application/vnd.ms-excel.sheet.macroEnabled.main+xml')
  })

  it('lit Tb_patient et Tb_seance par leur nom, sans plage fixe', async () => {
    const { patients, seances } = await readLegacyWorkbook(
      await buildFakeLegacyWorkbook({ patients: 25, seances: 40 }),
    )
    expect(patients.columns.slice(0, 4)).toEqual(['id_patient', 'nom', 'prenom', 'ddn'])
    expect(patients.rows).toHaveLength(25)
    expect(seances.columns).toEqual([
      'date',
      'motif',
      'anam',
      'pratique',
      'prix',
      'paiement',
      'praticien',
      'id_patient',
    ])
    expect(seances.rows).toHaveLength(40)
    // Data starts under the header row (row 2 of TEMP_BDD).
    expect(patients.rows[0]!.line).toBe(3)
    expect(seances.rows[TRAP_EXPECTATIONS.seanceRows - 1]!.cells['id_patient']).toBe(
      'FantômeJean01/01/1950',
    )

    const anne = patients.rows[0]!.cells
    expect(anne['nom']).toBe('D’Almeida')
    expect(anne['cdp']).toBe(1000)
    expect(anne['portable']).toBe(612345678)
    expect(anne['mail']).toBe('Anne-Lise.DAlmeida@Exemple.FR')
    const eloise = patients.rows[3]!.cells
    expect(eloise['ddn']).toEqual(new Date(Date.UTC(1990, 10, 2)))
  })

  it('retrouve les tableaux par leurs en-têtes si exceljs ne les voit pas comme tableaux', async () => {
    const workbook = new ExcelJS.Workbook()
    const ws = workbook.addWorksheet('TEMP_BDD')
    ws.getRow(2).values = [null, 'date', 'id_patient', null, 'id_patient', 'nom', 'prenom', 'ddn']
    ws.getRow(3).values = [null, '01/02/2024', 'k1', null, 'k1', 'Martin', 'Paul', '15/09/1979']
    ws.getRow(4).values = [null, '02/02/2024', 'k1']
    const tables = await readLegacyWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()))
    expect(tables.patients.rows.map((r) => r.cells['nom'])).toEqual(['Martin'])
    expect(tables.seances.rows.map((r) => r.cells['date'])).toEqual(['01/02/2024', '02/02/2024'])
  })

  it('signale un fichier illisible ou sans les tableaux attendus', async () => {
    await expect(readLegacyWorkbook(Buffer.from('pas un classeur'))).rejects.toMatchObject({
      reason: 'unreadable',
    })
    const workbook = new ExcelJS.Workbook()
    workbook.addWorksheet('Feuil1').addRow(['autre chose'])
    const error = await readLegacyWorkbook(Buffer.from(await workbook.xlsx.writeBuffer())).catch(
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(LegacyWorkbookError)
    expect(error).toMatchObject({ reason: 'tables_missing', missing: ['Tb_patient', 'Tb_seance'] })
  })

  it('déballe les valeurs de cellule exceljs', () => {
    expect(unwrapCell({ formula: 'A1&B1', result: 'DupontMarie' })).toBe('DupontMarie')
    expect(unwrapCell({ richText: [{ text: 'Du' }, { text: 'pont' }] })).toBe('Dupont')
    expect(unwrapCell({ text: 'a@exemple.fr', hyperlink: 'mailto:a@exemple.fr' })).toBe(
      'a@exemple.fr',
    )
    expect(unwrapCell({ error: '#N/A' })).toBeNull()
    expect(unwrapCell(undefined)).toBeNull()
  })
})
