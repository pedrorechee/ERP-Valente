'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { EntryType, FinancialEntry, CostCategory } from '@/types/database'
import { PAYMENT_METHOD_LABELS } from '@/types/database'
import { createFinancialEntry } from '@/app/actions/financeiro'
import { toast } from 'sonner'
import { CurrencyInput } from '@/components/ui/currency-input'
import { EntidadeSelect } from './EntidadeSelect'
import { SupplierAccountToggle } from './SupplierAccountToggle'
import { CategoriaSelect, categoryName } from './CategoriaSelect'
import { toastAfterClose } from '@/lib/ui-feedback'

export type CreatedFinancialEntry = FinancialEntry & {
  projects?: { id: string; name: string } | null
}

type EntryStatus = 'pago' | 'pendente' | 'agendado'

const STATUS_OPTIONS: { value: EntryStatus; label: string; activeClass: string }[] = [
  { value: 'pago', label: 'Pago', activeClass: 'bg-green-500 border-green-500 text-white' },
  { value: 'pendente', label: 'Pendente', activeClass: 'bg-yellow-500 border-yellow-500 text-white' },
  { value: 'agendado', label: 'Agendado', activeClass: 'bg-blue-500 border-blue-500 text-white' },
]

interface Props {
  projects: { id: string; name: string }[]
  suppliers?: { id: string; name: string }[]
  clients?: { id: string; name: string }[]
  categories: CostCategory[]
  preSelectedObraId?: string
  preSelectedSupplierId?: string
  preSelectedSupplierName?: string
  defaultEntryType?: EntryType
  defaultStatus?: EntryStatus
  onClose: () => void
  /** Adiciona o lançamento otimista na lista do pai (id temporário) */
  onOptimistic?: (entry: CreatedFinancialEntry) => void
  /** Troca o registro temporário pelo salvo (ou remove, se saved = null) */
  onSettled?: (tempId: string, saved: CreatedFinancialEntry | null) => void
}

export function LancamentoModal({
  projects,
  suppliers = [],
  clients = [],
  categories,
  preSelectedObraId,
  preSelectedSupplierId,
  preSelectedSupplierName,
  defaultEntryType = 'expense',
  defaultStatus = 'pago',
  onClose,
  onOptimistic,
  onSettled,
}: Props) {
  const [entryType, setEntryType] = useState<EntryType>(defaultEntryType)
  const [categoryId, setCategoryId] = useState('')
  const [status, setStatus] = useState<EntryStatus>(defaultStatus)
  // Fornecedor vinculado (pré-selecionado ou escolhido) + controle na conta corrente
  const [supplierId, setSupplierId] = useState<string | null>(preSelectedSupplierId ?? null)
  const [inSupplierAccount, setInSupplierAccount] = useState(true)
  const [paymentDate,   setPaymentDate]   = useState(() => new Date().toISOString().split('T')[0])
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().split('T')[0])

  const today = new Date().toISOString().split('T')[0]

  // Ao trocar Entrada/Saída, limpa a categoria se não for da natureza correspondente
  useEffect(() => {
    setCategoryId((prev) => {
      if (!prev) return prev
      const c = categories.find((x) => x.id === prev)
      return c && c.nature === entryType ? prev : ''
    })
  }, [entryType, categories])

  function buildOptimistic(formData: FormData, tempId: string): CreatedFinancialEntry {
    const projectId = formData.get('project_id') as string
    const nowIso = new Date().toISOString()
    return {
      id:                 tempId,
      entry_number:       0, // gerado pelo banco ao salvar; substituído no onSettled
      project_id:         projectId,
      entry_type:         entryType,
      entry_date:         formData.get('entry_date') as string,
      description:        formData.get('description') as string,
      amount:             Number(formData.get('amount')),
      category:           formData.get('category') as string,
      category_id:        ((formData.get('category_id') as string) || null),
      payment_method:     ((formData.get('payment_method') as string) || null) as CreatedFinancialEntry['payment_method'],
      counterpart:        ((formData.get('counterpart') as string) || null),
      supplier_id:        ((formData.get('supplier_id') as string) || null),
      phase_id:           ((formData.get('phase_id') as string) || null),
      storage_path_proof: null,
      notes:              ((formData.get('notes') as string) || null),
      status,
      payment_date:       status === 'pago' ? ((formData.get('payment_date') as string) || null) : null,
      scheduled_date:     status === 'agendado' ? ((formData.get('scheduled_date') as string) || null) : null,
      due_date:           status === 'pendente' ? ((formData.get('due_date') as string) || null) : null,
      paid_by:            ((formData.get('paid_by') as string) || null),
      nf_number:          ((formData.get('nf_number') as string) || null),
      in_supplier_account: (formData.get('in_supplier_account') as string) === 'true',
      created_by:         null,
      created_at:         nowIso,
      updated_at:         nowIso,
      projects:           projects.find((p) => p.id === projectId) ?? null,
    }
  }

  function persist(formData: FormData, tempId: string, optimistic: CreatedFinancialEntry) {
    createFinancialEntry(formData)
      .then((result) => {
        if (!result.success || !result.entry) throw new Error(result.error ?? 'Erro ao registrar lançamento')
        onSettled?.(tempId, result.entry as unknown as CreatedFinancialEntry)
      })
      .catch((err: Error) => {
        onSettled?.(tempId, null)
        toast.error(err.message || 'Erro ao registrar lançamento', {
          action: {
            label: 'Tentar novamente',
            onClick: () => {
              onOptimistic?.(optimistic)
              persist(formData, tempId, optimistic)
            },
          },
        })
      })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('entry_type', entryType)
    formData.set('category_id', categoryId)
    formData.set('category', categoryName(categories, categoryId))
    formData.set('status', status)
    if (status === 'pago') formData.set('payment_date', paymentDate)
    if (status === 'agendado') formData.set('scheduled_date', scheduledDate)
    // Só controla na conta corrente quando há fornecedor vinculado
    formData.set('in_supplier_account', supplierId && inSupplierAccount ? 'true' : 'false')

    // Atualização otimista: o lançamento entra na lista e o modal fecha na hora;
    // a gravação (incluindo upload de comprovante) roda em background com rollback.
    const tempId = `temp-${Date.now()}`
    const optimistic = buildOptimistic(formData, tempId)
    onOptimistic?.(optimistic)
    onClose()
    toastAfterClose('Lançamento registrado')
    persist(formData, tempId, optimistic)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gold/30 bg-white px-6 py-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="font-semibold text-dark">Novo Lançamento</h2>
            <span className="text-xs" style={{ color: '#8A5A3B' }}>Nº será gerado ao salvar</span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:text-dark transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Entry type */}
          <div className="flex rounded-lg border border-gold/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setEntryType('income')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                entryType === 'income'
                  ? 'bg-green-500 text-white'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              Entrada
            </button>
            <button
              type="button"
              onClick={() => setEntryType('expense')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                entryType === 'expense'
                  ? 'bg-red-500 text-white'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              Saída
            </button>
          </div>

          {/* Obra */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">
              Obra *
            </label>
            {preSelectedObraId ? (
              <>
                <input type="hidden" name="project_id" value={preSelectedObraId} />
                <div className="w-full rounded-lg border border-gold/50 bg-cream/30 px-3 py-2 text-sm text-dark">
                  {projects.find((p) => p.id === preSelectedObraId)?.name ?? 'Obra selecionada'}
                </div>
              </>
            ) : (
              <select
                name="project_id"
                required
                className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              >
                <option value="">Selecionar obra...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Date + Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-brown">
                Data *
              </label>
              <input
                name="entry_date"
                type="date"
                required
                defaultValue={today}
                className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-brown">
                Valor (R$) *
              </label>
              <CurrencyInput
                name="amount"
                required
                className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">
              Descrição *
            </label>
            <input
              name="description"
              required
              placeholder="Breve descrição do lançamento"
              className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>

          {/* NF + Payment method */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-brown">
                Nº NF (opcional)
              </label>
              <input
                name="nf_number"
                placeholder="Ex: 001234"
                inputMode="numeric"
                onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '') }}
                className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-brown">
                Forma de Pgto
              </label>
              <select
                name="payment_method"
                className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              >
                <option value="">Selecionar...</option>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">
              Categoria *
            </label>
            <CategoriaSelect
              categories={categories}
              entryType={entryType}
              value={categoryId}
              onChange={setCategoryId}
              className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>

          {/* Supplier / Client (pre-selected if coming from a supplier context) */}
          {preSelectedSupplierId ? (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-brown">
                Fornecedor / Prestador
              </label>
              <input type="hidden" name="supplier_id" value={preSelectedSupplierId} />
              <input type="hidden" name="counterpart" value={preSelectedSupplierName ?? ''} />
              <div className="w-full rounded-lg border border-gold/50 bg-cream/30 px-3 py-2 text-sm text-dark">
                {preSelectedSupplierName}
              </div>
            </div>
          ) : (
            <EntidadeSelect
              entryType={entryType}
              initialClients={clients}
              initialSuppliers={suppliers}
              onSupplierChange={setSupplierId}
            />
          )}

          {/* Controle na conta corrente — só quando há fornecedor vinculado */}
          {supplierId && (
            <SupplierAccountToggle enabled={inSupplierAccount} onChange={setInSupplierAccount} />
          )}

          {/* Paid by */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">
              Pago por
            </label>
            <input
              name="paid_by"
              placeholder="Nome de quem pagou"
              className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">
              Status
            </label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map(({ value, label, activeClass }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    status === value
                      ? activeClass
                      : 'border-gray-300 text-gray-500 hover:border-gold'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {status === 'pago' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-brown">
                Data do Pagamento *
              </label>
              <input
                name="payment_date"
                type="date"
                required
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              />
            </div>
          )}

          {status === 'agendado' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-brown">
                Data Agendada *
              </label>
              <input
                name="scheduled_date"
                type="date"
                required
                value={scheduledDate}
                onChange={e => setScheduledDate(e.target.value)}
                className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              />
            </div>
          )}

          {/* Proof */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">
              Comprovante (NF, boleto, recibo)
            </label>
            <input
              name="proof"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm text-gray-500 file:mr-3 file:rounded file:border-0 file:bg-terracotta/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-terracotta hover:file:bg-terracotta/20"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">
              Observações
            </label>
            <textarea
              name="notes"
              rows={2}
              placeholder="Observações opcionais..."
              className="w-full resize-none rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-terracotta px-5 py-2.5 text-sm font-medium text-white hover:bg-brown disabled:opacity-60 transition-colors"
            >
              Registrar Lançamento
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gold/50 px-4 py-2.5 text-sm font-medium text-dark hover:bg-cream transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
