'use client'

import { useRouter, useSearchParams } from 'next/navigation'

type Props = {
  currentBusca?: string
  currentTipo?: string
  currentStatus?: string
}

export function ClienteFiltros({ currentBusca, currentTipo, currentStatus }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete('page')
    router.push(`/clientes?${params.toString()}`)
  }

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    clearTimeout((window as unknown as { _cTimer: ReturnType<typeof setTimeout> })._cTimer)
    ;(window as unknown as { _cTimer: ReturnType<typeof setTimeout> })._cTimer = setTimeout(
      () => update('busca', e.target.value),
      350
    )
  }

  return (
    <div className="flex flex-wrap gap-3">
      <input
        type="search"
        placeholder="Buscar por nome, CPF ou CNPJ..."
        defaultValue={currentBusca}
        onChange={handleSearch}
        className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta sm:w-72"
      />
      <select
        defaultValue={currentTipo ?? ''}
        onChange={(e) => update('tipo', e.target.value)}
        className="rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
      >
        <option value="">Todos os tipos</option>
        <option value="pf">Pessoa Física</option>
        <option value="pj">Pessoa Jurídica</option>
      </select>
      <select
        defaultValue={currentStatus ?? ''}
        onChange={(e) => update('status', e.target.value)}
        className="rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
      >
        <option value="">Todos os status</option>
        <option value="ativo">Ativo</option>
        <option value="inativo">Inativo</option>
      </select>
    </div>
  )
}
