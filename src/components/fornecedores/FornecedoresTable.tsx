'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Phone, Mail, Trash2 } from 'lucide-react'
import type { Supplier } from '@/types/database'
import { SUPPLIER_TYPE_LABELS } from '@/types/database'
import { formatCurrency, formatPhone } from '@/lib/format'
import { useTableSort } from '@/hooks/useTableSort'
import { SortHeader } from '@/components/ui/sort-header'
import { PaginationBar, PaginationSummary } from '@/components/ui/pagination'
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal'
import { DetalheFornecedorModal } from './DetalheFornecedorModal'
import { deleteSupplier } from '@/app/actions/fornecedores'
import { toast } from 'sonner'
import { toastAfterClose } from '@/lib/ui-feedback'

type EntryRow = { project_id: string; amount: number; entry_date: string }
type SupplierWithEntries = Supplier & { financial_entries: EntryRow[] }
type SupplierRow = SupplierWithEntries & { totalPaid: number; projectCount: number }

const GETTERS = {
  name:         (r: SupplierRow) => r.name,
  type:         (r: SupplierRow) => SUPPLIER_TYPE_LABELS[r.type] ?? r.type,
  phone:        (r: SupplierRow) => r.phone ?? '',
  totalPaid:    (r: SupplierRow) => r.totalPaid,
  projectCount: (r: SupplierRow) => r.projectCount,
  status:       (r: SupplierRow) => r.is_active,
}

export function FornecedoresTable({ suppliers }: { suppliers: SupplierWithEntries[] }) {
  const [localSuppliers, setLocalSuppliers] = useState(suppliers)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null)

  // Mantém a lista local em sincronia quando o servidor revalida os dados
  useEffect(() => { setLocalSuppliers(suppliers) }, [suppliers])

  const rows: SupplierRow[] = useMemo(
    () =>
      localSuppliers.map((s) => {
        const entries = s.financial_entries ?? []
        const obras = new Set(entries.map((e) => e.project_id))
        return {
          ...s,
          totalPaid:    entries.reduce((sum, e) => sum + e.amount, 0),
          projectCount: obras.size,
        }
      }),
    [localSuppliers],
  )

  const { sorted, sortCol, sortDir, handleSort } = useTableSort(
    rows, GETTERS, 'name', 'asc', 'fornecedores',
  )

  // Paginação client-side (instantânea, sem ida ao servidor)
  const [page, setPage]       = useState(1)
  const [perPage, setPerPage] = useState(10)
  const totalItems  = sorted.length
  const totalPages  = Math.max(1, Math.ceil(totalItems / perPage))
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const paged = useMemo(
    () => sorted.slice((currentPage - 1) * perPage, currentPage * perPage),
    [sorted, currentPage, perPage],
  )
  useEffect(() => { setPage(1) }, [localSuppliers, sortCol, sortDir])

  function handleDeleteConfirm() {
    if (!deleteId) return
    const id       = deleteId
    const original = localSuppliers.find((s) => s.id === id)
    setDeleteId(null)
    setLocalSuppliers((prev) => prev.filter((s) => s.id !== id))
    toastAfterClose('Fornecedor excluído!')
    deleteSupplier(id)
      .then((result) => {
        if (!result.success) throw new Error(result.error)
      })
      .catch((err: Error) => {
        if (original) setLocalSuppliers((prev) => [...prev, original])
        toast.error(err.message || 'Erro ao excluir fornecedor.', {
          action: { label: 'Tentar novamente', onClick: () => setDeleteId(id) },
        })
      })
  }

  return (
    <div className="space-y-3">
      <PaginationSummary
        currentPage={currentPage}
        totalItems={totalItems}
        itemsPerPage={perPage}
        itemLabel="fornecedores"
        onPerPageChange={(n) => { setPerPage(n); setPage(1) }}
      />

      <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gold/20 bg-cream/30">
            <tr>
              <SortHeader label="Nome"       sortKey="name"         currentKey={sortCol} currentDir={sortDir} onSort={handleSort} className="text-left" />
              <SortHeader label="Tipo"       sortKey="type"         currentKey={sortCol} currentDir={sortDir} onSort={handleSort} className="text-center hidden md:table-cell" />
              <SortHeader label="Telefone"   sortKey="phone"        currentKey={sortCol} currentDir={sortDir} onSort={handleSort} className="text-center hidden sm:table-cell" />
              <SortHeader label="Total pago" sortKey="totalPaid"    currentKey={sortCol} currentDir={sortDir} onSort={handleSort} className="text-right hidden lg:table-cell" />
              <SortHeader label="Status"     sortKey="status"       currentKey={sortCol} currentDir={sortDir} onSort={handleSort} className="text-center" />
              <th className="px-4 py-3 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gold/10">
            {paged.map((s) => (
              <tr
                key={s.id}
                onClick={() => setDetailSupplier(s)}
                className="hover:bg-cream/20 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3">
                  <div>
                    <Link
                      href={`/fornecedores/${s.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium text-dark hover:text-terracotta transition-colors"
                    >
                      {s.name}
                    </Link>
                    {s.email && (
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
                        <Mail className="h-3 w-3" />
                        {s.email}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center hidden md:table-cell">
                  <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-medium text-brown">
                    {SUPPLIER_TYPE_LABELS[s.type] ?? s.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-center hidden sm:table-cell">
                  {s.phone ? (
                    <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      {formatPhone(s.phone)}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right hidden lg:table-cell">
                  <span className="font-semibold text-dark">
                    {s.projectCount > 0 ? formatCurrency(s.totalPaid) : '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {s.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/fornecedores/${s.id}`} className="text-xs text-terracotta hover:underline">
                      Ver
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDeleteId(s.id)}
                      className="rounded p-1 transition-colors"
                      style={{ color: '#8A5A3B' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#8B3A3A')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#8A5A3B')}
                      title="Excluir fornecedor"
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

      {detailSupplier && (
        <DetalheFornecedorModal
          supplier={detailSupplier}
          onClose={() => setDetailSupplier(null)}
        />
      )}

      <ConfirmDeleteModal
        isOpen={deleteId !== null}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
        title="Excluir fornecedor"
        message="Tem certeza que deseja excluir este fornecedor? Esta ação não pode ser desfeita."
      />
    </div>
  )
}
