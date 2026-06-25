export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getPageClient } from '@/lib/supabase/action'
import type { Employee, ProjectTeam, WorkLog } from '@/types/database'
import { FuncionarioDetalhe } from '@/components/equipe/FuncionarioDetalhe'

type Params = Promise<{ id: string }>

export default async function FuncionarioPage({ params }: { params: Params }) {
  const { id } = await params
  const supabase = await getPageClient()

  const [{ data: empData }, { data: allocData }, { data: logData }, { data: projData }] =
    await Promise.all([
      supabase.from('employees').select('*').eq('id', id).single(),
      supabase
        .from('project_team')
        .select('*, projects(id, name, status)')
        .eq('employee_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('work_logs')
        .select('*, projects(id, name), project_phases(name)')
        .eq('employee_id', id)
        .order('log_date', { ascending: false }),
      supabase.from('projects').select('id, name, status').order('name'),
    ])

  if (!empData) notFound()

  return (
    <div className="space-y-5">
      <Link
        href="/equipe"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-dark transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        RH e Equipe
      </Link>

      <FuncionarioDetalhe
        employee={empData as Employee}
        allocations={(allocData as AllocationRow[]) ?? []}
        workLogs={(logData as WorkLogRow[]) ?? []}
        projects={(projData as ProjectOption[]) ?? []}
      />
    </div>
  )
}

export type AllocationRow = ProjectTeam & {
  projects: { id: string; name: string; status: string } | null
}
export type WorkLogRow = WorkLog & {
  projects: { id: string; name: string } | null
  project_phases: { name: string } | null
}
export type ProjectOption = { id: string; name: string; status: string }
