'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import type { BudgetStatus } from '@/types/database'
import { formatCurrency } from '@/lib/format'
import { createBudget, deleteBudget } from '@/app/actions/orcamentos'
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal'
import { toast } from 'sonner'
import { toastAfterClose } from '@/lib/ui-feedback'

// Uma linha por OBRA. O orçamento (único) vem embutido, ou null quando não existe.
export interface ObraRow {
  projectId:       string
  projectName:     string
  budgetId:        string | null
  status:          BudgetStatus | null
  totalDirectCost: number
  totalWithBdi:    number
  consumidoPct:    number | null   // % consumido (só p/ aprovado; null = rascunho/sem)
}

// Cor da barra de % consumido: até 85% verde; 85–100% terracota; acima de 100% vermelho
function consumoColor(pct: number): string {
  if (pct > 100) return '#8B3A3A'
  if (pct >= 85) return '#C68B59'
  return '#4A7C59'
}

interface Props {
  rows: ObraRow[]
}

// Filtro de status: inclui "sem orçamento"
type StatusFilter = 'all' | 'sem' | 'rascunho' | 'aprovado'

// Badge: Sem orçamento (cinza), Rascunho (dourado), Aprovado (verde)
function statusBadge(status: BudgetStatus | null): { label: string; className: string; style?: React.CSSProperties } {
  if (status === 'aprovado')
    return { label: 'Aprovado', className: '', style: { backgroundColor: 'rgba(74,124,89,0.15)', color: '#4A7C59' } }
  if (status === 'rascunho')
    return { label: 'Rascunho', className: '', style: { backgroundColor: 'rgba(230,192,123,0.30)', color: '#8A5A3B' } }
  return { label: 'Sem orçamento', className: 'bg-gray-100 text-gray-500' }
}

const inputCls =
  'rounded-lg border border-gold/50 bg-white px-3 py-1.5 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta'
const labelCls = 'text-xs font-semibold uppercase tracking-wide text-brown'

export function OrcamentosClient({ rows }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<StatusFilter>('all')
  const [busyProject, setBusyProject] = useState<string | null>(null)
  // Lista local para remoção otimista
  const [localRows, setLocalRows] = useState(rows)
  const [deleteTarget, setDeleteTarget] = useState<ObraRow | null>(null)

  // Sincroniza quando o servidor revalida
  useEffect(() => { setLocalRows(rows) }, [rows])

  const filtered = useMemo(
    () =>
      localRows.filter((r) => {
        if (status === 'all') return true
        if (status === 'sem') return r.status === null
        return r.status === status
      }),
    [localRows, status],
  )

  // Abre o orçamento da obra. Se já existe → vai direto ao editor.
  // Se não existe → cria (get-or-create no servidor) e abre. Nunca cria um segundo.
  function openBudget(row: ObraRow) {
    if (row.budgetId) {
      router.push(`/orcamentos/${row.budgetId}`)
      return
    }
    if (busyProject) return
    setBusyProject(row.projectId)
    createBudget(row.projectId)
      .then((res) => {
        if (!res.success || !res.id) throw new Error(res.error ?? 'Erro ao abrir orçamento')
        // alreadyExists: a obra já tinha orçamento — apenas redireciona para ele.
        if (res.alreadyExists) {
          toast.info('Esta obra já possui um orçamento. Você foi direcionado para editá-lo.')
        }
        router.push(`/orcamentos/${res.id}`)
      })
      .catch((err: Error) => {
        setBusyProject(null)
        toast.error(err.message || 'Erro ao abrir orçamento', {
          action: { label: 'Tentar novamente', onClick: () => openBudget(row) },
        })
      })
  }

  // Remoção otimista: vira "Sem orçamento" na hora; reverte se falhar.
  function performDelete(target: ObraRow) {
    setLocalRows((prev) =>
      prev.map((r) =>
        r.projectId === target.projectId
          ? { ...r, budgetId: null, status: null, totalDirectCost: 0, totalWithBdi: 0 }
          : r,
      ),
    )
    if (!target.budgetId) return
    deleteBudget(target.budgetId)
      .then((res) => { if (!res.success) throw new Error(res.error) })
      .catch((err: Error) => {
        setLocalRows((prev) => prev.map((r) => (r.projectId === target.projectId ? target : r)))
        toast.error(err.message || 'Erro ao excluir orçamento.', {
          action: { label: 'Tentar novamente', onClick: () => performDelete(target) },
        })
      })
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    toastAfterClose('Orçamento excluído')
    performDelete(target)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark">Orçamentos</h1>
          <p className="text-sm text-gray-400">Um orçamento por obra</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className={inputCls}>
            <option value="all">Todos</option>
            <option value="sem">Sem orçamento</option>
            <option value="rascunho">Rascunho</option>
            <option value="aprovado">Aprovado</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gold/40 py-16 text-center">
          <p className="text-sm font-medium text-gray-400">
            {localRows.length === 0
              ? 'Nenhuma obra cadastrada ainda.'
              : 'Nenhuma obra corresponde ao filtro.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gold/20 bg-cream/30">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Obra</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 hidden sm:table-cell">Custo Direto</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Preço c/ BDI</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 w-48">% Consumido</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">Status</th>
                  <th className="px-4 py-3 w-28" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/10">
                {filtered.map((r) => {
                  const badge = statusBadge(r.status)
                  const hasBudget = !!r.budgetId
                  return (
                    <tr
                      key={r.projectId}
                      onClick={() => openBudget(r)}
                      className="cursor-pointer hover:bg-cream/20 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-dark">{r.projectName}</td>
                      <td className="px-4 py-3 text-right text-gray-600 hidden sm:table-cell">
                        {hasBudget ? formatCurrency(r.totalDirectCost) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-dark">
                        {hasBudget ? formatCurrency(r.totalWithBdi) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {r.consumidoPct == null ? (
                          <span className="text-sm text-gray-400">—</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, Math.max(0, r.consumidoPct))}%`,
                                  backgroundColor: consumoColor(r.consumidoPct),
                                }}
                              />
                            </div>
                            <span className="w-14 text-right text-xs font-medium" style={{ color: consumoColor(r.consumidoPct) }}>
                              {r.consumidoPct.toFixed(1).replace('.', ',')}%
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                          style={badge.style}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => openBudget(r)}
                            disabled={busyProject === r.projectId}
                            className="text-xs text-terracotta hover:underline disabled:opacity-50"
                          >
                            {hasBudget ? 'Abrir' : busyProject === r.projectId ? 'Abrindo…' : 'Criar'}
                          </button>
                          {hasBudget && (
                            <button
                              onClick={() => setDeleteTarget(r)}
                              className="rounded p-1 transition-colors"
                              style={{ color: '#8A5A3B' }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#8B3A3A')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = '#8A5A3B')}
                              title="Excluir orçamento"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmação de exclusão (permanente) */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        title="Excluir orçamento"
        message="Esta ação remove o orçamento e todos os seus itens permanentemente. A obra volta a ficar sem orçamento. Não é possível desfazer."
      />
    </div>
  )
}
