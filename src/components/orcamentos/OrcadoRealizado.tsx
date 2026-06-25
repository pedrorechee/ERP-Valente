'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { FileText } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { pctConsumido } from '@/lib/orcamento'

export interface OrcadoRealizadoRow {
  id:        string
  name:      string
  orcado:    number
  realizado: number
}

interface Props {
  rows: OrcadoRealizadoRow[]
  /** Texto quando não há nada a comparar (ex.: sem orçamento aprovado) */
  emptyMessage?: string
  budgetId?: string | null
  budgetIsDraft?: boolean
}

const VERDE = '#4A7C59'
const VERMELHO = '#8B3A3A'

export function OrcadoRealizado({ rows, emptyMessage, budgetId = undefined, budgetIsDraft }: Props) {
  const totals = useMemo(() => {
    const orcado = rows.reduce((s, r) => s + r.orcado, 0)
    const realizado = rows.reduce((s, r) => s + r.realizado, 0)
    return { orcado, realizado, saldo: orcado - realizado }
  }, [rows])

  const hasData = rows.some((r) => r.orcado > 0 || r.realizado > 0)

  // Renders only when the prop is explicitly provided (not in OrcamentoBuilder context)
  const showBudgetNav = budgetId !== undefined
  const budgetButton = showBudgetNav ? (
    budgetId ? (
      <div className="flex items-center gap-3">
        {budgetIsDraft && (
          <span className="text-xs text-gray-400">
            Orçamento em rascunho — finalize para comparar com o realizado
          </span>
        )}
        <Link
          href={`/orcamentos/${budgetId}`}
          prefetch
          className="flex items-center gap-2 rounded-lg border border-gold bg-white px-3 py-1.5 text-sm font-medium text-brown hover:bg-cream transition-colors"
        >
          <FileText className="h-4 w-4" />
          Ver orçamento completo
        </Link>
      </div>
    ) : (
      <button
        disabled
        title="Esta obra não possui orçamento cadastrado"
        className="flex items-center gap-2 rounded-lg border border-gold/30 bg-white px-3 py-1.5 text-sm font-medium text-brown/40 cursor-not-allowed opacity-50"
      >
        <FileText className="h-4 w-4" />
        Ver orçamento completo
      </button>
    )
  ) : null

  if (!hasData) {
    return (
      <div className="space-y-3">
        {showBudgetNav && <div className="flex justify-end">{budgetButton}</div>}
        <div className="rounded-xl border border-dashed border-gold/40 py-14 text-center">
          <p className="text-sm text-gray-400">
            {emptyMessage ?? 'Sem dados para comparar ainda.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {showBudgetNav && <div className="flex justify-end">{budgetButton}</div>}
      <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gold/20 bg-cream/30">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Etapa</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Orçado</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Realizado</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Saldo</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 w-48">% Consumido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gold/10">
            {rows.map((r) => {
              const saldo = r.orcado - r.realizado
              const pct = pctConsumido(r.orcado, r.realizado)
              const estourou = saldo < 0
              return (
                <tr key={r.id} className="hover:bg-cream/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-dark">{r.name}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(r.orcado)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(r.realizado)}</td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: estourou ? VERMELHO : VERDE }}>
                    {formatCurrency(saldo)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.max(0, pct))}%`,
                            backgroundColor: estourou ? VERMELHO : VERDE,
                          }}
                        />
                      </div>
                      <span
                        className="w-12 text-right text-xs font-medium"
                        style={{ color: estourou ? VERMELHO : '#6b7280' }}
                      >
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-gold/30 bg-cream/20">
              <td className="px-4 py-3 font-semibold text-dark">Total</td>
              <td className="px-4 py-3 text-right font-semibold text-dark">{formatCurrency(totals.orcado)}</td>
              <td className="px-4 py-3 text-right font-semibold text-dark">{formatCurrency(totals.realizado)}</td>
              <td className="px-4 py-3 text-right font-bold" style={{ color: totals.saldo < 0 ? VERMELHO : VERDE }}>
                {formatCurrency(totals.saldo)}
              </td>
              <td className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                {pctConsumido(totals.orcado, totals.realizado).toFixed(0)}% consumido
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
    </div>
  )
}
