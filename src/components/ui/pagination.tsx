'use client'

const PER_PAGE_OPTIONS = [10, 25, 50] as const

// Lista de páginas com truncamento por reticências (mesma lógica do Financeiro)
function getPageItems(current: number, total: number): (number | '…')[] {
  const pages: (number | '…')[] = []
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    pages.push(1)
    if (current > 3) pages.push('…')
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i)
    if (current < total - 2) pages.push('…')
    pages.push(total)
  }
  return pages
}

interface BarProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

// Componente único de paginação (visual padrão do Financeiro):
// "Anterior  [1] 2 … 14  Próximo", ativo terracota, demais compactos, centralizado.
// Client-side por callback — navegação instantânea, sem ida ao servidor.
export function PaginationBar({ currentPage, totalPages, onPageChange }: BarProps) {
  if (totalPages <= 1) return null
  const pages = getPageItems(currentPage, totalPages)

  return (
    <div className="flex flex-wrap items-center justify-center gap-1 border-t border-gold/20 px-4 py-3">
      <button
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="rounded-lg border border-gold/40 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
      >
        Anterior
      </button>

      {pages.map((p, idx) =>
        p === '…' ? (
          <span key={`e${idx}`} className="px-1 text-xs text-gray-300">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`h-7 min-w-[28px] rounded-lg border px-2 text-xs font-medium transition-colors ${
              currentPage === p
                ? 'border-terracotta bg-terracotta text-white'
                : 'border-gold/40 text-gray-500 hover:bg-cream'
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="rounded-lg border border-gold/40 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
      >
        Próximo
      </button>
    </div>
  )
}

interface SummaryProps {
  currentPage: number
  totalItems: number
  itemsPerPage: number
  itemLabel: string
  onPerPageChange: (perPage: number) => void
}

// Contador "Exibindo X–Y de Z" + seletor "N por página" (client-side por callback).
export function PaginationSummary({
  currentPage,
  totalItems,
  itemsPerPage,
  itemLabel,
  onPerPageChange,
}: SummaryProps) {
  if (totalItems === 0) return null

  const start = Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)
  const end = Math.min(currentPage * itemsPerPage, totalItems)

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-gray-400">
        Exibindo{' '}
        <span className="font-medium text-dark">
          {start}–{end}
        </span>{' '}
        de <span className="font-medium text-dark">{totalItems}</span> {itemLabel}
      </p>
      <select
        value={itemsPerPage}
        onChange={(e) => onPerPageChange(Number(e.target.value))}
        className="rounded-lg border border-gold/50 px-3 py-1.5 text-sm text-brown focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
      >
        {PER_PAGE_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n} por página
          </option>
        ))}
      </select>
    </div>
  )
}
