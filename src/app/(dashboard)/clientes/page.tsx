import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getPageClient } from '@/lib/supabase/action'
import { ClienteFiltros } from '@/components/clientes/ClienteFiltros'
import { ClientesTable } from '@/components/clientes/ClientesTable'
import type { Client } from '@/types/database'

type SearchParams = Promise<{
  busca?: string
  tipo?: string
  status?: string
}>

export default async function ClientesPage({ searchParams }: { searchParams: SearchParams }) {
  const { busca, tipo, status } = await searchParams
  const supabase = await getPageClient()

  // Filtros no servidor; a PAGINAÇÃO é client-side (instantânea) na tabela.
  let clientQ = supabase
    .from('clients')
    .select('*, projects(status, contract_value)')
    .order('name')
  if (busca) clientQ = clientQ.ilike('name', `%${busca}%`)
  if (tipo) clientQ = clientQ.eq('type', tipo)
  if (status === 'ativo') clientQ = clientQ.eq('is_active', true)
  if (status === 'inativo') clientQ = clientQ.eq('is_active', false)

  type ProjRow = { status: string; contract_value: number | null }
  type ClientWithProjects = Client & { projects: ProjRow[] }
  const { data: clientsData } = await clientQ

  const clients = (clientsData as ClientWithProjects[]) ?? []
  const totalItems = clients.length
  const itemLabel = `cliente${totalItems !== 1 ? 's' : ''}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark">Clientes</h1>
          <p className="text-sm text-gray-400">
            {totalItems} {itemLabel} encontrado{totalItems !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/clientes/novo"
          className="flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2.5 text-sm font-medium text-white hover:bg-brown transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Cliente
        </Link>
      </div>

      {/* Filters */}
      <ClienteFiltros currentBusca={busca} currentTipo={tipo} currentStatus={status} />

      {/* Table */}
      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gold/40 py-16 text-center">
          <p className="text-sm font-medium text-gray-400">Nenhum cliente encontrado.</p>
          <Link href="/clientes/novo" className="mt-3 text-xs text-terracotta hover:underline">
            Cadastrar primeiro cliente
          </Link>
        </div>
      ) : (
        <ClientesTable clients={clients} />
      )}
    </div>
  )
}
