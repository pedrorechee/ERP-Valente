import { getPageClient } from '@/lib/supabase/action'
import { FinanceiroClient } from '@/components/financeiro/FinanceiroClient'
import type { FinancialEntry, CostCategory } from '@/types/database'

type SearchParams = Promise<{
  obra?: string
}>

type EntryWithJoins = FinancialEntry & {
  projects?:  { id: string; name: string } | null
  suppliers?: { id: string; name: string } | null
}

export default async function FinanceiroPage({ searchParams }: { searchParams: SearchParams }) {
  const { obra = 'all' } = await searchParams
  const supabase = await getPageClient()

  // Carrega tudo de uma vez — filtros, resumo e paginação são feitos em memória no client
  const [
    { data: projectsData },
    { data: suppliersData },
    { data: clientsData },
    { data: entriesData },
    { data: categoriesData },
    { data: phasesData },
    { data: budgetsData },
  ] = await Promise.all([
    // Seletor de obra: lista TODAS as obras, independente do status
    supabase.from('projects').select('id, name').order('name'),
    supabase.from('suppliers').select('id, name').eq('is_active', true).order('name').limit(5),
    supabase.from('clients').select('id, name').order('created_at', { ascending: false }).limit(5),
    supabase
      .from('financial_entries')
      .select('*, projects(id, name), suppliers(id, name)')
      .order('entry_date', { ascending: false }),
    supabase.from('cost_categories').select('*').order('code'),
    // Fases de todas as obras — usadas no select "Fase da obra" ao editar um lançamento
    supabase.from('project_phases').select('id, project_id, name').order('order_index'),
    // Orçamentos aprovados (vigentes) com itens — para a coluna "Orçado" da DRE
    supabase.from('budgets')
      .select('project_id, total_direct_cost, budget_items(category_id, total)')
      .eq('status', 'aprovado'),
  ])

  const projects   = (projectsData   as { id: string; name: string }[]) ?? []
  const suppliers  = (suppliersData  as { id: string; name: string }[]) ?? []
  const clients    = (clientsData    as { id: string; name: string }[]) ?? []
  const entries    = (entriesData    as EntryWithJoins[]) ?? []
  const categories = (categoriesData as CostCategory[]) ?? []
  const phases     = (phasesData as { id: string; project_id: string; name: string }[]) ?? []

  // Mapa obra → { total orçado, orçado por categoria } a partir do orçamento aprovado
  type ApprovedRow = { project_id: string; total_direct_cost: number; budget_items: { category_id: string | null; total: number }[] }
  const orcadoByProject: Record<string, { total: number; byCategory: Record<string, number> }> = {}
  for (const b of (budgetsData as ApprovedRow[] | null) ?? []) {
    const byCategory: Record<string, number> = {}
    for (const it of b.budget_items ?? []) {
      if (it.category_id) byCategory[it.category_id] = (byCategory[it.category_id] ?? 0) + it.total
    }
    orcadoByProject[b.project_id] = { total: b.total_direct_cost ?? 0, byCategory }
  }

  return (
    <FinanceiroClient
      entries={entries}
      projects={projects}
      suppliers={suppliers}
      clients={clients}
      categories={categories}
      phases={phases}
      orcadoByProject={orcadoByProject}
      initialObra={obra}
    />
  )
}
