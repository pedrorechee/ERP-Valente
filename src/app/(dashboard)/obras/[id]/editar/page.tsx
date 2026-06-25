import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getPageClient } from '@/lib/supabase/action'
import type { Project, Client } from '@/types/database'
import { EditarObraForm } from '@/components/obras/EditarObraForm'

type Params = Promise<{ id: string }>

export default async function EditarObraPage({ params }: { params: Params }) {
  const { id } = await params
  const supabase = await getPageClient()

  const [{ data: projectData }, { data: clientsData }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase.from('clients').select('id, name').order('created_at', { ascending: false }).limit(5),
  ])

  if (!projectData) notFound()

  const project = projectData as Project
  const clients = (clientsData as Pick<Client, 'id' | 'name'>[] | null) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href={`/obras/${id}`}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-dark transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {project.name}
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-dark font-medium">Editar</span>
      </div>

      <h1 className="text-2xl font-bold text-dark">Editar Obra</h1>

      <EditarObraForm project={project} clients={clients} />
    </div>
  )
}
