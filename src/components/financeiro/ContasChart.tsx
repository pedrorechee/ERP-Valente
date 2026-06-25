'use client'

import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { formatCurrency } from '@/lib/format'

export interface ContasPoint {
  label:        string
  aReceber:     number
  aPagar:       number
  saldoPeriodo: number
  saldoAcum:    number
  saldoPast:    number | null
  saldoFuture:  number | null
}

interface Props {
  data:       ContasPoint[]
  todayLabel: string
}

function TooltipContent({ active, payload }: {
  active?: boolean
  payload?: { payload: ContasPoint }[]
}) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border bg-white p-3 text-xs shadow-md" style={{ borderColor: '#E6C07B' }}>
      <p className="mb-1.5 font-semibold text-dark">{p.label}</p>
      <div className="space-y-0.5">
        <div className="flex justify-between gap-4">
          <span style={{ color: '#4A7C59' }}>A receber</span>
          <span className="font-medium" style={{ color: '#4A7C59' }}>{formatCurrency(p.aReceber)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span style={{ color: '#8B3A3A' }}>A pagar</span>
          <span className="font-medium" style={{ color: '#8B3A3A' }}>{formatCurrency(p.aPagar)}</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-gold/20 pt-0.5">
          <span className="text-gray-500">Saldo do período</span>
          <span className="font-medium text-dark">{formatCurrency(p.saldoPeriodo)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Saldo acumulado</span>
          <span className="font-semibold" style={{ color: '#3B2418' }}>{formatCurrency(p.saldoAcum)}</span>
        </div>
      </div>
    </div>
  )
}

export function ContasChart({ data, todayLabel }: Props) {
  return (
    <ResponsiveContainer width="100%" height={380}>
      <ComposedChart data={data} margin={{ top: 16, right: 16, bottom: 0, left: 8 }} barGap={2} barCategoryGap="22%">
        {/* Grade limpa: só linhas horizontais */}
        <CartesianGrid vertical={false} stroke="#F4E2B8" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#8A5A3B' }}
          minTickGap={20}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#8A5A3B' }}
          tickFormatter={(v: number) =>
            v >= 1000 || v <= -1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v))
          }
          width={56}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<TooltipContent />} cursor={{ fill: 'rgba(244,226,184,0.25)' }} />
        <Bar dataKey="aReceber" name="A receber" fill="#4A7C59" radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={false} />
        <Bar dataKey="aPagar"   name="A pagar"   fill="#8B3A3A" radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={false} />
        <Line
          type="monotone"
          dataKey="saldoPast"
          name="Saldo acumulado"
          stroke="#3B2418"
          strokeWidth={2.5}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="saldoFuture"
          stroke="#3B2418"
          strokeWidth={2.5}
          strokeDasharray="6 4"
          dot={false}
          isAnimationActive={false}
        />
        <ReferenceLine
          x={todayLabel}
          stroke="#C68B59"
          strokeWidth={1.5}
          label={{ value: 'HOJE', fill: '#C68B59', fontSize: 11, position: 'top', fontWeight: 600 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export default ContasChart
