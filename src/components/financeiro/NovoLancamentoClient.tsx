'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Upload } from 'lucide-react'
import type { EntryType, CostCategory } from '@/types/database'
import { PAYMENT_METHOD_LABELS } from '@/types/database'
import { createFinancialEntry, createRecurringFinancialEntries } from '@/app/actions/financeiro'
import { CategoriaSelect, categoryName } from './CategoriaSelect'
import {
  generateRecurrenceDates,
  RECURRENCE_LIMIT,
  RECURRENCE_FREQUENCY_LABELS,
  type RecurrenceFrequency,
} from '@/lib/recurrence'
import { toast } from 'sonner'
import { toastAfterClose } from '@/lib/ui-feedback'
import { CurrencyInput } from '@/components/ui/currency-input'
import { EntidadeSelect } from './EntidadeSelect'
import { SupplierAccountToggle } from './SupplierAccountToggle'

type EntryStatus = 'pago' | 'pendente' | 'agendado'

const STATUS_OPTIONS: { value: EntryStatus; label: string; color: string }[] = [
  { value: 'pago',     label: 'Pago',     color: '#4A7C59' },
  { value: 'pendente', label: 'Pendente', color: '#B07D2A' },
  { value: 'agendado', label: 'Agendado', color: '#2A65A0' },
]

// Valores iniciais ao duplicar um lançamento existente (data fica sempre hoje)
export interface InitialValues {
  project_id?:     string
  entry_type?:     EntryType
  description?:    string
  amount?:         number
  category?:       string
  category_id?:    string | null
  payment_method?: string
  counterpart?:    string | null
  supplier_id?:    string | null
  paid_by?:        string | null
  notes?:          string | null
}

interface Props {
  projects:           { id: string; name: string }[]
  suppliers:          { id: string; name: string }[]
  clients:            { id: string; name: string }[]
  categories:         CostCategory[]
  phases:             { id: string; project_id: string; name: string }[]
  preSelectedObraId?: string
  initialValues?:     InitialValues
}

const inputCls =
  'w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta'
const labelCls =
  'text-xs font-semibold uppercase tracking-wide text-brown'

export function NovoLancamentoClient({ projects, suppliers, clients, categories, phases, preSelectedObraId, initialValues }: Props) {
  const router = useRouter()
  const [entryType, setEntryType]     = useState<EntryType>(initialValues?.entry_type ?? 'expense')
  const [categoryId, setCategoryId]   = useState(initialValues?.category_id ?? '')
  const [status,    setStatus]        = useState<EntryStatus>('pago')
  // Fornecedor selecionado + controle na conta corrente (ligado por padrão)
  const [supplierId, setSupplierId]   = useState<string | null>(initialValues?.supplier_id ?? null)
  const [inSupplierAccount, setInSupplierAccount] = useState(true)
  // Obra selecionada + fase opcional (para orçado x realizado por etapa)
  const [projectId, setProjectId]     = useState(preSelectedObraId ?? initialValues?.project_id ?? '')
  const [phaseId,   setPhaseId]       = useState('')
  const [phaseError, setPhaseError]   = useState(false)
  const phasesForProject = useMemo(
    () => phases.filter((p) => p.project_id === projectId),
    [phases, projectId],
  )

  // Ao trocar Entrada/Saída, limpa a categoria se não for da natureza correspondente
  useEffect(() => {
    setCategoryId((prev) => {
      if (!prev) return prev
      const c = categories.find((x) => x.id === prev)
      return c && c.nature === entryType ? prev : ''
    })
  }, [entryType, categories])
  const [paymentDate,   setPaymentDate]   = useState(() => new Date().toISOString().split('T')[0])
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().split('T')[0])

  // Datas de emissão e vencimento (vencimento acompanha a emissão até ser editado)
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split('T')[0])
  const [dueDate,   setDueDate]   = useState(() => new Date().toISOString().split('T')[0])
  const [dueDirty,  setDueDirty]  = useState(false)
  const [dateErrors, setDateErrors] = useState<{ due?: string; payment?: string }>({})

  // Recorrência
  const [recorrente, setRecorrente] = useState(false)
  const [frequencia, setFrequencia] = useState<RecurrenceFrequency>('mensal')
  const [repetirAte, setRepetirAte] = useState('')

  const today = new Date().toISOString().split('T')[0]

  function handleEntryDateChange(value: string) {
    setEntryDate(value)
    if (!dueDirty) setDueDate(value)
    setDateErrors({})
  }

  function persist(fd: FormData) {
    createFinancialEntry(fd)
      .then((result) => {
        if (!result.success) throw new Error(result.error ?? 'Erro ao registrar lançamento')
      })
      .catch((err: Error) => {
        toast.error(err.message || 'Erro ao registrar lançamento', {
          action: { label: 'Tentar novamente', onClick: () => persist(fd) },
        })
      })
  }

  function persistRecurring(fd: FormData) {
    createRecurringFinancialEntries(fd)
      .then((result) => {
        if (!result.success) throw new Error(result.error ?? 'Erro ao registrar lançamentos')
      })
      .catch((err: Error) => {
        toast.error(err.message || 'Erro ao registrar lançamentos', {
          action: { label: 'Tentar novamente', onClick: () => persistRecurring(fd) },
        })
      })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('entry_type', entryType)
    fd.set('category_id', categoryId)
    fd.set('category', categoryName(categories, categoryId))
    // Só controla na conta corrente quando há fornecedor vinculado
    fd.set('in_supplier_account', supplierId && inSupplierAccount ? 'true' : 'false')
    // Fase da obra (obrigatória quando há obra selecionada)
    const validPhase = !!phaseId && phasesForProject.some((p) => p.id === phaseId)
    if (projectId && !validPhase) {
      setPhaseError(true)
      if (phasesForProject.length === 0) {
        toast.error('Esta obra não possui fases cadastradas. Cadastre as fases antes de lançar.')
      } else {
        toast.error('Selecione a fase da obra')
        document.getElementById('novo-phase-select')?.focus()
      }
      return
    }
    fd.set('phase_id', phaseId)

    // Validações de datas (apenas no fluxo normal; recorrente gera as próprias datas)
    if (!recorrente) {
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
      fd.set('due_date', dueDate)
    }

    if (recorrente) {
      const startDate = (fd.get('entry_date') as string) || today
      if (!repetirAte) {
        toast.error('Informe a data final da recorrência')
        return
      }
      const dates = generateRecurrenceDates(startDate, repetirAte, frequencia)
      if (dates.length === 0) {
        toast.error('A data final é anterior à data do lançamento')
        return
      }
      if (dates.length > RECURRENCE_LIMIT) {
        toast.error(`Limite de ${RECURRENCE_LIMIT} repetições excedido — encurte o período ou mude a frequência`)
        return
      }
      fd.set('recurrence_frequency', frequencia)
      fd.set('recurrence_until', repetirAte)

      router.push('/financeiro')
      toastAfterClose(`${dates.length} lançamentos agendados registrados`)
      persistRecurring(fd)
      return
    }

    fd.set('status', status)
    if (status === 'pago') fd.set('payment_date', paymentDate)
    if (status === 'agendado') fd.set('scheduled_date', scheduledDate)

    // Navegação otimista: volta ao financeiro na hora; a gravação roda em background
    // e a lista é atualizada pela revalidação quando o insert conclui.
    router.push('/financeiro')
    toastAfterClose('Lançamento registrado')
    persist(fd)
  }

  return (
    <div className="space-y-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href="/financeiro"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-dark transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Financeiro
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-dark">Novo Lançamento</span>
      </div>

      <h1 className="text-2xl font-bold text-dark">Novo Lançamento</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-gold/40 bg-white p-6 shadow-sm space-y-5">

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

          {/* Obra */}
          <div className="space-y-1.5">
            <label className={labelCls}>Obra *</label>
            {preSelectedObraId ? (
              <>
                <input type="hidden" name="project_id" value={preSelectedObraId} />
                <div className={`${inputCls} bg-cream/30 text-dark`}>
                  {projects.find((p) => p.id === preSelectedObraId)?.name ?? 'Obra selecionada'}
                </div>
              </>
            ) : (
              <select
                name="project_id"
                required
                value={projectId}
                onChange={(e) => { setProjectId(e.target.value); setPhaseId(''); setPhaseError(false) }}
                className={inputCls}
              >
                <option value="">Selecionar obra…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Fase da obra (obrigatória) — habilita após escolher a obra */}
          {projectId && (
            <div className="space-y-1.5">
              <label className={labelCls}>Fase da obra <span style={{ color: '#8B3A3A' }}>*</span></label>
              {phasesForProject.length > 0 ? (
                <>
                  <select
                    id="novo-phase-select"
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
                  Esta obra não possui fases cadastradas. Cadastre as fases na aba{' '}
                  <Link href={`/obras/${projectId}?tab=fases`} className="font-semibold text-terracotta hover:underline">
                    Fases e Tarefas
                  </Link>.
                </div>
              )}
            </div>
          )}

          {/* Data + Valor */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className={labelCls}>Data de Emissão *</label>
              <input
                name="entry_date"
                type="date"
                required
                value={entryDate}
                onChange={(e) => handleEntryDateChange(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Valor *</label>
              <CurrencyInput name="amount" required defaultValue={initialValues?.amount} className={inputCls} />
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <label className={labelCls}>Descrição *</label>
            <input
              name="description"
              required
              defaultValue={initialValues?.description ?? ''}
              placeholder="Breve descrição do lançamento"
              className={inputCls}
            />
          </div>

          {/* Nº NF + Forma de Pagamento */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className={labelCls}>Nº NF (opcional)</label>
              <input
                name="nf_number"
                placeholder="Ex: 001234"
                inputMode="numeric"
                onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '') }}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Forma de Pagamento</label>
              <select name="payment_method" defaultValue={initialValues?.payment_method ?? ''} className={inputCls}>
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
              defaultSupplierId={initialValues?.supplier_id ?? undefined}
              defaultCounterpart={initialValues?.counterpart ?? undefined}
              onSupplierChange={setSupplierId}
            />
            <div className="space-y-1.5">
              <label className={labelCls}>Pago por</label>
              <input
                name="paid_by"
                defaultValue={initialValues?.paid_by ?? ''}
                placeholder="Nome de quem pagou"
                className={inputCls}
              />
            </div>
          </div>

          {/* Controle na conta corrente — só quando há fornecedor vinculado */}
          {supplierId && (
            <SupplierAccountToggle enabled={inSupplierAccount} onChange={setInSupplierAccount} />
          )}

          {/* Status (oculto quando recorrente: tudo é criado como agendado) */}
          {!recorrente && (
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
          )}

          {/* Vencimento (sempre) + campo condicional pelo status */}
          {!recorrente && (
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
                    setDueDirty(true)
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
          )}

          {/* Recorrente */}
          <div className="space-y-3 rounded-lg border border-gold/30 bg-cream/20 p-4">
            <div className="flex items-center justify-between">
              <label className={labelCls}>Recorrente</label>
              <button
                type="button"
                role="switch"
                aria-checked={recorrente}
                onClick={() => setRecorrente((v) => !v)}
                className="relative h-6 w-11 rounded-full transition-colors"
                style={{ backgroundColor: recorrente ? '#C68B59' : '#d1d5db' }}
              >
                <span
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                  style={{ left: recorrente ? '22px' : '2px' }}
                />
              </button>
            </div>

            {recorrente && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className={labelCls}>Frequência *</label>
                    <select
                      value={frequencia}
                      onChange={(e) => setFrequencia(e.target.value as RecurrenceFrequency)}
                      className={inputCls}
                    >
                      {Object.entries(RECURRENCE_FREQUENCY_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelCls}>Repetir até *</label>
                    <input
                      type="date"
                      required
                      value={repetirAte}
                      min={today}
                      onChange={(e) => setRepetirAte(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  Todos os lançamentos serão criados com status Agendado, numerados na descrição.
                  Limite de {RECURRENCE_LIMIT} repetições.
                </p>
              </>
            )}
          </div>

          {/* Comprovante */}
          <div className="space-y-1.5">
            <label className={labelCls}>Comprovante (NF, boleto, recibo)</label>
            <label className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gold/50 px-3 py-2.5 text-sm text-gray-400 hover:border-terracotta hover:text-terracotta transition-colors">
              <Upload className="h-4 w-4" />
              <span>Anexar arquivo (opcional)</span>
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
              defaultValue={initialValues?.notes ?? ''}
              placeholder="Observações opcionais…"
              className="w-full resize-none rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/financeiro"
            className="rounded-lg border border-gold/50 px-5 py-2.5 text-sm font-medium text-dark hover:bg-cream transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-terracotta px-6 py-2.5 text-sm font-medium text-white hover:bg-brown disabled:opacity-60 transition-colors"
          >
            Salvar Lançamento
          </button>
        </div>
      </form>
    </div>
  )
}
