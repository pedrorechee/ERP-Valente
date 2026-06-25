import { createClient } from './server'
import { createServiceClient } from './service'
import { GUEST_LOGIN_ENABLED } from '@/lib/guest'

// Acesso convidado (sem login): quando a flag está ligada, todo acesso usa o
// service client como dono — sem exigir cookie. Desligar a flag restaura o login.
async function isDevBypass(): Promise<boolean> {
  return GUEST_LOGIN_ENABLED
}

// Para Server Actions: retorna client + userId
export async function getActionClient() {
  if (await isDevBypass()) {
    return { supabase: createServiceClient(), userId: null as string | null }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, userId: user?.id ?? null }
}

// Para Server Component pages: retorna apenas o client
export async function getPageClient() {
  if (await isDevBypass()) {
    return createServiceClient()
  }
  return createClient()
}
