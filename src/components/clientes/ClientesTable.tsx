'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Phone, Trash2 } from 'lucide-react'
import type { Client } from '@/types/database'
import { CLIENT_TYPE_LABELS } from '@/types/database'
import { formatPhone } from '@/lib/format'
import { useTableSort } from '@/hooks/useTableSort'
import { SortHeader } from '@/components/ui/sort-header'
import { PaginationBar, PaginationSummary } from '@/components/ui/pagination'
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal'
import { DetalheClienteModal } from './DetalheClienteModal'
import { deleteClient } from '@/app/actions/clientes'
import { toast } from 'sonner'
import { toastAfterClose } from '@/lib/ui-feedback'

type ProjRow = { status: string; contract_value: number | null }
type ClientWithProjects = Client & { projects: ProjRow[] }
type ClientRow = ClientWithProjects & { activeProjects: number; contractedTotal: number }

function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const GETTERS = {
  name:            (r: ClientRow) => r.name,
  type:            (r: ClientRow) => CLIENT_TYPE_LABELS[r.type] ?? r.type,
  phone:           (r: ClientRow) => r.phone ?? '',
  activeProjects:  (r: ClientRow) => r.activeProjects,
  contractedTotal: (r: ClientRow) => r.contractedTotal,
  status:          (r: ClientRow) => r.is_active,
}

export function ClientesTable({ clients }: { clients: ClientWithProjects[] }) {
  const [localClients, setLocalClients] = useState(clients)
  const [detailClient, setDetailClient] = useState<Client | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Mantém a lista local em sincronia quando o servidor revalida os dados,
  // permitindo que inserções/edições/exclusões otimistas apareçam sem reload.
  useEffect(() => {
    setLocalClients(clients)
  }, [clients])

  const rows: ClientRow[] = useMemo(
    () =>
      localClients.map((c) => {
        const projs = c.projects ?? []
        return {
          ...c,
          activeProjects:  projs.filter((p) => p.status === 'active').length,
          contractedTotal: projs.reduce((s, p) => s + (p.contract_value ?? 0), 0),
        }
      }),
    [localClients],
  )

  const { sorted, sortCol, sortDir, handleSort } = useTableSort(
    rows, GETTERS, 'name', 'asc', 'clientes',
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
  // Volta à 1ª página quando os filtros/ordenação mudam o conjunto
  useEffect(() => { setPage(1) }, [localClients, sortCol, sortDir])

  function handleDeleteConfirm() {
    if (!deleteId) return
    const id       = deleteId
    const original = localClients.find((c) => c.id === id)
    setDeleteId(null)
    setLocalClients((prev) => prev.filter((c) => c.id !== id))
    toastAfterClose('Cliente excluído!')
    deleteClient(id)
      .then((result) => {
        if (!result.success) throw new Error(result.error)
      })
      .catch((err: Error) => {
        if (original) setLocalClients((prev) => [...prev, original])
        toast.error(err.message || 'Erro ao excluir cliente.', {
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
        itemLabel="clientes"
        onPerPageChange={(n) => { setPerPage(n); setPage(1) }}
      />

      <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gold/20 bg-cream/30">
            <tr>
              <SortHeader label="Nome"            sortKey="name"            currentKey={sortCol} currentDir={sortDir} onSort={handleSort} className="text-left" />
              <SortHeader label="Tipo"            sortKey="type"            currentKey={sortCol} currentDir={sortDir} onSort={handleSort} className="text-center hidden sm:table-cell" />
              <SortHeader label="Telefone"        sortKey="phone"           currentKey={sortCol} currentDir={sortDir} onSort={handleSort} className="text-center hidden md:table-cell" />
              <SortHeader label="Obras ativas"    sortKey="activeProjects"  currentKey={sortCol} currentDir={sortDir} onSort={handleSort} className="text-center hidden lg:table-cell" />
              <SortHeader label="Total contratado" sortKey="contractedTotal" currentKey={sortCol} currentDir={sortDir} onSort={handleSort} className="text-right hidden lg:table-cell" />
              <SortHeader label="Status"          sortKey="status"          currentKey={sortCol} currentDir={sortDir} onSort={handleSort} className="text-center" />
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gold/10">
            {paged.map((c) => (
              <tr
                key={c.id}
                onClick={() => setDetailClient(c)}
                className="hover:bg-cream/20 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3">
                  <div>
                    <Link
                      href={`/clientes/${c.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium text-dark hover:text-terracotta transition-colors"
                    >
                      {c.name}
                    </Link>
                    {c.email && <p className="text-xs text-gray-400 mt-0.5">{c.email}</p>}
                  </div>
                </td>
                <td className="px-4 py-3 text-center hidden sm:table-cell">
                  <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-medium text-brown">
                    {CLIENT_TYPE_LABELS[c.type]}
                  </span>
                </td>
                <td className="px-4 py-3 text-center hidden md:table-cell">
                  {c.phone ? (
                    <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      {formatPhone(c.phone)}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center hidden lg:table-cell">
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                    {c.activeProjects}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-dark hidden lg:table-cell">
                  {c.contractedTotal ? fmtCurrency(c.contractedTotal) : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {c.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/clientes/${c.id}`} className="text-xs text-terracotta hover:underline">
                      Ver
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDeleteId(c.id)}
                      className="rounded p-1 transition-colors"
                      style={{ color: '#8A5A3B' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#8B3A3A')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#8A5A3B')}
                      title="Excluir cliente"
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

      {detailClient && (
        <DetalheClienteModal
          client={detailClient}
          onClose={() => setDetailClient(null)}
        />
      )}

      <ConfirmDeleteModal
        isOpen={deleteId !== null}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
        title="Excluir cliente"
        message="Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita."
      />
    </div>
  )
}
