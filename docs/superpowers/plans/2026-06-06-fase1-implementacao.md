# Fase 1 — Fundação do ERP Valente: Plano de Implementação

> **Para agentes:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar este plano tarefa por tarefa. Steps usam checkbox (`- [ ]`) para tracking.

**Goal:** Construir a fundação completa do ERP Valente — design system, autenticação Supabase, layout com sidebar em grupos, header, mobile drawer e todas as páginas placeholder.

**Architecture:** Next.js 16 App Router com route groups `(auth)` e `(dashboard)` para layouts separados. Supabase SSR para autenticação via cookies server-side. `Sidebar` é client component (usa `usePathname`); layout do dashboard é server component (lê perfil e passa como prop). Middleware protege rotas antes do render com base no `role` do usuário.

**Tech Stack:** Next.js 16.2.7 · React 19 · TypeScript 5 · Tailwind CSS v4 · shadcn/ui canary · @supabase/ssr · Lucide React · Inter (next/font/google)

---

## Mapa de Arquivos

**Criar:**
```
sql/001_profiles.sql
src/types/database.ts
src/lib/utils.ts
src/lib/supabase/client.ts
src/lib/supabase/server.ts
src/lib/supabase/admin.ts
src/middleware.ts
src/app/actions/auth.ts
src/app/actions/users.ts
src/app/(auth)/layout.tsx
src/app/(auth)/login/page.tsx
src/app/(auth)/reset-password/page.tsx
src/app/(dashboard)/layout.tsx
src/app/(dashboard)/page.tsx
src/app/(dashboard)/obras/page.tsx
src/app/(dashboard)/financeiro/page.tsx
src/app/(dashboard)/orcamentos/page.tsx
src/app/(dashboard)/contratos/page.tsx
src/app/(dashboard)/suprimentos/page.tsx
src/app/(dashboard)/rh/page.tsx
src/app/(dashboard)/crm/page.tsx
src/app/(dashboard)/fornecedores/page.tsx
src/app/(dashboard)/portal/page.tsx
src/app/(dashboard)/relatorios/page.tsx
src/app/(dashboard)/configuracoes/page.tsx
src/app/(dashboard)/configuracoes/usuarios/page.tsx
src/app/portal-cliente/[obraId]/page.tsx
src/components/layout/Sidebar.tsx
src/components/layout/Header.tsx
```

**Modificar:**
```
.gitignore               ← adicionar .superpowers/
src/app/globals.css      ← Tailwind v4 theme + Valente palette
src/app/layout.tsx       ← Inter font + Toaster
src/app/page.tsx         ← redirecionar para /(dashboard)
```

---

## Task 1: SQL — Tabela profiles

**Arquivo:** `sql/001_profiles.sql`

- [ ] Criar pasta `sql/` na raiz do projeto e o arquivo:

```sql
-- ============================================================
-- ERP Valente — Fase 1
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- Tabela de perfis de usuário
CREATE TABLE profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT        NOT NULL,
  full_name     TEXT,
  role          TEXT        NOT NULL DEFAULT 'admin'
                            CHECK (role IN ('owner', 'admin', 'foreman', 'client')),
  phone         TEXT,
  avatar_url    TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger: cria profile quando usuário é criado no Auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Usuário lê o próprio perfil
CREATE POLICY "profiles: leitura própria"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Owner e admin leem todos os perfis
CREATE POLICY "profiles: leitura total (owner/admin)"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('owner', 'admin')
    )
  );

-- Usuário atualiza o próprio perfil
CREATE POLICY "profiles: atualização própria"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Owner e admin atualizam qualquer perfil
CREATE POLICY "profiles: atualização total (owner/admin)"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('owner', 'admin')
    )
  );

-- Owner e admin inserem perfis
CREATE POLICY "profiles: inserção (owner/admin)"
  ON profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('owner', 'admin')
    )
  );

-- Criar o primeiro usuário dono manualmente no Supabase Auth
-- e depois atualizar o role para 'owner':
-- UPDATE profiles SET role = 'owner' WHERE email = 'seu@email.com';
```

- [ ] **Commit**
```bash
git add sql/001_profiles.sql
git commit -m "feat: add profiles table SQL with triggers and RLS"
```

---

## Task 2: .gitignore

**Arquivo:** `.gitignore`

- [ ] Adicionar ao final do `.gitignore` existente:

```
# Brainstorming visual companion
.superpowers/
```

- [ ] **Commit**
```bash
git add .gitignore
git commit -m "chore: ignore .superpowers directory"
```

---

## Task 3: TypeScript — Tipos do banco de dados

**Arquivo:** `src/types/database.ts`

- [ ] Criar `src/types/database.ts`:

```typescript
export type UserRole = 'owner' | 'admin' | 'foreman' | 'client'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  phone: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
    }
  }
}
```

- [ ] Verificar tipos:
```bash
npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Commit**
```bash
git add src/types/database.ts
git commit -m "feat: add database TypeScript types"
```

---

## Task 4: Utilitário cn()

**Arquivo:** `src/lib/utils.ts`

- [ ] Criar `src/lib/utils.ts`:

```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Commit**
```bash
git add src/lib/utils.ts
git commit -m "feat: add cn utility function"
```

---

## Task 5: shadcn/ui — Init e componentes

- [ ] Instalar dependência `tw-animate-css` (exigida pela versão canary):
```bash
npm install tw-animate-css
```

- [ ] Rodar o init do shadcn canary na raiz do projeto:
```bash
npx shadcn@canary init
```

Quando perguntado, responder:
- **Which style would you like to use?** → `New York`
- **Which color would you like to use as base color?** → `Stone`
- **Would you like to use CSS variables for colors?** → `Yes`

Isso cria `components.json` e atualiza `src/app/globals.css`.

- [ ] Instalar todos os componentes necessários para a Fase 1:
```bash
npx shadcn@canary add button input label card avatar dropdown-menu sheet separator badge sonner
```

- [ ] Verificar que `src/components/ui/` foi criado com os componentes.

- [ ] **Commit**
```bash
git add components.json src/components/ui/ src/app/globals.css
git commit -m "feat: add shadcn/ui canary with Tailwind v4 support"
```

---

## Task 6: Design system — globals.css com paleta Valente

**Arquivo:** `src/app/globals.css`

O shadcn init já atualizou o arquivo. Agora adicionar o bloco `@theme` com a paleta Valente e os ajustes de cores primárias.

- [ ] Substituir **todo o conteúdo** de `src/app/globals.css` por:

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

/* ── Valente: mapeamento para tokens shadcn/ui ─────────────────── */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  /* ── Paleta Valente (utilitários Tailwind) ──────────────────── */
  --color-cream:      #F4E2B8;
  --color-gold:       #E6C07B;
  --color-terracotta: #C68B59;
  --color-brown:      #8A5A3B;
  --color-dark:       #3B2418;
  --color-gray-100:   #F9F7F4;
  --color-gray-400:   #A89880;
  --color-success:    #4A7C59;
  --color-danger:     #8B3A3A;

  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
}

/* ── Tema claro (padrão — dark mode não implementado na Fase 1) ── */
:root {
  --background:            oklch(1 0 0);
  --foreground:            oklch(0.21 0.034 24.9);     /* #3B2418 */
  --card:                  oklch(1 0 0);
  --card-foreground:       oklch(0.21 0.034 24.9);
  --popover:               oklch(1 0 0);
  --popover-foreground:    oklch(0.21 0.034 24.9);
  --primary:               oklch(0.627 0.115 38.7);    /* #C68B59 terracotta */
  --primary-foreground:    oklch(1 0 0);
  --secondary:             oklch(0.968 0.02 68.0);     /* #F9F7F4 */
  --secondary-foreground:  oklch(0.21 0.034 24.9);
  --muted:                 oklch(0.968 0.02 68.0);
  --muted-foreground:      oklch(0.6 0.05 40.0);       /* #A89880 */
  --accent:                oklch(0.884 0.09 65.0);     /* #E6C07B gold */
  --accent-foreground:     oklch(0.21 0.034 24.9);
  --destructive:           oklch(0.444 0.10 15.0);     /* #8B3A3A danger */
  --border:                oklch(0.884 0.09 65.0);     /* #E6C07B gold */
  --input:                 oklch(0.884 0.09 65.0);
  --ring:                  oklch(0.627 0.115 38.7);    /* #C68B59 terracotta */
  --radius:                0.5rem;
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] Verificar build sem erros:
```bash
npm run build
```
Esperado: compilação sem erros de CSS.

- [ ] **Commit**
```bash
git add src/app/globals.css
git commit -m "feat: configure Valente design system with Tailwind v4 palette"
```

---

## Task 7: Supabase — Clientes

**Arquivos:** `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`

- [ ] Criar `src/lib/supabase/client.ts` (browser):

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] Criar `src/lib/supabase/server.ts` (server components e server actions):

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignorado em server components (cookies read-only)
          }
        },
      },
    }
  )
}
```

- [ ] Criar `src/lib/supabase/admin.ts` (somente server actions — usa service role):

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
```

- [ ] Verificar tipos:
```bash
npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Commit**
```bash
git add src/lib/supabase/
git commit -m "feat: add Supabase browser, server and admin clients"
```

---

## Task 8: Middleware — Proteção de rotas por perfil

**Arquivo:** `src/middleware.ts`

- [ ] Criar `src/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { UserRole } from '@/types/database'

const FOREMAN_ALLOWED = ['/', '/obras', '/suprimentos']

export async function middleware(request: NextRequest) {
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

  // Páginas de auth: redireciona se já autenticado
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
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Rotas protegidas: redireciona se não autenticado
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

  // Cliente só acessa /portal-cliente
  if (role === 'client' && !pathname.startsWith('/portal-cliente')) {
    return NextResponse.redirect(new URL('/portal-cliente', request.url))
  }

  // Encarregado: bloqueia rotas não permitidas
  if (role === 'foreman') {
    const allowed = FOREMAN_ALLOWED.some(
      (r) => pathname === r || pathname.startsWith(r + '/')
    )
    if (!allowed && !pathname.startsWith('/portal-cliente')) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] Verificar tipos:
```bash
npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Commit**
```bash
git add src/middleware.ts
git commit -m "feat: add middleware with role-based route protection"
```

---

## Task 9: Server Actions — Auth

**Arquivo:** `src/app/actions/auth.ts`

- [ ] Criar `src/app/actions/auth.ts`:

```typescript
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'E-mail ou senha incorretos.' }
  }

  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function resetPassword(formData: FormData) {
  const email = formData.get('email') as string
  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password/confirm`,
  })

  if (error) {
    return { error: 'Não foi possível enviar o e-mail de recuperação.' }
  }

  return { success: true }
}
```

- [ ] Adicionar `NEXT_PUBLIC_SITE_URL` ao `.env.local`:
```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Commit**
```bash
git add src/app/actions/auth.ts .env.local
git commit -m "feat: add auth server actions (signIn, signOut, resetPassword)"
```

---

## Task 10: Root layout

**Arquivo:** `src/app/layout.tsx`

- [ ] Substituir `src/app/layout.tsx`:

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Valente ERP',
  description: 'Sistema de gestão para a Construtora Valente',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
```

- [ ] **Commit**
```bash
git add src/app/layout.tsx
git commit -m "feat: configure root layout with Inter font and Toaster"
```

---

## Task 11: Página raiz — redirecionamento

**Arquivo:** `src/app/page.tsx`

- [ ] Substituir `src/app/page.tsx`:

```typescript
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/')
}
```

> O middleware cuida de redirecionar para `/login` se não autenticado. Esta página só seria acessada diretamente — o redirect para `/` resulta no dashboard via route group.

- [ ] **Commit**
```bash
git add src/app/page.tsx
git commit -m "chore: root page redirects to dashboard"
```

---

## Task 12: Auth layout + Login

**Arquivos:** `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`

- [ ] Criar `src/app/(auth)/layout.tsx`:

```typescript
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      {children}
    </div>
  )
}
```

- [ ] Criar `src/app/(auth)/login/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signIn } from '@/app/actions/auth'
import { toast } from 'sonner'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full bg-terracotta hover:bg-brown text-white"
    >
      {pending ? 'Entrando...' : 'Entrar'}
    </Button>
  )
}

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setError(null)
    const result = await signIn(formData)
    if (result?.error) {
      setError(result.error)
      toast.error(result.error)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-xl border border-gold bg-white p-8 shadow-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-dark">
            <span className="text-base font-black text-gold">V</span>
          </div>
          <div className="text-center">
            <h1 className="text-lg font-bold text-dark">Valente ERP</h1>
            <p className="text-sm text-gray-400">Construtora Valente</p>
          </div>
        </div>

        {/* Form */}
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-brown text-xs font-semibold uppercase tracking-wide">
              E-mail
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="seu@email.com"
              required
              className="border-gold focus-visible:ring-terracotta"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-brown text-xs font-semibold uppercase tracking-wide">
              Senha
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              className="border-gold focus-visible:ring-terracotta"
            />
          </div>

          {error && (
            <p className="text-sm text-danger">{error}</p>
          )}

          <SubmitButton />
        </form>

        <div className="mt-4 text-center">
          <Link
            href="/reset-password"
            className="text-sm text-terracotta hover:text-brown underline-offset-4 hover:underline"
          >
            Esqueci minha senha
          </Link>
        </div>
      </div>
    </div>
  )
}
```

- [ ] Rodar o dev server e acessar `http://localhost:3000/login`:
```bash
npm run dev
```
Esperado: tela de login com card branco centralizado, logo V dourado, campos de e-mail e senha, botão terracota.

- [ ] **Commit**
```bash
git add src/app/(auth)/
git commit -m "feat: add auth layout and login page"
```

---

## Task 13: Reset de senha

**Arquivo:** `src/app/(auth)/reset-password/page.tsx`

- [ ] Criar `src/app/(auth)/reset-password/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resetPassword } from '@/app/actions/auth'
import { toast } from 'sonner'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full bg-terracotta hover:bg-brown text-white"
    >
      {pending ? 'Enviando...' : 'Enviar link de recuperação'}
    </Button>
  )
}

export default function ResetPasswordPage() {
  const [sent, setSent] = useState(false)

  async function handleSubmit(formData: FormData) {
    const result = await resetPassword(formData)
    if (result?.error) {
      toast.error(result.error)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-xl border border-gold bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-dark">
            <span className="text-base font-black text-gold">V</span>
          </div>
          <h1 className="text-lg font-bold text-dark">Recuperar senha</h1>
        </div>

        {sent ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-400">
              E-mail enviado! Verifique sua caixa de entrada e clique no link para definir uma nova senha.
            </p>
            <Link
              href="/login"
              className="text-sm text-terracotta hover:text-brown underline-offset-4 hover:underline"
            >
              Voltar ao login
            </Link>
          </div>
        ) : (
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-brown text-xs font-semibold uppercase tracking-wide">
                E-mail
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="seu@email.com"
                required
                className="border-gold focus-visible:ring-terracotta"
              />
            </div>
            <SubmitButton />
            <div className="text-center">
              <Link
                href="/login"
                className="text-sm text-gray-400 hover:text-dark underline-offset-4 hover:underline"
              >
                Voltar ao login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Commit**
```bash
git add src/app/(auth)/reset-password/
git commit -m "feat: add reset password page"
```

---

## Task 14: Sidebar component

**Arquivo:** `src/components/layout/Sidebar.tsx`

- [ ] Criar `src/components/layout/Sidebar.tsx`:

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, HardHat, Wallet, FileText, FileSignature,
  Package, Users, Handshake, Store, Globe, BarChart3, Settings,
  LogOut, User,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { signOut } from '@/app/actions/auth'
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
  href: '/',
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
      { href: '/orcamentos', label: 'Orçamentos',  icon: FileText,      roles: ['owner', 'admin'] },
      { href: '/contratos',  label: 'Contratos',   icon: FileSignature, roles: ['owner', 'admin'] },
    ],
  },
  {
    label: 'Operações',
    items: [
      { href: '/suprimentos', label: 'Suprimentos', icon: Package, roles: ['owner', 'admin', 'foreman'] },
      { href: '/rh',          label: 'RH e Equipe', icon: Users,   roles: ['owner', 'admin'] },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { href: '/crm',          label: 'CRM',          icon: Handshake, roles: ['owner', 'admin'] },
      { href: '/fornecedores', label: 'Fornecedores', icon: Store,     roles: ['owner', 'admin'] },
    ],
  },
]

const FOOTER_ITEMS: NavItem[] = [
  { href: '/portal',        label: 'Portal Cliente', icon: Globe,     roles: ['owner', 'admin'] },
  { href: '/relatorios',    label: 'Relatórios',     icon: BarChart3, roles: ['owner', 'admin'] },
  { href: '/configuracoes', label: 'Configurações',  icon: Settings,  roles: ['owner', 'admin'] },
]

type SidebarProps = {
  role: UserRole
  userName: string
  userEmail: string
  className?: string
}

export function Sidebar({ role, userName, userEmail, className }: SidebarProps) {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  function NavLink({ item }: { item: NavItem }) {
    if (!item.roles.includes(role)) return null
    const active = isActive(item.href)
    const Icon = item.icon
    return (
      <Link
        href={item.href}
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
    ? userName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <aside className={cn('flex h-full w-60 flex-col bg-dark', className)}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-terracotta">
          <span className="text-xs font-black text-white">V</span>
        </div>
        <span className="text-sm font-bold tracking-wide text-cream">VALENTE ERP</span>
      </div>

      {/* Dashboard */}
      <div className="px-3 pb-1">
        <NavLink item={DASHBOARD_ITEM} />
      </div>

      <Separator className="mx-3 my-2 bg-white/10" />

      {/* Grupos de navegação */}
      <nav className="flex-1 overflow-y-auto px-3">
        {NAV_GROUPS.map((group) => {
          const visible = group.items.filter((i) => i.roles.includes(role))
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

      {/* Rodapé fixo */}
      <div className="border-t border-white/10 px-3 py-3">
        <div className="space-y-0.5">
          {FOOTER_ITEMS.filter((i) => i.roles.includes(role)).map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>
      </div>

      {/* User menu */}
      <div className="border-t border-white/10 px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-white/5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracotta/40 text-xs font-semibold text-cream">
                {initials}
              </div>
              <div className="flex-1 overflow-hidden text-left">
                <p className="truncate text-sm font-medium text-cream">{userName}</p>
                <p className="truncate text-xs text-gray-400">{userEmail}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52">
            <DropdownMenuItem asChild>
              <Link href="/configuracoes" className="flex cursor-pointer items-center gap-2">
                <User className="h-4 w-4" />
                Meu Perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <form action={signOut} className="w-full">
                <button type="submit" className="flex w-full cursor-pointer items-center gap-2 text-danger">
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
```

- [ ] Verificar tipos:
```bash
npx tsc --noEmit
```

- [ ] **Commit**
```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: add Sidebar component with role-based navigation groups"
```

---

## Task 15: Header component (com mobile drawer)

**Arquivo:** `src/components/layout/Header.tsx`

- [ ] Criar `src/components/layout/Header.tsx`:

```typescript
'use client'

import { usePathname } from 'next/navigation'
import { Bell, Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Sidebar } from './Sidebar'
import type { UserRole } from '@/types/database'

const PAGE_TITLES: Record<string, string> = {
  '/':               'Dashboard',
  '/obras':          'Obras',
  '/financeiro':     'Financeiro',
  '/orcamentos':     'Orçamentos',
  '/contratos':      'Contratos',
  '/suprimentos':    'Suprimentos',
  '/rh':             'RH e Equipe',
  '/crm':            'CRM',
  '/fornecedores':   'Fornecedores',
  '/portal':         'Portal Cliente',
  '/relatorios':     'Relatórios',
  '/configuracoes':  'Configurações',
  '/configuracoes/usuarios': 'Usuários',
}

function getTitle(pathname: string): string {
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (pathname === path) return title
    if (path !== '/' && pathname.startsWith(path + '/')) return title
  }
  return 'ERP Valente'
}

type HeaderProps = {
  role: UserRole
  userName: string
  userEmail: string
}

export function Header({ role, userName, userEmail }: HeaderProps) {
  const pathname = usePathname()
  const title = getTitle(pathname)

  return (
    <header className="flex h-14 items-center border-b border-gold/30 bg-white px-4 gap-3">
      {/* Mobile: hamburger + sidebar drawer */}
      <Sheet>
        <SheetTrigger asChild>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-dark transition-colors md:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-60 p-0">
          <Sidebar role={role} userName={userName} userEmail={userEmail} className="h-full" />
        </SheetContent>
      </Sheet>

      {/* Título da página */}
      <h1 className="flex-1 text-base font-semibold text-dark">{title}</h1>

      {/* Notificações (placeholder Fase 1) */}
      <button
        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-dark transition-colors"
        aria-label="Notificações"
      >
        <Bell className="h-5 w-5" />
      </button>
    </header>
  )
}
```

- [ ] **Commit**
```bash
git add src/components/layout/Header.tsx
git commit -m "feat: add Header component with mobile Sheet drawer"
```

---

## Task 16: Dashboard layout

**Arquivo:** `src/app/(dashboard)/layout.tsx`

- [ ] Criar `src/app/(dashboard)/layout.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import type { UserRole } from '@/types/database'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const role = profile.role as UserRole
  const userName = profile.full_name || profile.email || 'Usuário'
  const userEmail = profile.email || ''

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Sidebar — visível apenas no desktop */}
      <div className="hidden md:flex md:shrink-0">
        <Sidebar role={role} userName={userName} userEmail={userEmail} />
      </div>

      {/* Conteúdo principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header role={role} userName={userName} userEmail={userEmail} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

- [ ] Verificar tipos:
```bash
npx tsc --noEmit
```

- [ ] **Commit**
```bash
git add src/app/(dashboard)/layout.tsx
git commit -m "feat: add dashboard layout with Sidebar and Header"
```

---

## Task 17: Dashboard page (com grid mobile)

**Arquivo:** `src/app/(dashboard)/page.tsx`

- [ ] Criar `src/app/(dashboard)/page.tsx`:

```typescript
import Link from 'next/link'
import { HardHat, BookOpen, Camera, CheckSquare, LayoutDashboard } from 'lucide-react'
import { Card } from '@/components/ui/card'

const QUICK_ACTIONS = [
  { href: '/obras',     label: 'Obras',          icon: HardHat,     description: 'Ver obras ativas' },
  { href: '/obras',     label: 'Diário de Obra',  icon: BookOpen,    description: 'Registrar atividades' },
  { href: '/obras',     label: 'Fotos',           icon: Camera,      description: 'Enviar fotos' },
  { href: '/obras',     label: 'Tarefas',         icon: CheckSquare, description: 'Checklist de tarefas' },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Título — visível no desktop */}
      <div className="hidden md:block">
        <h2 className="text-2xl font-bold text-dark">Visão Geral</h2>
        <p className="text-gray-400">Bem-vindo ao ERP Valente</p>
      </div>

      {/* Grid de atalhos rápidos — visível apenas no mobile */}
      <div className="md:hidden">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
          Acesso Rápido
        </p>
        <div className="grid grid-cols-2 gap-3">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <Link key={action.label} href={action.href}>
                <Card className="flex flex-col items-center gap-2 border-gold p-4 text-center transition-colors hover:bg-cream/20 active:scale-95">
                  <Icon className="h-6 w-6 text-terracotta" />
                  <span className="text-sm font-semibold text-dark">{action.label}</span>
                  <span className="text-xs text-gray-400">{action.description}</span>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Placeholder desktop — será preenchido na Fase 2 */}
      <div className="hidden md:block">
        <Card className="flex min-h-64 items-center justify-center border-gold border-dashed">
          <div className="text-center">
            <LayoutDashboard className="mx-auto mb-3 h-10 w-10 text-gray-400" />
            <p className="font-semibold text-dark">Dashboard executivo</p>
            <p className="mt-1 text-sm text-gray-400">
              Cards de obras, financeiro e alertas — disponíveis na Fase 2
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Commit**
```bash
git add src/app/(dashboard)/page.tsx
git commit -m "feat: add dashboard page with mobile quick actions grid"
```

---

## Task 18: Páginas placeholder dos módulos

**Arquivos:** todos os módulos restantes em `src/app/(dashboard)/`

- [ ] Criar os arquivos abaixo, todos com o mesmo padrão. Substitua `[NomeModulo]`, `[icone]` e `[href]` conforme a tabela após o código:

Padrão de arquivo:
```typescript
import { [Icon] } from 'lucide-react'
import { Card } from '@/components/ui/card'

export default function [NomeModulo]Page() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-dark">[Título]</h2>
        <p className="text-gray-400">[Subtítulo]</p>
      </div>
      <Card className="flex min-h-64 items-center justify-center border-gold border-dashed">
        <div className="text-center">
          <[Icon] className="mx-auto mb-3 h-10 w-10 text-gray-400" />
          <p className="font-semibold text-dark">[Título]</p>
          <p className="mt-1 text-sm text-gray-400">Disponível em fase futura</p>
        </div>
      </Card>
    </div>
  )
}
```

| Arquivo | Componente | Ícone Lucide | Título | Subtítulo |
|---|---|---|---|---|
| `obras/page.tsx` | `ObrasPage` | `HardHat` | Obras | Gestão de obras ativas |
| `financeiro/page.tsx` | `FinanceiroPage` | `Wallet` | Financeiro | Entradas e saídas por obra |
| `orcamentos/page.tsx` | `OrcamentosPage` | `FileText` | Orçamentos | Propostas e versões |
| `contratos/page.tsx` | `ContratosPage` | `FileSignature` | Contratos | Contratos e aditivos |
| `suprimentos/page.tsx` | `SuprimentosPage` | `Package` | Suprimentos | Compras e estoque |
| `rh/page.tsx` | `RhPage` | `Users` | RH e Equipe | Funcionários e apontamentos |
| `crm/page.tsx` | `CrmPage` | `Handshake` | CRM | Pipeline de vendas |
| `fornecedores/page.tsx` | `FornecedoresPage` | `Store` | Fornecedores | Cadastro e histórico |
| `portal/page.tsx` | `PortalPage` | `Globe` | Portal Cliente | Gestão do portal |
| `relatorios/page.tsx` | `RelatoriosPage` | `BarChart3` | Relatórios | Relatórios e exportações |

- [ ] Verificar build após criar todos os arquivos:
```bash
npm run build
```
Esperado: compilação sem erros.

- [ ] **Commit**
```bash
git add src/app/(dashboard)/obras/ src/app/(dashboard)/financeiro/ src/app/(dashboard)/orcamentos/ src/app/(dashboard)/contratos/ src/app/(dashboard)/suprimentos/ src/app/(dashboard)/rh/ src/app/(dashboard)/crm/ src/app/(dashboard)/fornecedores/ src/app/(dashboard)/portal/ src/app/(dashboard)/relatorios/
git commit -m "feat: add placeholder pages for all dashboard modules"
```

---

## Task 19: Portal Cliente placeholder

**Arquivo:** `src/app/portal-cliente/[obraId]/page.tsx`

- [ ] Criar `src/app/portal-cliente/[obraId]/page.tsx`:

```typescript
import { Globe } from 'lucide-react'
import { Card } from '@/components/ui/card'

export default function PortalClientePage({
  params,
}: {
  params: { obraId: string }
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header do portal */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-dark">
            <span className="text-base font-black text-gold">V</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-dark">Portal do Cliente</h1>
            <p className="text-sm text-gray-400">Construtora Valente</p>
          </div>
        </div>

        <Card className="flex min-h-64 items-center justify-center border-gold border-dashed">
          <div className="text-center">
            <Globe className="mx-auto mb-3 h-10 w-10 text-gray-400" />
            <p className="font-semibold text-dark">Acompanhamento da sua obra</p>
            <p className="mt-1 text-sm text-gray-400">
              Obra ID: {params.obraId} · Disponível na Fase 5
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Commit**
```bash
git add src/app/portal-cliente/
git commit -m "feat: add client portal placeholder page"
```

---

## Task 20: Configurações e gestão de usuários

**Arquivos:** `src/app/(dashboard)/configuracoes/page.tsx`, `src/app/(dashboard)/configuracoes/usuarios/page.tsx`

- [ ] Criar `src/app/(dashboard)/configuracoes/page.tsx`:

```typescript
import Link from 'next/link'
import { Users, Settings } from 'lucide-react'
import { Card } from '@/components/ui/card'

const CONFIG_SECTIONS = [
  {
    href: '/configuracoes/usuarios',
    icon: Users,
    title: 'Usuários',
    description: 'Criar e gerenciar usuários do sistema',
  },
]

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-dark">Configurações</h2>
        <p className="text-gray-400">Gerencie as configurações do sistema</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CONFIG_SECTIONS.map((section) => {
          const Icon = section.icon
          return (
            <Link key={section.href} href={section.href}>
              <Card className="flex items-start gap-4 border-gold p-5 transition-colors hover:bg-cream/20 cursor-pointer">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-terracotta/10">
                  <Icon className="h-5 w-5 text-terracotta" />
                </div>
                <div>
                  <p className="font-semibold text-dark">{section.title}</p>
                  <p className="mt-0.5 text-sm text-gray-400">{section.description}</p>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] Criar `src/app/(dashboard)/configuracoes/usuarios/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreateUserForm } from './CreateUserForm'
import type { UserRole } from '@/types/database'

const ROLE_LABELS: Record<UserRole, string> = {
  owner:   'Dono',
  admin:   'Administrativo',
  foreman: 'Encarregado',
  client:  'Cliente',
}

const ROLE_COLORS: Record<UserRole, string> = {
  owner:   'bg-brown/10 text-brown border-brown/20',
  admin:   'bg-terracotta/10 text-terracotta border-terracotta/20',
  foreman: 'bg-gold/10 text-brown border-gold/20',
  client:  'bg-gray-100 text-gray-400 border-gray-200',
}

export default async function UsuariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!currentProfile || !['owner', 'admin'].includes(currentProfile.role)) {
    redirect('/')
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-dark">Usuários</h2>
        <p className="text-gray-400">Crie e gerencie os usuários do sistema</p>
      </div>

      {/* Formulário de criação */}
      <Card className="border-gold p-6">
        <h3 className="mb-4 font-semibold text-dark flex items-center gap-2">
          <Users className="h-4 w-4 text-terracotta" />
          Novo usuário
        </h3>
        <CreateUserForm />
      </Card>

      {/* Lista de usuários */}
      <Card className="border-gold">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gold/30 bg-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">E-mail</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Perfil</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {profiles?.map((profile, i) => (
                <tr
                  key={profile.id}
                  className={i % 2 === 0 ? 'bg-white' : 'bg-gray-100'}
                >
                  <td className="px-4 py-3 font-medium text-dark">
                    {profile.full_name || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{profile.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[profile.role as UserRole]}`}>
                      {ROLE_LABELS[profile.role as UserRole]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${profile.is_active ? 'bg-success/10 text-success border-success/20' : 'bg-danger/10 text-danger border-danger/20'}`}>
                      {profile.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
```

- [ ] Criar `src/app/(dashboard)/configuracoes/usuarios/CreateUserForm.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createUser } from '@/app/actions/users'
import { toast } from 'sonner'

const ROLE_OPTIONS = [
  { value: 'admin',   label: 'Administrativo' },
  { value: 'foreman', label: 'Encarregado' },
  { value: 'client',  label: 'Cliente' },
  { value: 'owner',   label: 'Dono' },
]

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      className="bg-terracotta hover:bg-brown text-white"
    >
      {pending ? 'Criando...' : 'Criar usuário'}
    </Button>
  )
}

export function CreateUserForm() {
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setError(null)
    const result = await createUser(formData)
    if (result?.error) {
      setError(result.error)
      toast.error(result.error)
    } else {
      toast.success('Usuário criado! O e-mail de acesso foi enviado.')
    }
  }

  return (
    <form action={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5">
        <Label htmlFor="full_name" className="text-brown text-xs font-semibold uppercase tracking-wide">
          Nome completo
        </Label>
        <Input id="full_name" name="full_name" placeholder="João Silva" required className="border-gold" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-brown text-xs font-semibold uppercase tracking-wide">
          E-mail
        </Label>
        <Input id="email" name="email" type="email" placeholder="joao@email.com" required className="border-gold" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="role" className="text-brown text-xs font-semibold uppercase tracking-wide">
          Perfil
        </Label>
        <select
          id="role"
          name="role"
          required
          className="flex h-9 w-full rounded-md border border-gold bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-terracotta"
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone" className="text-brown text-xs font-semibold uppercase tracking-wide">
          Telefone
        </Label>
        <Input id="phone" name="phone" placeholder="(11) 99999-9999" className="border-gold" />
      </div>

      {error && (
        <p className="sm:col-span-2 lg:col-span-4 text-sm text-danger">{error}</p>
      )}

      <div className="sm:col-span-2 lg:col-span-4">
        <SubmitButton />
      </div>
    </form>
  )
}
```

- [ ] **Commit**
```bash
git add src/app/(dashboard)/configuracoes/
git commit -m "feat: add Configuracoes and Usuarios pages"
```

---

## Task 21: Server Action — Criar usuário

**Arquivo:** `src/app/actions/users.ts`

- [ ] Criar `src/app/actions/users.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'

export async function createUser(formData: FormData) {
  // Verificar se o solicitante é owner ou admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Não autenticado.' }

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!currentProfile || !['owner', 'admin'].includes(currentProfile.role)) {
    return { error: 'Sem permissão para criar usuários.' }
  }

  const full_name = (formData.get('full_name') as string)?.trim()
  const email     = (formData.get('email') as string)?.trim().toLowerCase()
  const role      = formData.get('role') as UserRole
  const phone     = (formData.get('phone') as string)?.trim() || null

  if (!full_name || !email || !role) {
    return { error: 'Preencha todos os campos obrigatórios.' }
  }

  if (!['owner', 'admin', 'foreman', 'client'].includes(role)) {
    return { error: 'Perfil inválido.' }
  }

  // Criar usuário via service role (bypassa RLS)
  const adminClient = createAdminClient()

  const { error: authError } = await adminClient.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name, role, phone },
    // Usuário receberá e-mail para definir senha
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      return { error: 'Este e-mail já está cadastrado.' }
    }
    return { error: `Erro ao criar usuário: ${authError.message}` }
  }

  // O trigger handle_new_user cria o profile automaticamente.
  // Se phone foi fornecido, atualizar o profile (o trigger não inclui phone):
  if (phone) {
    await supabase
      .from('profiles')
      .update({ phone })
      .eq('email', email)
  }

  revalidatePath('/configuracoes/usuarios')
  return { success: true }
}
```

- [ ] Verificar tipos:
```bash
npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Commit**
```bash
git add src/app/actions/users.ts
git commit -m "feat: add createUser server action with admin API"
```

---

## Task 22: Verificação final

- [ ] Rodar build completo:
```bash
npm run build
```
Esperado: `Route (app)` listando todas as rotas sem erros.

- [ ] Rodar dev server:
```bash
npm run dev
```

- [ ] Verificar no browser `http://localhost:3000`:
  - [ ] Redireciona para `/login` (não autenticado)
  - [ ] Tela de login: card branco, logo V, campos, botão terracota
  - [ ] `/reset-password`: tela de recuperação de senha
  - [ ] Após login: sidebar com grupos PROJETOS / OPERAÇÕES / COMERCIAL + rodapé
  - [ ] Ícones Lucide, sem emojis
  - [ ] Mobile (320px): sidebar oculta, hamburger no header abre drawer
  - [ ] Dashboard mobile: grid 2×2 com atalhos
  - [ ] `/configuracoes/usuarios`: lista de usuários + formulário de criação
  - [ ] Logout funciona e redireciona para `/login`

- [ ] **Commit final**
```bash
git add -A
git commit -m "feat: complete Phase 1 - foundation, auth, layout and placeholders"
```

---

## Checklist de entregáveis (spec §8)

- [ ] Design system configurado (Tailwind v4 + tokens + Inter)
- [ ] shadcn/ui canary instalado e configurado
- [ ] Clientes Supabase: browser, server e admin
- [ ] Middleware de proteção de rotas por perfil
- [ ] Tela de login (card centralizado)
- [ ] Tela de reset de senha
- [ ] Layout base: Sidebar com grupos + Header
- [ ] Sheet mobile (drawer) + grid de atalhos
- [ ] Páginas placeholder para todos os módulos
- [ ] Página Configurações → Usuários (CRUD básico)
- [ ] `sql/001_profiles.sql` com tabela, triggers e RLS
