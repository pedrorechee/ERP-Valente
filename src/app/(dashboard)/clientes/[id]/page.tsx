import { notFound } from 'next/navigation'
import { getPageClient } from '@/lib/supabase/action'
import type { Client, Project, FinancialEntry } from '@/types/database'
import { ClienteDetalhe } from '@/components/clientes/ClienteDetalhe'

type Params = Promise<{ id: string }>

export default async function ClientePage({ params }: { params: Params }) {
  const { id } = await params
  const supabase = await getPageClient()

  // As 3 queries rodam em paralelo: as entradas são filtradas pelo cliente
  // via join (antes era preciso esperar as obras para só então buscá-las)
  const [{ data: clientData }, { data: projectsData }, { data: finData }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase
      .from('projects')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('financial_entries')
      .select('id, entry_number, project_id, amount, status, entry_date, description, projects!inner(client_id, name)')
      .eq('projects.client_id', id)
      .eq('entry_type', 'income')
      .order('entry_date', { ascending: false }),
  ])

  if (!clientData) notFound()

  const client = clientData as Client
  const projects = (projectsData as Project[]) ?? []
  const incomeEntries = (finData as unknown as FinancialEntry[]) ?? []

  return (
    <ClienteDetalhe
      client={client}
      projects={projects}
      incomeEntries={incomeEntries}
    />
  )
}
