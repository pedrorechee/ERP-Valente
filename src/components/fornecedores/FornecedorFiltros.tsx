'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { SUPPLIER_TYPE_LABELS } from '@/types/database'
import type { SupplierType } from '@/types/database'

interface Props {
  currentBusca?: string
  currentTipo?: string
  currentStatus?: string
}

export function FornecedorFiltros({ currentBusca = '', currentTipo = '', currentStatus = '' }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-3">
      {/* Search */}
      <input
        type="search"
        placeholder="Buscar fornecedor..."
        defaultValue={currentBusca}
        onChange={(e) => {
          clearTimeout((window as Window & { _fTimer?: ReturnType<typeof setTimeout> })._fTimer)
          ;(window as Window & { _fTimer?: ReturnType<typeof setTimeout> })._fTimer = setTimeout(
            () => update('busca', e.target.value),
            350
          )
        }}
        className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta sm:w-72"
      />

      {/* Type filter */}
      <select
        value={currentTipo}
        onChange={(e) => update('tipo', e.target.value)}
        className="rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
      >
        <option value="">Todos os tipos</option>
        {(Object.entries(SUPPLIER_TYPE_LABELS) as [SupplierType, string][]).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>

      {/* Status filter */}
      <select
        value={currentStatus}
        onChange={(e) => update('status', e.target.value)}
        className="rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
      >
        <option value="">Todos</option>
        <option value="ativo">Ativos</option>
        <option value="inativo">Inativos</option>
      </select>

      {(currentBusca || currentTipo || currentStatus) && (
        <button
          onClick={() => router.push(pathname)}
          className="rounded-lg border border-gold/50 px-3 py-2 text-sm text-gray-500 hover:bg-cream transition-colors"
        >
          Limpar
        </button>
      )}
    </div>
  )
}
