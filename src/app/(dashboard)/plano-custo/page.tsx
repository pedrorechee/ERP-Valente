import { getPageClient } from '@/lib/supabase/action'
import { PlanoCustoClient } from '@/components/plano-custo/PlanoCustoClient'
import type { CostCategory } from '@/types/database'

export default async function PlanoCustoPage() {
  const supabase = await getPageClient()

  const { data: catsData } = await supabase
    .from('cost_categories')
    .select('*')
    .order('code')

  const categories = (catsData as CostCategory[]) ?? []

  return <PlanoCustoClient categories={categories} />
}
