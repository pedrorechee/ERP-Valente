import Link from 'next/link'
import { ArrowUpCircle, ArrowDownCircle, ArrowRight, Paperclip } from 'lucide-react'
import type { FinancialEntry } from '@/types/database'
import { formatCurrency, formatDate } from '@/lib/format'

const STATUS_BADGE: Record<string, string> = {
  pago: 'bg-green-100 text-green-700',
  pendente: 'bg-yellow-100 text-yellow-700',
  agendado: 'bg-blue-100 text-blue-700',
}

const STATUS_LABEL: Record<string, string> = {
  pago: 'Pago',
  pendente: 'Pendente',
  agendado: 'Agendado',
}

interface Props {
  projectId: string
  entries: FinancialEntry[]
}

export function FinanceiroObra({ projectId, entries }: Props) {
  const totalIncome = entries
    .filter((e) => e.entry_type === 'income')
    .reduce((s, e) => s + e.amount, 0)

  const totalExpense = entries
    .filter((e) => e.entry_type === 'expense')
    .reduce((s, e) => s + e.amount, 0)

  const balance = totalIncome - totalExpense

  const last5 = entries.slice(0, 5)

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-xs text-green-600">Entradas</p>
          <p className="mt-1 text-lg font-bold text-green-700">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs text-red-600">Saídas</p>
          <p className="mt-1 text-lg font-bold text-red-700">{formatCurrency(totalExpense)}</p>
        </div>
        <div
          className={`rounded-xl border p-4 ${
            balance >= 0 ? 'border-blue-200 bg-blue-50' : 'border-red-200 bg-red-50'
          }`}
        >
          <p className={`text-xs ${balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            Resultado
          </p>
          <p
            className={`mt-1 text-lg font-bold ${
              balance >= 0 ? 'text-blue-700' : 'text-red-700'
            }`}
          >
            {formatCurrency(balance)}
          </p>
        </div>
      </div>

      {/* Last 5 entries */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-dark">Últimos lançamentos</h3>
          <div className="flex items-center gap-2">
            <Link
              href={`/financeiro?obra=${projectId}&new=1`}
              className="flex items-center gap-1.5 rounded-lg bg-terracotta px-3 py-1.5 text-xs font-medium text-white hover:bg-brown transition-colors"
            >
              + Novo Lançamento
            </Link>
            <Link
              href={`/financeiro?obra=${projectId}`}
              className="flex items-center gap-1 text-xs font-medium text-terracotta hover:text-brown transition-colors"
            >
              Ver todos
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {last5.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gold/40 py-10 text-center">
            <p className="text-sm text-gray-400">Nenhum lançamento registrado.</p>
            <Link
              href={`/financeiro?obra=${projectId}&new=1`}
              className="mt-2 inline-block text-xs text-terracotta hover:underline"
            >
              Registrar primeiro lançamento
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden">
            <div className="divide-y divide-gold/10">
              {last5.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-cream/20 transition-colors"
                >
                  <div className="shrink-0">
                    {entry.entry_type === 'income' ? (
                      <ArrowUpCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <ArrowDownCircle className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-dark">{entry.description}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(entry.entry_date)} · {entry.category}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {entry.storage_path_proof && (
                      <Paperclip className="h-3 w-3 text-gray-300" />
                    )}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-xs font-medium hidden sm:inline ${
                        STATUS_BADGE[entry.status] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {STATUS_LABEL[entry.status] ?? entry.status}
                    </span>
                    <span
                      className={`text-sm font-semibold whitespace-nowrap ${
                        entry.entry_type === 'income' ? 'text-green-600' : 'text-red-500'
                      }`}
                    >
                      {entry.entry_type === 'income' ? '+' : '−'} {formatCurrency(entry.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {entries.length > 5 && (
              <div className="border-t border-gold/20 px-4 py-2.5">
                <Link
                  href={`/financeiro?obra=${projectId}`}
                  className="flex items-center justify-center gap-1.5 text-xs font-medium text-terracotta hover:text-brown transition-colors"
                >
                  Ver todos os {entries.length} lançamentos
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
