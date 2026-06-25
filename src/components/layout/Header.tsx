'use client'

import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Sheet, SheetTrigger, SheetContent } from '@/components/ui/sheet'
import { Sidebar } from './Sidebar'
import type { UserRole } from '@/types/database'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':              'Dashboard',
  '/obras':                  'Obras',
  '/financeiro':             'Financeiro',
  '/orcamentos':             'Orcamentos',
  '/contratos':              'Contratos',
  '/suprimentos':            'Suprimentos',
  '/equipe':                 'RH e Equipe',
  '/crm':                    'CRM',
  '/fornecedores':           'Fornecedores',
  '/portal':                 'Portal Cliente',
  '/relatorios':             'Relatorios',
  '/configuracoes':          'Configuracoes',
  '/configuracoes/usuarios': 'Usuarios',
}

function getTitle(pathname: string): string {
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (pathname === path) return title
    if (path !== '/dashboard' && pathname.startsWith(path + '/')) return title
  }
  return 'ERP Valente'
}

type HeaderProps = {
  role: UserRole
  userName: string
  userEmail: string
  /** Sino de notificações (streamed via Suspense pelo layout) */
  notificationBell: React.ReactNode
}

export function Header({ role, userName, userEmail, notificationBell }: HeaderProps) {
  const pathname = usePathname()
  const title = getTitle(pathname)

  return (
    <header className="flex h-14 items-center gap-3 border-b border-gold/30 bg-white px-4">
      {/* Mobile: hamburger abre drawer */}
      <Sheet>
        <SheetTrigger
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-dark md:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" showCloseButton={false} className="w-60 p-0">
          <Sidebar role={role} userName={userName} userEmail={userEmail} className="h-full" />
        </SheetContent>
      </Sheet>

      <h1 className="flex-1 text-base font-semibold text-dark">{title}</h1>

      {notificationBell}
    </header>
  )
}
