export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getPageClient } from '@/lib/supabase/action'
import { ApontamentoGrade } from '@/components/equipe/ApontamentoGrade'
import type { WorkLog } from '@/types/database'
import type { GradeEmployee, GradePhase, GradeProject } from '@/components/equipe/ApontamentoGrade'

type SearchParams = Promise<{ obra?: string }>

export default async function ApontamentoPage({ searchParams }: { searchParams: SearchParams }) {
  const { obra } = await searchParams
  const supabase = await getPageClient()

  const { data: projData } = await supabase
    .from('projects')
    .select('id, name, status')
    .neq('status', 'cancelled')
    .order('name')
  const projects = (projData as GradeProject[] | null) ?? []

  let employees: GradeEmployee[] = []
  let phases: GradePhase[] = []
  let workLogs: WorkLog[] = []

  if (obra) {
    const [{ data: teamData }, { data: phaseData }, { data: logData }] = await Promise.all([
      supabase
        .from('project_team')
        .select('employee_id, role_in_project, employees(id, name, role, employment_type, monthly_salary, daily_rate, charge_factor, work_days_month)')
        .eq('project_id', obra)
        .is('end_date', null),
      supabase.from('project_phases').select('id, name').eq('project_id', obra).order('order_index'),
      supabase.from('work_logs').select('*').eq('project_id', obra),
    ])

    type TeamJoin = {
      employee_id: string
      role_in_project: string | null
      employees: Omit<GradeEmployee, 'role_in_project'> | null
    }
    employees = ((teamData as TeamJoin[] | null) ?? [])
      .filter((t) => t.employees)
      .map((t) => ({ ...(t.employees as Omit<GradeEmployee, 'role_in_project'>), role_in_project: t.role_in_project }))
    phases = (phaseData as GradePhase[] | null) ?? []
    workLogs = (logData as WorkLog[] | null) ?? []
  }

  return (
    <div className="space-y-5">
      <Link
        href={obra ? `/obras/${obra}?tab=equipe` : '/equipe'}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-dark transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        {obra ? 'Voltar à obra' : 'RH e Equipe'}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-dark">Apontamento de equipe</h1>
        <p className="text-sm text-gray-400">Presença, horas e custo da mão de obra própria por obra e semana</p>
      </div>

      <ApontamentoGrade
        projects={projects}
        selectedObra={obra ?? ''}
        employees={employees}
        phases={phases}
        workLogs={workLogs}
      />
    </div>
  )
}
