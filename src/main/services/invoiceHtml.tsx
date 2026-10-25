import { renderToStaticMarkup } from 'react-dom/server'
import { InvoiceDocument } from '@shared/invoice/InvoiceDocument'
import type { InvoiceDocumentData } from '@shared/types/invoices'

/** Complete A4 page for `printToPDF` / printing. No script, no external resource. */
export function renderInvoiceHtml(data: InvoiceDocumentData): string {
  const body = renderToStaticMarkup(<InvoiceDocument data={data} />)
  const title = data.kind === 'avoir' ? `Avoir ${data.numero}` : `Note d’honoraires ${data.numero}`
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<title>${title}</title>
<style>
@page { size: A4; margin: 12mm; }
html, body { margin: 0; background: #FFFFFF; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style>
</head>
<body>${body}</body>
</html>`
}
