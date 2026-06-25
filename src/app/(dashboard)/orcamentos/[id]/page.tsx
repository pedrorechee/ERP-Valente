import { notFound } from 'next/navigation'
import { getPageClient } from '@/lib/supabase/action'
import type { Budget, BudgetItem, ProjectPhase, CostCategory } from '@/types/database'
import { OrcamentoBuilder } from '@/components/orcamentos/OrcamentoBuilder'

type Params = Promise<{ id: string }>

type BudgetWithProject = Budget & { projects?: { id: string; name: string } | null }

export default async function OrcamentoConstrutorPage({ params }: { params: Params }) {
  const { id } = await params
  const supabase = await getPageClient()

  const { data: budgetData } = await supabase
    .from('budgets')
    .select('*, projects(id, name)')
    .eq('id', id)
    .single()

  if (!budgetData) notFound()
  const budget = budgetData as BudgetWithProject

  // Fases da obra, itens do orçamento, categorias e despesas realizadas — em paralelo
  const [{ data: phasesData }, { data: itemsData }, { data: catsData }, { data: realizedData }] = await Promise.all([
    supabase
      .from('project_phases')
      .select('*')
      .eq('project_id', budget.project_id)
      .order('order_index', { ascending: true }),
    supabase
      .from('budget_items')
      .select('*')
      .eq('budget_id', id)
      .order('order_index', { ascending: true }),
    supabase
      .from('cost_categories')
      .select('*')
      .eq('nature', 'expense')
      .eq('is_active', true)
      .order('code'),
    // Realizado = despesas pagas da obra (com fase), para o orçado x realizado
    supabase
      .from('financial_entries')
      .select('phase_id, amount')
      .eq('project_id', budget.project_id)
      .eq('entry_type', 'expense')
      .eq('status', 'pago'),
  ])

  // Agrega o realizado por fase (e o que não tem fase)
  const realizedByPhase: Record<string, number> = {}
  let realizedNoPhase = 0
  for (const r of (realizedData as { phase_id: string | null; amount: number }[]) ?? []) {
    if (r.phase_id) realizedByPhase[r.phase_id] = (realizedByPhase[r.phase_id] ?? 0) + r.amount
    else realizedNoPhase += r.amount
  }

  return (
    <OrcamentoBuilder
      budget={budget}
      phases={(phasesData as ProjectPhase[]) ?? []}
      items={(itemsData as BudgetItem[]) ?? []}
      categories={(catsData as CostCategory[]) ?? []}
      realizedByPhase={realizedByPhase}
      realizedNoPhase={realizedNoPhase}
    />
  )
}
