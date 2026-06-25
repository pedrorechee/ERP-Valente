import Link from 'next/link'
import { ArrowRight, CheckCircle, Layers } from 'lucide-react'
import type { Project, ProjectPhase, PhaseTask, Client } from '@/types/database'
import {
  PROJECT_TYPE_LABELS, PHASE_STATUS_LABELS,
  CONSTRUCTION_SYSTEM_LABELS, FINISH_STANDARD_LABELS,
} from '@/types/database'
import { formatDate, formatCurrency } from '@/lib/format'

const PHASE_STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress:  'bg-blue-100 text-blue-700',
  completed:    'bg-green-100 text-green-700',
  delayed:      'bg-red-100 text-red-700',
}

interface Props {
  project:           Project & { clients?: Pick<Client, 'id' | 'name'> | null }
  phases:            (ProjectPhase & { phase_tasks: PhaseTask[] })[]
  totalGasto:        number
  plannedDirectCost: number
  realizedWithPhase: number
}

function calcDuration(start: string, end: string): string {
  const days = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (days < 30) return `${days} dia${days !== 1 ? 's' : ''}`
  const months = Math.floor(days / 30)
  const rem    = days % 30
  const mLabel = `${months} mês${months !== 1 ? 'es' : ''}`
  return rem === 0 ? mLabel : `${mLabel} e ${rem} dia${rem !== 1 ? 's' : ''}`
}

export function VisaoGeral({ project, phases, totalGasto, plannedDirectCost, realizedWithPhase }: Props) {
  const contractValue = project.contract_value ?? null
  const saldo         = contractValue !== null ? contractValue - totalGasto : null
  const margem        =
    contractValue && contractValue > 0
      ? ((contractValue - totalGasto) / contractValue) * 100
      : null
  // Mesmo cálculo do Dashboard: realizado (despesas pagas por fase) ÷ orçado (custo direto)
  const percentGasto  =
    plannedDirectCost > 0 ? (realizedWithPhase / plannedDirectCost) * 100 : null

  function barColor(pct: number): string {
    if (pct >= 90) return '#8B3A3A'
    if (pct >= 70) return '#C68B59'
    return '#4A7C59'
  }

  // ── Dados para o banner de conclusão ────────────────────────
  const isConcluida = project.status === 'completed' && !!project.actual_end_date
  let conclusaoBanner: string | null = null
  if (isConcluida && project.actual_end_date) {
    const prevDays  = Math.round(
      (new Date(project.expected_end_date).getTime() - new Date(project.start_date).getTime()) /
      (1000 * 60 * 60 * 24)
    )
    const realDays  = Math.round(
      (new Date(project.actual_end_date).getTime() - new Date(project.start_date).getTime()) /
      (1000 * 60 * 60 * 24)
    )
    const diff      = realDays - prevDays
    const prazoDesc =
      diff === 0 ? 'no prazo' :
      diff < 0   ? `${Math.abs(diff)} dia${Math.abs(diff) !== 1 ? 's' : ''} antes do prazo` :
                   `${diff} dia${diff !== 1 ? 's' : ''} de atraso`
    conclusaoBanner =
      `Obra concluída em ${formatDate(project.actual_end_date)}` +
      ` · ${prazoDesc}` +
      ` · Prazo realizado: ${calcDuration(project.start_date, project.actual_end_date)}`
  }

  return (
    <div className="space-y-5">

      {/* ── 1. Cards de informação ─────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {(() => {
          const cards: { label: string; value: string }[] = [
            { label: 'Tipo',             value: PROJECT_TYPE_LABELS[project.type] },
            { label: 'Área construída',  value: project.area_m2 ? `${project.area_m2} m²` : '—' },
            { label: 'Nº do Alvará',     value: project.permit_number ?? '—' },
            { label: 'Início',           value: formatDate(project.start_date) },
            { label: 'Término previsto', value: formatDate(project.expected_end_date) },
          ]
          // Novos campos — só aparecem quando preenchidos
          if (project.floors_count != null) cards.push({ label: 'Nº de pavimentos', value: String(project.floors_count) })
          if (project.construction_system) cards.push({ label: 'Sistema construtivo', value: CONSTRUCTION_SYSTEM_LABELS[project.construction_system] ?? project.construction_system })
          if (project.finish_standard) cards.push({ label: 'Padrão de acabamento', value: FINISH_STANDARD_LABELS[project.finish_standard] })
          if (project.art_number) cards.push({ label: 'ART / RRT', value: project.art_number })
          if (project.cno_number) cards.push({ label: 'CNO', value: project.cno_number })
          if (project.habite_se_number) cards.push({ label: 'Habite-se', value: project.habite_se_number })
          return cards.map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-gold/30 bg-white p-4">
              <p className="text-xs text-gray-400">{label}</p>
              <p className="mt-1 font-semibold text-dark text-sm">{value}</p>
            </div>
          ))
        })()}
      </div>

      {/* ── 2. Banner de conclusão (só quando concluída) ─────── */}
      {conclusaoBanner && (
        <div
          className="flex items-center gap-3 rounded-xl px-5 py-3"
          style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderLeft: '4px solid #4A7C59',
          }}
        >
          <CheckCircle className="h-4 w-4 shrink-0" style={{ color: '#4A7C59' }} />
          <p className="text-sm font-medium" style={{ color: '#166534' }}>
            {conclusaoBanner}
          </p>
        </div>
      )}

      {/* ── 3. Grid duas colunas: Fases | Financeiro ─────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">

        {/* Coluna esquerda — Progresso por Fase (60%) */}
        <div className="rounded-xl border border-gold/40 bg-white p-5 shadow-sm lg:col-span-3">
          <div className="mb-4 flex items-center gap-2">
            <Layers className="h-4 w-4 text-terracotta" />
            <h2 className="font-semibold text-dark">Progresso por Fase</h2>
          </div>

          {phases.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma fase cadastrada.</p>
          ) : (
            <div className="space-y-3">
              {phases.map((phase) => {
                const tasks          = phase.phase_tasks ?? []
                const completedTasks = tasks.filter((t) => t.completed).length

                return (
                  <div key={phase.id}>
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-dark">{phase.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PHASE_STATUS_COLORS[phase.status]}`}>
                          {PHASE_STATUS_LABELS[phase.status]}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        {tasks.length > 0 && (
                          <span>{completedTasks}/{tasks.length} tarefas</span>
                        )}
                        <span className="font-semibold text-dark">{phase.progress}%</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Coluna direita — Resumo Financeiro (40%) */}
        <div className="rounded-xl border border-gold/40 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-3 font-semibold text-dark">Resumo Financeiro</h2>

          <div className="divide-y divide-gray-100">
            {/* Valor do Contrato */}
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-500">Valor do Contrato</span>
              <span className="text-sm font-semibold text-dark">
                {contractValue != null ? formatCurrency(contractValue) : 'Não informado'}
              </span>
            </div>

            {/* Total Gasto */}
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-500">Total Gasto</span>
              <span className="text-sm font-semibold" style={{ color: '#8B3A3A' }}>
                {formatCurrency(totalGasto)}
              </span>
            </div>

            {/* Saldo */}
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-500">Saldo</span>
              <span
                className="text-sm font-semibold"
                style={{ color: saldo != null ? (saldo >= 0 ? '#4A7C59' : '#8B3A3A') : undefined }}
              >
                {saldo != null
                  ? saldo >= 0
                    ? `+${formatCurrency(saldo)}`
                    : formatCurrency(saldo)
                  : '—'}
              </span>
            </div>

            {/* Margem */}
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-500">Margem</span>
              <span
                className="text-sm font-semibold"
                style={{
                  color: margem != null
                    ? margem >= 15 ? '#4A7C59' : margem >= 5 ? '#C68B59' : '#8B3A3A'
                    : undefined,
                }}
              >
                {margem != null ? `${margem.toFixed(1).replace('.', ',')}%` : '—'}
              </span>
            </div>
          </div>

          {/* Barra de progresso do orçamento */}
          {percentGasto != null && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs text-gray-400">
                <span>Orçamento consumido</span>
                <span>
                  {Math.min(percentGasto, 100).toFixed(1).replace('.', ',')}%
                  {percentGasto > 100 && ' (excedido)'}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(percentGasto, 100)}%`,
                    backgroundColor: barColor(percentGasto),
                  }}
                />
              </div>
              {percentGasto > 100 && (
                <p className="mt-1.5 text-xs font-medium" style={{ color: '#8B3A3A' }}>
                  Gastos ultrapassaram o orçamento em {formatCurrency(realizedWithPhase - plannedDirectCost)}.
                </p>
              )}
              {percentGasto > 90 && percentGasto <= 100 && (
                <p className="mt-1.5 text-xs" style={{ color: '#C68B59' }}>
                  Atenção: mais de 90% do orçamento já foi utilizado.
                </p>
              )}
            </div>
          )}

          {/* Botão Ver lançamentos */}
          <div className="mt-4 border-t border-gray-100 pt-4">
            <Link
              href={`/financeiro?obra=${project.id}`}
              className="flex items-center gap-1.5 text-sm font-medium transition-colors"
              style={{ color: '#C68B59' }}
            >
              Ver lançamentos
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
