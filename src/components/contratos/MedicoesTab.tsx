'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, X, Pencil, Trash2, ExternalLink } from 'lucide-react'
import type { Measurement, MeasurementStatus } from '@/types/database'
import { MEASUREMENT_STATUS_LABELS } from '@/types/database'
import { formatCurrency, formatDate, formatFinanceNumber } from '@/lib/format'
import { netoMedicao, retidoMedicao } from '@/lib/medicao'
import { CurrencyInput } from '@/components/ui/currency-input'
import {
  createMeasurement,
  updateMeasurement,
  deleteMeasurement,
} from '@/app/actions/contratos'
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal'
import { toast } from 'sonner'
import { toastAfterClose } from '@/lib/ui-feedback'

interface Props {
  contractId:       string
  retentionPercent: number
  measurements:     Measurement[]
  setMeasurements:  React.Dispatch<React.SetStateAction<Measurement[]>>
}

const inputCls =
  'w-full rounded-lg border border-gold/50 bg-white px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta'
const labelCls = 'text-xs font-semibold uppercase tracking-wide text-brown'

const RECEITA_STATUSES: MeasurementStatus[] = ['aprovada', 'faturada']

function statusBadge(status: MeasurementStatus): { className: string; style?: React.CSSProperties } {
  if (status === 'aprovada') return { className: 'bg-green-100 text-green-700' }
  if (status === 'faturada') return { className: 'bg-blue-100 text-blue-700' }
  if (status === 'medida')
    return { className: '', style: { backgroundColor: 'rgba(230,192,123,0.30)', color: '#8A5A3B' } }
  return { className: 'bg-gray-100 text-gray-600' } // prevista
}

function periodLabel(start: string | null, end: string | null): string {
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`
  if (end) return `até ${formatDate(end)}`
  if (start) return `a partir de ${formatDate(start)}`
  return '—'
}

function pct(n: number | null): string {
  if (n == null) return '—'
  return `${n.toFixed(1).replace('.', ',')}%`
}

const today = () => new Date().toISOString().slice(0, 10)

export function MedicoesTab({ contractId, retentionPercent, measurements, setMeasurements }: Props) {
  const [modalOpen, setModalOpen]   = useState(false)
  const [editTarget, setEditTarget] = useState<Measurement | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Measurement | null>(null)

  const [status, setStatus] = useState<MeasurementStatus>('medida')
  const [amount, setAmount] = useState(0) // espelho do valor para preview de retenção
  const [retention, setRetention] = useState(retentionPercent || 0) // % de retenção desta medição

  // Mostra colunas de retenção/líquido quando o contrato ou alguma medição tem retenção
  const anyRetention =
    (retentionPercent || 0) > 0 || measurements.some((m) => (m.retention_percent || 0) > 0)

  const sorted = useMemo(
    () => [...measurements].sort((a, b) => a.measurement_number - b.measurement_number),
    [measurements],
  )
  const nextNumber = useMemo(
    () => (measurements.length ? Math.max(...measurements.map((m) => m.measurement_number)) + 1 : 1),
    [measurements],
  )

  function openCreate() {
    setEditTarget(null)
    setStatus('medida')
    setAmount(0)
    setRetention(retentionPercent || 0) // padrão = retenção do contrato
    setModalOpen(true)
  }

  function openEdit(m: Measurement) {
    setEditTarget(m)
    setStatus(m.status)
    setAmount(m.amount)
    setRetention(m.retention_percent || 0)
    setModalOpen(true)
  }

  // ── Persistência otimista ──────────────────────────────────
  function persistCreate(formData: FormData, tempId: string, optimistic: Measurement) {
    createMeasurement(contractId, formData)
      .then((res) => {
        if (!res.success || !res.measurement) throw new Error(res.error ?? 'Erro ao salvar medição')
        const saved = res.measurement as unknown as Measurement
        setMeasurements((prev) => prev.map((m) => (m.id === tempId ? saved : m)))
      })
      .catch((err: Error) => {
        setMeasurements((prev) => prev.filter((m) => m.id !== tempId))
        toast.error(err.message || 'Erro ao salvar medição', {
          action: {
            label: 'Tentar novamente',
            onClick: () => {
              setMeasurements((prev) => [...prev, optimistic])
              persistCreate(formData, tempId, optimistic)
            },
          },
        })
      })
  }

  function persistEdit(id: string, formData: FormData, optimistic: Measurement, prev: Measurement) {
    updateMeasurement(id, formData)
      .then((res) => {
        if (!res.success || !res.measurement) throw new Error(res.error ?? 'Erro ao atualizar medição')
        const saved = res.measurement as unknown as Measurement
        setMeasurements((list) => list.map((m) => (m.id === id ? saved : m)))
      })
      .catch((err: Error) => {
        setMeasurements((list) => list.map((m) => (m.id === id ? prev : m)))
        toast.error(err.message || 'Erro ao atualizar medição', {
          action: {
            label: 'Tentar novamente',
            onClick: () => {
              setMeasurements((list) => list.map((m) => (m.id === id ? optimistic : m)))
              persistEdit(id, formData, optimistic, prev)
            },
          },
        })
      })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('status', status)

    const amt = Number(formData.get('amount')) || 0
    const periodStart = (formData.get('period_start') as string) || null
    const periodEnd = (formData.get('period_end') as string) || null
    const progressRaw = formData.get('progress_percent') as string
    const progress = progressRaw ? Number(progressRaw) : null
    const description = (formData.get('description') as string) || null
    // receita esperada (otimista): só quando aprovada/faturada e líquido > 0
    const willHaveReceita = RECEITA_STATUSES.includes(status) && netoMedicao(amt, retention) > 0

    if (editTarget) {
      const prev = editTarget
      const optimistic: Measurement = {
        ...editTarget,
        period_start: periodStart,
        period_end: periodEnd,
        progress_percent: progress,
        amount: amt,
        retention_percent: retention,
        description,
        status,
        financial_entry_id: willHaveReceita ? (editTarget.financial_entry_id ?? 'temp-fe') : null,
      }
      setMeasurements((list) => list.map((m) => (m.id === editTarget.id ? optimistic : m)))
      setModalOpen(false)
      toastAfterClose('Medição atualizada')
      persistEdit(editTarget.id, formData, optimistic, prev)
    } else {
      const tempId = `temp-${Date.now()}`
      const optimistic: Measurement = {
        id: tempId,
        contract_id: contractId,
        project_id: '',
        measurement_number: nextNumber,
        period_start: periodStart,
        period_end: periodEnd,
        progress_percent: progress,
        amount: amt,
        retention_percent: retention,
        description,
        status,
        financial_entry_id: willHaveReceita ? 'temp-fe' : null,
        created_at: new Date().toISOString(),
      }
      setMeasurements((prev) => [...prev, optimistic])
      setModalOpen(false)
      toastAfterClose('Medição registrada')
      persistCreate(formData, tempId, optimistic)
    }
  }

  function performDelete(target: Measurement) {
    setMeasurements((prev) => prev.filter((m) => m.id !== target.id))
    deleteMeasurement(target.id)
      .then((res) => { if (!res.success) throw new Error(res.error) })
      .catch((err: Error) => {
        setMeasurements((prev) => [...prev, target])
        toast.error(err.message || 'Erro ao excluir medição.', {
          action: { label: 'Tentar novamente', onClick: () => performDelete(target) },
        })
      })
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    toastAfterClose('Medição excluída')
    performDelete(target)
  }

  const previewNet = netoMedicao(amount, retention)
  const previewRet = retidoMedicao(amount, retention)
  const willGenerate = RECEITA_STATUSES.includes(status)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-brown transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova Medição
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gold/40 py-16 text-center">
          <p className="text-sm font-medium text-gray-400">Nenhuma medição registrada.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gold/20 bg-cream/30">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Nº</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Período</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">%</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Valor</th>
                  {anyRetention && (
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 hidden sm:table-cell">Ret.</th>
                  )}
                  {anyRetention && (
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 hidden md:table-cell">Líquido</th>
                  )}
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">Receita</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/10">
                {sorted.map((m) => {
                  const badge = statusBadge(m.status)
                  return (
                    <tr key={m.id} className="hover:bg-cream/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-dark">{m.measurement_number}</td>
                      <td className="px-4 py-3 text-gray-600">{periodLabel(m.period_start, m.period_end)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{pct(m.progress_percent)}</td>
                      <td className="px-4 py-3 text-right font-medium text-dark">{formatCurrency(m.amount)}</td>
                      {anyRetention && (
                        <td className="px-4 py-3 text-right text-gray-600 hidden sm:table-cell">
                          {(m.retention_percent || 0) > 0 ? pct(m.retention_percent) : '—'}
                        </td>
                      )}
                      {anyRetention && (
                        <td className="px-4 py-3 text-right text-gray-600 hidden md:table-cell">
                          {formatCurrency(netoMedicao(m.amount, m.retention_percent || 0))}
                        </td>
                      )}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                          style={badge.style}
                        >
                          {MEASUREMENT_STATUS_LABELS[m.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {m.financial_entry_id ? (
                          <Link
                            href="/financeiro"
                            className="inline-flex items-center gap-1 text-xs text-terracotta hover:underline"
                            title="Receita gerada no Financeiro"
                          >
                            {(() => {
                              const n = (m as Measurement & { financial_entries?: { entry_number: number } | null })
                                .financial_entries?.entry_number
                              return n ? formatFinanceNumber(n) : 'Ver receita'
                            })()}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(m)}
                            className="rounded p-1 text-gray-400 hover:text-terracotta transition-colors"
                            title="Editar medição"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(m)}
                            className="rounded p-1 transition-colors"
                            style={{ color: '#8A5A3B' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#8B3A3A')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = '#8A5A3B')}
                            title="Excluir medição"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Nova/Editar Medição */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div
            key={editTarget?.id ?? 'new'}
            className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gold/30 bg-white px-6 py-4">
              <h2 className="font-semibold text-dark">
                {editTarget ? `Editar Medição nº ${editTarget.measurement_number}` : `Nova Medição nº ${nextNumber}`}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded p-1 text-gray-400 hover:text-dark transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelCls}>Início do Período</label>
                  <input
                    name="period_start"
                    type="date"
                    defaultValue={editTarget?.period_start ?? ''}
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Fim do Período</label>
                  <input
                    name="period_end"
                    type="date"
                    defaultValue={editTarget?.period_end ?? today()}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelCls}>% de Avanço (opcional)</label>
                  <input
                    name="progress_percent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    defaultValue={editTarget?.progress_percent ?? ''}
                    placeholder="Ex: 25"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Valor da Medição (R$) *</label>
                  <CurrencyInput
                    name="amount"
                    required
                    defaultValue={editTarget?.amount ?? 0}
                    onValueChange={setAmount}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>% de Retenção</label>
                <input
                  name="retention_percent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={retention}
                  onChange={(e) => setRetention(e.target.value === '' ? 0 : Number(e.target.value))}
                  placeholder="0"
                  className={inputCls}
                />
                <p className="text-xs text-gray-400">
                  Padrão do contrato: {(retentionPercent || 0).toFixed(1).replace('.', ',')}%. Ajustável nesta medição.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as MeasurementStatus)}
                  className={inputCls}
                >
                  {(Object.keys(MEASUREMENT_STATUS_LABELS) as MeasurementStatus[]).map((s) => (
                    <option key={s} value={s}>{MEASUREMENT_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Descrição</label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={editTarget?.description ?? ''}
                  placeholder="Descrição da medição…"
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Preview de retenção / líquido (recalcula em tempo real) */}
              {amount > 0 && (
                <div className="rounded-lg border border-gold/30 bg-cream/30 p-3 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Valor bruto</span>
                    <span>{formatCurrency(amount)}</span>
                  </div>
                  {retention > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Retenção ({retention.toFixed(1).replace('.', ',')}%)</span>
                      <span style={{ color: '#8B3A3A' }}>− {formatCurrency(previewRet)}</span>
                    </div>
                  )}
                  <div className="mt-1 flex justify-between border-t border-gold/30 pt-1 font-semibold text-dark">
                    <span>Líquido a receber</span>
                    <span>{formatCurrency(previewNet)}</span>
                  </div>
                </div>
              )}

              {/* Aviso sobre geração de receita */}
              <p className="text-xs text-gray-400">
                {willGenerate
                  ? `Ao salvar como "${MEASUREMENT_STATUS_LABELS[status]}", uma receita a receber${retention > 0 ? ' (valor líquido)' : ''} será gerada/atualizada no Financeiro.`
                  : 'Medições "Prevista" ou "Medida" ainda não geram receita no Financeiro.'}
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 rounded-lg border border-gold/50 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-[#F9F7F4]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-terracotta py-2.5 text-sm font-medium text-white transition-colors hover:bg-brown"
                >
                  {editTarget ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        title="Excluir medição"
        message="Esta ação remove a medição permanentemente. Se houver receita gerada no Financeiro, ela também será removida."
      />
    </div>
  )
}
