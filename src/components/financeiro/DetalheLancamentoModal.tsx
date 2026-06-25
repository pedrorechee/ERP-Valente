'use client'

import { useEffect, useState } from 'react'
import { X, ExternalLink, Copy, Check } from 'lucide-react'
import type { EntryType, FinancialEntryStatus, PaymentMethod, CostCategory } from '@/types/database'
import { PAYMENT_METHOD_LABELS, FINANCIAL_STATUS_LABELS } from '@/types/database'
import { formatCurrency, formatDate, formatFinanceNumber } from '@/lib/format'
import { getProofUrl } from '@/app/actions/financeiro'

type EntryWithProject = {
  id: string
  entry_number: number
  project_id: string
  entry_type: EntryType
  entry_date: string
  description: string
  amount: number
  category: string
  payment_method: PaymentMethod | null
  counterpart: string | null
  supplier_id: string | null
  storage_path_proof: string | null
  notes: string | null
  status: FinancialEntryStatus
  payment_date: string | null
  scheduled_date: string | null
  due_date: string | null
  paid_by: string | null
  nf_number: string | null
  category_id: string | null
  projects?: { id: string; name: string } | null
  suppliers?: { id: string; name: string } | null
}

interface Props {
  entry:      EntryWithProject
  categories: CostCategory[]
  onClose:    () => void
}

function Field({
  label,
  value,
  valueStyle,
}: {
  label: string
  value: string
  valueStyle?: React.CSSProperties
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-brown">{label}</p>
      <p className="text-sm text-dark" style={valueStyle}>{value}</p>
    </div>
  )
}

const IMAGE_EXT = /\.(jpe?g|png)$/i

export function DetalheLancamentoModal({ entry, categories, onClose }: Props) {
  const conta = entry.category_id ? categories.find((c) => c.id === entry.category_id) : null
  const categoriaLabel = conta ? `${conta.code} — ${conta.name}` : entry.category
  const [proofUrl, setProofUrl] = useState<string | null>(null)
  const [proofLoading, setProofLoading] = useState(!!entry.storage_path_proof)
  const [copied, setCopied] = useState(false)

  function copyNumber() {
    navigator.clipboard
      ?.writeText(formatFinanceNumber(entry.entry_number))
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {})
  }

  useEffect(() => {
    if (!entry.storage_path_proof) return
    let active = true
    getProofUrl(entry.storage_path_proof)
      .then((res) => {
        if (active && res.success && res.url) setProofUrl(res.url)
      })
      .finally(() => { if (active) setProofLoading(false) })
    return () => { active = false }
  }, [entry.storage_path_proof])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(59,36,24,0.4)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gold/20 px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold text-dark">Detalhes do Lançamento</h2>
            <button
              type="button"
              onClick={copyNumber}
              title="Copiar número"
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-sm font-semibold transition-colors"
              style={{ backgroundColor: '#C68B59', color: '#fff' }}
            >
              {formatFinanceNumber(entry.entry_number)}
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5 opacity-80" />}
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-cream hover:text-dark transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Obra"  value={entry.projects?.name ?? '—'} />
            <Field label="Tipo"  value={entry.entry_type === 'income' ? 'Entrada' : 'Saída'} />
            <Field label="Data de Emissão" value={formatDate(entry.entry_date)} />
            <Field label="Valor" value={formatCurrency(entry.amount)} />
            <Field label="Categoria" value={categoriaLabel} />
            <Field
              label="Forma de Pagamento"
              value={entry.payment_method ? PAYMENT_METHOD_LABELS[entry.payment_method] : '—'}
            />
            <Field
              label="Cliente / Fornecedor"
              value={
                entry.entry_type === 'expense'
                  ? (entry.suppliers?.name ?? entry.counterpart ?? '—')
                  : (entry.counterpart ?? '—')
              }
            />
            <Field label="Pago por" value={entry.paid_by ?? '—'} />
            <Field label="Nº NF" value={entry.nf_number ?? '—'} />
            <Field
              label="Status"
              value={FINANCIAL_STATUS_LABELS[entry.status] ?? entry.status}
            />
          </div>

          {/* As quatro datas, sempre visíveis ("—" quando vazias) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(() => {
              const vencido =
                entry.status === 'pendente' &&
                !!entry.due_date &&
                entry.due_date < new Date().toISOString().split('T')[0]
              return (
                <Field
                  label="Data de Vencimento"
                  value={
                    entry.due_date
                      ? `${formatDate(entry.due_date)}${vencido ? ' — Vencido' : ''}`
                      : '—'
                  }
                  valueStyle={vencido ? { color: '#8B3A3A' } : undefined}
                />
              )
            })()}
            <Field
              label="Data do Pagamento"
              value={entry.payment_date ? formatDate(entry.payment_date) : '—'}
            />
            <Field
              label="Data do Agendamento"
              value={entry.scheduled_date ? formatDate(entry.scheduled_date) : '—'}
            />
          </div>

          {entry.notes && (
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-brown">Observações</p>
              <p className="text-sm text-dark whitespace-pre-wrap">{entry.notes}</p>
            </div>
          )}

          {/* Comprovante */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-brown">Comprovante</p>
            {!entry.storage_path_proof ? (
              <p className="text-sm text-gray-400">Nenhum comprovante anexado.</p>
            ) : proofLoading ? (
              <p className="text-sm text-gray-400">Carregando comprovante…</p>
            ) : proofUrl ? (
              <div className="space-y-2">
                <a
                  href={proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-fit items-center gap-1.5 text-sm text-terracotta hover:text-brown transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir comprovante
                </a>
                {IMAGE_EXT.test(entry.storage_path_proof) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={proofUrl}
                    alt="Comprovante"
                    className="max-h-64 rounded-lg border border-gold/30 object-contain"
                  />
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Não foi possível carregar o comprovante.</p>
            )}
          </div>

          {/* Ações */}
          <div className="flex items-center justify-end border-t border-gold/20 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gold/50 px-5 py-2.5 text-sm font-medium text-dark hover:bg-cream transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
