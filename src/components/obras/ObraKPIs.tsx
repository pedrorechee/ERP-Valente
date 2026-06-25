import type { Project, ProjectPhase, PhaseTask } from '@/types/database'

interface Props {
  project: Project
  phases:  (ProjectPhase & { phase_tasks: PhaseTask[] })[]
  totalPago: number
}

const GREEN = '#4A7C59'
const TERRACOTTA = '#C68B59'
const RED = '#8B3A3A'
const NEUTRAL = '#3B2418'

function dayDiff(fromIso: string, toIso: string): number {
  return Math.round(
    (new Date(toIso + 'T00:00:00Z').getTime() - new Date(fromIso + 'T00:00:00Z').getTime()) /
    86400000
  )
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export type KpiCard = { label: string; value: string; color: string; sub?: string | null }

// Cálculo dos 4 KPIs em memória — reutilizado pelo card e pelo relatório PDF
export function getKpiCards({ project, phases, totalPago }: Props): KpiCard[] {
  const today = todayIso()
  const isClosed = project.status === 'completed' || project.status === 'cancelled'

  // ── 1. Dias restantes ────────────────────────────────────────
  let diasRestLabel: string
  let diasRestColor: string
  if (isClosed) {
    diasRestLabel = project.status === 'completed' ? 'Concluída' : 'Cancelada'
    diasRestColor = NEUTRAL
  } else {
    const dias = dayDiff(today, project.expected_end_date)
    if (dias < 0) {
      diasRestLabel = `${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'} de atraso`
      diasRestColor = RED
    } else {
      diasRestLabel = `${dias} ${dias === 1 ? 'dia' : 'dias'}`
      diasRestColor = dias > 30 ? GREEN : dias >= 7 ? TERRACOTTA : RED
    }
  }

  // ── 2. Saúde do prazo ────────────────────────────────────────
  let saudeLabel: string
  let saudeColor: string
  let saudeSub: string | null = null
  if (isClosed) {
    saudeLabel = '—'
    saudeColor = NEUTRAL
  } else {
    const totalDias = dayDiff(project.start_date, project.expected_end_date)
    const decorridos = dayDiff(project.start_date, today)
    const tempoPct = totalDias <= 0 ? 100 : Math.max(0, Math.min(100, (decorridos / totalDias) * 100))
    const noRitmo = project.overall_progress >= tempoPct
    saudeLabel = noRitmo ? 'No ritmo' : 'Atrasado'
    saudeColor = noRitmo ? GREEN : RED
    saudeSub = `Progresso ${Math.round(project.overall_progress)}% · Tempo ${Math.round(tempoPct)}%`
  }

  // ── 3. Custo / m² ────────────────────────────────────────────
  let custoLabel: string
  const custoColor = NEUTRAL
  if (project.area_m2 && project.area_m2 > 0) {
    custoLabel = `${formatMoney(totalPago / project.area_m2)}/m²`
  } else {
    custoLabel = '—'
  }

  // ── 4. Prazo médio das fases ─────────────────────────────────
  const concluidas = phases.filter(
    (p) => p.status === 'completed' && p.actual_end && p.expected_end
  )
  let prazoLabel: string
  let prazoColor: string
  if (concluidas.length === 0) {
    prazoLabel = '—'
    prazoColor = NEUTRAL
  } else {
    const somaDiff = concluidas.reduce(
      (sum, p) => sum + dayDiff(p.expected_end!, p.actual_end!),
      0
    )
    const media = Math.round(somaDiff / concluidas.length)
    if (media > 0) {
      prazoLabel = `${media} ${media === 1 ? 'dia' : 'dias'} de atraso`
      prazoColor = RED
    } else if (media < 0) {
      prazoLabel = `${Math.abs(media)} ${Math.abs(media) === 1 ? 'dia' : 'dias'} adiantado`
      prazoColor = GREEN
    } else {
      prazoLabel = 'No prazo'
      prazoColor = GREEN
    }
  }

  return [
    { label: 'Dias restantes',        value: diasRestLabel, color: diasRestColor },
    { label: 'Saúde do prazo',        value: saudeLabel,    color: saudeColor, sub: saudeSub },
    { label: 'Custo / m²',            value: custoLabel,    color: custoColor },
    { label: 'Prazo médio das fases', value: prazoLabel,    color: prazoColor },
  ]
}

export function ObraKPIs({ project, phases, totalPago }: Props) {
  const cards = getKpiCards({ project, phases, totalPago })

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-medium text-gray-400">{c.label}</p>
          <p className="mt-1 text-lg font-bold" style={{ color: c.color }}>{c.value}</p>
          {c.sub && <p className="mt-0.5 text-xs text-gray-400">{c.sub}</p>}
        </div>
      ))}
    </div>
  )
}
