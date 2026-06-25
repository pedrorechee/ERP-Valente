import { getPageClient } from '@/lib/supabase/action'
import { OrcamentosClient, type ObraRow } from '@/components/orcamentos/OrcamentosClient'
import { pctConsumido } from '@/lib/orcamento'
import type { BudgetStatus } from '@/types/database'

export default async function OrcamentosPage() {
  const supabase = await getPageClient()

  // Cada obra tem no máximo um orçamento (UNIQUE project_id). A lista é de OBRAS.
  const [{ data: projectsData }, { data: budgetsData }, { data: expensesData }] = await Promise.all([
    supabase.from('projects').select('id, name').order('name'),
    supabase.from('budgets').select('id, project_id, status, total_direct_cost, total_with_bdi'),
    // Realizado por obra = despesas pagas (independente de fase)
    supabase.from('financial_entries').select('project_id, amount').eq('entry_type', 'expense').eq('status', 'pago'),
  ])

  type BudgetRow = {
    id: string
    project_id: string
    status: BudgetStatus
    total_direct_cost: number
    total_with_bdi: number
  }
  const projects = (projectsData as { id: string; name: string }[]) ?? []
  const budgets  = (budgetsData as BudgetRow[]) ?? []
  const byProject = new Map(budgets.map((b) => [b.project_id, b]))

  // Soma das despesas pagas por obra
  const realizedByProject = new Map<string, number>()
  for (const e of (expensesData as { project_id: string; amount: number }[] | null) ?? []) {
    realizedByProject.set(e.project_id, (realizedByProject.get(e.project_id) ?? 0) + (e.amount ?? 0))
  }

  // Uma linha por obra; orçamento embutido (ou null quando "Sem orçamento")
  const rows: ObraRow[] = projects.map((p) => {
    const b = byProject.get(p.id) ?? null
    const isApproved = b?.status === 'aprovado'
    // % consumido só para orçamento APROVADO (rascunho não é usado → null)
    const consumidoPct = isApproved
      ? pctConsumido(b!.total_direct_cost ?? 0, realizedByProject.get(p.id) ?? 0)
      : null
    return {
      projectId: p.id,
      projectName: p.name,
      budgetId: b?.id ?? null,
      status: b?.status ?? null,
      totalDirectCost: b?.total_direct_cost ?? 0,
      totalWithBdi: b?.total_with_bdi ?? 0,
      consumidoPct,
    }
  })

  return <OrcamentosClient rows={rows} />
}
