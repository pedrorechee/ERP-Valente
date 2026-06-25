import { getPageClient } from '@/lib/supabase/action'
import { NovoLancamentoClient } from '@/components/financeiro/NovoLancamentoClient'
import type { CostCategory } from '@/types/database'

type SearchParams = Promise<{ obra?: string; dup?: string }>

export default async function NovoLancamentoPage({ searchParams }: { searchParams: SearchParams }) {
  const { obra, dup } = await searchParams

  // Dados de um lançamento sendo duplicado (passados pela listagem)
  let initialValues: Record<string, unknown> | undefined
  if (dup) {
    try {
      initialValues = JSON.parse(dup)
    } catch {
      initialValues = undefined
    }
  }
  const supabase = await getPageClient()

  const [{ data: projectsData }, { data: suppliersData }, { data: clientsData }, { data: categoriesData }, { data: phasesData }] = await Promise.all([
    // Seletor de obra do lançamento: lista TODAS as obras, independente do status
    supabase.from('projects').select('id, name').order('name'),
    supabase.from('suppliers').select('id, name').eq('is_active', true).order('name').limit(5),
    supabase.from('clients').select('id, name').order('created_at', { ascending: false }).limit(5),
    supabase.from('cost_categories').select('*').order('code'),
    // Fases de todas as obras — filtradas em memória pela obra selecionada
    supabase.from('project_phases').select('id, project_id, name').order('order_index'),
  ])

  const projects   = projectsData   ?? []
  const suppliers  = suppliersData  ?? []
  const clients    = clientsData    ?? []
  const categories = (categoriesData as CostCategory[]) ?? []
  const phases     = (phasesData as { id: string; project_id: string; name: string }[]) ?? []

  return (
    <NovoLancamentoClient
      projects={projects}
      suppliers={suppliers}
      clients={clients}
      categories={categories}
      phases={phases}
      preSelectedObraId={obra}
      initialValues={initialValues}
    />
  )
}
