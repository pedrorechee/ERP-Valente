'use client'

import Link from 'next/link'
import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer,
  ReferenceLine, LabelList,
} from 'recharts'
import { formatCurrency } from '@/lib/format'

// ─── Public types ─────────────────────────────────────────────────────────────

export type CfEntry = {
  entry_date: string
  entry_type: 'income' | 'expense'
  amount: number
  status: 'pago' | 'pendente' | 'agendado'
  project_id: string
  description: string
}

export type CfProject = { id: string; name: string }

// ─── Internal types ───────────────────────────────────────────────────────────

type Granularity = 'daily' | 'weekly' | 'monthly'

const GRAN_LABELS: Record<Granularity, string> = {
  daily:   'Diário',
  weekly:  'Semanal',
  monthly: 'Mensal',
}

const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

// px available per bucket — used for chart width and barSize calculation
const BAR_PX: Record<Granularity, number> = { monthly: 88, weekly: 76, daily: 48 }

// how many future buckets to always include
const FUTURE_EXTRA: Record<Granularity, number> = { monthly: 3, weekly: 4, daily: 7 }

// hard cap on total buckets
const MAX_BUCKETS: Record<Granularity, number> = { monthly: 48, weekly: 52, daily: 90 }

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toLocalStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseLocal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function addDays(s: string, n: number): string {
  const d = parseLocal(s); d.setDate(d.getDate() + n); return toLocalStr(d)
}

function monthKey(s: string): string { return s.slice(0, 7) }

function mondayKey(s: string): string {
  const d = parseLocal(s)
  const dow = d.getDay()
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  return toLocalStr(d)
}

function bucketKey(dateStr: string, g: Granularity): string {
  if (g === 'daily')   return dateStr
  if (g === 'monthly') return monthKey(dateStr)
  return mondayKey(dateStr)
}

// ─── Dynamic bucket generation ────────────────────────────────────────────────

type BucketMeta = { key: string; label: string; startDate: string; endDate: string }

function buildBuckets(
  g: Granularity,
  entries: CfEntry[],
  now: Date,
  dateFromOverride: string,  // '' = no override
  dateToOverride: string,    // '' = no override
): BucketMeta[] {
  const todayStr = toLocalStr(now)

  let minDate = todayStr
  let maxDate = todayStr
  for (const e of entries) {
    if (e.entry_date < minDate) minDate = e.entry_date
    if (e.entry_date > maxDate) maxDate = e.entry_date
  }

  // Hard boundaries from the date range filter take precedence
  if (dateFromOverride) minDate = dateFromOverride
  if (dateToOverride)   maxDate = dateToOverride
  const hasEndOverride = !!dateToOverride

  if (g === 'monthly') {
    const startMo = monthKey(minDate)
    const todayMo = monthKey(todayStr)
    const rawEnd  = monthKey(maxDate)
    const futEnd  = hasEndOverride ? rawEnd : addMonths(todayMo, FUTURE_EXTRA.monthly)
    const endMo   = rawEnd > futEnd ? rawEnd : futEnd

    const buckets: BucketMeta[] = []
    let cur = startMo
    while (cur <= endMo && buckets.length < MAX_BUCKETS.monthly) {
      const [y, m] = cur.split('-').map(Number)
      const d    = new Date(y, m - 1, 1)
      const last = new Date(y, m, 0)
      buckets.push({
        key:       cur,
        label:     `${MONTHS_PT[d.getMonth()]}/${String(y).slice(2)}`,
        startDate: `${cur}-01`,
        endDate:   toLocalStr(last),
      })
      cur = addMonths(cur, 1)
    }
    return buckets
  }

  if (g === 'weekly') {
    const startWk  = mondayKey(minDate)
    const todayWk  = mondayKey(todayStr)
    const rawEnd   = mondayKey(maxDate)
    const futEnd   = hasEndOverride ? rawEnd : addDays(todayWk, FUTURE_EXTRA.weekly * 7)
    const endWk    = rawEnd > futEnd ? rawEnd : futEnd

    const buckets: BucketMeta[] = []
    let cur = startWk
    while (cur <= endWk && buckets.length < MAX_BUCKETS.weekly) {
      const d   = parseLocal(cur)
      const sun = new Date(d); sun.setDate(d.getDate() + 6)
      const wom = Math.ceil(d.getDate() / 7)
      buckets.push({
        key:       cur,
        label:     `S${wom} ${MONTHS_PT[d.getMonth()]}`,
        startDate: cur,
        endDate:   toLocalStr(sun),
      })
      cur = addDays(cur, 7)
    }
    return buckets
  }

  // daily
  const futEnd = hasEndOverride ? maxDate : addDays(todayStr, FUTURE_EXTRA.daily)
  const endDay = maxDate > futEnd ? maxDate : futEnd

  const buckets: BucketMeta[] = []
  let cur = minDate
  while (cur <= endDay && buckets.length < MAX_BUCKETS.daily) {
    const d = parseLocal(cur)
    buckets.push({
      key:       cur,
      label:     `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      startDate: cur,
      endDate:   cur,
    })
    cur = addDays(cur, 1)
  }
  return buckets
}

// ─── Y-axis formatter ─────────────────────────────────────────────────────────

function fmtY(v: number): string {
  const a = Math.abs(v)
  if (a >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (a >= 1_000)     return `R$ ${Math.round(v / 1_000)}k`
  return v === 0 ? 'R$ 0' : `R$ ${v}`
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CfTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  const income  = payload.find(p => p.name === 'income')?.value  ?? 0
  const expense = payload.find(p => p.name === 'expense')?.value ?? 0
  const result  = income - expense

  return (
    <div
      className="rounded-lg bg-white p-3 shadow-lg text-xs space-y-1 min-w-[200px]"
      style={{ border: '1px solid #E6C07B', color: '#3B2418' }}
    >
      <p className="font-semibold mb-2" style={{ color: '#3B2418' }}>{label}</p>
      <p style={{ color: '#4A7C59' }}>Entradas: {formatCurrency(income)}</p>
      <p style={{ color: '#8B3A3A' }}>Saídas: {formatCurrency(expense)}</p>
      <p
        className="border-t pt-1"
        style={{ borderColor: '#F4E2B8', color: result >= 0 ? '#4A7C59' : '#8B3A3A' }}
      >
        Resultado: {formatCurrency(result)}
      </p>
      <p style={{ color: '#3B2418' }}>
        Saldo acumulado: {formatCurrency(payload.find(p => p.name === 'accumulated')?.value ?? 0)}
      </p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type ChartRow = BucketMeta & {
  income: number
  expense: number
  accumulated: number
}

export function CashFlowSection({ entries, projects }: { entries: CfEntry[]; projects: CfProject[] }) {
  const [granularity,     setGranularity]     = useState<Granularity>('monthly')
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [dateFrom,        setDateFrom]        = useState<string>('')
  const [dateTo,          setDateTo]          = useState<string>('')
  const [mounted,         setMounted]         = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  const byProject = useMemo(
    () => selectedProject === 'all' ? entries : entries.filter(e => e.project_id === selectedProject),
    [entries, selectedProject],
  )

  const filtered = useMemo(() => {
    if (!dateFrom && !dateTo) return byProject
    return byProject.filter(e => {
      if (dateFrom && e.entry_date < dateFrom) return false
      if (dateTo   && e.entry_date > dateTo)   return false
      return true
    })
  }, [byProject, dateFrom, dateTo])

  const hasDateFilter = !!(dateFrom || dateTo)

  const { chartData, isEmpty, todayBucketKey, todayLabel } = useMemo(() => {
    const now      = new Date()
    const todayStr = toLocalStr(now)
    const todayBK  = bucketKey(todayStr, granularity)

    // ── DIÁRIO: preenche todos os dias do período, sem lacunas ───────────────
    if (granularity === 'daily') {
      // 1. Agrupa entradas por data exata (string YYYY-MM-DD)
      const byDate = new Map<string, { income: number; expense: number }>()
      for (const e of filtered) {
        let slot = byDate.get(e.entry_date)
        if (!slot) { slot = { income: 0, expense: 0 }; byDate.set(e.entry_date, slot) }
        if (e.entry_type === 'income') slot.income  += e.amount
        else                           slot.expense += e.amount
      }

      // 2. Determina o range completo do período
      let firstDay = todayStr
      let lastDay  = todayStr
      for (const dk of byDate.keys()) {
        if (dk < firstDay) firstDay = dk
        if (dk > lastDay)  lastDay  = dk
      }
      // Filtro de data tem precedência
      if (dateFrom) firstDay = dateFrom
      if (dateTo)   lastDay  = dateTo
      // Dias futuros extras quando não há filtro de fim
      if (!dateTo) {
        const futEnd = addDays(todayStr, FUTURE_EXTRA.daily)
        if (futEnd > lastDay) lastDay = futEnd
      }

      // 3. Itera cada dia do período — dias sem lançamento recebem 0/0
      //    e o saldo acumulado continua do dia anterior (não cai para zero)
      let running   = 0
      let totalData = 0
      const rows: ChartRow[] = []
      let cur = firstDay

      while (cur <= lastDay && rows.length < MAX_BUCKETS.daily) {
        const d    = parseLocal(cur)
        const slot = byDate.get(cur) ?? { income: 0, expense: 0 }
        running   += slot.income - slot.expense
        totalData += slot.income + slot.expense
        rows.push({
          key:         cur,
          label:       `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
          startDate:   cur,
          endDate:     cur,
          income:      slot.income,
          expense:     slot.expense,
          accumulated: running,
        })
        cur = addDays(cur, 1)
      }

      const todayLabel = rows.find(b => b.key === todayBK)?.label ?? ''
      return { chartData: rows, isEmpty: totalData === 0, todayBucketKey: todayBK, todayLabel }
    }

    // ── SEMANAL / MENSAL: lógica original (inalterada) ───────────────────────
    const buckets    = buildBuckets(granularity, filtered, now, dateFrom, dateTo)
    const todayLabel = buckets.find(b => b.key === todayBK)?.label ?? ''

    const bMap = new Map<string, { income: number; expense: number }>()
    buckets.forEach(b => bMap.set(b.key, { income: 0, expense: 0 }))

    for (const e of filtered) {
      const bk   = bucketKey(e.entry_date, granularity)
      const slot = bMap.get(bk)
      if (!slot) continue
      if (e.entry_type === 'income') slot.income  += e.amount
      else                           slot.expense += e.amount
    }

    let running   = 0
    let totalData = 0
    const chartData: ChartRow[] = buckets.map(b => {
      const { income, expense } = bMap.get(b.key)!
      running   += income - expense
      totalData += income + expense
      return { ...b, income, expense, accumulated: running }
    })

    return { chartData, isEmpty: totalData === 0, todayBucketKey: todayBK, todayLabel }
  }, [filtered, granularity, dateFrom, dateTo])

  const barPx   = BAR_PX[granularity]
  const barSize = Math.max(14, Math.floor(barPx * 0.38))
  const minW    = Math.max(560, chartData.length * barPx)

  const scrollToToday = useCallback(() => {
    const el = scrollRef.current
    if (!el || !chartData.length) return
    const idx = chartData.findIndex(b => b.key === todayBucketKey)
    if (idx < 0) return
    const scrollX = Math.max(0, idx * barPx - el.clientWidth / 2 + barPx / 2)
    el.scrollTo({ left: scrollX, behavior: 'smooth' })
  }, [chartData, todayBucketKey, barPx])

  // Auto-scroll to today on mount and when granularity changes
  useEffect(() => {
    if (mounted) {
      // defer so the DOM is painted first
      const id = setTimeout(scrollToToday, 80)
      return () => clearTimeout(id)
    }
  }, [mounted, granularity, scrollToToday])

  return (
    <section className="hidden md:block">
      {/* Header ─────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold text-dark">Fluxo de Caixa</h3>

        <div className="flex flex-wrap items-center gap-2">
          {/* Granularity pills */}
          <div className="flex overflow-hidden rounded-lg border border-gold/30">
            {(['daily', 'weekly', 'monthly'] as Granularity[]).map(g => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  granularity === g
                    ? 'bg-terracotta text-white'
                    : 'text-gray-400 hover:text-brown hover:bg-cream/30'
                }`}
              >
                {GRAN_LABELS[g]}
              </button>
            ))}
          </div>

          {/* Date range filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">De</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="rounded-lg border border-gold/30 bg-white py-1.5 px-2 text-xs text-brown hover:border-gold focus:outline-none focus:ring-2 focus:ring-gold/50"
            />
            <span className="text-xs text-gray-400">até</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={e => setDateTo(e.target.value)}
              className="rounded-lg border border-gold/30 bg-white py-1.5 px-2 text-xs text-brown hover:border-gold focus:outline-none focus:ring-2 focus:ring-gold/50"
            />
            {hasDateFilter && (
              <button
                onClick={() => { setDateFrom(''); setDateTo('') }}
                className="rounded-lg border border-gold/30 px-2 py-1.5 text-xs text-gray-400 hover:text-brown hover:border-gold transition-colors"
                title="Limpar filtro de datas"
              >
                ✕
              </button>
            )}
          </div>

          {/* Hoje button */}
          <button
            onClick={scrollToToday}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium text-brown transition-colors hover:bg-cream"
            style={{ borderColor: '#E6C07B' }}
          >
            Hoje
          </button>

          {/* Obra select */}
          <div className="relative">
            <select
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
              className="appearance-none cursor-pointer rounded-lg border border-gold/30 bg-white py-1.5 pl-3 pr-7 text-xs text-brown hover:border-gold focus:outline-none focus:ring-2 focus:ring-gold/50"
            >
              <option value="all">Todas as obras</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-brown text-xs">▾</span>
          </div>
        </div>
      </div>

      {/* Chart card ─────────────────────────────────────── */}
      <div className="rounded-xl border border-gold/30 bg-white p-5 shadow-sm relative">
        {/* Legend */}
        <div className="mb-3 flex flex-wrap justify-end gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm shrink-0" style={{ background: '#4A7C59' }} />
            Entradas
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm shrink-0" style={{ background: '#8B3A3A' }} />
            Saídas
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 shrink-0" style={{ background: '#3B2418' }} />
            Saldo acumulado
          </span>
        </div>

        {/* Spinner while recharts hydrates */}
        {!mounted ? (
          <div className="flex h-[300px] items-center justify-center">
            <div
              className="h-8 w-8 animate-spin rounded-full border-4"
              style={{ borderColor: '#C68B59', borderTopColor: 'transparent' }}
            />
          </div>
        ) : (
          <div ref={scrollRef} className="overflow-x-auto">
            <div style={{ width: minW, height: 300 }} className="[&_svg]:outline-none">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 22, right: 16, left: 4, bottom: 0 }}
                  barCategoryGap="12%"
                  barGap={2}
                >

                  {/* Separate scales: bars fill the chart, line floats on its own range */}
                  <YAxis yAxisId="bars" hide domain={[0, 'dataMax']} />
                  <YAxis yAxisId="line" hide orientation="right" />

                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                    interval={granularity === 'daily' ? 2 : 0}
                  />

                  <Tooltip content={<CfTooltip />} cursor={{ fill: '#F4E2B818' }} />

                  {/* "Hoje" reference line */}
                  {todayLabel && (
                    <ReferenceLine
                      x={todayLabel}
                      stroke="#C68B59"
                      strokeDasharray="4 3"
                      strokeWidth={1.5}
                      label={{
                        value: 'Hoje',
                        position: 'insideTopRight',
                        fontSize: 10,
                        fill: '#C68B59',
                        offset: 4,
                      }}
                    />
                  )}

                  {/* Income bars */}
                  <Bar
                    yAxisId="bars"
                    dataKey="income"
                    name="income"
                    fill="#4A7C59"
                    radius={[4, 4, 0, 0]}
                    barSize={barSize}
                    opacity={isEmpty ? 0.15 : 1}
                    cursor="pointer"
                  >
                    {granularity === 'monthly' && (
                      <LabelList
                        dataKey="income"
                        position="top"
                        formatter={(v: unknown) => typeof v === 'number' && v > 0 ? fmtY(v) : ''}
                        style={{ fontSize: 9, fill: '#4A7C59' }}
                      />
                    )}
                  </Bar>

                  {/* Expense bars */}
                  <Bar
                    yAxisId="bars"
                    dataKey="expense"
                    name="expense"
                    fill="#8B3A3A"
                    radius={[4, 4, 0, 0]}
                    barSize={barSize}
                    opacity={isEmpty ? 0.15 : 1}
                    cursor="pointer"
                  >
                    {granularity === 'monthly' && (
                      <LabelList
                        dataKey="expense"
                        position="top"
                        formatter={(v: unknown) => typeof v === 'number' && v > 0 ? fmtY(v) : ''}
                        style={{ fontSize: 9, fill: '#8B3A3A' }}
                      />
                    )}
                  </Bar>

                  {/* Saldo acumulado */}
                  <Line
                    yAxisId="line"
                    dataKey="accumulated"
                    name="accumulated"
                    stroke="#3B2418"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#3B2418' }}
                  />

                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {isEmpty && mounted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 rounded-xl">
            <p className="text-sm text-gray-400">Nenhum lançamento neste período</p>
            <Link
              href="/financeiro/novo"
              className="mt-3 rounded-lg bg-terracotta px-4 py-1.5 text-xs font-medium text-white hover:bg-brown transition-colors"
            >
              + Novo Lançamento
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
