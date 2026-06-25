import { notFound } from 'next/navigation'
import { getPageClient } from '@/lib/supabase/action'
import type { Supplier, SupplierEvaluation, FinancialEntry, CostCategory } from '@/types/database'
import { FornecedorDetalhe } from '@/components/fornecedores/FornecedorDetalhe'

type Params = Promise<{ id: string }>

type EntryWithProject = FinancialEntry & {
  projects?: { id: string; name: string } | null
}

export default async function FornecedorPage({ params }: { params: Params }) {
  const { id } = await params
  const supabase = await getPageClient()

  const [
    { data: supplierData },
    { data: projectsData },
    { data: entriesData },
    { data: evalsData },
    { data: categoriesData },
  ] = await Promise.all([
    supabase.from('suppliers').select('*').eq('id', id).single(),
    supabase.from('projects').select('id, name').order('name'),
    supabase
      .from('financial_entries')
      .select(
        'id, entry_number, project_id, entry_type, entry_date, description, amount, status, storage_path_proof, supplier_id, projects(id, name)'
      )
      .eq('supplier_id', id)
      .order('entry_date', { ascending: false }),
    supabase
      .from('supplier_evaluations')
      .select('*, projects(id, name)')
      .eq('supplier_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('cost_categories').select('*').order('code'),
  ])

  if (!supplierData) notFound()

  const supplier = supplierData as Supplier
  const projects = (projectsData as { id: string; name: string }[]) ?? []
  const entries = (entriesData as unknown as EntryWithProject[]) ?? []
  const evaluations = (evalsData as SupplierEvaluation[]) ?? []
  const categories = (categoriesData as CostCategory[]) ?? []

  // Compute stats
  const totalPago = entries
    .filter((e) => e.entry_type === 'expense' && e.status === 'pago')
    .reduce((s, e) => s + e.amount, 0)

  const saldoDevedor = entries
    .filter((e) => e.entry_type === 'expense' && (e.status === 'pendente' || e.status === 'agendado'))
    .reduce((s, e) => s + e.amount, 0)

  const obrasSet = new Set(entries.map((e) => e.project_id))
  const obrasAtendidas = obrasSet.size

  const sortedByDate = [...entries].sort((a, b) =>
    b.entry_date.localeCompare(a.entry_date)
  )
  const ultimoPagamento = sortedByDate[0]?.entry_date ?? null

  const qualityScores = evaluations
    .map((e) => e.quality_score)
    .filter((s): s is number => s !== null)
  const avgQuality =
    qualityScores.length > 0
      ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
      : null

  return (
    <FornecedorDetalhe
      supplier={supplier}
      projects={projects}
      entries={entries}
      evaluations={evaluations}
      categories={categories}
      stats={{ totalPago, obrasAtendidas, saldoDevedor, ultimoPagamento, avgQuality }}
    />
  )
}
