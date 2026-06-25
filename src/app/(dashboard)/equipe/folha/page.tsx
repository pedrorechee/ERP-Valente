export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getPageClient } from '@/lib/supabase/action'
import { PAYROLL_CATEGORY_CODE } from '@/types/database'
import { FolhaManager } from '@/components/equipe/FolhaManager'
import type { PreviewGroup, ExistingEntry, FolhaProject } from '@/components/equipe/FolhaManager'

type SearchParams = Promise<{ mes?: string }>

function defaultMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

export default async function FolhaPage({ searchParams }: { searchParams: SearchParams }) {
  const { mes: mesParam } = await searchParams
  const mes = /^\d{4}-\d{2}$/.test(mesParam ?? '') ? (mesParam as string) : defaultMonth()
  const [y, m] = mes.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const periodStart = `${mes}-01`
  const periodEnd = `${mes}-${String(lastDay).padStart(2, '0')}`

  const supabase = await getPageClient()

  const { data: cat } = await supabase
    .from('cost_categories')
    .select('id')
    .eq('code', PAYROLL_CATEGORY_CODE)
    .maybeSingle()
  const payrollCatId = (cat as { id: string } | null)?.id ?? null

  const [{ data: projData }, { data: logData }, existingRes] = await Promise.all([
    supabase.from('projects').select('id, name').order('name'),
    supabase
      .from('work_logs')
      .select('employee_id, project_id, phase_id, computed_cost, employees(name), projects(name), project_phases(name)')
      .is('financial_entry_id', null)
      .gte('log_date', periodStart)
      .lte('log_date', periodEnd),
    payrollCatId
      ? supabase
          .from('financial_entries')
          .select('id, description, amount, status, project_id, phase_id, projects(name), project_phases(name)')
          .eq('category_id', payrollCatId)
          .gte('entry_date', periodStart)
          .lte('entry_date', periodEnd)
          .order('description')
      : Promise.resolve({ data: [] as unknown[] }),
  ])

  // Agrupa apontamentos não lançados por funcionário + obra + fase
  type LogRow = {
    employee_id: string; project_id: string; phase_id: string | null; computed_cost: number
    employees: { name: string } | null
    projects: { name: string } | null
    project_phases: { name: string } | null
  }
  const groupMap = new Map<string, PreviewGroup>()
  for (const w of ((logData as LogRow[] | null) ?? [])) {
    const key = `${w.employee_id}|${w.project_id}|${w.phase_id ?? 'none'}`
    const g = groupMap.get(key) ?? {
      key,
      employee_name: w.employees?.name ?? 'Funcionário',
      project_id: w.project_id,
      project_name: w.projects?.name ?? '',
      phase_id: w.phase_id,
      phase_name: w.project_phases?.name ?? null,
      cost: 0,
      days: 0,
    }
    g.cost += w.computed_cost ?? 0
    g.days += 1
    groupMap.set(key, g)
  }
  const groups = [...groupMap.values()]
    .filter((g) => g.cost > 0)
    .map((g) => ({ ...g, cost: Math.round(g.cost * 100) / 100 }))
    .sort((a, b) => a.project_name.localeCompare(b.project_name) || a.employee_name.localeCompare(b.employee_name))

  type EntryRow = {
    id: string; description: string; amount: number; status: string
    project_id: string; phase_id: string | null
    projects: { name: string } | null
    project_phases: { name: string } | null
  }
  const existing: ExistingEntry[] = (((existingRes.data as EntryRow[] | null) ?? [])).map((e) => ({
    id: e.id,
    description: e.description,
    amount: e.amount,
    status: e.status,
    project_id: e.project_id,
    project_name: e.projects?.name ?? '',
    phase_name: e.project_phases?.name ?? null,
  }))

  const projects = (projData as FolhaProject[] | null) ?? []

  return (
    <div className="space-y-5">
      <Link
        href="/equipe"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-dark transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        RH e Equipe
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-dark">Fechamento de folha</h1>
        <p className="text-sm text-gray-400">
          Consolida os apontamentos do período em lançamentos de despesa no Financeiro
        </p>
      </div>

      <FolhaManager
        mes={mes}
        periodStart={periodStart}
        periodEnd={periodEnd}
        projects={projects}
        groups={groups}
        existing={existing}
      />
    </div>
  )
}
