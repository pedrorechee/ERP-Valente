import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'

export interface SessionRole {
  userId: string | null
  role:   UserRole | null
}

// Resolve o usuário/role atual honrando o dev-bypass (mesmo padrão do layout).
// Em dev-bypass não há sessão Supabase; tratamos como 'owner' (acesso total).
export async function getSessionRole(): Promise<SessionRole> {
  if (process.env.NODE_ENV === 'development') {
    const cookieStore = await cookies()
    if (cookieStore.get('dev-bypass')?.value === '1') {
      return { userId: null, role: 'owner' }
    }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { userId: null, role: null }

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return { userId: user.id, role: ((data as { role: UserRole } | null)?.role ?? null) }
}
