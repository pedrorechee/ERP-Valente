'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, HardHat, Wallet, FileText, FileSignature,
  Package, Users, Handshake, Store, Globe, BarChart3, Settings,
  LogOut, User, UserRound, ListTree,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { signOut } from '@/app/actions/auth'
import { useCompany } from '@/components/layout/CompanyProvider'
import { canAccessRoute } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/database'

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  roles: UserRole[]
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const DASHBOARD_ITEM: NavItem = {
  href: '/dashboard',
  label: 'Dashboard',
  icon: LayoutDashboard,
  roles: ['owner', 'admin', 'foreman'],
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Projetos',
    items: [
      { href: '/obras',      label: 'Obras',       icon: HardHat,       roles: ['owner', 'admin', 'foreman'] },
      { href: '/financeiro', label: 'Financeiro',  icon: Wallet,        roles: ['owner', 'admin'] },
      { href: '/plano-custo', label: 'Plano de Custo', icon: ListTree,  roles: ['owner', 'admin'] },
      { href: '/orcamentos', label: 'Orcamentos',  icon: FileText,      roles: ['owner', 'admin'] },
      { href: '/contratos',  label: 'Contratos',   icon: FileSignature, roles: ['owner', 'admin'] },
    ],
  },
  {
    label: 'Operacoes',
    items: [
      { href: '/suprimentos', label: 'Suprimentos', icon: Package, roles: ['owner', 'admin', 'foreman'] },
      { href: '/equipe',      label: 'RH e Equipe', icon: Users,   roles: ['owner', 'admin'] },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { href: '/clientes',     label: 'Clientes',     icon: UserRound, roles: ['owner', 'admin'] },
      { href: '/crm',          label: 'CRM',          icon: Handshake, roles: ['owner', 'admin'] },
      { href: '/fornecedores', label: 'Fornecedores', icon: Store,     roles: ['owner', 'admin'] },
    ],
  },
]

const FOOTER_ITEMS: NavItem[] = [
  { href: '/portal',        label: 'Portal Cliente', icon: Globe,     roles: ['owner', 'admin'] },
  { href: '/relatorios',    label: 'Relatorios',     icon: BarChart3, roles: ['owner', 'admin'] },
  { href: '/configuracoes', label: 'Configuracoes',  icon: Settings,  roles: ['owner', 'admin'] },
]

type SidebarProps = {
  role: UserRole
  userName: string
  userEmail: string
  className?: string
}

export function Sidebar({ role, userName, userEmail, className }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const { companyName, logoUrl } = useCompany()
  // Marca curta na sidebar: usa um nome customizado se houver; senão "Valente"
  const brand = companyName && companyName !== 'Construtora Valente' ? companyName : 'Valente'
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  // Clear pending state once the navigation resolves (pathname updates)
  useEffect(() => { setPendingHref(null) }, [pathname])

  function isActive(href: string) {
    const byPath = href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)
    return byPath || pendingHref === href
  }

  function NavLink({ item }: { item: NavItem }) {
    if (!canAccessRoute(role, item.href)) return null
    const active = isActive(item.href)
    const Icon = item.icon
    return (
      <Link
        href={item.href}
        prefetch={true}
        onMouseEnter={() => router.prefetch(item.href)}
        onClick={() => setPendingHref(item.href)}
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
          active
            ? 'bg-terracotta text-white'
            : 'text-cream/70 hover:bg-white/5 hover:text-cream'
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span>{item.label}</span>
      </Link>
    )
  }

  const initials = userName
    ? userName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <aside className={cn('flex h-full w-60 flex-col bg-dark', className)}>
      <div className="flex items-center gap-2.5 px-4 py-5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={brand} className="h-14 w-14 shrink-0 rounded-md object-contain" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-terracotta">
            <span className="text-2xl font-black text-white">V</span>
          </div>
        )}
        <span className="truncate text-lg font-bold tracking-wide text-cream">
          {brand}
        </span>
      </div>

      <div className="px-3 pb-1">
        <NavLink item={DASHBOARD_ITEM} />
      </div>

      <Separator className="mx-3 my-2 bg-white/10" />

      <nav className="flex-1 overflow-y-auto px-3">
        {NAV_GROUPS.map((group) => {
          const visible = group.items.filter((i) => canAccessRoute(role, i.href))
          if (visible.length === 0) return null
          return (
            <div key={group.label} className="mb-4">
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {visible.map((item) => (
                  <NavLink key={item.href} item={item} />
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-3">
        <div className="space-y-0.5">
          {FOOTER_ITEMS.filter((i) => canAccessRoute(role, i.href)).map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>
      </div>

      {/* User menu */}
      <div className="border-t border-white/10 px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-white/5"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracotta/40 text-xs font-semibold text-cream">
              {initials}
            </div>
            <div className="flex-1 overflow-hidden text-left">
              <p className="truncate text-sm font-medium text-cream">{userName}</p>
              <p className="truncate text-xs text-gray-400">{userEmail}</p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52">
            <DropdownMenuItem className="p-0">
              <Link
                href="/configuracoes"
                className="flex w-full items-center gap-2 px-1.5 py-1"
              >
                <User className="h-4 w-4" />
                Meu Perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="p-0">
              <form action={signOut} className="w-full">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 px-1.5 py-1 text-danger"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
