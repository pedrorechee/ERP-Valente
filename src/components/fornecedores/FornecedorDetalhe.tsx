'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Phone, Mail, FileText, Key, Star, ArrowUpCircle, ArrowDownCircle,
  Paperclip, Plus, Trash2, CheckCircle2, XCircle, AlertCircle, ChevronLeft, Pencil,
} from 'lucide-react'
import type { Supplier, SupplierEvaluation, FinancialEntry, CostCategory } from '@/types/database'
import { SUPPLIER_TYPE_LABELS } from '@/types/database'
import { formatCurrency, formatDate, formatPhone, formatDocument, formatFinanceNumber } from '@/lib/format'
import { deleteEvaluation } from '@/app/actions/fornecedores'
import { AvaliacaoModal } from './AvaliacaoModal'
import { LancamentoModal } from '@/components/financeiro/LancamentoModal'
import { toast } from 'sonner'
import { toastAfterClose } from '@/lib/ui-feedback'

type EntryWithProject = FinancialEntry & {
  projects?: { id: string; name: string } | null
}

interface Stats {
  totalPago: number
  obrasAtendidas: number
  saldoDevedor: number
  ultimoPagamento: string | null
  avgQuality: number | null
}

interface Props {
  supplier: Supplier
  projects: { id: string; name: string }[]
  entries: EntryWithProject[]
  evaluations: SupplierEvaluation[]
  categories: CostCategory[]
  stats: Stats
}

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

function StarDisplay({ score }: { score: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-4 w-4 ${
            s <= score ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-100 text-gray-300'
          }`}
        />
      ))}
    </div>
  )
}

type Tab = 'dados' | 'historico' | 'avaliacoes'

export function FornecedorDetalhe({ supplier, projects, entries, evaluations, categories, stats }: Props) {
  const [avaliacaoOpen, setAvaliacaoOpen] = useState(false)
  const [pagamentoOpen, setPagamentoOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('dados')
  const [localEntries, setLocalEntries] = useState(entries)
  const [localEvals, setLocalEvals]     = useState(evaluations)

  // Mantém as listas locais em sincronia quando o servidor revalida os dados
  useEffect(() => { setLocalEntries(entries) }, [entries])
  useEffect(() => { setLocalEvals(evaluations) }, [evaluations])

  const pendingEntries = localEntries.filter((e) => e.status === 'pendente' || e.status === 'agendado')

  function handleDeleteEval(evalId: string) {
    if (!confirm('Excluir avaliação?')) return
    const removed = localEvals.find((ev) => ev.id === evalId)

    // Remoção otimista com rollback se a exclusão falhar
    setLocalEvals((prev) => prev.filter((ev) => ev.id !== evalId))
    toastAfterClose('Avaliação excluída')

    deleteEvaluation(evalId, supplier.id)
      .then((result) => {
        if (!result.success) throw new Error(result.error)
      })
      .catch(() => {
        if (removed) setLocalEvals((prev) => [removed, ...prev])
        toast.error('Erro ao excluir avaliação', {
          action: { label: 'Tentar novamente', onClick: () => handleDeleteEval(evalId) },
        })
      })
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/fornecedores"
        className="flex w-fit items-center gap-1 text-sm text-gray-500 hover:text-dark transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Fornecedores
      </Link>

      {/* Header card */}
      <div className="rounded-xl border border-gold/40 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-dark">{supplier.name}</h1>
              <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-medium text-brown">
                {SUPPLIER_TYPE_LABELS[supplier.type]}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  supplier.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {supplier.is_active ? 'Ativo' : 'Inativo'}
              </span>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500">
              {supplier.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {formatPhone(supplier.phone)}
                </span>
              )}
              {supplier.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  {supplier.email}
                </span>
              )}
              {supplier.document && (
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  {formatDocument(supplier.document)}
                </span>
              )}
              {supplier.pix_key && (
                <span className="flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5" />
                  {supplier.pix_key}
                </span>
              )}
            </div>

            {supplier.notes && (
              <p className="text-sm text-gray-400 italic">{supplier.notes}</p>
            )}
          </div>

          <div className="flex flex-col items-end gap-3">
            <Link
              href={`/fornecedores/${supplier.id}/editar`}
              className="flex items-center gap-1.5 rounded-lg border border-gold/50 px-3 py-1.5 text-sm font-medium text-dark hover:bg-cream transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Link>
            {stats.avgQuality !== null && (
              <div className="flex flex-col items-end gap-1">
                <StarDisplay score={Math.round(stats.avgQuality)} />
                <span className="text-xs text-gray-400">
                  Média: {stats.avgQuality.toFixed(1)} ({localEvals.length} avaliação{localEvals.length !== 1 ? 'ões' : ''})
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conta corrente alert */}
      {stats.saldoDevedor > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
              <div>
                <p className="font-semibold text-orange-800">
                  Saldo devedor: {formatCurrency(stats.saldoDevedor)}
                </p>
                <p className="mt-0.5 text-sm text-orange-600">
                  {pendingEntries.length} lançamento{pendingEntries.length !== 1 ? 's' : ''} pendente{pendingEntries.length !== 1 ? 's' : ''} com este fornecedor
                </p>
              </div>
            </div>
            <button
              onClick={() => setPagamentoOpen(true)}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
            >
              Registrar pagamento
            </button>
          </div>

          {pendingEntries.length > 0 && (
            <div className="mt-4 divide-y divide-orange-200 rounded-lg border border-orange-200 bg-white overflow-hidden">
              {pendingEntries.slice(0, 3).map((e) => (
                <div key={e.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-dark">{e.description}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(e.entry_date)} · {e.projects?.name ?? '—'}
                    </p>
                  </div>
                  <span className="font-semibold text-orange-700">{formatCurrency(e.amount)}</span>
                </div>
              ))}
              {pendingEntries.length > 3 && (
                <div className="px-4 py-2 text-xs text-gray-400 text-center">
                  +{pendingEntries.length - 3} lançamentos
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-gold/30 bg-cream/30 p-1 w-fit">
        {(['dados', 'historico', 'avaliacoes'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === t ? 'bg-white text-dark shadow-sm' : 'text-gray-500 hover:text-dark'
            }`}
          >
            {t === 'dados' ? 'Dados cadastrais' : t === 'historico' ? 'Histórico financeiro' : 'Avaliações'}
          </button>
        ))}
      </div>

      {/* Tab: Dados cadastrais */}
      {activeTab === 'dados' && (
        <div className="rounded-xl border border-gold/40 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Tipo" value={SUPPLIER_TYPE_LABELS[supplier.type] ?? supplier.type} />
            <Field label="CPF / CNPJ" value={formatDocument(supplier.document)} />
            <Field label="Telefone / WhatsApp" value={formatPhone(supplier.phone)} />
            <Field label="E-mail" value={supplier.email} />
            <Field label="Endereço" value={supplier.address} />
            <Field label="Chave PIX" value={supplier.pix_key} />
            <Field label="Cadastrado em" value={formatDate(supplier.created_at)} />
          </div>
          {supplier.notes && (
            <div className="mt-5 border-t border-gold/20 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brown mb-1">
                Observações
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{supplier.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Histórico financeiro tab ── */}
      {activeTab === 'historico' && (
        <div>
          {localEntries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gold/40 py-12 text-center">
              <p className="text-sm text-gray-400">
                Nenhum lançamento vinculado a este fornecedor.
              </p>
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
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-400 hidden md:table-cell">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gold/10">
                    {localEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-cream/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: '#8A5A3B' }}>
                          {formatFinanceNumber(entry.entry_number)}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          {formatDate(entry.entry_date)}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell">
                          {entry.projects?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {entry.entry_type === 'income' ? (
                              <ArrowUpCircle className="h-4 w-4 shrink-0 text-green-500" />
                            ) : (
                              <ArrowDownCircle className="h-4 w-4 shrink-0 text-red-400" />
                            )}
                            <span className="font-medium text-dark">{entry.description}</span>
                            {entry.storage_path_proof && (
                              <Paperclip className="h-3 w-3 shrink-0 text-gray-300" />
                            )}
                          </div>
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${
                            entry.entry_type === 'income' ? 'text-green-600' : 'text-red-500'
                          }`}
                        >
                          {entry.entry_type === 'income' ? '+' : '−'} {formatCurrency(entry.amount)}
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              STATUS_BADGE[entry.status] ?? 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {STATUS_LABEL[entry.status] ?? entry.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-gold/20 bg-cream/20">
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400"
                      >
                        Total gasto
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-dark">
                        {formatCurrency(stats.totalPago)}
                      </td>
                      <td className="hidden md:table-cell" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Avaliações tab ── */}
      {activeTab === 'avaliacoes' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setAvaliacaoOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-brown transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nova Avaliação
            </button>
          </div>

          {localEvals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gold/40 py-12 text-center">
              <p className="text-sm text-gray-400">Nenhuma avaliação registrada ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {localEvals.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-xl border border-gold/30 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        {ev.quality_score !== null && (
                          <StarDisplay score={ev.quality_score} />
                        )}
                        {ev.met_deadline !== null && (
                          <span
                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                              ev.met_deadline
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {ev.met_deadline ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            {ev.met_deadline ? 'Cumpriu prazo' : 'Atrasou'}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {ev.projects?.name} · {formatDate(ev.created_at)}
                        </span>
                      </div>
                      {ev.observation && (
                        <p className="text-sm text-gray-600 italic">"{ev.observation}"</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteEval(ev.id)}
                      className="rounded p-1 text-brown hover:text-[#8B3A3A] transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Avaliação modal */}
      {avaliacaoOpen && (
        <AvaliacaoModal
          supplierId={supplier.id}
          projects={projects}
          onClose={() => setAvaliacaoOpen(false)}
          onOptimistic={(ev) => setLocalEvals((prev) => [ev, ...prev])}
          onSettled={(tempId, saved) =>
            setLocalEvals((prev) =>
              saved
                ? prev.map((ev) => (ev.id === tempId ? saved : ev))
                : prev.filter((ev) => ev.id !== tempId)
            )
          }
        />
      )}

      {/* Registrar pagamento modal */}
      {pagamentoOpen && (
        <LancamentoModal
          projects={projects}
          suppliers={[supplier]}
          categories={categories}
          preSelectedSupplierId={supplier.id}
          preSelectedSupplierName={supplier.name}
          defaultEntryType="expense"
          defaultStatus="pago"
          onClose={() => setPagamentoOpen(false)}
          onOptimistic={(entry) => setLocalEntries((prev) => [entry, ...prev])}
          onSettled={(tempId, saved) =>
            setLocalEntries((prev) =>
              saved
                ? prev.map((e) => (e.id === tempId ? saved : e))
                : prev.filter((e) => e.id !== tempId)
            )
          }
        />
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
