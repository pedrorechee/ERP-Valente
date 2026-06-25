import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getPageClient } from '@/lib/supabase/action'
import { FornecedorFiltros } from '@/components/fornecedores/FornecedorFiltros'
import { FornecedoresTable } from '@/components/fornecedores/FornecedoresTable'
import type { Supplier } from '@/types/database'

type SearchParams = Promise<{
  busca?: string
  tipo?: string
  status?: string
}>

export default async function FornecedoresPage({ searchParams }: { searchParams: SearchParams }) {
  const { busca, tipo, status } = await searchParams
  const supabase = await getPageClient()

  // Filtros no servidor; a PAGINAÇÃO é client-side (instantânea) na tabela.
  let supplierQ = supabase
    .from('suppliers')
    .select('*, financial_entries(project_id, amount, entry_date)')
    .eq('financial_entries.entry_type', 'expense')
    .order('name')
  if (busca) supplierQ = supplierQ.ilike('name', `%${busca}%`)
  if (tipo) supplierQ = supplierQ.eq('type', tipo)
  if (status === 'ativo') supplierQ = supplierQ.eq('is_active', true)
  if (status === 'inativo') supplierQ = supplierQ.eq('is_active', false)

  type AggRow = { project_id: string; amount: number; entry_date: string }
  type SupplierWithEntries = Supplier & { financial_entries: AggRow[] }
  const { data: suppliersData } = await supplierQ

  const suppliers = (suppliersData as SupplierWithEntries[]) ?? []
  const totalItems = suppliers.length
  const itemLabel = `fornecedor${totalItems !== 1 ? 'es' : ''}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark">Fornecedores</h1>
          <p className="text-sm text-gray-400">
            {totalItems} {itemLabel} encontrado{totalItems !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/fornecedores/novo"
          className="flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2.5 text-sm font-medium text-white hover:bg-brown transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Fornecedor
        </Link>
      </div>

      {/* Filters */}
      <FornecedorFiltros currentBusca={busca} currentTipo={tipo} currentStatus={status} />

      {/* Table */}
      {suppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gold/40 py-16 text-center">
          <p className="text-sm font-medium text-gray-400">Nenhum fornecedor encontrado.</p>
          <Link
            href="/fornecedores/novo"
            className="mt-3 text-xs text-terracotta hover:underline"
          >
            Cadastrar primeiro fornecedor
          </Link>
        </div>
      ) : (
        <FornecedoresTable suppliers={suppliers} />
      )}
    </div>
  )
}
