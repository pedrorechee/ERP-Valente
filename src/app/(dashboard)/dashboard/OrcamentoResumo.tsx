'use client'

import Link from 'next/link'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/format'

export interface OrcamentoRow {
  budgetId:  string
  projectId: string
  name:      string
  orcado:    number
  realizado: number
  pct:       number
}

interface Props {
  rows: OrcamentoRow[]
}

// Gráficos carregados sob demanda, fora do bundle inicial
const OrcamentoCharts = dynamic(() => import('./OrcamentoCharts'), {
  ssr: false,
  loading: () => <ChartSpinner />,
})

function ChartSpinner() {
  return (
    <div className="flex h-[260px] items-center justify-center">
      <div
        className="h-8 w-8 rounded-full border-[3px]"
        style={{
          borderColor: '#F4E2B8',
          borderTopColor: '#C68B59',
          animation: 'spin 0.8s linear infinite',
        }}
      />
    </div>
  )
}

const VERDE = '#4A7C59'
const VERMELHO = '#8B3A3A'
const TERRACOTA = '#C68B59'

function fmtPct(v: number): string {
  return `${v.toFixed(1).replace('.', ',')}%`
}

// Cor da barra/situação conforme o % consumido
function barColor(pct: number): string {
  if (pct > 100) return VERMELHO
  if (pct >= 90) return TERRACOTA
  return VERDE
}

function situacao(row: OrcamentoRow): { text: string; color: string } {
  if (row.pct > 100) return { text: `Estourou ${formatCurrency(row.realizado - row.orcado)}`, color: VERMELHO }
  if (row.pct >= 90) return { text: 'No limite', color: TERRACOTA }
  return { text: 'Dentro do orçado', color: VERDE }
}

export function OrcamentoResumo({ rows }: Props) {
  const router = useRouter()
  const [view, setView] = useState<'grafico' | 'tabela'>('grafico')

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold text-dark">Acompanhamento Orçamentário</h3>

        {rows.length > 0 && (
          <div className="flex overflow-hidden rounded-lg border" style={{ borderColor: '#E6C07B' }}>
            {(['grafico', 'tabela'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setView(m)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={
                  view === m
                    ? { backgroundColor: '#C68B59', color: '#fff' }
                    : { backgroundColor: '#F9F7F4', color: '#8A5A3B' }
                }
              >
                {m === 'grafico' ? 'Gráfico' : 'Tabela'}
              </button>
            ))}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gold/40 bg-cream/10 py-12 text-center">
          <p className="text-sm text-gray-400">Nenhuma obra com orçamento aprovado ainda.</p>
        </div>
      ) : view === 'grafico' ? (
        <OrcamentoCharts rows={rows} />
      ) : (
        <>
          {/* Tabela por obra */}
          <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gold/20 bg-cream/30">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Obra</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 hidden sm:table-cell">Orçado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 hidden sm:table-cell">Realizado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 hidden sm:table-cell">Saldo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 w-48">% Consumido</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 hidden md:table-cell">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold/10">
                  {rows.map((r) => {
                    const sit = situacao(r)
                    const color = barColor(r.pct)
                    return (
                      <tr
                        key={r.budgetId}
                        className="cursor-pointer hover:bg-cream/20 transition-colors"
                        onClick={() => router.push(`/orcamentos/${r.budgetId}`)}
                        onMouseEnter={() => router.prefetch(`/orcamentos/${r.budgetId}`)}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <Link
                            href={`/orcamentos/${r.budgetId}`}
                            prefetch
                            className="font-medium text-dark hover:text-terracotta transition-colors"
                          >
                            {r.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 hidden sm:table-cell">{formatCurrency(r.orcado)}</td>
                        <td className="px-4 py-3 text-right text-gray-600 hidden sm:table-cell">{formatCurrency(r.realizado)}</td>
                        <td className="px-4 py-3 text-right text-sm font-medium hidden sm:table-cell" style={{ color: r.orcado - r.realizado >= 0 ? VERDE : VERMELHO }}>
                          {formatCurrency(r.orcado - r.realizado)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${Math.min(100, Math.max(0, r.pct))}%`, backgroundColor: color }}
                              />
                            </div>
                            <span className="w-14 text-right text-xs font-medium" style={{ color }}>
                              {fmtPct(r.pct)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs font-medium" style={{ color: sit.color }}>{sit.text}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
