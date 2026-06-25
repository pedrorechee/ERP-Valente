'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, X, Trash2 } from 'lucide-react'
import type { ContractStatus } from '@/types/database'
import { CONTRACT_STATUS_LABELS } from '@/types/database'
import { formatCurrency } from '@/lib/format'
import { createContract, deleteContract } from '@/app/actions/contratos'
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal'
import { toast } from 'sonner'
import { toastAfterClose } from '@/lib/ui-feedback'
import type { ContractRow } from '@/app/(dashboard)/contratos/page'

interface Props {
  contracts: ContractRow[]
  projects:  { id: string; name: string }[]
}

// Badge de status: ativo verde, concluído cinza, suspenso dourado, cancelado vermelho
function statusStyle(status: ContractStatus): { className: string; style?: React.CSSProperties } {
  if (status === 'ativo') return { className: 'bg-green-100 text-green-700' }
  if (status === 'suspenso')
    return { className: '', style: { backgroundColor: 'rgba(230,192,123,0.30)', color: '#8A5A3B' } }
  if (status === 'cancelado')
    return { className: '', style: { backgroundColor: 'rgba(139,58,58,0.12)', color: '#8B3A3A' } }
  return { className: 'bg-gray-100 text-gray-600' } // concluído
}

// Aditivo: + verde, − vermelho, 0 neutro
function amendmentDisplay(value: number): { text: string; color: string } {
  if (value > 0) return { text: `+ ${formatCurrency(value)}`, color: '#4A7C59' }
  if (value < 0) return { text: `− ${formatCurrency(Math.abs(value))}`, color: '#8B3A3A' }
  return { text: '—', color: '#9ca3af' }
}

const inputCls =
  'rounded-lg border border-gold/50 bg-white px-3 py-1.5 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta'
const labelCls = 'text-xs font-semibold uppercase tracking-wide text-brown'

export function ContratosClient({ contracts, projects }: Props) {
  const router = useRouter()
  const [obra, setObra]     = useState('all')
  const [status, setStatus] = useState('all')
  // Lista local para remoção otimista
  const [localContracts, setLocalContracts] = useState(contracts)
  const [deleteTarget, setDeleteTarget] = useState<ContractRow | null>(null)

  // Sincroniza quando o servidor revalida
  useEffect(() => { setLocalContracts(contracts) }, [contracts])

  // Modal "Novo Contrato"
  const [novoOpen, setNovoOpen] = useState(false)
  const [novoObra, setNovoObra] = useState('')
  const [creating, setCreating] = useState(false)
  const [novoErr, setNovoErr]   = useState<string | null>(null)

  // Obras que ainda NÃO têm contrato (uma obra = um contrato)
  const obrasComContrato = useMemo(
    () => new Set(contracts.map((c) => c.project_id)),
    [contracts],
  )
  const obrasDisponiveis = useMemo(
    () => projects.filter((p) => !obrasComContrato.has(p.id)),
    [projects, obrasComContrato],
  )

  const filtered = useMemo(
    () =>
      localContracts.filter((c) => {
        if (obra !== 'all' && c.project_id !== obra) return false
        if (status !== 'all' && c.status !== status) return false
        return true
      }),
    [localContracts, obra, status],
  )

  // Remoção otimista: some na hora; reverte e oferece "Tentar novamente" se falhar
  function performDelete(target: ContractRow) {
    setLocalContracts((prev) => prev.filter((c) => c.id !== target.id))
    deleteContract(target.id)
      .then((res) => { if (!res.success) throw new Error(res.error) })
      .catch((err: Error) => {
        setLocalContracts((prev) => [...prev, target])
        toast.error(err.message || 'Erro ao excluir contrato.', {
          action: { label: 'Tentar novamente', onClick: () => performDelete(target) },
        })
      })
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    toastAfterClose('Contrato excluído')
    performDelete(target)
  }

  function handleCreate() {
    if (!novoObra) {
      setNovoErr('Selecione a obra')
      return
    }
    setCreating(true)
    setNovoErr(null)
    createContract(novoObra)
      .then((res) => {
        if (!res.success || !res.id) throw new Error(res.error ?? 'Erro ao criar contrato')
        router.push(`/contratos/${res.id}`)
      })
      .catch((err: Error) => {
        setCreating(false)
        setNovoErr(err.message || 'Erro ao criar contrato')
      })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark">Contratos</h1>
          <p className="text-sm text-gray-400">Contratos, aditivos e medições por obra</p>
        </div>
        <button
          onClick={() => { setNovoOpen(true); setNovoObra(''); setNovoErr(null) }}
          className="flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2.5 text-sm font-medium text-white hover:bg-brown transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Contrato
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Obra</label>
          <select value={obra} onChange={(e) => setObra(e.target.value)} className={inputCls}>
            <option value="all">Todas as obras</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
            <option value="all">Todos</option>
            <option value="ativo">Ativo</option>
            <option value="concluido">Concluído</option>
            <option value="suspenso">Suspenso</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gold/40 py-16 text-center">
          <p className="text-sm font-medium text-gray-400">
            {contracts.length === 0
              ? 'Nenhum contrato criado ainda.'
              : 'Nenhum contrato corresponde aos filtros.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gold/20 bg-cream/30">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Obra</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 hidden sm:table-cell">Nº Contrato</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 hidden md:table-cell">Valor Original</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 hidden lg:table-cell">Aditivos</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Valor Total</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 hidden md:table-cell">Total Medido</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Saldo a Faturar</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">Status</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/10">
                {filtered.map((c) => {
                  const badge = statusStyle(c.status)
                  const adt = amendmentDisplay(c.amendments_value)
                  return (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/contratos/${c.id}`)}
                      className="cursor-pointer hover:bg-cream/20 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-dark">{c.project_name}</td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                        {c.contract_number || '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 hidden md:table-cell">
                        {formatCurrency(c.original_value)}
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell" style={{ color: adt.color }}>
                        {adt.text}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-dark">
                        {formatCurrency(c.total_value)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 hidden md:table-cell">
                        {formatCurrency(c.total_measured)}
                      </td>
                      <td
                        className="px-4 py-3 text-right font-medium"
                        style={{ color: c.balance_to_invoice > 0 ? '#4A7C59' : '#6b7280' }}
                      >
                        {formatCurrency(c.balance_to_invoice)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                          style={badge.style}
                        >
                          {CONTRACT_STATUS_LABELS[c.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/contratos/${c.id}`}
                            className="text-xs text-terracotta hover:underline"
                          >
                            Abrir
                          </Link>
                          <button
                            onClick={() => setDeleteTarget(c)}
                            className="rounded p-1 transition-colors"
                            style={{ color: '#8A5A3B' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#8B3A3A')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = '#8A5A3B')}
                            title="Excluir contrato"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
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

      {/* Modal Novo Contrato */}
      {novoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(59,36,24,0.4)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget && !creating) setNovoOpen(false) }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gold/20 px-6 py-4">
              <h2 className="text-lg font-bold text-dark">Novo Contrato</h2>
              <button
                type="button"
                onClick={() => !creating && setNovoOpen(false)}
                className="rounded p-1 text-gray-400 hover:text-dark transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              {obrasDisponiveis.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Todas as obras já possuem contrato. Cada obra pode ter apenas um contrato principal.
                </p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className={labelCls}>
                      Obra <span style={{ color: '#8B3A3A' }}>*</span>
                    </label>
                    <select
                      value={novoObra}
                      onChange={(e) => { setNovoObra(e.target.value); setNovoErr(null) }}
                      className={`w-full ${novoErr ? 'border-[#8B3A3A]' : 'border-gold/50'} rounded-lg border bg-white px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta`}
                    >
                      <option value="">Selecionar obra…</option>
                      {obrasDisponiveis.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    {novoErr && <p className="text-xs" style={{ color: '#8B3A3A' }}>{novoErr}</p>}
                  </div>

                  <p className="text-xs text-gray-400">
                    Será criado o contrato principal da obra e o detalhe será aberto para preencher
                    valores, datas, aditivos e medições.
                  </p>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setNovoOpen(false)}
                  disabled={creating}
                  className="flex-1 rounded-lg border border-gold/50 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-[#F9F7F4] disabled:opacity-60"
                >
                  Cancelar
                </button>
                {obrasDisponiveis.length > 0 && (
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={creating}
                    className="flex-1 rounded-lg bg-terracotta py-2.5 text-sm font-medium text-white transition-colors hover:bg-brown disabled:opacity-60"
                  >
                    {creating ? 'Criando…' : 'Criar e abrir'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de exclusão (permanente) */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        title="Excluir contrato"
        message="Esta ação remove o contrato, seus aditivos e medições permanentemente. As receitas geradas pelas medições no Financeiro também serão removidas. Não é possível desfazer."
      />
    </div>
  )
}
