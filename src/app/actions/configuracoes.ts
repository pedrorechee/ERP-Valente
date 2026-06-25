'use server'

import { revalidatePath } from 'next/cache'
import { getActionClient } from '@/lib/supabase/action'
import { uploadFile, getPublicUrl, buildPath } from '@/lib/storage'
import type { CompanySettings } from '@/types/database'

type SettingsResult =
  | { success: true; settings: CompanySettings; logoUrl: string | null }
  | { success: false; error: string }

const FIELDS = [
  'legal_name', 'trade_name', 'document', 'state_registration', 'municipal_registration',
  'phone', 'email', 'website',
  'cep', 'street', 'address_number', 'complement', 'neighborhood', 'city', 'state',
] as const

// Atualiza o singleton de dados da empresa (owner/admin via RLS).
export async function updateCompanySettings(formData: FormData): Promise<SettingsResult> {
  const { supabase } = await getActionClient()

  const { data: existing } = await supabase
    .from('company_settings')
    .select('id, logo_path')
    .limit(1)
    .maybeSingle()
  const ex = existing as { id: string; logo_path: string | null } | null

  // Logo (opcional): novo upload mantém o anterior se falhar
  let logoPath = ex?.logo_path ?? null
  const logoFile = formData.get('logo') as File | null
  if (logoFile && logoFile.size > 0) {
    const path = buildPath(['logo', `${Date.now()}-${logoFile.name}`])
    try {
      logoPath = await uploadFile('company-assets', path, logoFile)
    } catch {
      /* mantém a logo anterior se o upload falhar */
    }
  }

  const payload: Record<string, string | null> = { logo_path: logoPath }
  for (const f of FIELDS) payload[f] = (formData.get(f) as string)?.trim() || null

  let row: unknown
  if (ex?.id) {
    const { data, error } = await supabase
      .from('company_settings')
      .update(payload)
      .eq('id', ex.id)
      .select('*')
      .single()
    if (error) return { success: false, error: error.message }
    row = data
  } else {
    const { data, error } = await supabase
      .from('company_settings')
      .insert(payload)
      .select('*')
      .single()
    if (error) return { success: false, error: error.message }
    row = data
  }

  // Recarrega sidebar/PDFs em todo o app
  revalidatePath('/', 'layout')
  revalidatePath('/configuracoes')

  const settings = row as CompanySettings
  const logoUrl = settings.logo_path ? getPublicUrl('company-assets', settings.logo_path) : null
  return { success: true, settings, logoUrl }
}

// Salva as preferências (Seção 3) na mesma linha singleton.
export async function updateCompanyPreferences(formData: FormData): Promise<SettingsResult> {
  const { supabase } = await getActionClient()

  const { data: existing } = await supabase
    .from('company_settings')
    .select('id')
    .limit(1)
    .maybeSingle()
  const ex = existing as { id: string } | null

  const num = (k: string): number | null => {
    const v = formData.get(k) as string
    return v === null || v === '' ? null : Number(v)
  }
  const payload = {
    default_bdi_percent:       num('default_bdi_percent'),
    default_retention_percent: num('default_retention_percent'),
    default_warranty_months:   num('default_warranty_months'),
  }

  let row: unknown
  if (ex?.id) {
    const { data, error } = await supabase
      .from('company_settings')
      .update(payload)
      .eq('id', ex.id)
      .select('*')
      .single()
    if (error) return { success: false, error: error.message }
    row = data
  } else {
    const { data, error } = await supabase
      .from('company_settings')
      .insert(payload)
      .select('*')
      .single()
    if (error) return { success: false, error: error.message }
    row = data
  }

  revalidatePath('/configuracoes')
  const settings = row as CompanySettings
  const logoUrl = settings.logo_path ? getPublicUrl('company-assets', settings.logo_path) : null
  return { success: true, settings, logoUrl }
}
