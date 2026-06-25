'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Building2, ChevronDown, TrendingDown, TrendingUp, FileSignature } from 'lucide-react'
import { formatCurrency } from '@/lib/format'

const STORAGE_KEY = 'dashboard-period'

const PERIOD_OPTIONS = [
  { value: 'this-month',     label: 'Este mês',          title: 'do mês',     sub: 'no mês' },
  { value: 'last-3-months',  label: 'Últimos 3 meses',   title: 'do período', sub: 'nos últimos 3 meses' },
  { value: 'last-6-months',  label: 'Últimos 6 meses',   title: 'do período', sub: 'nos últimos 6 meses' },
  { value: 'last-12-months', label: 'Últimos 12 meses',  title: 'do período', sub: 'nos últimos 12 meses' },
  { value: 'this-year',      label: 'Este ano',          title: 'do ano',     sub: 'no ano' },
] as const

type PeriodValue = (typeof PERIOD_OPTIONS)[number]['value']

export type StatsEntry = {
  entry_date: string
  entry_type: 'income' | 'expense'
  amount: number
}

function firstDayOfMonth(year: number, monthIndex: number): string {
  const d = new Date(year, monthIndex, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function periodStart(period: PeriodValue, now: Date): string {
  const y = now.getFullYear()
  const m = now.getMonth()
  switch (period) {
    case 'this-month':     return firstDayOfMonth(y, m)
    case 'last-3-months':  return firstDayOfMonth(y, m - 2)
    case 'last-6-months':  return firstDayOfMonth(y, m - 5)
    case 'last-12-months': return firstDayOfMonth(y, m - 12)
    case 'this-year':      return `${y}-01-01`
  }
}

export function DashboardStats({
  entries,
  activeCount,
  overdueCount,
  completedCount,
  negativeBalanceCount,
  saldoAFaturar = 0,
}: {
  entries: StatsEntry[]
  activeCount: number
  overdueCount: number
  completedCount: number
  negativeBalanceCount: number
  saldoAFaturar?: number
}) {
  const [period, setPeriod] = useState<PeriodValue>('this-month')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && PERIOD_OPTIONS.some((o) => o.value === saved)) {
      setPeriod(saved as PeriodValue)
    }
  }, [])

  function handlePeriodChange(value: PeriodValue) {
    setPeriod(value)
    localStorage.setItem(STORAGE_KEY, value)
  }

  const option = PERIOD_OPTIONS.find((o) => o.value === period) ?? PERIOD_OPTIONS[0]

  const now = new Date()

  const { income, expense } = useMemo(() => {
    const start = periodStart(period, new Date())
    let income = 0
    let expense = 0
    for (const entry of entries) {
      if (entry.entry_date < start) continue
      if (entry.entry_type === 'income') income += entry.amount
      else expense += entry.amount
    }
    return { income, expense }
  }, [entries, period])

  const balance = income - expense

  return (
    <>
      {/* Título desktop + seletor de período */}
      <div className="hidden md:flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-dark">Visão Geral</h2>
          <p className="text-sm text-gray-400">
            {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="relative">
          <select
            value={period}
            onChange={(e) => handlePeriodChange(e.target.value as PeriodValue)}
            aria-label="Período dos resumos financeiros"
            className="appearance-none cursor-pointer rounded-lg border border-gold bg-transparent py-1.5 pl-3 pr-8 text-sm font-medium text-brown transition-colors hover:bg-cream/30 focus:outline-none focus:ring-2 focus:ring-gold/50"
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brown" />
        </div>
      </div>

      {/* Cards financeiros + obras (desktop) */}
      <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Obras ativas"
          value={activeCount.toString()}
          icon={<Building2 className="h-5 w-5" />}
          sub={`${overdueCount} atrasada${overdueCount !== 1 ? 's' : ''}`}
          subColor={overdueCount > 0 ? 'text-red-500' : 'text-gray-400'}
          subCompleted={`${completedCount} concluída${completedCount !== 1 ? 's' : ''}`}
          sub2={negativeBalanceCount > 0
            ? `${negativeBalanceCount} com saldo negativo`
            : undefined}
          sub2Color="text-red-500"
          href="/obras"
        />
        <StatCard
          label={`Receitas ${option.title}`}
          value={formatCurrency(income)}
          icon={<TrendingUp className="h-5 w-5 text-green-500" />}
          sub={`Entradas ${option.sub}`}
          href="/financeiro"
        />
        <StatCard
          label={`Despesas ${option.title}`}
          value={formatCurrency(expense)}
          icon={<TrendingDown className="h-5 w-5 text-red-400" />}
          sub={`Saídas ${option.sub}`}
          href="/financeiro"
        />
        <StatCard
          label={`Resultado ${option.title}`}
          value={formatCurrency(balance)}
          icon={
            balance >= 0
              ? <TrendingUp className="h-5 w-5 text-blue-500" />
              : <TrendingDown className="h-5 w-5 text-red-400" />
          }
          sub={balance >= 0 ? 'Positivo' : 'Negativo'}
          subColor={balance >= 0 ? 'text-green-500' : 'text-red-500'}
          href="/financeiro"
        />
        {saldoAFaturar > 0 && (
          <StatCard
            label="Saldo a faturar"
            value={formatCurrency(saldoAFaturar)}
            icon={<FileSignature className="h-5 w-5" />}
            sub="Contratos ativos"
            subColor="text-green-600"
            href="/contratos"
          />
        )}
      </div>

      {/* Cards simplificados mobile */}
      <div className="md:hidden grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gold/30 bg-white p-4">
          <p className="text-xs text-gray-400">Obras ativas</p>
          <p className="mt-1 text-2xl font-bold text-dark">{activeCount}</p>
          <div className="mt-0.5 flex items-center gap-3">
            <span className={`text-xs ${overdueCount > 0 ? 'text-red-500' : 'text-gray-400'}`}>
              {overdueCount} atrasada{overdueCount !== 1 ? 's' : ''}
            </span>
            <span className="text-xs" style={{ color: '#4A7C59' }}>
              {completedCount} concluída{completedCount !== 1 ? 's' : ''}
            </span>
          </div>
          {negativeBalanceCount > 0 && (
            <p className="text-xs text-red-500">{negativeBalanceCount} saldo negativo</p>
          )}
        </div>
        <div className="rounded-xl border border-gold/30 bg-white p-4">
          <p className="text-xs text-gray-400">Resultado {option.title}</p>
          <p className={`mt-1 text-lg font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {formatCurrency(balance)}
          </p>
        </div>
        {saldoAFaturar > 0 && (
          <Link href="/contratos" className="rounded-xl border border-gold/30 bg-white p-4">
            <p className="text-xs text-gray-400">Saldo a faturar</p>
            <p className="mt-1 text-lg font-bold" style={{ color: '#4A7C59' }}>
              {formatCurrency(saldoAFaturar)}
            </p>
          </Link>
        )}
      </div>
    </>
  )
}

function StatCard({
  label,
  value,
  icon,
  sub,
  subColor = 'text-gray-400',
  subCompleted,
  sub2,
  sub2Color = 'text-gray-400',
  href,
}: {
  label: string
  value: string
  icon: React.ReactNode
  sub?: string
  subColor?: string
  subCompleted?: string
  sub2?: string
  sub2Color?: string
  href: string
}) {
  return (
    <Link href={href}>
      <div className="rounded-xl border border-gold/30 bg-white p-5 shadow-sm hover:border-gold hover:shadow-md transition-all group">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-400">{label}</p>
          <div className="text-gray-300 group-hover:text-terracotta transition-colors">{icon}</div>
        </div>
        <p className="text-xl font-bold text-dark">{value}</p>
        {(sub || subCompleted) && (
          <div className="mt-0.5 flex items-center gap-3">
            {sub && <span className={`text-xs ${subColor}`}>{sub}</span>}
            {subCompleted && <span className="text-xs" style={{ color: '#4A7C59' }}>{subCompleted}</span>}
          </div>
        )}
        {sub2 && <p className={`mt-0.5 text-xs ${sub2Color}`}>{sub2}</p>}
      </div>
    </Link>
  )
}
