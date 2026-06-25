'use client'

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Plus, ArrowUpCircle, ArrowDownCircle, Paperclip, Trash2, Pencil,
  TrendingUp, TrendingDown, Banknote, AlertTriangle, SlidersHorizontal,
  ChevronDown, RotateCcw,
} from 'lucide-react'
import type { FinancialEntry, CostCategory, PaymentMethod } from '@/types/database'
import { PAYMENT_METHOD_LABELS } from '@/types/database'
import { formatCurrency, formatDate, formatFinanceNumber, parseFinanceNumber } from '@/lib/format'
import { deleteFinancialEntry, bulkMarkPaid, bulkDeleteEntries } from '@/app/actions/financeiro'
import { toast } from 'sonner'
import { toastAfterClose } from '@/lib/ui-feedback'
import { ContaCorrenteTab } from './ContaCorrenteTab'
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal'
import { EditLancamentoModal } from './EditLancamentoModal'
import { DetalheLancamentoModal } from './DetalheLancamentoModal'
import { MarkPaidModal } from './MarkPaidModal'
import { ContasPagarReceberTab } from './ContasPagarReceberTab'
import { DRETab } from './DRETab'
import { useTableSort } from '@/hooks/useTableSort'
import { SortHeader } from '@/components/ui/sort-header'
import { PaginationBar } from '@/components/ui/pagination'

type EntryWithJoins = FinancialEntry & {
  projects?:  { id: string; name: string } | null
  suppliers?: { id: string; name: string } | null
}

// Vencimento exibido: agendado usa a data agendada; demais usam a data de vencimento (pode ser nulo)
function displayDueDate(e: EntryWithJoins): string | null {
  return e.status === 'agendado' ? e.scheduled_date : e.due_date
}

const ENTRY_GETTERS = {
  num:    (e: EntryWithJoins) => e.entry_number,
  date:   (e: EntryWithJoins) => e.entry_date,
  venc:   (e: EntryWithJoins) => displayDueDate(e) ?? '',
  pgto:   (e: EntryWithJoins) => e.payment_date ?? '',
  obra:   (e: EntryWithJoins) => e.projects?.name ?? '',
  desc:   (e: EntryWithJoins) => e.description,
  cat:    (e: EntryWithJoins) => e.category,
  forma:  (e: EntryWithJoins) => (e.payment_method ? PAYMENT_METHOD_LABELS[e.payment_method] : ''),
  amount: (e: EntryWithJoins) => e.amount,
  status: (e: EntryWithJoins) => e.status,
}

type DateField = 'emissao' | 'vencimento' | 'pagamento'

interface Props {
  entries:     EntryWithJoins[]
  projects:    { id: string; name: string }[]
  suppliers:   { id: string; name: string }[]
  clients:     { id: string; name: string }[]
  categories:  CostCategory[]
  phases:      { id: string; project_id: string; name: string }[]
  orcadoByProject: Record<string, { total: number; byCategory: Record<string, number> }>
  initialObra: string
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

// Data de vencimento efetiva: agendados usam a data agendada; pendentes, a data de vencimento
function entryDueDate(e: EntryWithJoins): string {
  if (e.status === 'agendado') return e.scheduled_date ?? e.entry_date
  if (e.status === 'pendente') return e.due_date ?? e.entry_date
  return e.due_date ?? e.entry_date
}

// Vencido: agendado com data passada, ou pendente com due_date informada e passada
function isOverdue(e: EntryWithJoins, today: string): boolean {
  if (e.status === 'agendado') return (e.scheduled_date ?? e.entry_date) < today
  if (e.status === 'pendente') return !!e.due_date && e.due_date < today
  return false
}

// Data usada pelo filtro "Filtrar data por" (pode ser nula — entrada sem aquele campo não aparece no filtro)
function dateForField(e: EntryWithJoins, field: DateField): string | null {
  if (field === 'emissao')   return e.entry_date
  if (field === 'pagamento') return e.payment_date
  // vencimento: usa exatamente o que é exibido na coluna (null exclui a entrada do filtro)
  return displayDueDate(e)
}

// Nome do fornecedor/cliente associado ao lançamento
function entityLabel(e: EntryWithJoins): string {
  return e.suppliers?.name ?? e.counterpart ?? ''
}

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}


// Linha memoizada: editar/excluir um lançamento não re-renderiza as demais
const EntryRow = memo(function EntryRow({
  entry,
  onEdit,
  onDelete,
  onDetail,
  selected,
  onToggleSelect,
}: {
  entry: EntryWithJoins
  onEdit: (entry: EntryWithJoins) => void
  onDelete: (entry: EntryWithJoins) => void
  onDetail: (entry: EntryWithJoins) => void
  selected: boolean
  onToggleSelect: (id: string) => void
}) {
  return (
    <tr
      onClick={() => onDetail(entry)}
      className="hover:bg-cream/20 transition-colors cursor-pointer"
    >
      <td className="px-4 py-3 w-8" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(entry.id)}
          className="h-4 w-4 cursor-pointer rounded border-gold/50 accent-[#C68B59]"
        />
      </td>
      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: '#8A5A3B' }}>
        {formatFinanceNumber(entry.entry_number)}
      </td>
      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
        {formatDate(entry.entry_date)}
      </td>
      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap hidden md:table-cell">
        {displayDueDate(entry) ? formatDate(displayDueDate(entry)!) : '—'}
      </td>
      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap hidden lg:table-cell">
        {entry.payment_date ? formatDate(entry.payment_date) : '—'}
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
      <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
        {entry.category}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell">
        {entry.payment_method ? PAYMENT_METHOD_LABELS[entry.payment_method] : '—'}
      </td>
      <td
        className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${
          entry.entry_type === 'income' ? 'text-green-600' : 'text-red-500'
        }`}
      >
        {entry.entry_type === 'income' ? '+' : '−'}{' '}
        {formatCurrency(entry.amount)}
      </td>
      <td className="px-4 py-3 text-center hidden md:table-cell">
        {isOverdue(entry, new Date().toISOString().split('T')[0]) ? (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium cursor-default"
            style={{ backgroundColor: 'rgba(139,58,58,0.12)', color: '#8B3A3A' }}
            title={`Vencido em ${entryDueDate(entry).split('-').reverse().join('/')}`}
          >
            Vencido
          </span>
        ) : (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium cursor-default ${
              STATUS_BADGE[entry.status] ?? 'bg-gray-100 text-gray-600'
            }`}
            title={
              entry.status === 'agendado' && entry.scheduled_date
                ? `Agendado para ${entry.scheduled_date.split('-').reverse().join('/')}`
                : undefined
            }
          >
            {STATUS_LABEL[entry.status] ?? entry.status}
          </span>
        )}
      </td>
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(entry)}
            className="rounded p-1 transition-colors"
            style={{ color: '#8A5A3B' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#C68B59')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#8A5A3B')}
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(entry)}
            className="rounded p-1 transition-colors disabled:opacity-40"
            style={{ color: '#8A5A3B' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#8B3A3A')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#8A5A3B')}
            title="Excluir"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
})

const inputCls =
  'rounded-lg border border-gold/50 px-3 py-1.5 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta'
const labelCls = 'text-xs font-semibold uppercase tracking-wide text-brown'

export function FinanceiroClient({
  entries,
  projects,
  suppliers,
  clients,
  categories,
  phases,
  orcadoByProject,
  initialObra,
}: Props) {
  const today = useMemo(() => new Date().toISOString().split('T')[0], [])
  // Mapa conta → exibição (código — descrição), para filtro e detalhe
  const catById = useMemo(() => {
    const m = new Map<string, CostCategory>()
    for (const c of categories) m.set(c.id, c)
    return m
  }, [categories])
  const [activeTab, setActiveTab]   = useState<'lancamentos' | 'conta-corrente' | 'projecao' | 'dre'>('lancamentos')
  const [confirmId, setConfirmId]   = useState<{ id: string; projectId: string } | null>(null)
  const [localEntries, setLocalEntries] = useState(entries)
  const [editingEntry, setEditingEntry] = useState<EntryWithJoins | null>(null)
  const [detailEntry,  setDetailEntry]  = useState<EntryWithJoins | null>(null)

  // Seleção em lote
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set())
  const [markPaidOpen, setMarkPaidOpen]     = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  // ── Filtros (todos em memória) ──
  const [obra,   setObra]   = useState(initialObra || 'all')
  const [faseFilter, setFaseFilter] = useState('all')
  const [tipo,   setTipo]   = useState('all')
  const [status, setStatus] = useState('all')
  const [dateField, setDateField] = useState<DateField>('emissao')
  const [de,  setDe]  = useState('')
  const [ate, setAte] = useState('')
  const [catFilter,     setCatFilter]     = useState('all')
  const [pagoPorFilter, setPagoPorFilter] = useState('all')
  const [formaFilter,   setFormaFilter]   = useState('all')
  const [entidadeFilter, setEntidadeFilter] = useState('')
  const [busca,          setBusca]          = useState('')
  const [debouncedBusca, setDebouncedBusca] = useState('')
  // Avançados (seção "Mais filtros")
  const [moreOpen,       setMoreOpen]       = useState(false)
  const [soVencidos,     setSoVencidos]     = useState(false)
  const [comComprovante, setComComprovante] = useState(false)
  const [comNF,          setComNF]          = useState(false)
  // Paginação (em memória)
  const [page,    setPage]    = useState(1)
  const [perPage, setPerPage] = useState(10)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedBusca(busca), 300)
    return () => clearTimeout(t)
  }, [busca])

  // Fases da obra selecionada (filtradas em memória, já ordenadas por order_index)
  const phasesOfObra = useMemo(
    () => (obra === 'all' ? [] : phases.filter((p) => p.project_id === obra)),
    [phases, obra],
  )
  // Ao trocar de obra (ou voltar p/ "Todas"), reseta o filtro de fase
  useEffect(() => { setFaseFilter('all') }, [obra])

  // Opções derivadas de todos os lançamentos carregados
  const paidByOptions = useMemo(
    () => [...new Set(localEntries.map((e) => e.paid_by).filter((p): p is string => !!p))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [localEntries]
  )
  const formaOptions = useMemo(
    () => [...new Set(localEntries.map((e) => e.payment_method).filter((p): p is NonNullable<typeof p> => !!p))],
    [localEntries]
  )
  const entidadeOptions = useMemo(
    () => [...new Set(localEntries.map(entityLabel).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [localEntries]
  )

  // Predicado dos filtros — usado na listagem, no resumo e na exportação
  const matchesFilters = useCallback(
    (e: EntryWithJoins) => {
      if (obra !== 'all' && e.project_id !== obra) return false
      if (faseFilter !== 'all' && e.phase_id !== faseFilter) return false
      if (tipo !== 'all' && e.entry_type !== tipo) return false
      if (status !== 'all' && e.status !== status) return false

      if (de || ate) {
        const d = dateForField(e, dateField)
        if (!d) return false
        if (de && d < de) return false
        if (ate && d > ate) return false
      }

      if (catFilter !== 'all') {
        // Filtra pela conta do plano (category_id); fallback no texto p/ registros antigos
        if (e.category_id) { if (e.category_id !== catFilter) return false }
        else { const c = catById.get(catFilter); if (!c || e.category !== c.name) return false }
      }
      if (pagoPorFilter !== 'all' && (e.paid_by ?? '') !== pagoPorFilter) return false
      if (formaFilter !== 'all' && e.payment_method !== formaFilter) return false

      const ent = entidadeFilter.trim().toLowerCase()
      if (ent && !entityLabel(e).toLowerCase().includes(ent)) return false

      const q = debouncedBusca.trim().toLowerCase()
      if (q) {
        // Busca por descrição OU por número ("123" ou "FIN-000123" → normaliza p/ entry_number)
        const num = parseFinanceNumber(q)
        const byDesc = e.description.toLowerCase().includes(q)
        const byNum  = num !== null && e.entry_number === num
        if (!byDesc && !byNum) return false
      }

      if (soVencidos && !isOverdue(e, today)) return false
      if (comComprovante && !e.storage_path_proof) return false
      if (comNF && !e.nf_number) return false


      return true
    },
    [
      obra, faseFilter, tipo, status, dateField, de, ate, catFilter, pagoPorFilter,
      formaFilter, entidadeFilter, debouncedBusca, soVencidos, comComprovante,
      comNF, today, catById,
    ]
  )

  const filtered = useMemo(
    () => localEntries.filter(matchesFilters),
    [localEntries, matchesFilters]
  )

  // Resumo reflete o resultado filtrado (antes da paginação)
  const summary = useMemo(() => {
    let totalIncome = 0
    let totalExpense = 0
    const byProject: Record<string, { income: number; expense: number }> = {}
    for (const e of filtered) {
      if (e.entry_type === 'income') totalIncome += e.amount
      else totalExpense += e.amount
      if (!byProject[e.project_id]) byProject[e.project_id] = { income: 0, expense: 0 }
      if (e.entry_type === 'income') byProject[e.project_id].income += e.amount
      else byProject[e.project_id].expense += e.amount
    }
    const negativoCount = Object.values(byProject).filter((p) => p.expense > p.income).length
    return { totalIncome, totalExpense, balance: totalIncome - totalExpense, negativoCount }
  }, [filtered])

  const { sorted: sortedEntries, sortCol, sortDir, handleSort } = useTableSort(
    filtered, ENTRY_GETTERS, 'date', 'desc', 'financeiro',
  )

  // Paginação em memória
  const totalPages  = Math.max(1, Math.ceil(sortedEntries.length / perPage))
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const pageEntries = useMemo(
    () => sortedEntries.slice((currentPage - 1) * perPage, currentPage * perPage),
    [sortedEntries, currentPage, perPage]
  )

  // Mantém a lista local em sincronia quando o servidor revalida os dados
  useEffect(() => {
    setLocalEntries(entries)
    setSelectedIds(new Set())
  }, [entries])

  // Volta para a primeira página sempre que os filtros mudam
  useEffect(() => {
    setPage(1)
  }, [
    obra, faseFilter, tipo, status, dateField, de, ate, catFilter, pagoPorFilter,
    formaFilter, entidadeFilter, debouncedBusca, soVencidos, comComprovante,
    comNF, perPage,
  ])

  // Contador de filtros ativos
  const activeFilterCount =
    (obra !== 'all' ? 1 : 0) +
    (faseFilter !== 'all' ? 1 : 0) +
    (tipo !== 'all' ? 1 : 0) +
    (status !== 'all' ? 1 : 0) +
    (de || ate ? 1 : 0) +
    (catFilter !== 'all' ? 1 : 0) +
    (pagoPorFilter !== 'all' ? 1 : 0) +
    (formaFilter !== 'all' ? 1 : 0) +
    (entidadeFilter.trim() ? 1 : 0) +
    (busca.trim() ? 1 : 0) +
    (soVencidos ? 1 : 0) +
    (comComprovante ? 1 : 0) +
    (comNF ? 1 : 0)

  function clearFilters() {
    setObra('all')
    setFaseFilter('all')
    setTipo('all')
    setStatus('all')
    setDateField('emissao')
    setDe('')
    setAte('')
    setCatFilter('all')
    setPagoPorFilter('all')
    setFormaFilter('all')
    setEntidadeFilter('')
    setBusca('')
    setDebouncedBusca('')
    setSoVencidos(false)
    setComComprovante(false)
    setComNF(false)
  }

  function performDelete(id: string, projectId: string) {
    const index = localEntries.findIndex((e) => e.id === id)
    const removed = localEntries[index]

    // Remoção otimista: a linha some na hora; reverte se a exclusão falhar
    setLocalEntries((prev) => prev.filter((e) => e.id !== id))
    toastAfterClose('Lançamento excluído')

    deleteFinancialEntry(id, projectId)
      .then((result) => {
        if (!result.success) throw new Error(result.error)
      })
      .catch(() => {
        if (removed) {
          setLocalEntries((prev) => {
            const next = [...prev]
            next.splice(Math.min(index, next.length), 0, removed)
            return next
          })
        }
        toast.error('Erro ao excluir lançamento', {
          action: { label: 'Tentar novamente', onClick: () => performDelete(id, projectId) },
        })
      })
  }

  function confirmDelete() {
    if (!confirmId) return
    const { id, projectId } = confirmId
    setConfirmId(null)
    performDelete(id, projectId)
  }

  // ── Ações em lote (optimistic) ──
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const allVisibleSelected =
    pageEntries.length > 0 && pageEntries.every((e) => selectedIds.has(e.id))

  function toggleSelectAll() {
    if (allVisibleSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(pageEntries.map((e) => e.id)))
  }

  function performBulkMarkPaid(
    ids: string[],
    paymentDate: string,
    paymentMethod?: PaymentMethod | null,
    toastMsg?: string,
  ) {
    const snapshot = localEntries
    setLocalEntries((prev) =>
      prev.map((e) =>
        ids.includes(e.id)
          ? {
              ...e,
              status: 'pago' as const,
              payment_date: paymentDate,
              scheduled_date: null,
              ...(paymentMethod ? { payment_method: paymentMethod } : {}),
            }
          : e
      )
    )
    setSelectedIds(new Set())
    toastAfterClose(
      toastMsg ??
        `${ids.length} lançamento${ids.length !== 1 ? 's' : ''} marcado${ids.length !== 1 ? 's' : ''} como pago`,
    )

    bulkMarkPaid(ids, paymentDate, paymentMethod)
      .then((result) => {
        if (!result.success) throw new Error(result.error)
      })
      .catch(() => {
        setLocalEntries(snapshot)
        toast.error('Erro ao marcar como pago', {
          action: { label: 'Tentar novamente', onClick: () => performBulkMarkPaid(ids, paymentDate, paymentMethod, toastMsg) },
        })
      })
  }

  function performBulkDelete(ids: string[]) {
    const snapshot = localEntries
    setLocalEntries((prev) => prev.filter((e) => !ids.includes(e.id)))
    setSelectedIds(new Set())
    toastAfterClose(`${ids.length} lançamento${ids.length !== 1 ? 's' : ''} excluído${ids.length !== 1 ? 's' : ''}`)

    bulkDeleteEntries(ids)
      .then((result) => {
        if (!result.success) throw new Error(result.error)
      })
      .catch(() => {
        setLocalEntries(snapshot)
        toast.error('Erro ao excluir lançamentos', {
          action: { label: 'Tentar novamente', onClick: () => performBulkDelete(ids) },
        })
      })
  }

  // Callbacks estáveis para as linhas memoizadas
  const handleEditRow = useCallback((entry: EntryWithJoins) => setEditingEntry(entry), [])
  const handleDeleteRow = useCallback(
    (entry: EntryWithJoins) => setConfirmId({ id: entry.id, projectId: entry.project_id }),
    []
  )
  const handleDetailRow = useCallback((entry: EntryWithJoins) => setDetailEntry(entry), [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark">Financeiro</h1>
          <p className="text-sm text-gray-400">Controle de entradas e saídas por obra</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/financeiro/novo${obra !== 'all' ? `?obra=${obra}` : ''}`}
            className="flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2.5 text-sm font-medium text-white hover:bg-brown transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novo Lançamento
          </Link>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-gold/30 bg-cream/30 p-1 w-fit">
        {(
          [
            { key: 'lancamentos', label: 'Lançamentos' },
            { key: 'projecao', label: 'A Pagar / A Receber' },
            { key: 'dre', label: 'DRE' },
            { key: 'conta-corrente', label: 'Contas de Fornecedores' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-white text-dark shadow-sm'
                : 'text-gray-500 hover:text-dark hover:bg-white/60'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Lançamentos tab ── */}
      {activeTab === 'lancamentos' && (
        <div className="space-y-5">
          {/* Summary cards — refletem os filtros desta aba */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="mb-1 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <p className="text-xs font-medium text-green-600">Entradas</p>
              </div>
              <p className="text-xl font-bold text-green-700">{formatCurrency(summary.totalIncome)}</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="mb-1 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                <p className="text-xs font-medium text-red-500">Saídas</p>
              </div>
              <p className="text-xl font-bold text-red-600">{formatCurrency(summary.totalExpense)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="mb-1 flex items-center gap-2">
                <Banknote className="h-4 w-4 text-gray-400" />
                <p className="text-xs font-medium text-gray-400">Resultado</p>
              </div>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(summary.balance)}
              </p>
            </div>
            <div
              className={`rounded-xl border p-4 ${
                summary.negativoCount > 0
                  ? 'border-orange-200 bg-orange-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="mb-1 flex items-center gap-2">
                <AlertTriangle
                  className={`h-4 w-4 ${
                    summary.negativoCount > 0 ? 'text-orange-500' : 'text-gray-400'
                  }`}
                />
                <p
                  className={`text-xs font-medium ${
                    summary.negativoCount > 0 ? 'text-orange-600' : 'text-gray-400'
                  }`}
                >
                  No negativo
                </p>
              </div>
              <p
                className={`text-xl font-bold ${
                  summary.negativoCount > 0 ? 'text-orange-600' : 'text-gray-500'
                }`}
              >
                {summary.negativoCount} obra{summary.negativoCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-4 rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
            {/* Filtrar data por + presets */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Filtrar data por</label>
                <select
                  value={dateField}
                  onChange={(e) => setDateField(e.target.value as DateField)}
                  className={inputCls}
                >
                  <option value="emissao">Emissão</option>
                  <option value="vencimento">Vencimento</option>
                  <option value="pagamento">Pagamento</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>De</label>
                <input
                  type="date"
                  value={de}
                  onChange={(e) => setDe(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Até</label>
                <input
                  type="date"
                  value={ate}
                  onChange={(e) => setAte(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Demais filtros */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Obra</label>
                <select value={obra} onChange={(e) => setObra(e.target.value)} className={inputCls}>
                  <option value="all">Todas as obras</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Fase — aparece só com uma obra específica selecionada */}
              {obra !== 'all' && (
                <div className="flex flex-col gap-1.5" style={{ animation: 'faseFadeIn 150ms ease-out' }}>
                  <style>{`@keyframes faseFadeIn { from { opacity: 0; transform: translateX(-6px) } to { opacity: 1; transform: none } }`}</style>
                  <label className={labelCls}>Fase</label>
                  <select value={faseFilter} onChange={(e) => setFaseFilter(e.target.value)} className={inputCls}>
                    <option value="all">Todas as fases</option>
                    {phasesOfObra.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Tipo</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
                  <option value="all">Todos</option>
                  <option value="income">Entradas</option>
                  <option value="expense">Saídas</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
                  <option value="all">Todos</option>
                  <option value="pago">Pago</option>
                  <option value="pendente">Pendente</option>
                  <option value="agendado">Agendado</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Categoria</label>
                <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className={inputCls}>
                  <option value="all">Todas</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Forma de pagamento</label>
                <select value={formaFilter} onChange={(e) => setFormaFilter(e.target.value)} className={inputCls}>
                  <option value="all">Todas</option>
                  {formaOptions.map((f) => (
                    <option key={f} value={f}>{PAYMENT_METHOD_LABELS[f]}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Pago por</label>
                <select value={pagoPorFilter} onChange={(e) => setPagoPorFilter(e.target.value)} className={inputCls}>
                  <option value="all">Todos</option>
                  {paidByOptions.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Fornecedor/Cliente</label>
                <input
                  type="text"
                  list="entidade-options"
                  value={entidadeFilter}
                  onChange={(e) => setEntidadeFilter(e.target.value)}
                  placeholder="Buscar…"
                  className={inputCls}
                />
                <datalist id="entidade-options">
                  {entidadeOptions.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Busca</label>
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar descrição ou Nº…"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Mais filtros (avançados) + ações */}
            <div className="flex flex-wrap items-center gap-3 border-t border-gold/20 pt-3">
              <button
                onClick={() => setMoreOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-gold/50 px-3 py-1.5 text-xs font-medium text-brown transition-colors hover:bg-cream"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Mais filtros
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
              </button>

              {activeFilterCount > 0 && (
                <>
                  <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-medium text-brown">
                    {activeFilterCount} filtro{activeFilterCount !== 1 ? 's' : ''} ativo{activeFilterCount !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-cream"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Limpar filtros
                  </button>
                </>
              )}
            </div>

            {moreOpen && (
              <div className="flex flex-wrap items-end gap-x-5 gap-y-3 rounded-lg bg-cream/30 p-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-dark">
                  <input
                    type="checkbox"
                    checked={soVencidos}
                    onChange={(e) => setSoVencidos(e.target.checked)}
                    className="h-4 w-4 rounded border-gold/50 accent-[#C68B59]"
                  />
                  Somente vencidos
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-dark">
                  <input
                    type="checkbox"
                    checked={comComprovante}
                    onChange={(e) => setComComprovante(e.target.checked)}
                    className="h-4 w-4 rounded border-gold/50 accent-[#C68B59]"
                  />
                  Com comprovante
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-dark">
                  <input
                    type="checkbox"
                    checked={comNF}
                    onChange={(e) => setComNF(e.target.checked)}
                    className="h-4 w-4 rounded border-gold/50 accent-[#C68B59]"
                  />
                  Com NF
                </label>
              </div>
            )}
          </div>

          {/* Table */}
          {sortedEntries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gold/40 py-14 text-center">
              <p className="text-sm text-gray-400">
                {localEntries.length === 0
                  ? 'Nenhum lançamento cadastrado.'
                  : 'Nenhum lançamento corresponde aos filtros aplicados.'}
              </p>
            </div>
          ) : (
            <>
              {/* Counter above table */}
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-400">
                  {(() => {
                    const from = (currentPage - 1) * perPage + 1
                    const to   = Math.min(currentPage * perPage, sortedEntries.length)
                    return `Exibindo ${from}–${to} de ${sortedEntries.length} lançamentos`
                  })()}
                </p>
                <select
                  value={String(perPage)}
                  onChange={(e) => setPerPage(Number(e.target.value))}
                  className="rounded-lg border border-gold/50 px-2 py-1 text-xs text-brown focus:border-terracotta focus:outline-none"
                >
                  <option value="10">10 por página</option>
                  <option value="25">25 por página</option>
                  <option value="50">50 por página</option>
                </select>
              </div>

              {/* Barra de ações em lote */}
              {selectedIds.size > 0 && (
                <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-gold/40 bg-cream/60 px-4 py-2.5 shadow-sm backdrop-blur">
                  <span className="text-sm font-medium text-dark">
                    {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
                  </span>
                  <span className="text-gold">|</span>
                  <button
                    onClick={() => setMarkPaidOpen(true)}
                    className="text-sm font-medium text-brown hover:text-terracotta transition-colors"
                  >
                    Marcar como Pago
                  </button>
                  <span className="text-gold">|</span>
                  <button
                    onClick={() => setBulkDeleteOpen(true)}
                    className="text-sm font-medium transition-colors"
                    style={{ color: '#8B3A3A' }}
                  >
                    Excluir
                  </button>
                </div>
              )}

              <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gold/20 bg-cream/30">
                      <tr>
                        <th className="px-4 py-3 w-8">
                          <input
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={toggleSelectAll}
                            className="h-4 w-4 cursor-pointer rounded border-gold/50 accent-[#C68B59]"
                          />
                        </th>
                        <SortHeader label="Nº"          sortKey="num"    currentKey={sortCol} currentDir={sortDir} onSort={handleSort} />
                        <SortHeader label="Data emissão" sortKey="date"   currentKey={sortCol} currentDir={sortDir} onSort={handleSort} />
                        <SortHeader label="Vencimento"   sortKey="venc"   currentKey={sortCol} currentDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
                        <SortHeader label="Pagamento"    sortKey="pgto"   currentKey={sortCol} currentDir={sortDir} onSort={handleSort} className="hidden lg:table-cell" />
                        <SortHeader label="Obra"      sortKey="obra"   currentKey={sortCol} currentDir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
                        <SortHeader label="Descrição" sortKey="desc"   currentKey={sortCol} currentDir={sortDir} onSort={handleSort} />
                        <SortHeader label="Categoria" sortKey="cat"    currentKey={sortCol} currentDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
                        <SortHeader label="Forma"     sortKey="forma"  currentKey={sortCol} currentDir={sortDir} onSort={handleSort} className="hidden lg:table-cell" />
                        <SortHeader label="Valor"     sortKey="amount" currentKey={sortCol} currentDir={sortDir} onSort={handleSort} className="text-right" />
                        <SortHeader label="Status"    sortKey="status" currentKey={sortCol} currentDir={sortDir} onSort={handleSort} className="text-center hidden md:table-cell" />
                        <th className="px-4 py-3 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gold/10">
                      {pageEntries.map((entry) => (
                        <EntryRow
                          key={entry.id}
                          entry={entry}
                          onEdit={handleEditRow}
                          onDelete={handleDeleteRow}
                          onDetail={handleDetailRow}
                          selected={selectedIds.has(entry.id)}
                          onToggleSelect={handleToggleSelect}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <PaginationBar currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Conta Corrente tab (somente leitura, derivada dos lançamentos) ── */}
      {activeTab === 'conta-corrente' && (
        <ContaCorrenteTab entries={localEntries} projects={projects} />
      )}

      {/* ── A Pagar / A Receber tab ── */}
      {activeTab === 'projecao' && (
        <ContasPagarReceberTab
          entries={localEntries}
          projects={projects}
          onMarkPaid={(id, date, method, nature) =>
            performBulkMarkPaid(
              [id],
              date,
              method,
              nature === 'receber' ? 'Título marcado como recebido' : 'Título marcado como pago',
            )
          }
        />
      )}

      {/* ── DRE tab ── */}
      {activeTab === 'dre' && <DRETab entries={localEntries} projects={projects} categories={categories} orcadoByProject={orcadoByProject} />}

      <ConfirmDeleteModal
        isOpen={!!confirmId}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmId(null)}
      />

      <ConfirmDeleteModal
        isOpen={bulkDeleteOpen}
        title="Excluir lançamentos"
        message={`Tem certeza que deseja excluir ${selectedIds.size} lançamento${selectedIds.size !== 1 ? 's' : ''}? Esta ação não pode ser desfeita.`}
        onConfirm={() => {
          setBulkDeleteOpen(false)
          performBulkDelete([...selectedIds])
        }}
        onCancel={() => setBulkDeleteOpen(false)}
      />

      {markPaidOpen && (
        <MarkPaidModal
          count={selectedIds.size}
          onConfirm={(paymentDate) => {
            setMarkPaidOpen(false)
            performBulkMarkPaid([...selectedIds], paymentDate)
          }}
          onCancel={() => setMarkPaidOpen(false)}
        />
      )}

      {detailEntry && (
        <DetalheLancamentoModal
          entry={detailEntry}
          categories={categories}
          onClose={() => setDetailEntry(null)}
        />
      )}

      {editingEntry && (
        <EditLancamentoModal
          entry={editingEntry}
          projects={projects}
          suppliers={suppliers}
          clients={clients}
          categories={categories}
          phases={phases}
          onClose={() => setEditingEntry(null)}
          onSaved={(updated) => {
            setLocalEntries((prev) =>
              prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e))
            )
            setEditingEntry(null)
          }}
        />
      )}
    </div>
  )
}
