import type { UserRole } from '@/types/database'

export const ROLE_LABELS: Record<UserRole, string> = {
  owner:   'Dono',
  admin:   'Administrativo',
  foreman: 'Encarregado',
  client:  'Cliente',
}

// ── Mapa central de acesso por área ────────────────────────────────
// Fonte única de verdade: usada pela navegação (Sidebar), pelos guards
// de rota (proxy.ts) e pelo quadro-resumo em Configurações.
export interface AreaPolicy {
  key:    string
  label:  string
  routes: string[]      // prefixos de rota que pertencem à área
  roles:  UserRole[]    // perfis com acesso
}

export const AREAS: AreaPolicy[] = [
  { key: 'dashboard',    label: 'Dashboard',       routes: ['/dashboard'],    roles: ['owner', 'admin', 'foreman'] },
  { key: 'obras',        label: 'Obras',           routes: ['/obras'],        roles: ['owner', 'admin', 'foreman'] },
  { key: 'suprimentos',  label: 'Suprimentos',     routes: ['/suprimentos'],  roles: ['owner', 'admin', 'foreman'] },
  { key: 'financeiro',   label: 'Financeiro',      routes: ['/financeiro'],   roles: ['owner', 'admin'] },
  { key: 'plano-custo',  label: 'Plano de Custo',  routes: ['/plano-custo'],  roles: ['owner', 'admin'] },
  { key: 'orcamentos',   label: 'Orçamentos',      routes: ['/orcamentos'],   roles: ['owner', 'admin'] },
  { key: 'contratos',    label: 'Contratos',       routes: ['/contratos'],    roles: ['owner', 'admin'] },
  // Apontamento: encarregado pode registrar presença/horas. Precisa vir ANTES de
  // '/equipe' (match por prefixo na ordem do array) para liberar só esta sub-rota.
  { key: 'apontamento',  label: 'Apontamento',     routes: ['/equipe/apontamento'], roles: ['owner', 'admin', 'foreman'] },
  { key: 'rh',           label: 'RH e Equipe',     routes: ['/equipe'],       roles: ['owner', 'admin'] },
  { key: 'clientes',     label: 'Clientes',        routes: ['/clientes'],     roles: ['owner', 'admin'] },
  { key: 'crm',          label: 'CRM',             routes: ['/crm'],          roles: ['owner', 'admin'] },
  { key: 'fornecedores', label: 'Fornecedores',    routes: ['/fornecedores'], roles: ['owner', 'admin'] },
  { key: 'portal',       label: 'Portal Cliente',  routes: ['/portal'],       roles: ['owner', 'admin'] },
  { key: 'relatorios',   label: 'Relatórios',      routes: ['/relatorios'],   roles: ['owner', 'admin'] },
  { key: 'configuracoes', label: 'Configurações',  routes: ['/configuracoes'], roles: ['owner', 'admin'] },
]

// Área que cobre um pathname (match por prefixo). null = rota não mapeada.
function areaForPath(pathname: string): AreaPolicy | null {
  return AREAS.find((a) =>
    a.routes.some((r) => pathname === r || pathname.startsWith(r + '/')),
  ) ?? null
}

// Um perfil pode acessar a rota? Rotas não mapeadas são liberadas.
export function canAccessRoute(role: UserRole, pathname: string): boolean {
  const area = areaForPath(pathname)
  if (!area) return true
  return area.roles.includes(role)
}

// Um perfil pode acessar uma área específica (por href/prefixo)?
export function canAccessHref(role: UserRole, href: string): boolean {
  return canAccessRoute(role, href)
}

// Resumo legível por perfil (quadro informativo em Configurações).
export function areasForRole(role: UserRole): string[] {
  return AREAS.filter((a) => a.roles.includes(role)).map((a) => a.label)
}

export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  owner:   'Acesso total ao sistema, incluindo Configurações e gestão de usuários.',
  admin:   'Acesso operacional completo e a Dados da Empresa; gerencia encarregados e clientes.',
  foreman: 'Acesso a Obras e Suprimentos (e Dashboard). Sem Financeiro, Orçamentos, Contratos ou Configurações.',
  client:  'Acesso apenas ao Portal do Cliente.',
}
