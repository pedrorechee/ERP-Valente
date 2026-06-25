import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getPageClient } from '@/lib/supabase/action'
import type { Client } from '@/types/database'
import { EditarClienteForm } from '@/components/clientes/EditarClienteForm'

type Params = Promise<{ id: string }>

export default async function EditarClientePage({ params }: { params: Params }) {
  const { id } = await params
  const supabase = await getPageClient()

  const { data } = await supabase.from('clients').select('*').eq('id', id).single()
  if (!data) notFound()

  const client = data as Client

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href={`/clientes/${id}`}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-dark transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {client.name}
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-dark">Editar</span>
      </div>

      <h1 className="text-2xl font-bold text-dark">Editar Cliente</h1>

      <EditarClienteForm client={client} />
    </div>
  )
}
