'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import type { Client, Project, FinancialEntry } from '@/types/database'
import {
  CLIENT_TYPE_LABELS, HOW_THEY_FOUND_LABELS, PROJECT_STATUS_LABELS,
} from '@/types/database'
import { formatCurrency, formatDate, formatPhone, formatDocument, formatProjectAddress, formatFinanceNumber } from '@/lib/format'

type Tab = 'dados' | 'obras' | 'financeiro'

type Props = {
  client: Client
  projects: Project[]
  incomeEntries: FinancialEntry[]
}

const STATUS_BADGE: Record<string, string> = {
  active:    'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  paused:    'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-red-100 text-red-800',
}

export function ClienteDetalhe({ client, projects, incomeEntries }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('dados')

  const obrasAtivas = projects.filter((p) => p.status === 'active').length
  const totalContratado = projects.reduce((s, p) => s + (p.contract_value ?? 0), 0)
  const totalRecebido = incomeEntries
    .filter((e) => e.status === 'pago')
    .reduce((s, e) => s + e.amount, 0)

  // Nome da obra por id — para a tabela de lançamentos do histórico financeiro
  const projName = (pid: string) => projects.find((p) => p.id === pid)?.name ?? 'Obra'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-gold/40 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-dark">{client.name}</h1>
              <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-medium text-brown">
                {CLIENT_TYPE_LABELS[client.type]}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  client.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {client.is_active ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
              {client.phone && <span>{formatPhone(client.phone)}</span>}
              {client.email && <span>{client.email}</span>}
              {client.document && <span>{formatDocument(client.document)}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/clientes/${client.id}/editar`}
              className="flex items-center gap-1.5 rounded-lg border border-gold/50 px-3 py-1.5 text-sm font-medium text-dark hover:bg-cream transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Link>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {/* Obras: total grande + legenda das ativas embaixo */}
        <div className="rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-400">Obras</p>
          <p className="mt-1 text-xl font-bold text-dark">{projects.length}</p>
          <p className="text-xs" style={{ color: '#8A5A3B' }}>
            {obrasAtivas} ativa{obrasAtivas !== 1 ? 's' : ''}
          </p>
        </div>
        {[
          { label: 'Valor contratado', value: formatCurrency(totalContratado) },
          { label: 'Valor recebido', value: formatCurrency(totalRecebido) },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-400">{card.label}</p>
            <p className="mt-1 text-xl font-bold text-dark">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-gold/30 bg-cream/30 p-1 w-fit">
        {(['dados', 'obras', 'financeiro'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === t ? 'bg-white text-dark shadow-sm' : 'text-gray-500 hover:text-dark'
            }`}
          >
            {t === 'dados' ? 'Dados cadastrais' : t === 'obras' ? 'Obras' : 'Histórico financeiro'}
          </button>
        ))}
      </div>

      {/* Tab: Dados cadastrais */}
      {activeTab === 'dados' && (
        <div className="rounded-xl border border-gold/40 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Tipo" value={CLIENT_TYPE_LABELS[client.type]} />
            <Field label="CPF / CNPJ" value={formatDocument(client.document)} />
            <Field label="Telefone / WhatsApp" value={formatPhone(client.phone)} />
            <Field label="E-mail" value={client.email} />
            <Field label="Endereço" value={client.address} />
            <Field
              label="Cidade / Estado"
              value={[client.city, client.state].filter(Boolean).join(' — ')}
            />
            <Field
              label="Como chegou até nós"
              value={client.how_they_found ? HOW_THEY_FOUND_LABELS[client.how_they_found] : null}
            />
            <Field label="Cadastrado em" value={formatDate(client.created_at)} />
          </div>
          {client.notes && (
            <div className="mt-5 border-t border-gold/20 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brown mb-1">
                Observações
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Obras */}
      {activeTab === 'obras' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">{projects.length} obra{projects.length !== 1 ? 's' : ''}</p>
          </div>

          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gold/40 py-12 text-center">
              <p className="text-sm text-gray-400">Nenhuma obra vinculada.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-gold/20 bg-cream/30">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Obra
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-400 hidden sm:table-cell">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 hidden md:table-cell">
                      Valor contrato
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 hidden lg:table-cell">
                      Avanço
                    </th>
                    <th className="px-4 py-3 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold/10">
                  {projects.map((p) => (
                    <tr key={p.id} className="hover:bg-cream/20 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/obras/${p.id}`}
                          className="font-medium text-dark hover:text-terracotta transition-colors"
                        >
                          {p.name}
                        </Link>
                        <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{formatProjectAddress(p)}</p>
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[p.status]}`}>
                          {PROJECT_STATUS_LABELS[p.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-dark hidden md:table-cell">
                        {p.contract_value ? formatCurrency(p.contract_value) : '—'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-terracotta"
                              style={{ width: `${p.overall_progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{p.overall_progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/obras/${p.id}`} className="text-xs text-terracotta hover:underline">
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Histórico financeiro */}
      {activeTab === 'financeiro' && (
        <div className="space-y-4">
          {incomeEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gold/40 py-12 text-center">
              <p className="text-sm text-gray-400">Nenhum recebimento registrado.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gold/20 bg-cream/30">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Nº</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Data</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 hidden sm:table-cell">Obra</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Descrição</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gold/10">
                    {incomeEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-cream/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: '#8A5A3B' }}>
                          {formatFinanceNumber(entry.entry_number)}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          {formatDate(entry.entry_date)}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell">
                          <Link href={`/obras/${entry.project_id}`} className="hover:text-terracotta transition-colors">
                            {projName(entry.project_id)}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-medium text-dark">{entry.description}</td>
                        <td className="px-4 py-3 text-right font-semibold whitespace-nowrap text-green-600">
                          {formatCurrency(entry.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-gold/20 bg-cream/20">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Total recebido (pagos)
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-dark whitespace-nowrap">
                        {formatCurrency(totalRecebido)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-brown">{label}</p>
      <p className="mt-0.5 text-sm text-dark">{value || <span className="text-gray-300">—</span>}</p>
    </div>
  )
}
