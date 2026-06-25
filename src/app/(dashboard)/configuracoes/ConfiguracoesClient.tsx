'use client'

import { useState } from 'react'
import { Building2, Users, SlidersHorizontal } from 'lucide-react'
import type { CompanySettings, Profile, UserRole } from '@/types/database'
import { DadosEmpresaForm } from './DadosEmpresaForm'
import { UsuariosTab } from './UsuariosTab'
import { PreferenciasTab } from './PreferenciasTab'

type Tab = 'empresa' | 'usuarios' | 'preferencias'

interface Props {
  role:     UserRole
  userId:   string | null
  settings: CompanySettings | null
  logoUrl:  string | null
  profiles: Profile[]
}

const TABS = [
  { key: 'empresa',      label: 'Dados da Empresa',       icon: Building2 },
  { key: 'usuarios',     label: 'Usuários e Permissões',  icon: Users },
  { key: 'preferencias', label: 'Preferências',           icon: SlidersHorizontal },
] as const

export function ConfiguracoesClient({ role, userId, settings, logoUrl, profiles }: Props) {
  const [tab, setTab] = useState<Tab>('empresa')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-dark">Configurações</h2>
        <p className="text-sm text-gray-400">Dados da empresa, usuários e preferências do sistema</p>
      </div>

      {/* Abas */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-gold/30 bg-cream/30 p-1 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-dark shadow-sm' : 'text-gray-500 hover:text-dark'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'empresa' && <DadosEmpresaForm settings={settings} logoUrl={logoUrl} />}

      {tab === 'usuarios' && (
        <UsuariosTab profiles={profiles} currentUserId={userId} currentRole={role} />
      )}

      {tab === 'preferencias' && <PreferenciasTab settings={settings} />}
    </div>
  )
}
