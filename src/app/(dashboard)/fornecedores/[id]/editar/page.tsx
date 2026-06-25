import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getPageClient } from '@/lib/supabase/action'
import type { Supplier } from '@/types/database'
import { EditarFornecedorForm } from '@/components/fornecedores/EditarFornecedorForm'

type Params = Promise<{ id: string }>

export default async function EditarFornecedorPage({ params }: { params: Params }) {
  const { id } = await params
  const supabase = await getPageClient()

  const { data } = await supabase.from('suppliers').select('*').eq('id', id).single()
  if (!data) notFound()

  const supplier = data as Supplier

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href={`/fornecedores/${id}`}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-dark transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {supplier.name}
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-dark">Editar</span>
      </div>

      <h1 className="text-2xl font-bold text-dark">Editar Fornecedor</h1>

      <EditarFornecedorForm supplier={supplier} />
    </div>
  )
}
