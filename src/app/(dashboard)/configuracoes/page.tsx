import { redirect } from 'next/navigation'
import { getSessionRole } from '@/lib/auth'
import { getPageClient } from '@/lib/supabase/action'
import { getCompanyInfo } from '@/lib/company'
import { ConfiguracoesClient } from './ConfiguracoesClient'
import type { Profile } from '@/types/database'

export default async function ConfiguracoesPage() {
  // Só owner/admin acessam Configurações (mesmo via URL direta)
  const { role, userId } = await getSessionRole()
  if (!role || !['owner', 'admin'].includes(role)) {
    redirect('/dashboard')
  }

  const supabase = await getPageClient()
  const [{ settings, logoUrl }, { data: profilesData }] = await Promise.all([
    getCompanyInfo(),
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
  ])
  const profiles = (profilesData as Profile[] | null) ?? []

  return (
    <ConfiguracoesClient
      role={role}
      userId={userId}
      settings={settings}
      logoUrl={logoUrl}
      profiles={profiles}
    />
  )
}
