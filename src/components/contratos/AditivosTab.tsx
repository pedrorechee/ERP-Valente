'use client'

import { useMemo, useState } from 'react'
import { Plus, X, Pencil, Trash2, FileText } from 'lucide-react'
import type { ContractAmendment, AmendmentType } from '@/types/database'
import { AMENDMENT_TYPE_LABELS } from '@/types/database'
import { formatCurrency, formatDate } from '@/lib/format'
import { CurrencyInput } from '@/components/ui/currency-input'
import {
  createAmendment,
  updateAmendment,
  deleteAmendment,
  getContractDocUrl,
} from '@/app/actions/contratos'
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal'
import { toast } from 'sonner'
import { toastAfterClose } from '@/lib/ui-feedback'

interface Props {
  contractId:    string
  amendments:    ContractAmendment[]
  setAmendments: React.Dispatch<React.SetStateAction<ContractAmendment[]>>
}

const inputCls =
  'w-full rounded-lg border border-gold/50 bg-white px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta'
const labelCls = 'text-xs font-semibold uppercase tracking-wide text-brown'

function valueDisplay(value: number): { text: string; color: string } {
  if (value > 0) return { text: `+ ${formatCurrency(value)}`, color: '#4A7C59' }
  if (value < 0) return { text: `− ${formatCurrency(Math.abs(value))}`, color: '#8B3A3A' }
  return { text: '—', color: '#9ca3af' }
}

function daysDisplay(days: number): { text: string; color: string } {
  if (days > 0) return { text: `+${days} dias`, color: '#4A7C59' }
  if (days < 0) return { text: `${days} dias`, color: '#8B3A3A' }
  return { text: '—', color: '#9ca3af' }
}

const today = () => new Date().toISOString().slice(0, 10)

export function AditivosTab({ contractId, amendments, setAmendments }: Props) {
  const [modalOpen, setModalOpen]   = useState(false)
  const [editTarget, setEditTarget] = useState<ContractAmendment | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ContractAmendment | null>(null)

  // Campos controlados do modal
  const [type, setType] = useState<AmendmentType>('valor')
  const [sign, setSign] = useState<'+' | '-'>('+')

  const sorted = useMemo(
    () => [...amendments].sort((a, b) => a.amendment_number - b.amendment_number),
    [amendments],
  )
  const nextNumber = useMemo(
    () => (amendments.length ? Math.max(...amendments.map((a) => a.amendment_number)) + 1 : 1),
    [amendments],
  )

  function openCreate() {
    setEditTarget(null)
    setType('valor')
    setSign('+')
    setModalOpen(true)
  }

  function openEdit(a: ContractAmendment) {
    setEditTarget(a)
    setType(a.type)
    setSign(a.value_change < 0 ? '-' : '+')
    setModalOpen(true)
  }

  async function viewDoc(path: string) {
    const res = await getContractDocUrl(path)
    if (res.success && res.url) window.open(res.url, '_blank')
    else toast.error(res.error || 'Erro ao abrir o documento')
  }

  // ── Persistência otimista ──────────────────────────────────
  function persistCreate(formData: FormData, tempId: string, optimistic: ContractAmendment) {
    createAmendment(contractId, formData)
      .then((res) => {
        if (!res.success || !res.amendment) throw new Error(res.error ?? 'Erro ao salvar aditivo')
        const saved = res.amendment as unknown as ContractAmendment
        setAmendments((prev) => prev.map((a) => (a.id === tempId ? saved : a)))
      })
      .catch((err: Error) => {
        setAmendments((prev) => prev.filter((a) => a.id !== tempId))
        toast.error(err.message || 'Erro ao salvar aditivo', {
          action: {
            label: 'Tentar novamente',
            onClick: () => {
              setAmendments((prev) => [...prev, optimistic])
              persistCreate(formData, tempId, optimistic)
            },
          },
        })
      })
  }

  function persistEdit(amendmentId: string, formData: FormData, optimistic: ContractAmendment, prev: ContractAmendment) {
    updateAmendment(amendmentId, formData)
      .then((res) => {
        if (!res.success || !res.amendment) throw new Error(res.error ?? 'Erro ao atualizar aditivo')
        const saved = res.amendment as unknown as ContractAmendment
        setAmendments((list) => list.map((a) => (a.id === amendmentId ? saved : a)))
      })
      .catch((err: Error) => {
        setAmendments((list) => list.map((a) => (a.id === amendmentId ? prev : a)))
        toast.error(err.message || 'Erro ao atualizar aditivo', {
          action: {
            label: 'Tentar novamente',
            onClick: () => {
              setAmendments((list) => list.map((a) => (a.id === amendmentId ? optimistic : a)))
              persistEdit(amendmentId, formData, optimistic, prev)
            },
          },
        })
      })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const signedValue = (sign === '-' ? -1 : 1) * (Number(formData.get('value_change')) || 0)
    formData.set('value_change', String(signedValue))
    formData.set('type', type)

    const date = (formData.get('date') as string) || today()
    const days = Math.trunc(Number(formData.get('days_change')) || 0)
    const description = (formData.get('description') as string) || null

    if (editTarget) {
      const prev = editTarget
      const optimistic: ContractAmendment = {
        ...editTarget,
        type,
        value_change: signedValue,
        days_change: days,
        date,
        description,
      }
      setAmendments((list) => list.map((a) => (a.id === editTarget.id ? optimistic : a)))
      setModalOpen(false)
      toastAfterClose('Aditivo atualizado')
      persistEdit(editTarget.id, formData, optimistic, prev)
    } else {
      const tempId = `temp-${Date.now()}`
      const optimistic: ContractAmendment = {
        id: tempId,
        contract_id: contractId,
        amendment_number: nextNumber,
        type,
        value_change: signedValue,
        days_change: days,
        date,
        description,
        document_path: null,
        created_at: new Date().toISOString(),
      }
      setAmendments((prev) => [...prev, optimistic])
      setModalOpen(false)
      toastAfterClose('Aditivo registrado')
      persistCreate(formData, tempId, optimistic)
    }
  }

  function performDelete(target: ContractAmendment) {
    setAmendments((prev) => prev.filter((a) => a.id !== target.id))
    deleteAmendment(target.id)
      .then((res) => { if (!res.success) throw new Error(res.error) })
      .catch((err: Error) => {
        setAmendments((prev) => [...prev, target])
        toast.error(err.message || 'Erro ao excluir aditivo.', {
          action: { label: 'Tentar novamente', onClick: () => performDelete(target) },
        })
      })
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    toastAfterClose('Aditivo excluído')
    performDelete(target)
  }

  const showValue = type === 'valor' || type === 'valor_prazo'
  const showDays  = type === 'prazo' || type === 'valor_prazo'

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-brown transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Aditivo
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gold/40 py-16 text-center">
          <p className="text-sm font-medium text-gray-400">Nenhum aditivo registrado.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gold/20 bg-cream/30">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Nº</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Tipo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Valor</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Prazo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 hidden md:table-cell">Descrição</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/10">
                {sorted.map((a) => {
                  const v = valueDisplay(a.value_change)
                  const d = daysDisplay(a.days_change)
                  return (
                    <tr key={a.id} className="hover:bg-cream/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-dark">{a.amendment_number}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(a.date)}</td>
                      <td className="px-4 py-3 text-gray-600">{AMENDMENT_TYPE_LABELS[a.type]}</td>
                      <td className="px-4 py-3 text-right font-medium" style={{ color: v.color }}>{v.text}</td>
                      <td className="px-4 py-3 text-right font-medium" style={{ color: d.color }}>{d.text}</td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{a.description || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {a.document_path && (
                            <button
                              onClick={() => viewDoc(a.document_path!)}
                              className="rounded p-1 text-gray-400 hover:text-terracotta transition-colors"
                              title="Ver documento"
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(a)}
                            className="rounded p-1 text-gray-400 hover:text-terracotta transition-colors"
                            title="Editar aditivo"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(a)}
                            className="rounded p-1 transition-colors"
                            style={{ color: '#8A5A3B' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#8B3A3A')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = '#8A5A3B')}
                            title="Excluir aditivo"
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

      {/* Modal Novo/Editar Aditivo */}
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
                {editTarget ? `Editar Aditivo nº ${editTarget.amendment_number}` : `Novo Aditivo nº ${nextNumber}`}
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
                  <label className={labelCls}>Tipo *</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as AmendmentType)}
                    className={inputCls}
                  >
                    {(Object.keys(AMENDMENT_TYPE_LABELS) as AmendmentType[]).map((t) => (
                      <option key={t} value={t}>{AMENDMENT_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Data *</label>
                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={editTarget?.date ?? today()}
                    className={inputCls}
                  />
                </div>
              </div>

              {showValue && (
                <div className="space-y-1.5">
                  <label className={labelCls}>Valor</label>
                  <div className="flex gap-2">
                    <div className="flex rounded-lg border border-gold/50 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setSign('+')}
                        className={`px-3 py-2 text-sm font-medium transition-colors ${
                          sign === '+' ? 'bg-green-500 text-white' : 'text-gray-500 hover:bg-gray-50'
                        }`}
                        title="Acréscimo"
                      >
                        + Acréscimo
                      </button>
                      <button
                        type="button"
                        onClick={() => setSign('-')}
                        className={`px-3 py-2 text-sm font-medium transition-colors ${
                          sign === '-' ? 'bg-red-500 text-white' : 'text-gray-500 hover:bg-gray-50'
                        }`}
                        title="Supressão"
                      >
                        − Supressão
                      </button>
                    </div>
                    <CurrencyInput
                      name="value_change"
                      defaultValue={editTarget ? Math.abs(editTarget.value_change) : 0}
                      className={`${inputCls} flex-1`}
                    />
                  </div>
                </div>
              )}

              {showDays && (
                <div className="space-y-1.5">
                  <label className={labelCls}>Dias de prazo (+/−)</label>
                  <input
                    name="days_change"
                    type="number"
                    step="1"
                    defaultValue={editTarget?.days_change || ''}
                    placeholder="Ex: 30 ou -15"
                    className={inputCls}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className={labelCls}>Descrição / Motivo</label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={editTarget?.description ?? ''}
                  placeholder="Motivo do aditivo…"
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>
                  Documento (PDF) {editTarget?.document_path && '(substituir)'}
                </label>
                <input
                  name="document"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm text-gray-500 file:mr-3 file:rounded file:border-0 file:bg-terracotta/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-terracotta hover:file:bg-terracotta/20"
                />
              </div>

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
        title="Excluir aditivo"
        message="Esta ação remove o aditivo permanentemente. O Valor Total e o Prazo do contrato serão recalculados."
      />
    </div>
  )
}
