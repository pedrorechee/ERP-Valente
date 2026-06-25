'use server'

import { getActionClient } from '@/lib/supabase/action'

export async function searchClients(query: string): Promise<{ id: string; name: string }[]> {
  const { supabase } = await getActionClient()
  const { data } = await supabase
    .from('clients')
    .select('id, name')
    .eq('is_active', true)
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(5)
  return data ?? []
}

export async function searchSuppliers(query: string): Promise<{ id: string; name: string }[]> {
  const { supabase } = await getActionClient()
  const { data } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('is_active', true)
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(5)
  return data ?? []
}
