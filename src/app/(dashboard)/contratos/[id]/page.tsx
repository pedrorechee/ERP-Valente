import { notFound } from 'next/navigation'
import { getPageClient } from '@/lib/supabase/action'
import type { Contract, ContractAmendment, Measurement } from '@/types/database'
import { ContratoDetalhe } from '@/components/contratos/ContratoDetalhe'

type Params = Promise<{ id: string }>

export type ContractWithProject = Contract & {
  projects?: { id: string; name: string; client_id: string | null; expected_end_date: string } | null
}

export default async function ContratoDetalhePage({ params }: { params: Params }) {
  const { id } = await params
  const supabase = await getPageClient()

  const { data: contractData } = await supabase
    .from('contracts')
    .select('*, projects(id, name, client_id, expected_end_date)')
    .eq('id', id)
    .single()

  if (!contractData) notFound()
  const contract = contractData as unknown as ContractWithProject

  // Cliente da obra, aditivos, medições e orçamento aprovado — em paralelo
  const clientId = contract.projects?.client_id ?? null
  const [
    { data: clientData },
    { data: amendmentsData },
    { data: measurementsData },
    { data: budgetData },
  ] = await Promise.all([
    clientId
      ? supabase.from('clients').select('id, name').eq('id', clientId).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('contract_amendments')
      .select('*')
      .eq('contract_id', id)
      .order('amendment_number', { ascending: true }),
    supabase
      .from('measurements')
      .select('*, financial_entries(entry_number)')
      .eq('contract_id', id)
      .order('measurement_number', { ascending: true }),
    // Orçamento aprovado da obra — comparativo Estimado x Contratado
    supabase
      .from('budgets')
      .select('total_with_bdi')
      .eq('project_id', contract.project_id)
      .eq('status', 'aprovado')
      .limit(1),
  ])

  const clientName = (clientData as { id: string; name: string } | null)?.name ?? null
  const approvedBudget =
    (budgetData as { total_with_bdi: number }[] | null)?.[0] ?? null

  return (
    <ContratoDetalhe
      contract={contract}
      clientName={clientName}
      amendments={(amendmentsData as ContractAmendment[]) ?? []}
      measurements={(measurementsData as Measurement[]) ?? []}
      approvedBudget={approvedBudget}
    />
  )
}
