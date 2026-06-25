'use client'

import dynamic from 'next/dynamic'
import type { ProjectPhase, PhaseTask, CriticalMilestone } from '@/types/database'

// Gráfico de Gantt carregado sob demanda, fora do bundle inicial
const CronogramaChart = dynamic(() => import('@/components/obras/CronogramaChart'), {
  ssr: false,
  loading: () => <ChartSpinner />,
})

function ChartSpinner() {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-xl border border-gold/40 bg-white">
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
  phases:          (ProjectPhase & { phase_tasks: PhaseTask[] })[]
  milestones:      CriticalMilestone[]
  overallProgress: number
}

export function Cronograma({ phases, milestones, overallProgress }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-dark">Cronograma da Obra</h2>
      <CronogramaChart phases={phases} milestones={milestones} overallProgress={overallProgress} />
    </div>
  )
}
