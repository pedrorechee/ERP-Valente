import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { CompanyProvider } from '@/components/layout/CompanyProvider'
import { getCompanyInfo, companyDisplayName } from '@/lib/company'
import { GUEST_LOGIN_ENABLED } from '@/lib/guest'
import type { Profile, UserRole } from '@/types/database'
import { generateNotifications, getUnreadCount } from '@/app/actions/notifications'

// Sino de notificações carregado via streaming: a geração de alertas
// (várias queries + inserts) não bloqueia mais a renderização do layout
async function NotificationArea({ userId }: { userId: string }) {
  const [, unreadCount] = await Promise.all([
    generateNotifications(userId),
    getUnreadCount(userId),
  ])
  return <NotificationBell initialCount={unreadCount} />
}

function BellFallback() {
  return (
    <div
      className="relative flex h-8 w-8 items-center justify-center rounded-md text-gray-300"
      aria-label="Notificações"
    >
      <Bell className="h-5 w-5" />
    </div>
  )
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { settings, logoUrl } = await getCompanyInfo()
  const companyName = companyDisplayName(settings)

  // Bypass de autenticacao (entrar sem login) — dev sempre; prod só com a flag
  if (GUEST_LOGIN_ENABLED) {
    const cookieStore = await cookies()
    if (cookieStore.get('dev-bypass')?.value === '1') {
      return (
        <CompanyProvider companyName={companyName} logoUrl={logoUrl}>
          <div className="flex h-screen overflow-hidden bg-gray-100">
            <div className="hidden md:flex md:shrink-0">
              <Sidebar role="owner" userName="Convidado" userEmail="acesso sem login" />
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
              <Header
                role="owner"
                userName="Convidado"
                userEmail="acesso sem login"
                notificationBell={<NotificationBell initialCount={0} />}
              />
              <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
            </div>
          </div>
        </CompanyProvider>
      )
    }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  const profile = profileData as Pick<Profile, 'role' | 'full_name' | 'email'> | null

  if (!profile) redirect('/login')

  const role = profile.role as UserRole
  const userName = profile.full_name || profile.email || 'Usuario'
  const userEmail = profile.email || ''

  return (
    <CompanyProvider companyName={companyName} logoUrl={logoUrl}>
      <div className="flex h-screen overflow-hidden bg-gray-100">
        <div className="hidden md:flex md:shrink-0">
          <Sidebar role={role} userName={userName} userEmail={userEmail} />
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header
            role={role}
            userName={userName}
            userEmail={userEmail}
            notificationBell={
              <Suspense fallback={<BellFallback />}>
                <NotificationArea userId={user.id} />
              </Suspense>
            }
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </CompanyProvider>
  )
}
