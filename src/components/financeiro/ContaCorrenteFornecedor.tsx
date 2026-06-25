'use client'

import { Users } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'

export interface ContaData {
  name: string
  total: number
  count: number
  lastDate: string
}

interface Props {
  data: ContaData[]
}

export function ContaCorrenteFornecedor({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gold/40 py-14 text-center">
        <Users className="mb-3 h-8 w-8 text-gray-300" />
        <p className="text-sm font-medium text-gray-400">Nenhum fornecedor encontrado</p>
        <p className="mt-1 text-xs text-gray-300">
          Fornecedores aparecem aqui quando você registra saídas com contraparte preenchida.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Resumo de gastos por fornecedor/prestador no período selecionado.
      </p>
      <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gold/20 bg-cream/30">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Fornecedor / Prestador
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-400 hidden sm:table-cell">
                  Lançamentos
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 hidden md:table-cell">
                  Último lançamento
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Total gasto
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gold/10">
              {data.map((item) => (
                <tr key={item.name} className="hover:bg-cream/20 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-dark">{item.name}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500 hidden sm:table-cell">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium">
                      {item.count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">
                    {item.lastDate ? formatDate(item.lastDate) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-red-500 whitespace-nowrap">
                    {formatCurrency(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gold/20 bg-cream/20">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Total
                </td>
                <td className="px-4 py-3 text-right font-bold text-dark whitespace-nowrap">
                  {formatCurrency(data.reduce((s, d) => s + d.total, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
