'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import type { FinancialEntry } from '@/types/database'
import { PAYMENT_METHOD_LABELS } from '@/types/database'
import { formatCurrency, formatDate, formatFinanceNumber } from '@/lib/format'

type EntryWithJoins = FinancialEntry & {
  projects?:  { id: string; name: string } | null
  suppliers?: { id: string; name: string } | null
}

interface SupplierSummary {
  id:              string
  name:            string
  totalContratado: number
  totalPago:       number
  saldoDevedor:    number
  lastDate:        string
}

interface Props {
  /** Todos os lançamentos já carregados no Financeiro (fonte única) */
  entries:  EntryWithJoins[]
  projects: { id: string; name: string }[]
}

const STATUS_BADGE: Record<string, string> = {
  pago:     'bg-green-100 text-green-700',
  pendente: 'bg-yellow-100 text-yellow-700',
  agendado: 'bg-blue-100 text-blue-700',
}
const STATUS_LABEL: Record<string, string> = {
  pago:     'Pago',
  pendente: 'Pendente',
  agendado: 'Agendado',
}

// Totais de uma lista de lançamentos controlados (saídas e entradas/estornos)
function computeTotals(rows: EntryWithJoins[]) {
  let totalContratado = 0 // todas as saídas controladas (qualquer status)
  let totalPago       = 0 // saídas controladas pagas
  let devedorSaidas   = 0 // saídas controladas pendentes/agendadas
  let estornos        = 0 // entradas controladas (abatem o saldo)
  for (const e of rows) {
    if (e.entry_type === 'expense') {
      totalContratado += e.amount
      if (e.status === 'pago') totalPago += e.amount
      else devedorSaidas += e.amount
    } else {
      estornos += e.amount
    }
  }
  return { totalContratado, totalPago, saldoDevedor: devedorSaidas - estornos }
}

export function ContaCorrenteTab({ entries, projects }: Props) {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null)
  const [obraFilter, setObraFilter] = useState<string>('all')

  // Apenas lançamentos marcados para a conta corrente e com fornecedor vinculado
  const controlled = useMemo(
    () => entries.filter(e => e.in_supplier_account && e.supplier_id),
    [entries],
  )

  // ── Resumo por fornecedor ─────────────────────────────────
  const supplierSummaries = useMemo(() => {
    const groups: Record<string, EntryWithJoins[]> = {}
    const names:  Record<string, string> = {}
    for (const e of controlled) {
      const sid = e.supplier_id as string
      ;(groups[sid] ??= []).push(e)
      if (!names[sid]) names[sid] = e.suppliers?.name ?? 'Fornecedor'
      if (e.suppliers?.name) names[sid] = e.suppliers.name
    }
    return Object.entries(groups)
      .map<SupplierSummary>(([id, rows]) => {
        const t = computeTotals(rows)
        const lastDate = rows.reduce((max, e) => (e.entry_date > max ? e.entry_date : max), '')
        return { id, name: names[id], ...t, lastDate }
      })
      // Maior saldo devedor primeiro (quem você mais deve)
      .sort((a, b) => b.saldoDevedor - a.saldoDevedor)
  }, [controlled])

  const selectedName = useMemo(
    () => supplierSummaries.find(s => s.id === selectedSupplierId)?.name,
    [supplierSummaries, selectedSupplierId],
  )

  // Lançamentos do fornecedor aberto (com filtro de obra aplicado)
  const extratoRows = useMemo(() => {
    return controlled
      .filter(e => e.supplier_id === selectedSupplierId)
      .filter(e => obraFilter === 'all' || e.project_id === obraFilter)
      .sort((a, b) => {
        const d = b.entry_date.localeCompare(a.entry_date)
        return d !== 0 ? d : b.created_at.localeCompare(a.created_at)
      })
  }, [controlled, selectedSupplierId, obraFilter])

  const extTotals = useMemo(() => computeTotals(extratoRows), [extratoRows])

  // Obras presentes nos lançamentos controlados do fornecedor aberto
  const obraOptions = useMemo(() => {
    if (!selectedSupplierId) return []
    const map = new Map<string, string>()
    for (const e of controlled) {
      if (e.supplier_id !== selectedSupplierId) continue
      const name = e.projects?.name ?? projects.find(p => p.id === e.project_id)?.name ?? '—'
      map.set(e.project_id, name)
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }))
  }, [controlled, selectedSupplierId, projects])

  function openSupplier(id: string) {
    setSelectedSupplierId(id)
    setObraFilter('all')
  }

  return (
    <div className="space-y-5">

      {/* ══ LISTA DE FORNECEDORES ══════════════════════════════ */}
      {!selectedSupplierId && (
        <>
          <div>
            <h2 className="text-base font-semibold text-dark">
              Contas de Fornecedores <span className="font-normal text-gray-400">(conta corrente)</span>
            </h2>
            <p className="text-sm text-gray-500">
              Visualização derivada dos lançamentos marcados para a conta corrente. O saldo devedor é quanto você ainda deve.
            </p>
          </div>

          {supplierSummaries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gold/40 py-14 text-center">
              <p className="text-sm text-gray-400">
                Nenhum lançamento controlado na conta corrente ainda.
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Ao lançar uma saída com fornecedor em <span className="font-medium text-brown">Lançamentos</span>, ative
                “Controlar na conta corrente do fornecedor”.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gold/20 bg-cream/30">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Fornecedor</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 hidden sm:table-cell">Total Contratado</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 hidden sm:table-cell">Total Pago</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Saldo Devedor</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-400 hidden md:table-cell">Última Mov.</th>
                      <th className="px-4 py-3 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gold/10">
                    {supplierSummaries.map(s => (
                      <tr
                        key={s.id}
                        onClick={() => openSupplier(s.id)}
                        className="cursor-pointer hover:bg-cream/20 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-dark">{s.name}</td>
                        <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">
                          {formatCurrency(s.totalContratado)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">
                          {formatCurrency(s.totalPago)}
                        </td>
                        <td
                          className="px-4 py-3 text-right font-semibold"
                          style={{ color: s.saldoDevedor > 0 ? '#8B3A3A' : '#4A7C59' }}
                        >
                          {s.saldoDevedor > 0 ? formatCurrency(s.saldoDevedor) : 'Quitado'}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-gray-400 hidden md:table-cell">
                          {s.lastDate ? formatDate(s.lastDate) : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          <ChevronRight className="h-4 w-4" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ EXTRATO DO FORNECEDOR (somente leitura) ════════════ */}
      {selectedSupplierId && (
        <>
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedSupplierId(null)}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-dark transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>
              <span className="text-gray-200">|</span>
              <span className="font-semibold text-dark">{selectedName}</span>
            </div>

            {/* Filtro por obra */}
            {obraOptions.length > 1 && (
              <select
                value={obraFilter}
                onChange={e => setObraFilter(e.target.value)}
                className="rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              >
                <option value="all">Todas as obras</option>
                {obraOptions.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Cards de resumo */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-500">Total em Notas</p>
              <p className="mt-1 text-xl font-bold text-dark">{formatCurrency(extTotals.totalContratado)}</p>
            </div>
            <div className="rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-500">Total Pago</p>
              <p className="mt-1 text-xl font-bold text-dark">{formatCurrency(extTotals.totalPago)}</p>
            </div>
            <div className="rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-500">Saldo Devedor</p>
              <p className="mt-1 text-xl font-bold" style={{ color: extTotals.saldoDevedor > 0 ? '#8B3A3A' : '#4A7C59' }}>
                {extTotals.saldoDevedor > 0 ? formatCurrency(extTotals.saldoDevedor) : 'Quitado'}
              </p>
            </div>
          </div>

          {/* Lista de lançamentos controlados */}
          {extratoRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gold/40 py-14 text-center">
              <p className="text-sm text-gray-400">Nenhum lançamento para este fornecedor.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gold/20 bg-cream/30">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Nº</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Data</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Descrição</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 hidden md:table-cell">Obra</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Valor</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 hidden lg:table-cell">Forma</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gold/10">
                    {extratoRows.map(row => (
                      <tr key={row.id} className="hover:bg-cream/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: '#8A5A3B' }}>
                          {formatFinanceNumber(row.entry_number)}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          {formatDate(row.entry_date)}
                        </td>
                        <td className="px-4 py-3 font-medium text-dark">{row.description}</td>
                        <td className="px-4 py-3 text-xs text-gray-400 hidden md:table-cell">
                          {row.projects?.name ?? '—'}
                        </td>
                        <td
                          className="px-4 py-3 text-right font-semibold whitespace-nowrap"
                          style={{ color: row.entry_type === 'income' ? '#4A7C59' : '#8A5A3B' }}
                        >
                          {row.entry_type === 'income' ? '− ' : ''}{formatCurrency(row.amount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              STATUS_BADGE[row.status] ?? 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {STATUS_LABEL[row.status] ?? row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell">
                          {row.payment_method ? PAYMENT_METHOD_LABELS[row.payment_method] : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
