'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PaginationBar, PaginationSummary } from '@/components/ui/pagination'
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal'
import { FuncionarioModal } from './FuncionarioModal'
import { deleteEmployee } from '@/app/actions/equipe'
import { toastAfterClose } from '@/lib/ui-feedback'
import { formatCurrency, formatDocument } from '@/lib/format'
import { costLabel } from '@/lib/equipe'
import { EMPLOYMENT_TYPE_LABELS, type Employee } from '@/types/database'

export type EmployeeWithCount = Employee & { activeAllocations: number }

const thBase = 'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400'

export function EmployeesManager({ employees }: { employees: EmployeeWithCount[] }) {
  const [local, setLocal] = useState<EmployeeWithCount[]>(employees)
  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState('')   // '', 'clt', 'diarista'
  const [status, setStatus] = useState('') // '', 'ativo', 'inativo'
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [modal, setModal] = useState<null | 'new' | EmployeeWithCount>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Cards de resumo (sobre o conjunto completo, independem do filtro)
  const stats = useMemo(() => ({
    total:     local.length,
    ativos:    local.filter((e) => e.is_active).length,
    clt:       local.filter((e) => e.employment_type === 'clt').length,
    diaristas: local.filter((e) => e.employment_type === 'diarista').length,
  }), [local])

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return local.filter((e) => {
      if (tipo && e.employment_type !== tipo) return false
      if (status === 'ativo' && !e.is_active) return false
      if (status === 'inativo' && e.is_active) return false
      if (q) {
        const hay = `${e.name} ${e.role ?? ''} ${e.document ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [local, busca, tipo, status])

  const totalItems = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage))
  const currentPage = Math.min(page, totalPages)
  const paged = filtered.slice((currentPage - 1) * perPage, currentPage * perPage)

  function resetPage() { setPage(1) }

  function handleSaved(emp: Employee) {
    setLocal((prev) => {
      const existing = prev.find((e) => e.id === emp.id)
      if (existing) {
        return prev.map((e) => (e.id === emp.id ? { ...e, ...emp } : e))
      }
      return [{ ...emp, activeAllocations: 0 }, ...prev]
    })
  }

  function handleDeleteConfirm() {
    if (!deleteId) return
    const id = deleteId
    const original = local.find((e) => e.id === id)
    setDeleteId(null)
    setLocal((prev) => prev.filter((e) => e.id !== id))
    toastAfterClose('Funcionário excluído')
    deleteEmployee(id)
      .then((r) => { if (!r.success) throw new Error(r.error) })
      .catch((err: Error) => {
        if (original) setLocal((prev) => [original, ...prev])
        toast.error(err.message || 'Erro ao excluir funcionário', {
          action: { label: 'Tentar novamente', onClick: () => setDeleteId(id) },
        })
      })
  }

  const filterCls =
    'rounded-lg border border-gold/50 bg-white px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark">RH e Equipe</h1>
          <p className="text-sm text-gray-400">
            {totalItems} funcionário{totalItems !== 1 ? 's' : ''} encontrado{totalItems !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/equipe/apontamento"
            className="rounded-lg border border-gold/50 px-4 py-2.5 text-sm font-medium text-dark hover:bg-cream transition-colors"
          >
            Apontar
          </Link>
          <Link
            href="/equipe/folha"
            className="rounded-lg border border-gold/50 px-4 py-2.5 text-sm font-medium text-dark hover:bg-cream transition-colors"
          >
            Fechar folha
          </Link>
          <button
            type="button"
            onClick={() => setModal('new')}
            className="flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2.5 text-sm font-medium text-white hover:bg-brown transition-colors"
          >
            <Plus className="h-4 w-4" /> Novo Funcionário
          </button>
        </div>
      </div>

      {/* Cards de resumo (sem ícones) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total de funcionários', value: stats.total },
          { label: 'Ativos', value: stats.ativos },
          { label: 'CLT', value: stats.clt },
          { label: 'Diaristas', value: stats.diaristas },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-400">{c.label}</p>
            <p className="mt-1 text-xl font-bold text-dark">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Buscar por nome, função ou CPF…"
          value={busca}
          onChange={(e) => { setBusca(e.target.value); resetPage() }}
          className={`${filterCls} sm:w-72`}
        />
        <select value={tipo} onChange={(e) => { setTipo(e.target.value); resetPage() }} className={filterCls}>
          <option value="">Todos os tipos</option>
          <option value="clt">CLT</option>
          <option value="diarista">Diarista</option>
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); resetPage() }} className={filterCls}>
          <option value="">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </select>
      </div>

      {/* Tabela */}
      {totalItems === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gold/40 py-16 text-center">
          <p className="text-sm font-medium text-gray-400">Nenhum funcionário encontrado.</p>
          <button
            type="button"
            onClick={() => setModal('new')}
            className="mt-3 text-xs text-terracotta hover:underline"
          >
            Cadastrar primeiro funcionário
          </button>
        </div>
      ) : (
        <>
          <PaginationSummary
            currentPage={currentPage}
            totalItems={totalItems}
            itemsPerPage={perPage}
            itemLabel="funcionários"
            onPerPageChange={(n) => { setPerPage(n); resetPage() }}
          />

          <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gold/20 bg-cream/30">
                  <tr>
                    <th className={`${thBase} text-left`}>Nome</th>
                    <th className={`${thBase} text-left hidden sm:table-cell`}>Função</th>
                    <th className={`${thBase} text-center`}>Tipo</th>
                    <th className={`${thBase} text-right`}>Custo</th>
                    <th className={`${thBase} text-center hidden md:table-cell`}>Obras ativas</th>
                    <th className={`${thBase} text-center`}>Status</th>
                    <th className="px-4 py-3 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold/10">
                  {paged.map((e) => (
                    <tr key={e.id} className="hover:bg-cream/20 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/equipe/${e.id}`}
                          className="font-medium text-dark hover:text-terracotta transition-colors"
                        >
                          {e.name}
                        </Link>
                        {e.document && (
                          <p className="mt-0.5 text-xs text-gray-400">{formatDocument(e.document)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-left text-gray-600 hidden sm:table-cell">
                        {e.role || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-medium text-brown">
                          {EMPLOYMENT_TYPE_LABELS[e.employment_type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-dark whitespace-nowrap">
                        {costLabel(e, formatCurrency)}
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          {e.activeAllocations}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          e.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {e.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <Link href={`/equipe/${e.id}`} className="text-xs text-terracotta hover:underline">
                            Ver
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeleteId(e.id)}
                            className="rounded p-1 transition-colors"
                            style={{ color: '#8A5A3B' }}
                            onMouseEnter={(ev) => (ev.currentTarget.style.color = '#8B3A3A')}
                            onMouseLeave={(ev) => (ev.currentTarget.style.color = '#8A5A3B')}
                            title="Excluir funcionário"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </>
      )}

      {modal && (
        <FuncionarioModal
          employee={modal === 'new' ? null : modal}
          onSave={handleSaved}
          onClose={() => setModal(null)}
        />
      )}

      <ConfirmDeleteModal
        isOpen={!!deleteId}
        title="Excluir funcionário"
        message="Tem certeza que deseja excluir este funcionário? As alocações e apontamentos vinculados também serão removidos. Esta ação não pode ser desfeita."
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
