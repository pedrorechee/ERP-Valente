import { cookies } from 'next/headers'
import { createClient } from './server'
import { createServiceClient } from './service'

async function isDevBypass(): Promise<boolean> {
  if (process.env.NODE_ENV !== 'development') return false
  const cookieStore = await cookies()
  return cookieStore.get('dev-bypass')?.value === '1'
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
