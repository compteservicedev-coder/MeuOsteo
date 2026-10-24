/**
 * Note d'honoraires (DATA_MODEL.md §factures, mandatory mentions). One template for the PDF
 * (rendered to static HTML in main, then `printToPDF`) and for the on-screen previews, so what
 * the practitioner sees is what the patient receives. Inline styles only: no Tailwind in the PDF.
 */
import type { CSSProperties } from 'react'
import { formatIsoDateFr } from '../domain/dates'
import { formatEuros } from '../domain/invoice'
import type { InvoiceDocumentData } from '../types/invoices'

const INK = '#141B2D'
const SOFT = '#3A4560'
const MUTED = '#586380'
const ROYAL = '#1F4FD8'

const p = (extra: CSSProperties = {}): CSSProperties => ({ margin: 0, ...extra })

const placeholder = (value: string, label: string) => value.trim() || `[${label}]`

export function InvoiceDocument({
  data,
  stamp,
}: {
  data: InvoiceDocumentData
  /** « ÉMISE » / « SUPPRIMÉE » stamp of the previews (never printed). */
  stamp?: string | null
}) {
  const { cabinet } = data
  const isAvoir = data.kind === 'avoir'
  const numero = data.provisional ? `N° ${data.numero} (provisoire)` : `N° ${data.numero}`
  const grid: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 2.4fr 1fr',
    gap: 10,
  }
  return (
    <article
      aria-label={isAvoir ? 'Avoir' : 'Aperçu de la note d’honoraires'}
      style={{
        position: 'relative',
        boxSizing: 'border-box',
        background: '#FFFFFF',
        color: INK,
        fontFamily: "Figtree, 'Segoe UI', Arial, sans-serif",
        fontSize: 13,
        lineHeight: 1.5,
        padding: '34px 36px',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        overflow: 'hidden',
        minHeight: '100%',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          height: 6,
          background: 'linear-gradient(90deg, #22C3D6, #3B6CF6, #1F4FD8)',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <p style={p({ fontSize: 15, fontWeight: 800 })}>
            {placeholder(cabinet.nom, 'Prénom NOM')}
          </p>
          <p style={p({ color: SOFT })}>{cabinet.titre}</p>
          <p style={p({ marginTop: 6, color: SOFT })}>
            {placeholder(cabinet.adresse, 'Adresse du cabinet')}
            {cabinet.telephone.trim() && (
              <>
                <br />
                Tél. {cabinet.telephone}
              </>
            )}
            <br />
            N° ADELI : {cabinet.adeli.trim() || '[—]'} · SIRET : {cabinet.siret.trim() || '[—]'}
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap' }}>
          <p style={p({ fontSize: 17, fontWeight: 800, color: ROYAL })}>
            {isAvoir ? 'Avoir' : 'Note d’honoraires'}
          </p>
          <p style={p({ marginTop: 2, fontWeight: 700 })}>{numero}</p>
          <p style={p({ marginTop: 2, color: SOFT })}>
            Émis{isAvoir ? '' : 'e'} le {formatIsoDateFr(data.dateEmission)}
          </p>
        </div>
      </div>

      <div style={{ background: '#F3F7FC', borderRadius: 8, padding: '12px 16px' }}>
        <p
          style={p({
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: MUTED,
          })}
        >
          Patient
        </p>
        <p style={p({ marginTop: 2, fontWeight: 700 })}>{data.patientNom}</p>
        <p style={p({ color: SOFT })}>{data.patientAdresse}</p>
      </div>

      <div>
        <div
          style={{
            ...grid,
            padding: '8px 0',
            borderBottom: `2px solid ${INK}`,
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          <span>Date</span>
          <span>Désignation</span>
          <span style={{ textAlign: 'right' }}>Montant</span>
        </div>
        <div style={{ ...grid, padding: '10px 0', borderBottom: '1px solid #E1E6EF' }}>
          <span>{formatIsoDateFr(data.dateSeance)}</span>
          <span>{data.libelle}</span>
          <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {formatEuros(data.montantCents)}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 40,
            padding: '12px 0 0',
            fontSize: 15,
            fontWeight: 800,
          }}
        >
          <span>Total</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatEuros(data.montantCents)}
          </span>
        </div>
      </div>

      {data.reference && <p style={p({ color: SOFT, fontWeight: 600 })}>{data.reference}</p>}
      {data.reglementMention && <p style={p({ color: SOFT })}>{data.reglementMention}</p>}
      <p style={p({ fontSize: 12, color: MUTED })}>{cabinet.mentionTva}</p>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ textAlign: 'center', minWidth: 180 }}>
          <p style={p({ fontSize: 12, color: MUTED })}>Signature</p>
          {data.signature ? (
            <img
              src={data.signature}
              alt="Signature du praticien"
              style={{ maxWidth: 200, maxHeight: 90, objectFit: 'contain', marginTop: 4 }}
            />
          ) : (
            <div style={{ height: 60 }} />
          )}
        </div>
      </div>

      {stamp && (
        <div
          aria-hidden="true"
          className="stamp"
          style={{
            position: 'absolute',
            right: 34,
            top: 120,
            padding: '8px 16px',
            border: `3px solid ${stamp === 'SUPPRIMÉE' ? '#C2272D' : ROYAL}`,
            borderRadius: 10,
            color: stamp === 'SUPPRIMÉE' ? '#C2272D' : ROYAL,
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: '0.08em',
            background: 'rgba(255,255,255,0.85)',
            transform: 'rotate(-8deg)',
          }}
        >
          {stamp}
        </div>
      )}
    </article>
  )
}
