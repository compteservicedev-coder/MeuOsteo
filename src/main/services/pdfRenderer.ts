import { randomUUID } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import type { PdfRenderer } from './invoices'

/**
 * Renders the invoice template in a hidden, script-less window, then `printToPDF` (or the
 * system print dialog). The HTML goes through a temporary file in userData, removed at once.
 */
export function createElectronPdfRenderer(tempDir: string): PdfRenderer {
  async function withPage<T>(html: string, run: (win: BrowserWindow) => Promise<T>): Promise<T> {
    mkdirSync(tempDir, { recursive: true })
    const file = join(tempDir, `${randomUUID()}.html`)
    writeFileSync(file, html, 'utf8')
    const win = new BrowserWindow({
      show: false,
      width: 794,
      height: 1123,
      webPreferences: {
        javascript: false,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    })
    try {
      await win.loadFile(file)
      return await run(win)
    } finally {
      win.destroy()
      rmSync(file, { force: true })
    }
  }

  return {
    render: (html) =>
      withPage(html, (win) =>
        win.webContents.printToPDF({
          pageSize: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
        }),
      ),
    print: (html) =>
      withPage(
        html,
        (win) =>
          new Promise<boolean>((resolve) =>
            win.webContents.print({ silent: false, printBackground: true }, (success) =>
              resolve(success),
            ),
          ),
      ),
  }
}
