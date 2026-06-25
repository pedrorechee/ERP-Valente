import { getPageClient } from '@/lib/supabase/action'
import { getPublicUrl } from '@/lib/storage'
import type { CompanySettings } from '@/types/database'

export const COMPANY_FALLBACK_NAME = 'Construtora Valente'

export interface CompanyInfo {
  settings: CompanySettings | null
  logoUrl:  string | null
}

// Lê o singleton de dados da empresa. Tolerante a falha: se a migration 030
// ainda não foi aplicada (tabela inexistente), retorna nulos para o app
// continuar funcionando com os textos-padrão.
export async function getCompanyInfo(): Promise<CompanyInfo> {
  try {
    const supabase = await getPageClient()
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .maybeSingle()
    if (error) return { settings: null, logoUrl: null }
    const settings = (data as CompanySettings | null) ?? null
    const logoUrl = settings?.logo_path ? getPublicUrl('company-assets', settings.logo_path) : null
    return { settings, logoUrl }
  } catch {
    return { settings: null, logoUrl: null }
  }
}

// Nome de exibição: nome fantasia > razão social > fallback fixo
export function companyDisplayName(
  settings: CompanySettings | null,
  fallback: string = COMPANY_FALLBACK_NAME,
): string {
  return settings?.trade_name?.trim() || settings?.legal_name?.trim() || fallback
}
