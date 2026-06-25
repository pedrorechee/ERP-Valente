'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, Cell, LabelList, ReferenceLine,
} from 'recharts'
import { formatCurrency } from '@/lib/format'
import type { OrcamentoRow } from './OrcamentoResumo'

// Paleta
const DOURADO   = '#E6C07B'
const TERRACOTA = '#C68B59'
const MARROM    = '#8A5A3B'
const VERDE     = '#4A7C59'
const VERMELHO  = '#8B3A3A'
const ESCURO    = '#3B2418'

function fmtPct(v: number): string {
  return `${v.toFixed(1).replace('.', ',')}%`
}

// Formato compacto de R$ para o eixo X (200k, 1.2M)
function fmtCompact(v: number): string {
  const a = Math.abs(v)
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (a >= 1_000)     return `${Math.round(v / 1_000)}k`
  return String(Math.round(v))
}

// Trunca nomes longos no eixo Y (tooltip mostra o nome completo)
function truncName(s: string): string {
  return s.length > 16 ? `${s.slice(0, 15)}…` : s
}

// Faixa de risco do % consumido (regra dos gráficos: 85% / 100%)
function faixaColor(pct: number): string {
  if (pct > 100) return VERMELHO
  if (pct >= 85) return TERRACOTA
  return VERDE
}
function faixaSituacao(pct: number): string {
  if (pct > 100) return 'Estourado'
  if (pct >= 85) return 'No limite'
  return 'Dentro do orçado'
}

const boxStyle: React.CSSProperties = { border: `1px solid ${DOURADO}`, color: ESCURO }

// ── Tooltip do gráfico 1 (Orçado vs Realizado) ──
function TooltipOrcRel({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const orcado    = payload.find((p) => p.dataKey === 'orcado')?.value ?? 0
  const realizado = payload.find((p) => p.dataKey === 'realizado')?.value ?? 0
  const saldo     = orcado - realizado
  return (
    <div className="rounded-lg bg-white p-3 text-xs shadow-lg space-y-1 min-w-[200px]" style={boxStyle}>
      <p className="font-semibold mb-1.5">{label}</p>
      <div className="flex justify-between gap-4">
        <span style={{ color: MARROM }}>Orçado</span>
        <span className="font-medium" style={{ color: MARROM }}>{formatCurrency(orcado)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span style={{ color: TERRACOTA }}>Realizado</span>
        <span className="font-medium" style={{ color: TERRACOTA }}>{formatCurrency(realizado)}</span>
      </div>
      <div className="flex justify-between gap-4 border-t pt-1" style={{ borderColor: '#F4E2B8' }}>
        <span style={{ color: saldo >= 0 ? VERDE : VERMELHO }}>Saldo</span>
        <span className="font-semibold" style={{ color: saldo >= 0 ? VERDE : VERMELHO }}>{formatCurrency(saldo)}</span>
      </div>
    </div>
  )
}

// ── Tooltip do gráfico 2 (% consumido) ──
function TooltipPct({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const pct = payload[0]?.value ?? 0
  const color = faixaColor(pct)
  return (
    <div className="rounded-lg bg-white p-3 text-xs shadow-lg space-y-1 min-w-[180px]" style={boxStyle}>
      <p className="font-semibold mb-1.5">{label}</p>
      <div className="flex justify-between gap-4">
        <span style={{ color: MARROM }}>% consumido</span>
        <span className="font-semibold" style={{ color }}>{fmtPct(pct)}</span>
      </div>
      <p className="font-medium" style={{ color }}>{faixaSituacao(pct)}</p>
    </div>
  )
}

export function OrcamentoCharts({ rows }: { rows: OrcamentoRow[] }) {
  // Altura confortável: cada obra com espaçamento legível (mesma nos dois gráficos)
  const chartHeight = Math.max(180, rows.length * 46 + 64)
  // Escala do eixo % deixa espaço para o rótulo e para a linha de 100%
  const maxPct = rows.reduce((m, r) => Math.max(m, r.pct), 0)
  const pctMax = Math.max(110, Math.ceil(maxPct / 10) * 10 + 10)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* ── Gráfico 1 — Orçado vs Realizado ── */}
      <div className="rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: MARROM }}>
          Orçado vs Realizado por obra
        </p>
        <div className="[&_svg]:outline-none" style={{ width: '100%', height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 0, left: 4 }}
              barGap={2}
              barCategoryGap="24%"
            >
              <CartesianGrid horizontal={false} stroke="#F4E2B8" />
              <XAxis
                type="number"
                tickFormatter={fmtCompact}
                tick={{ fontSize: 11, fill: MARROM }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={116}
                tickFormatter={truncName}
                tick={{ fontSize: 11, fill: MARROM }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<TooltipOrcRel />} cursor={{ fill: 'rgba(244,226,184,0.25)' }} />
              <Legend verticalAlign="top" height={28} iconType="square" wrapperStyle={{ fontSize: 12, color: MARROM }} />
              <Bar dataKey="orcado"    name="Orçado"    fill={DOURADO}   radius={[0, 3, 3, 0]} maxBarSize={16} isAnimationActive={false} />
              <Bar dataKey="realizado" name="Realizado" fill={TERRACOTA} radius={[0, 3, 3, 0]} maxBarSize={16} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Gráfico 2 — % Consumido ── */}
      <div className="rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: MARROM }}>
            % Consumido por obra
          </p>
          <div className="flex flex-wrap gap-3 text-[11px] text-gray-500">
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: VERDE }} />Dentro</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: TERRACOTA }} />No limite</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: VERMELHO }} />Estourado</span>
          </div>
        </div>
        <div className="[&_svg]:outline-none" style={{ width: '100%', height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 4, right: 44, bottom: 0, left: 4 }}
              barCategoryGap="24%"
            >
              <CartesianGrid horizontal={false} stroke="#F4E2B8" />
              <XAxis
                type="number"
                domain={[0, pctMax]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fontSize: 11, fill: MARROM }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={116}
                tickFormatter={truncName}
                tick={{ fontSize: 11, fill: MARROM }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<TooltipPct />} cursor={{ fill: 'rgba(244,226,184,0.25)' }} />
              {/* Limite do orçamento (100%) */}
              <ReferenceLine
                x={100}
                stroke={MARROM}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{ value: '100%', position: 'top', fontSize: 10, fill: MARROM }}
              />
              <Bar dataKey="pct" name="% consumido" radius={[0, 3, 3, 0]} maxBarSize={20} isAnimationActive={false}>
                {rows.map((r) => (
                  <Cell key={r.budgetId} fill={faixaColor(r.pct)} />
                ))}
                <LabelList
                  dataKey="pct"
                  position="right"
                  formatter={(v: unknown) => (typeof v === 'number' ? fmtPct(v) : '')}
                  style={{ fontSize: 11, fontWeight: 600, fill: ESCURO }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export default OrcamentoCharts
