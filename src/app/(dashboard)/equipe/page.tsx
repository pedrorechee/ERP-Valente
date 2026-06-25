export const dynamic = 'force-dynamic'

import { getPageClient } from '@/lib/supabase/action'
import { EmployeesManager, type EmployeeWithCount } from '@/components/equipe/EmployeesManager'
import type { Employee } from '@/types/database'

type EmployeeRow = Employee & { project_team: { id: string; end_date: string | null }[] }

export default async function EquipePage() {
  const supabase = await getPageClient()

  const { data } = await supabase
    .from('employees')
    .select('*, project_team(id, end_date)')
    .order('name')

  const rows = (data as EmployeeRow[] | null) ?? []
  const employees: EmployeeWithCount[] = rows.map(({ project_team, ...e }) => ({
    ...e,
    activeAllocations: (project_team ?? []).filter((t) => !t.end_date).length,
  }))

  return <EmployeesManager employees={employees} />
}
