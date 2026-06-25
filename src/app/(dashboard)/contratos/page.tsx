import { getPageClient } from '@/lib/supabase/action'
import { ContratosClient } from '@/components/contratos/ContratosClient'
import type { ContractStatus } from '@/types/database'

export type ContractRow = {
  id:                 string
  project_id:         string
  project_name:       string
  contract_number:    string | null
  status:             ContractStatus
  original_value:     number
  amendments_value:   number   // saldo dos aditivos de valor (+/−)
  total_value:        number   // original + aditivos
  total_measured:     number   // soma das medições
  balance_to_invoice: number   // valor total − total medido
}

type Raw = {
  id:                  string
  project_id:          string
  contract_number:     string | null
  original_value:      number
  status:              ContractStatus
  projects:            { id: string; name: string } | null
  contract_amendments: { value_change: number }[]
  measurements:        { amount: number }[]
}

export default async function ContratosPage() {
  const supabase = await getPageClient()

  // Carrega tudo de uma vez — filtros são feitos em memória no client
  const [{ data: contractsData }, { data: projectsData }] = await Promise.all([
    supabase
      .from('contracts')
      .select(
        'id, project_id, contract_number, original_value, status, updated_at, projects(id, name), contract_amendments(value_change), measurements(amount)',
      )
      .order('updated_at', { ascending: false }),
    // Seletor de obra: TODAS as obras, independente do status
    supabase.from('projects').select('id, name').order('name'),
  ])

  const contracts: ContractRow[] = ((contractsData as unknown as Raw[]) ?? []).map((c) => {
    const amendments_value = c.contract_amendments.reduce((s, a) => s + (a.value_change || 0), 0)
    const total_value = (c.original_value || 0) + amendments_value
    const total_measured = c.measurements.reduce((s, m) => s + (m.amount || 0), 0)
    return {
      id:                 c.id,
      project_id:         c.project_id,
      project_name:       c.projects?.name ?? '—',
      contract_number:    c.contract_number,
      status:             c.status,
      original_value:     c.original_value || 0,
      amendments_value,
      total_value,
      total_measured,
      balance_to_invoice: total_value - total_measured,
    }
  })

  const projects = (projectsData as { id: string; name: string }[]) ?? []

  return <ContratosClient contracts={contracts} projects={projects} />
}
