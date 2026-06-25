'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getActionClient } from '@/lib/supabase/action'
import type { ClientType, HowTheyFound } from '@/types/database'

export type ClientResult =
  | { success: true }
  | { success: false; error: string }

export type ClientQuickResult =
  | { success: true; client: { id: string; name: string } }
  | { success: false; error: string }

export async function createClient(formData: FormData): Promise<void> {
  const { supabase } = await getActionClient()

  const { data, error } = await supabase
    .from('clients')
    .insert({
      name: formData.get('name') as string,
      type: (formData.get('type') as ClientType) || 'pf',
      phone: (formData.get('phone') as string) || null,
      email: (formData.get('email') as string) || null,
      document: (formData.get('document') as string) || null,
      address: (formData.get('address') as string) || null,
      city: (formData.get('city') as string) || null,
      state: (formData.get('state') as string) || null,
      notes: (formData.get('notes') as string) || null,
      how_they_found: (formData.get('how_they_found') as HowTheyFound) || null,
      is_active: true,
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Erro ao criar cliente')

  revalidatePath('/clientes')
  redirect(`/clientes/${data.id}`)
}

export async function updateClient(id: string, formData: FormData): Promise<ClientResult> {
  const { supabase } = await getActionClient()

  const { error } = await supabase
    .from('clients')
    .update({
      name: formData.get('name') as string,
      type: (formData.get('type') as ClientType) || 'pf',
      phone: (formData.get('phone') as string) || null,
      email: (formData.get('email') as string) || null,
      document: (formData.get('document') as string) || null,
      address: (formData.get('address') as string) || null,
      city: (formData.get('city') as string) || null,
      state: (formData.get('state') as string) || null,
      notes: (formData.get('notes') as string) || null,
      how_they_found: (formData.get('how_they_found') as HowTheyFound) || null,
      is_active: formData.get('is_active') === 'true',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/clientes')
  revalidatePath(`/clientes/${id}`)
  return { success: true }
}

export async function deleteClient(id: string): Promise<ClientResult> {
  const { supabase } = await getActionClient()

  const { error } = await supabase.from('clients').delete().eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/clientes')
  return { success: true }
}

export async function createClientQuick(formData: FormData): Promise<ClientQuickResult> {
  const { supabase } = await getActionClient()

  const { data, error } = await supabase
    .from('clients')
    .insert({
      name: formData.get('name') as string,
      type: (formData.get('type') as ClientType) || 'pf',
      phone: (formData.get('phone') as string) || null,
      is_active: true,
    })
    .select('id, name')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? 'Erro ao criar cliente' }

  revalidatePath('/clientes')
  return { success: true, client: data as { id: string; name: string } }
}
