import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createProject } from '@/app/actions/obras'
import { getPageClient } from '@/lib/supabase/action'
import { getCompanyInfo } from '@/lib/company'
import type { Client } from '@/types/database'
import { ObraFormFields } from '@/components/obras/ObraFormFields'
import { SubmitButton } from '@/components/ui/submit-button'

type SearchParams = Promise<{ client_id?: string }>

export default async function NovaObraPage({ searchParams }: { searchParams: SearchParams }) {
  const { client_id } = await searchParams
  const supabase = await getPageClient()
  const { data: clientsData } = await supabase
    .from('clients')
    .select('id, name')
    .order('created_at', { ascending: false })
    .limit(5)

  const clients = (clientsData as Pick<Client, 'id' | 'name'>[] | null) ?? []
  const { settings } = await getCompanyInfo()
  const defaultWarrantyMonths = settings?.default_warranty_months ?? undefined

  async function handleCreate(formData: FormData) {
    'use server'
    await createProject(formData)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/obras"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-dark transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Obras
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-dark font-medium">Nova Obra</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-dark">Cadastrar Nova Obra</h1>
        <p className="mt-1 text-sm text-gray-500">
          As fases padrão serão criadas automaticamente após o cadastro.
        </p>
      </div>

      <form action={handleCreate} className="space-y-6">
        <ObraFormFields clients={clients} defaultClientId={client_id} defaultWarrantyMonths={defaultWarrantyMonths} />

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/obras"
            className="rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-dark hover:bg-cream transition-colors"
          >
            Cancelar
          </Link>
          <SubmitButton
            label="Cadastrar Obra"
            pendingLabel="Cadastrando…"
            className="flex items-center gap-2 rounded-lg bg-terracotta px-6 py-2 text-sm font-medium text-white hover:bg-brown transition-colors disabled:opacity-60"
          />
        </div>
      </form>
    </div>
  )
}
