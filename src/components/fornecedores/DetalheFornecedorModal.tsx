'use client'

import { useEffect, useState } from 'react'
import { X, Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Supplier } from '@/types/database'
import { SUPPLIER_TYPE_LABELS } from '@/types/database'
import { formatPhone, formatDocument, formatCurrency } from '@/lib/format'
import { getSupplierModalStats } from '@/app/actions/fornecedores'

interface Props {
  supplier: Supplier
  onClose:  () => void
}

interface Stats {
  avgQuality:         number | null
  evaluationCount:    number
  saldoContaCorrente: number
}

function Field({
  label,
  value,
  full = false,
}: {
  label: string
  value: React.ReactNode
  full?: boolean
}) {
  return (
    <div className={`space-y-0.5 ${full ? 'sm:col-span-2' : ''}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-brown">{label}</p>
      <div className="text-sm text-dark">{value}</div>
    </div>
  )
}

function SmallSpinner() {
  return (
    <div
      className="h-4 w-4 rounded-full border-2"
      style={{
        borderColor: '#F4E2B8',
        borderTopColor: '#C68B59',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  )
}

function StarDisplay({ score }: { score: number }) {
  const rounded = Math.round(score)
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`h-4 w-4 ${
              s <= rounded ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-100 text-gray-300'
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-gray-400">{score.toFixed(1).replace('.', ',')}</span>
    </div>
  )
}

export function DetalheFornecedorModal({ supplier, onClose }: Props) {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // Avaliação média e saldo buscados sob demanda ao abrir o modal
  useEffect(() => {
    let active = true
    getSupplierModalStats(supplier.id)
      .then((res) => {
        if (active && res.success) {
          setStats({
            avgQuality:         res.avgQuality ?? null,
            evaluationCount:    res.evaluationCount ?? 0,
            saldoContaCorrente: res.saldoContaCorrente ?? 0,
          })
        }
      })
      .finally(() => { if (active) setStatsLoading(false) })
    return () => { active = false }
  }, [supplier.id])

  const devedor = (stats?.saldoContaCorrente ?? 0) > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(59,36,24,0.4)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gold/20 px-6 py-4">
          <h2 className="text-lg font-bold text-dark">Detalhes do Fornecedor</h2>
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
            <Field label="Nome" value={supplier.name} />
            <Field label="Tipo" value={SUPPLIER_TYPE_LABELS[supplier.type] ?? supplier.type} />
            <Field label="CPF/CNPJ" value={formatDocument(supplier.document)} />
            <Field label="Telefone" value={supplier.phone ? formatPhone(supplier.phone) : '—'} />
            <Field label="E-mail" value={supplier.email ?? '—'} />
            <Field label="Chave PIX" value={supplier.pix_key ?? '—'} />
            <Field label="Endereço" value={supplier.address ?? '—'} full />
            <Field
              label="Avaliação média"
              value={
                statsLoading ? (
                  <SmallSpinner />
                ) : stats && stats.avgQuality !== null && stats.evaluationCount > 0 ? (
                  <StarDisplay score={stats.avgQuality} />
                ) : (
                  '—'
                )
              }
            />
            <Field
              label="Saldo conta corrente"
              value={
                statsLoading ? (
                  <SmallSpinner />
                ) : stats ? (
                  <span
                    className="font-semibold"
                    style={{ color: devedor ? '#8B3A3A' : '#4A7C59' }}
                  >
                    {formatCurrency(stats.saldoContaCorrente)}
                  </span>
                ) : (
                  '—'
                )
              }
            />
            <Field
              label="Observações"
              value={supplier.notes || 'Nenhuma observação.'}
              full
            />
          </div>

          {/* Ações */}
          <div className="flex items-center justify-end gap-3 border-t border-gold/20 pt-4">
            <button
              type="button"
              onClick={() => router.push(`/fornecedores/${supplier.id}`)}
              className="rounded-lg border bg-white px-5 py-2.5 text-sm font-medium text-brown transition-colors hover:bg-cream"
              style={{ borderColor: '#E6C07B' }}
            >
              Ver página completa
            </button>
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
