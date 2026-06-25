'use client'

import { useEffect, useState } from 'react'
import { X, Upload, ExternalLink } from 'lucide-react'
import type { EntryType, FinancialEntryStatus, PaymentMethod, CostCategory } from '@/types/database'
import { PAYMENT_METHOD_LABELS } from '@/types/database'
import { updateFinancialEntry } from '@/app/actions/financeiro'
import { formatFinanceNumber } from '@/lib/format'
import { CurrencyInput } from '@/components/ui/currency-input'
import { EntidadeSelect } from './EntidadeSelect'
import { SupplierAccountToggle } from './SupplierAccountToggle'
import { CategoriaSelect, categoryName } from './CategoriaSelect'
import { toast } from 'sonner'
import { toastAfterClose } from '@/lib/ui-feedback'

type EntryWithProject = {
  id: string
  entry_number: number
  project_id: string
  entry_type: EntryType
  entry_date: string
  description: string
  amount: number
  category: string
  category_id: string | null
  payment_method: PaymentMethod | null
  counterpart: string | null
  supplier_id: string | null
  storage_path_proof: string | null
  notes: string | null
  status: FinancialEntryStatus
  payment_date: string | null
  scheduled_date: string | null
  due_date: string | null
  paid_by: string | null
  nf_number: string | null
  in_supplier_account: boolean
  phase_id: string | null
  projects?: { id: string; name: string } | null
  suppliers?: { id: string; name: string } | null
}

const STATUS_OPTIONS: { value: FinancialEntryStatus; label: string; color: string }[] = [
  { value: 'pago',     label: 'Pago',     color: '#4A7C59' },
  { value: 'pendente', label: 'Pendente', color: '#B07D2A' },
  { value: 'agendado', label: 'Agendado', color: '#2A65A0' },
]

const inputCls =
  'w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta'
const labelCls =
  'text-xs font-semibold uppercase tracking-wide text-brown'

interface Props {
  entry:    EntryWithProject
  projects: { id: string; name: string }[]
  suppliers: { id: string; name: string }[]
  clients:  { id: string; name: string }[]
  categories: CostCategory[]
  phases:   { id: string; project_id: string; name: string }[]
  onClose:  () => void
  onSaved:  (updated: EntryWithProject) => void
}

export function EditLancamentoModal({ entry, projects, suppliers, clients, categories, phases, onClose, onSaved }: Props) {
  const [entryType, setEntryType]   = useState<EntryType>(entry.entry_type)
  const [categoryId, setCategoryId] = useState(entry.category_id ?? '')
  const [status,    setStatus]      = useState<FinancialEntryStatus>(entry.status)
  // Fornecedor vinculado + controle na conta corrente (mantém o que estava salvo)
  const [supplierId, setSupplierId] = useState<string | null>(entry.supplier_id ?? null)
  const [inSupplierAccount, setInSupplierAccount] = useState(entry.in_supplier_account)
  // Fase da obra (obrigatória) — a obra é fixa na edição
  const [phaseId, setPhaseId] = useState(entry.phase_id ?? '')
  const [phaseError, setPhaseError] = useState(false)
  const phasesForProject = phases.filter((p) => p.project_id === entry.project_id)

  // Ao trocar Entrada/Saída, limpa a categoria se não for da natureza correspondente
  useEffect(() => {
    setCategoryId((prev) => {
      if (!prev) return prev
      const c = categories.find((x) => x.id === prev)
      return c && c.nature === entryType ? prev : ''
    })
  }, [entryType, categories])
  const [paymentDate,   setPaymentDate]   = useState(entry.payment_date ?? entry.entry_date)
  const [scheduledDate, setScheduledDate] = useState(entry.scheduled_date ?? entry.entry_date)
  // Registros antigos sem vencimento: sugere a própria emissão ao editar
  const [entryDate,  setEntryDate]  = useState(entry.entry_date)
  const [dueDate,    setDueDate]    = useState(entry.due_date ?? entry.entry_date)
  const [dateErrors, setDateErrors] = useState<{ due?: string; payment?: string }>({})

  const projectName = entry.projects?.name
    ?? projects.find((p) => p.id === entry.project_id)?.name
    ?? 'Obra'

  function persist(fd: FormData, optimistic: EntryWithProject) {
    updateFinancialEntry(entry.id, fd)
      .then((result) => {
        if (!result.success || !result.entry) {
          onSaved(entry)
          toast.error(result.error ?? 'Erro ao atualizar lançamento', {
            action: {
              label: 'Tentar novamente',
              onClick: () => { onSaved(optimistic); persist(fd, optimistic) },
            },
          })
        } else {
          onSaved(result.entry as unknown as EntryWithProject)
        }
      })
      .catch(() => {
        onSaved(entry)
        toast.error('Erro ao atualizar lançamento', {
          action: {
            label: 'Tentar novamente',
            onClick: () => { onSaved(optimistic); persist(fd, optimistic) },
          },
        })
      })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    // Fase da obra obrigatória (inclusive lançamentos legados sem fase)
    const validPhase = !!phaseId && phasesForProject.some((p) => p.id === phaseId)
    if (!validPhase) {
      setPhaseError(true)
      if (phasesForProject.length === 0) {
        toast.error('Esta obra não possui fases cadastradas. Cadastre as fases antes de salvar.')
      } else {
        toast.error('Selecione a fase da obra')
        document.getElementById('edit-phase-select')?.focus()
      }
      return
    }

    // Validações de datas
    const errors: { due?: string; payment?: string } = {}
    if (dueDate < entryDate) {
      errors.due = 'O vencimento não pode ser anterior à data de emissão'
    }
    if (status === 'pago' && paymentDate < entryDate) {
      errors.payment = 'O pagamento não pode ser anterior à data de emissão'
    }
    if (errors.due || errors.payment) {
      setDateErrors(errors)
      return
    }

    const fd = new FormData(e.currentTarget)
    fd.set('entry_type', entryType)
    fd.set('category_id', categoryId)
    fd.set('category', categoryName(categories, categoryId))
    fd.set('status', status)
    if (status === 'pago') fd.set('payment_date', paymentDate)
    if (status === 'agendado') fd.set('scheduled_date', scheduledDate)
    fd.set('due_date', dueDate)
    // Só controla na conta corrente quando há fornecedor vinculado
    const controla = !!supplierId && inSupplierAccount
    fd.set('in_supplier_account', controla ? 'true' : 'false')
    // Fase da obra (opcional)
    const fase = phaseId && phasesForProject.some((p) => p.id === phaseId) ? phaseId : ''
    fd.set('phase_id', fase)

    // Atualização otimista: a lista reflete a edição e o modal fecha na hora;
    // a gravação acontece em background com rollback se falhar.
    const optimistic: EntryWithProject = {
      ...entry,
      entry_type:     entryType,
      status,
      supplier_id:    ((fd.get('supplier_id') as string) || null),
      entry_date:     (fd.get('entry_date') as string) || entry.entry_date,
      description:    (fd.get('description') as string) || entry.description,
      amount:         Number(fd.get('amount')) || entry.amount,
      category:       (fd.get('category') as string) || entry.category,
      category_id:    categoryId || entry.category_id,
      payment_method: ((fd.get('payment_method') as PaymentMethod) || null),
      counterpart:    ((fd.get('counterpart') as string) || null),
      notes:          ((fd.get('notes') as string) || null),
      paid_by:        ((fd.get('paid_by') as string) || null),
      nf_number:      ((fd.get('nf_number') as string) || null),
      payment_date:   status === 'pago' ? paymentDate : null,
      scheduled_date: status === 'agendado' ? scheduledDate : null,
      due_date:       dueDate || null,
      in_supplier_account: controla,
      phase_id:       fase || null,
    }

    onSaved(optimistic)
    onClose()
    toastAfterClose('Lançamento atualizado')
    persist(fd, optimistic)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(59,36,24,0.4)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gold/20 px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold text-dark">Editar Lançamento</h2>
            <span
              className="rounded-md px-2.5 py-1 font-mono text-sm font-semibold"
              style={{ backgroundColor: '#F4E2B8', color: '#3B2418' }}
              title="Número do lançamento (não editável)"
            >
              {formatFinanceNumber(entry.entry_number)}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-cream hover:text-dark transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 p-6">

          {/* Toggle Entrada / Saída */}
          <div className="flex rounded-lg border border-gold/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setEntryType('income')}
              className="flex-1 py-2.5 text-sm font-semibold transition-colors"
              style={
                entryType === 'income'
                  ? { backgroundColor: '#4A7C59', color: '#fff' }
                  : { backgroundColor: '#fff', color: '#6b7280' }
              }
            >
              ↑ Entrada
            </button>
            <button
              type="button"
              onClick={() => setEntryType('expense')}
              className="flex-1 py-2.5 text-sm font-semibold transition-colors border-l border-gold/40"
              style={
                entryType === 'expense'
                  ? { backgroundColor: '#8B3A3A', color: '#fff' }
                  : { backgroundColor: '#fff', color: '#6b7280' }
              }
            >
              ↓ Saída
            </button>
          </div>

          {/* Obra (bloqueada) */}
          <div className="space-y-1.5">
            <label className={labelCls}>Obra</label>
            <div className={`${inputCls} bg-cream/40 text-dark cursor-not-allowed`}>
              {projectName}
            </div>
          </div>

          {/* Fase da obra (obrigatória) */}
          <div className="space-y-1.5">
            <label className={labelCls}>Fase da obra <span style={{ color: '#8B3A3A' }}>*</span></label>
            {phasesForProject.length > 0 ? (
              <>
                <select
                  id="edit-phase-select"
                  value={phaseId}
                  onChange={(e) => { setPhaseId(e.target.value); setPhaseError(false) }}
                  className={`${inputCls} ${phaseError ? 'border-[#8B3A3A]' : ''}`}
                >
                  <option value="">Selecione a fase</option>
                  {phasesForProject.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {phaseError && (
                  <p className="text-xs" style={{ color: '#8B3A3A' }}>Selecione a fase da obra</p>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-gold/50 bg-cream/20 px-3 py-2.5 text-xs text-brown">
                Esta obra não possui fases cadastradas. Cadastre as fases na aba Fases e Tarefas.
              </div>
            )}
          </div>

          {/* Data + Valor */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className={labelCls}>Data de Emissão *</label>
              <input
                name="entry_date"
                type="date"
                required
                value={entryDate}
                onChange={(e) => {
                  setEntryDate(e.target.value)
                  setDateErrors({})
                }}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Valor *</label>
              <CurrencyInput name="amount" required defaultValue={entry.amount} className={inputCls} />
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <label className={labelCls}>Descrição *</label>
            <input
              name="description"
              required
              defaultValue={entry.description}
              className={inputCls}
            />
          </div>

          {/* Nº NF + Forma de Pagamento */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className={labelCls}>Nº NF (opcional)</label>
              <input
                name="nf_number"
                defaultValue={entry.nf_number ?? ''}
                placeholder="Ex: 001234"
                inputMode="numeric"
                onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '') }}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Forma de Pagamento</label>
              <select name="payment_method" defaultValue={entry.payment_method ?? ''} className={inputCls}>
                <option value="">Selecionar…</option>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <label className={labelCls}>Categoria *</label>
            <CategoriaSelect
              categories={categories}
              entryType={entryType}
              value={categoryId}
              onChange={setCategoryId}
              className={inputCls}
            />
          </div>

          {/* Entidade (cliente ou fornecedor) + Pago por */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <EntidadeSelect
              entryType={entryType}
              initialClients={clients}
              initialSuppliers={suppliers}
              defaultSupplierId={entry.supplier_id ?? undefined}
              defaultCounterpart={entry.counterpart ?? entry.suppliers?.name ?? undefined}
              onSupplierChange={setSupplierId}
            />
            <div className="space-y-1.5">
              <label className={labelCls}>Pago por</label>
              <input
                name="paid_by"
                defaultValue={entry.paid_by ?? ''}
                placeholder="Nome de quem pagou"
                className={inputCls}
              />
            </div>
          </div>

          {/* Controle na conta corrente — só quando há fornecedor vinculado */}
          {supplierId && (
            <SupplierAccountToggle enabled={inSupplierAccount} onChange={setInSupplierAccount} />
          )}

          {/* Status */}
          <div className="space-y-1.5">
            <label className={labelCls}>Status</label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map(({ value, label, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(value)}
                  className="rounded-full border px-4 py-1.5 text-xs font-medium transition-colors"
                  style={
                    status === value
                      ? { backgroundColor: color, borderColor: color, color: '#fff' }
                      : { borderColor: '#d1d5db', color: '#6b7280' }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Vencimento (sempre) + campo condicional pelo status */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className={labelCls}>Data de Vencimento *</label>
              <input
                name="due_date"
                type="date"
                required
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value)
                  setDateErrors((prev) => ({ ...prev, due: undefined }))
                }}
                className={inputCls}
              />
              {dateErrors.due && (
                <p className="text-xs" style={{ color: '#8B3A3A' }}>{dateErrors.due}</p>
              )}
            </div>

            {status === 'pago' && (
              <div className="space-y-1.5 form-slide-down">
                <label className={labelCls}>Data do Pagamento *</label>
                <input
                  name="payment_date"
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => {
                    setPaymentDate(e.target.value)
                    setDateErrors((prev) => ({ ...prev, payment: undefined }))
                  }}
                  className={inputCls}
                />
                {dateErrors.payment && (
                  <p className="text-xs" style={{ color: '#8B3A3A' }}>{dateErrors.payment}</p>
                )}
              </div>
            )}

            {status === 'agendado' && (
              <div className="space-y-1.5 form-slide-down">
                <label className={labelCls}>Data do Agendamento *</label>
                <input
                  name="scheduled_date"
                  type="date"
                  required
                  value={scheduledDate}
                  onChange={e => setScheduledDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            )}
          </div>

          {/* Comprovante */}
          <div className="space-y-1.5">
            <label className={labelCls}>Comprovante</label>
            {entry.storage_path_proof && (
              <a
                href={entry.storage_path_proof}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-2 flex items-center gap-1.5 text-xs text-terracotta hover:text-brown transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver comprovante atual
              </a>
            )}
            <label className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gold/50 px-3 py-2.5 text-sm text-gray-400 hover:border-terracotta hover:text-terracotta transition-colors">
              <Upload className="h-4 w-4" />
              <span>
                {entry.storage_path_proof ? 'Substituir comprovante (opcional)' : 'Anexar arquivo (opcional)'}
              </span>
              <input
                name="proof"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
              />
            </label>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <label className={labelCls}>Observações</label>
            <textarea
              name="notes"
              rows={3}
              defaultValue={entry.notes ?? ''}
              placeholder="Observações opcionais…"
              className="w-full resize-none rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>

          {/* Ações */}
          <div className="flex items-center justify-end gap-3 border-t border-gold/20 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gold/50 px-5 py-2.5 text-sm font-medium text-dark hover:bg-cream transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-terracotta px-6 py-2.5 text-sm font-medium text-white hover:bg-brown disabled:opacity-60 transition-colors"
            >
              Salvar alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
