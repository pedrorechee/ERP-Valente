import { createClient } from '@supabase/supabase-js'

// Cliente com service role — bypassa RLS, usar APENAS em Server Actions
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } }
  )
}
