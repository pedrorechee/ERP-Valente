'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { RotateCcw, X } from 'lucide-react'
import type { FinancialEntry, PaymentMethod } from '@/types/database'
import { PAYMENT_METHOD_LABELS } from '@/types/database'
import { formatCurrency, formatFinanceNumber } from '@/lib/format'
import type { ContasPoint } from './ContasChart'

type EntryWithJoins = FinancialEntry & {
  projects?:  { id: string; name: string } | null
  suppliers?: { id: string; name: string } | null
}

type Nature = 'pagar' | 'receber'

// Gráfico carregado sob demanda, fora do bundle inicial
const ContasChart = dynamic(() => import('./ContasChart'), {
  ssr: false,
  loading: () => <ChartSpinner />,
})

function ChartSpinner() {
  return (
    <div className="flex h-[380px] items-center justify-center">
      <div
        className="h-8 w-8 rounded-full border-[3px]"
        style={{
          borderColor: '#F4E2B8',
          borderTopColor: '#C68B59',
          animation: 'spin 0.8s linear infinite',
        }}
      />
    </div>
  )
}

interface Props {
  entries:    EntryWithJoins[]
  projects:   { id: string; name: string }[]
  onMarkPaid: (id: string, paymentDate: string, paymentMethod: PaymentMethod | null, nature: Nature) => void
}

type Gran = 'dia' | 'semana' | 'mes'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const RED = '#8B3A3A'
const GREEN = '#4A7C59'
const BROWN = '#8A5A3B'
const TERRACOTTA = '#C68B59'
const GOLD = '#E6C07B'

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
function startOfWeekMon(d: Date): Date {
  const x = new Date(d)
  const wd = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - wd)
  x.setHours(0, 0, 0, 0)
  return x
}
function dayDiff(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + 'T00:00:00').getTime()
  const b = new Date(toISO + 'T00:00:00').getTime()
  return Math.round((b - a) / 86400000)
}
// dd/mm a partir de uma data ISO (YYYY-MM-DD)
function ddmm(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

const isPending = (e: EntryWithJoins) => e.status === 'pendente' || e.status === 'agendado'

// Vencimento efetivo de uma conta em aberto
function dueDate(e: EntryWithJoins): string {
  if (e.status === 'agendado') return e.scheduled_date ?? e.entry_date
  return e.due_date ?? e.entry_date
}
// Data em que o lançamento afeta (ou afetará) o caixa
function effectiveDate(e: EntryWithJoins, today: string): string {
  if (e.status === 'pago') return e.payment_date ?? e.entry_date
  const due = dueDate(e)
  return due < today ? today : due
}
function entityLabel(e: EntryWithJoins): string {
  return e.suppliers?.name ?? e.counterpart ?? ''
}

// Selo de situação de um título em aberto
function dueBadge(due: string, today: string): { label: string; bg: string; color: string } {
  if (due < today)   return { label: 'Vencido',    bg: 'rgba(139,58,58,0.12)',  color: RED }
  if (due === today) return { label: 'Vence hoje', bg: 'rgba(198,139,89,0.15)', color: TERRACOTTA }
  return { label: 'A vencer', bg: 'rgba(230,192,123,0.30)', color: BROWN }
}

// Faixas de prazo (relativas a hoje) usadas como separadores dentro de cada coluna
const PRAZO_SECTIONS: { key: string; label: string; test: (d: number) => boolean }[] = [
  { key: 'vencidos', label: 'Vencidos',          test: (d) => d < 0 },
  { key: 'prox7',    label: 'Próximos 7 dias',   test: (d) => d >= 0 && d <= 7 },
  { key: '8a30',     label: '8 a 30 dias',       test: (d) => d >= 8 && d <= 30 },
  { key: 'mais30',   label: 'Acima de 30 dias',  test: (d) => d > 30 },
]

interface ColumnSection { key: string; label: string; subtotal: number; items: EntryWithJoins[] }
interface ColumnData { total: number; count: number; sections: ColumnSection[] }

// ── Gráfico: gera buckets (dia/semana/mês) e a série acumulada ──
function makeBuckets(gran: Gran, today: Date): { label: string; startISO: string; endISO: string }[] {
  const out: { label: string; startISO: string; endISO: string }[] = []
  if (gran === 'dia') {
    const start = addDays(today, -7)
    for (let i = 0; i < 38; i++) {
      const d = addDays(start, i)
      out.push({ label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, startISO: ymd(d), endISO: ymd(addDays(d, 1)) })
    }
  } else if (gran === 'semana') {
    const start = addDays(startOfWeekMon(today), -28)
    for (let i = 0; i < 17; i++) {
      const d = addDays(start, i * 7)
      out.push({ label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, startISO: ymd(d), endISO: ymd(addDays(d, 7)) })
    }
  } else {
    const base = new Date(today.getFullYear(), today.getMonth() - 3, 1)
    for (let i = 0; i < 16; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() + i, 1)
      const e = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      out.push({ label: `${MONTHS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, startISO: ymd(d), endISO: ymd(e) })
    }
  }
  return out
}

function buildSeries(entries: EntryWithJoins[], gran: Gran, todayISO: string): { points: ContasPoint[]; todayLabel: string } {
  const buckets = makeBuckets(gran, new Date(todayISO + 'T00:00:00'))
  const n = buckets.length
  const aReceber = new Array(n).fill(0)
  const aPagar = new Array(n).fill(0)
  const deltaIn = new Array(n).fill(0)
  let baseline = 0
  const rangeStart = buckets[0].startISO
  const rangeEnd = buckets[n - 1].endISO

  const idxOf = (iso: string) => {
    for (let i = 0; i < n; i++) if (iso >= buckets[i].startISO && iso < buckets[i].endISO) return i
    return -1
  }

  for (const e of entries) {
    if (isPending(e)) {
      const bi = idxOf(dueDate(e))
      if (bi >= 0) {
        if (e.entry_type === 'income') aReceber[bi] += e.amount
        else aPagar[bi] += e.amount
      }
    }
    const eff = effectiveDate(e, todayISO)
    const delta = e.entry_type === 'income' ? e.amount : -e.amount
    if (eff < rangeStart) baseline += delta
    else if (eff < rangeEnd) {
      const bi = idxOf(eff)
      if (bi >= 0) deltaIn[bi] += delta
    }
  }

  let todayIdx = idxOf(todayISO)
  if (todayIdx < 0) todayIdx = 0

  const points: ContasPoint[] = []
  let acc = baseline
  for (let i = 0; i < n; i++) {
    acc += deltaIn[i]
    points.push({
      label: buckets[i].label,
      aReceber: aReceber[i],
      aPagar: aPagar[i],
      saldoPeriodo: aReceber[i] - aPagar[i],
      saldoAcum: acc,
      saldoPast: i <= todayIdx ? acc : null,
      saldoFuture: i >= todayIdx ? acc : null,
    })
  }
  return { points, todayLabel: buckets[todayIdx].label }
}

// ── Mini-modal: confirma data (e forma) de pagamento/recebimento ──
function MarkSettledModal({
  nature,
  onConfirm,
  onCancel,
}: {
  nature: Nature
  onConfirm: (paymentDate: string, paymentMethod: PaymentMethod | null) => void
  onCancel: () => void
}) {
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0])
  const [method, setMethod] = useState<'' | PaymentMethod>('')
  const isReceber = nature === 'receber'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(59,36,24,0.4)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-dark">
            {isReceber ? 'Marcar como Recebido' : 'Marcar como Pago'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-cream hover:text-dark transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-brown">
            {isReceber ? 'Data do Recebimento *' : 'Data do Pagamento *'}
          </label>
          <input
            type="date"
            required
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
          />
        </div>

        <div className="mb-6 space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-brown">
            Forma de pagamento
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as '' | PaymentMethod)}
            className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
          >
            <option value="">Não informar</option>
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gold/50 py-2.5 text-sm font-medium text-dark transition-colors hover:bg-[#F9F7F4]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!paymentDate}
            onClick={() => onConfirm(paymentDate, method || null)}
            className="flex-1 rounded-lg bg-terracotta py-2.5 text-sm font-medium text-white hover:bg-brown disabled:opacity-60 transition-colors"
          >
            {isReceber ? 'Confirmar recebimento' : 'Confirmar pagamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Coluna (A Pagar / A Receber) ──
function Column({
  title,
  data,
  valueColor,
  headerBg,
  actionLabel,
  emptyText,
  onMark,
  today,
}: {
  title: string
  data: ColumnData
  valueColor: string
  headerBg: string
  actionLabel: string
  emptyText: string
  onMark: (e: EntryWithJoins) => void
  today: string
}) {
  return (
    <div className="flex flex-col rounded-xl border border-gold/30 bg-white shadow-sm" style={{ maxHeight: 600 }}>
      {/* Cabeçalho fixo com o total em destaque */}
      <div className="shrink-0 rounded-t-xl border-b border-gold/20 px-4 py-3" style={{ backgroundColor: headerBg }}>
        <h2 className="text-xs font-bold uppercase tracking-wide" style={{ color: BROWN }}>{title}</h2>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-bold" style={{ color: valueColor }}>{formatCurrency(data.total)}</span>
          <span className="text-xs text-gray-400">({data.count} título{data.count !== 1 ? 's' : ''})</span>
        </div>
      </div>

      {/* Lista com rolagem interna */}
      <div className="flex-1 overflow-y-auto">
        {data.count === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-400">{emptyText}</p>
          </div>
        ) : (
          data.sections.map((sec) => (
            <div key={sec.key}>
              {/* Separador de prazo */}
              <div className="flex items-center justify-between bg-cream/20 px-4 pt-2.5 pb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: BROWN }}>
                  {sec.label}
                  <span className="ml-1.5 font-normal text-gray-400">({sec.items.length})</span>
                </span>
                <span className="text-[11px] font-semibold" style={{ color: valueColor }}>
                  {formatCurrency(sec.subtotal)}
                </span>
              </div>

              {sec.items.map((e) => {
                const due = dueDate(e)
                const badge = dueBadge(due, today)
                const entity = entityLabel(e)
                const obra = e.projects?.name ?? ''
                const sub = [obra, entity].filter(Boolean).join(' · ')
                return (
                  <div key={e.id} className="flex items-center gap-3 border-t border-gold/10 px-4 py-2.5 hover:bg-cream/20">
                    {/* Esquerda: vencimento + selo */}
                    <div className="flex w-16 shrink-0 flex-col items-start gap-1">
                      <span className="text-sm font-bold text-dark">{ddmm(due)}</span>
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap"
                        style={{ backgroundColor: badge.bg, color: badge.color }}
                      >
                        {badge.label}
                      </span>
                    </div>

                    {/* Meio: nº + descrição + obra/entidade */}
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[11px]" style={{ color: '#8A5A3B' }}>
                        {formatFinanceNumber(e.entry_number)}
                      </p>
                      <p className="truncate text-sm font-semibold text-dark">{e.description}</p>
                      {sub && <p className="truncate text-xs text-gray-400">{sub}</p>}
                    </div>

                    {/* Direita: valor + ação */}
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-sm font-semibold whitespace-nowrap" style={{ color: valueColor }}>
                        {formatCurrency(e.amount)}
                      </span>
                      <button
                        onClick={() => onMark(e)}
                        className="rounded-lg border bg-white px-2.5 py-1 text-[11px] font-medium text-brown transition-colors hover:border-terracotta hover:bg-terracotta hover:text-white whitespace-nowrap"
                        style={{ borderColor: GOLD }}
                      >
                        {actionLabel}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function ContasPagarReceberTab({ entries, projects, onMarkPaid }: Props) {
  const today = useMemo(() => new Date().toISOString().split('T')[0], [])
  const [obra, setObra] = useState('all')
  const [de,  setDe]  = useState('')
  const [ate, setAte] = useState('')
  const [gran, setGran] = useState<Gran>('mes')
  const [settling, setSettling] = useState<{ entry: EntryWithJoins; nature: Nature } | null>(null)

  // Escopo: respeita a obra selecionada
  const scoped = useMemo(
    () => (obra === 'all' ? entries : entries.filter((e) => e.project_id === obra)),
    [entries, obra]
  )

  // ── Colunas A Pagar / A Receber (respeitam obra + período de vencimento) ──
  const columns = useMemo(() => {
    const start = de || '0000-01-01'
    const end = ate || '9999-12-31'

    function build(entryType: 'income' | 'expense'): ColumnData {
      const items = scoped
        .filter((e) => isPending(e) && e.entry_type === entryType)
        // Período de vencimento: due_date (ou scheduled_date) BETWEEN [de, ate]
        .filter((e) => { const d = dueDate(e).slice(0, 10); return d >= start && d <= end })
        .sort((a, b) => dueDate(a).localeCompare(dueDate(b)))
      const total = items.reduce((s, e) => s + e.amount, 0)
      const sections: ColumnSection[] = PRAZO_SECTIONS.map((sec) => {
        const secItems = items.filter((e) => sec.test(dayDiff(today, dueDate(e))))
        return { key: sec.key, label: sec.label, items: secItems, subtotal: secItems.reduce((s, e) => s + e.amount, 0) }
      }).filter((sec) => sec.items.length > 0)
      return { total, count: items.length, sections }
    }

    return { pagar: build('expense'), receber: build('income') }
  }, [scoped, de, ate, today])

  const series = useMemo(() => buildSeries(scoped, gran, today), [scoped, gran, today])

  const isFiltered = obra !== 'all' || !!de || !!ate

  function clearFilters() {
    setObra('all')
    setDe('')
    setAte('')
  }

  function handleMark(entry: EntryWithJoins, nature: Nature) {
    setSettling({ entry, nature })
  }

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="space-y-4 rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">Obra</label>
            <select
              value={obra}
              onChange={(e) => setObra(e.target.value)}
              className="rounded-lg border border-gold/50 px-3 py-1.5 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            >
              <option value="all">Todas as obras</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">Vencimento — de</label>
            <input
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
              className="rounded-lg border border-gold/50 px-3 py-1.5 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">até</label>
            <input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="rounded-lg border border-gold/50 px-3 py-1.5 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>

          {isFiltered && (
            <button
              onClick={clearFilters}
              className="ml-auto flex items-center gap-1.5 self-end rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-cream"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Duas colunas: A Pagar | A Receber */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Column
          title="A Pagar"
          data={columns.pagar}
          valueColor={RED}
          headerBg="rgba(139,58,58,0.05)"
          actionLabel="Marcar pago"
          emptyText="Nenhum título a pagar no período"
          onMark={(e) => handleMark(e, 'pagar')}
          today={today}
        />
        <Column
          title="A Receber"
          data={columns.receber}
          valueColor={GREEN}
          headerBg="rgba(74,124,89,0.05)"
          actionLabel="Marcar recebido"
          emptyText="Nenhum título a receber no período"
          onMark={(e) => handleMark(e, 'receber')}
          today={today}
        />
      </div>

      {/* Gráfico */}
      <div className="rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-dark">Fluxo projetado</h2>
            <p className="text-xs text-gray-400">A receber e a pagar por período, com saldo acumulado</p>
          </div>
          <div className="flex gap-1 rounded-lg border border-gold/30 bg-cream/30 p-1">
            {([
              { key: 'dia',    label: 'Diário' },
              { key: 'semana', label: 'Semanal' },
              { key: 'mes',    label: 'Mensal' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setGran(key)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  gran === key ? 'bg-white text-dark shadow-sm' : 'text-gray-500 hover:text-dark'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <ContasChart data={series.points} todayLabel={series.todayLabel} />
      </div>

      {/* Mini-modal de confirmação */}
      {settling && (
        <MarkSettledModal
          nature={settling.nature}
          onConfirm={(paymentDate, paymentMethod) => {
            const { entry, nature } = settling
            setSettling(null)
            onMarkPaid(entry.id, paymentDate, paymentMethod, nature)
          }}
          onCancel={() => setSettling(null)}
        />
      )}
    </div>
  )
}
