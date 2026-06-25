import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { UserRole } from '@/types/database'
import { canAccessRoute } from '@/lib/permissions'
import { GUEST_LOGIN_ENABLED } from '@/lib/guest'

export async function proxy(request: NextRequest) {
  // Acesso convidado (sem login) — dev sempre; prod só com NEXT_PUBLIC_ALLOW_GUEST=1.
  // Libera qualquer rota direta (ex.: /obras) sem exigir autenticação.
  // A página /login continua acessível para configurar o login depois.
  if (GUEST_LOGIN_ENABLED && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const isAuthPage = pathname === '/login' || pathname.startsWith('/reset-password')

  // Paginas de auth: redireciona se ja autenticado
  if (isAuthPage) {
    if (!user) return supabaseResponse
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'client') {
      return NextResponse.redirect(new URL('/portal-cliente', request.url))
    }
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Portal cliente: clientes podem acessar, outros tambem
  if (pathname.startsWith('/portal-cliente')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return supabaseResponse
  }

  // Rotas protegidas: redireciona se nao autenticado
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const role = profile.role as UserRole

  // Cliente so acessa /portal-cliente
  if (role === 'client' && !pathname.startsWith('/portal-cliente')) {
    return NextResponse.redirect(new URL('/portal-cliente', request.url))
  }

  // Demais perfis: bloqueia rotas fora do mapa de permissões (com aviso)
  if (!canAccessRoute(role, pathname)) {
    return NextResponse.redirect(new URL('/dashboard?acesso=negado', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
