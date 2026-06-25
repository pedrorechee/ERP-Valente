'use client'

import { createContext, useContext } from 'react'

// Mantido em sincronia com COMPANY_FALLBACK_NAME em '@/lib/company' (que é
// server-only e não pode ser importado num client component).
const FALLBACK_NAME = 'Construtora Valente'

interface CompanyCtx {
  companyName: string
  logoUrl:     string | null
}

const Ctx = createContext<CompanyCtx>({ companyName: FALLBACK_NAME, logoUrl: null })

export function CompanyProvider({
  companyName,
  logoUrl,
  children,
}: {
  companyName: string
  logoUrl:     string | null
  children:    React.ReactNode
}) {
  return <Ctx.Provider value={{ companyName, logoUrl }}>{children}</Ctx.Provider>
}

// Nome/logo da empresa para sidebar e PDFs (lido do company_settings).
export function useCompany(): CompanyCtx {
  return useContext(Ctx)
}
