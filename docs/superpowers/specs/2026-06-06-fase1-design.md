# Spec — Fase 1: Fundação do ERP Valente

**Data:** 2026-06-06  
**Status:** Aprovado para implementação

---

## 1. Stack Técnica

| Tecnologia | Versão | Observação |
|---|---|---|
| Next.js | 16.2.7 | App Router |
| React | 19.2.4 | — |
| TypeScript | 5.x | strict mode |
| Tailwind CSS | v4 | configuração via `@theme` no CSS, sem `tailwind.config.ts` |
| shadcn/ui | latest | instalação manual compatível com Tailwind v4 |
| Supabase SSR | `@supabase/ssr` | autenticação server-side |
| Supabase JS | `@supabase/supabase-js` | client-side e server actions |
| Lucide React | latest | ícones monocromáticos — sem emojis em nenhuma tela |
| Inter | next/font/google | tipografia sem flash |

---

## 2. Estrutura de Rotas

```
src/app/
├── (auth)/                    ← layout sem sidebar
│   ├── layout.tsx
│   ├── login/page.tsx
│   └── reset-password/page.tsx
├── (dashboard)/               ← layout com sidebar, rotas protegidas
│   ├── layout.tsx             ← Sidebar + Header
│   ├── page.tsx               ← Dashboard principal
│   ├── obras/page.tsx
│   ├── financeiro/page.tsx
│   ├── orcamentos/page.tsx
│   ├── contratos/page.tsx
│   ├── suprimentos/page.tsx
│   ├── rh/page.tsx
│   ├── crm/page.tsx
│   ├── fornecedores/page.tsx
│   ├── portal/page.tsx
│   ├── relatorios/page.tsx
│   └── configuracoes/
│       ├── page.tsx
│       └── usuarios/page.tsx  ← criação e gestão de usuários
├── portal-cliente/
│   └── [obraId]/page.tsx      ← acesso exclusivo do cliente
├── layout.tsx                 ← root layout (fonte, providers)
└── middleware.ts              ← proteção de rotas por perfil
```

---

## 3. Perfis e Permissões

| Perfil | `role` no DB | Descrição |
|---|---|---|
| Dono | `owner` | Acesso total |
| Administrativo | `admin` | Acesso total (igual ao dono) |
| Encarregado | `foreman` | Acesso restrito ao campo |
| Cliente | `client` | Somente portal do cliente |

### Matriz de acesso por rota

| Rota | owner | admin | foreman | client |
|---|---|---|---|---|
| `/` (dashboard) | ✓ | ✓ | ✓ | — |
| `/obras` | ✓ | ✓ | ✓ (só alocadas, via RLS) | — |
| `/financeiro` | ✓ | ✓ | — | — |
| `/orcamentos` | ✓ | ✓ | — | — |
| `/contratos` | ✓ | ✓ | — | — |
| `/suprimentos` | ✓ | ✓ | ✓ | — |
| `/rh` | ✓ | ✓ | — | — |
| `/crm` | ✓ | ✓ | — | — |
| `/fornecedores` | ✓ | ✓ | — | — |
| `/portal` | ✓ | ✓ | — | — |
| `/relatorios` | ✓ | ✓ | — | — |
| `/configuracoes` | ✓ | ✓ | — | — |
| `/portal-cliente/[obraId]` | ✓ | ✓ | — | ✓ |

**Regras do middleware:**
- Não autenticado em qualquer rota protegida → redireciona para `/login`
- Já autenticado em `/login` → redireciona para `/` ou `/portal-cliente/[obraId]`
- `client` fazendo login → redireciona direto para `/portal-cliente/[obraId]` onde `obraId` é a obra mais recente vinculada ao cliente (Fase 1: assume uma obra por cliente; seleção múltipla vem em fase futura)
- `foreman` acessando rota restrita → redireciona para `/`

---

## 4. Layout System

### Sidebar (desktop, 240px fixa)

Estrutura com 3 grupos temáticos + rodapé fixo:

```
VALENTE ERP
─────────────────────
⊞  Dashboard          ← sem grupo, sempre no topo
─────────────────────
PROJETOS
    HardHat    Obras
    Wallet     Financeiro
    FileText   Orçamentos
    FileSignature  Contratos
─────────────────────
OPERAÇÕES
    Package    Suprimentos
    Users      RH e Equipe
─────────────────────
COMERCIAL
    Handshake  CRM
    Store      Fornecedores
─────────────────────  ← mt-auto (rodapé fixo)
    Globe      Portal Cliente
    BarChart3  Relatórios
    Settings   Configurações
─────────────────────
[avatar] Nome do usuário ▾   ← DropdownMenu (Perfil / Logout)
```

**Ícones:** Lucide React, monocromáticos.
- Inativo: `text-cream/70`
- Ativo: `text-white` dentro de `bg-terracotta rounded-md`
- Rodapé: `text-gray-400`

**Renderização condicional por perfil:**
A sidebar filtra os itens com base no `role` do usuário logado (lido do contexto de sessão). `foreman` vê apenas: Dashboard, Obras, Suprimentos. `owner` e `admin` veem todos os itens. A filtragem é feita no componente `Sidebar.tsx` — a proteção de acesso real é reforçada pelo middleware e pelo RLS.

### Header (desktop, 56px)

```
[ Título da página atual ]          [ Bell ]
```

Sino de notificações posicionado sem funcionalidade na Fase 1.

### Mobile (< 768px)

- Sidebar oculta
- Header: `[Menu icon] [Título] [Bell]`
- `Menu` abre sidebar como **Sheet (drawer)** deslizante da esquerda com backdrop
- Dashboard mobile exibe grid 2×2 de atalhos rápidos: Obras, Diário de Obra, Fotos, Tarefas

---

## 5. Design System — Tailwind v4

Configuração em `src/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-cream:      #F4E2B8;
  --color-gold:       #E6C07B;
  --color-terracotta: #C68B59;
  --color-brown:      #8A5A3B;
  --color-dark:       #3B2418;
  --color-gray-100:   #F9F7F4;
  --color-gray-400:   #A89880;
  --color-success:    #4A7C59;
  --color-danger:     #8B3A3A;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --radius: 0.5rem;
}
```

### Tokens de uso

| Elemento | Classe |
|---|---|
| Fundo de tela | `bg-white` ou `bg-gray-100` |
| Sidebar background | `bg-dark` |
| Sidebar texto | `text-cream` |
| Item sidebar ativo | `bg-terracotta text-white rounded-md` |
| Label separador sidebar | `text-gray-400 text-xs uppercase tracking-widest` |
| Botão primário | `bg-terracotta hover:bg-brown text-white` |
| Card | `bg-white border border-gold rounded-lg shadow-sm` |
| Título de página | `text-dark font-bold` |
| Texto secundário | `text-gray-400` |
| Valor financeiro positivo | `text-success font-semibold` |
| Valor financeiro negativo | `text-danger font-semibold` |
| Fundo alternado de tabela | `even:bg-gray-100` |

### Componentes shadcn/ui instalados na Fase 1

`Button`, `Input`, `Label`, `Card`, `Avatar`, `DropdownMenu`, `Sheet`, `Separator`, `Badge`, `Sonner`

Instalação: `npx shadcn@canary init` (versão canary com suporte nativo a Tailwind v4) seguido de `npx shadcn@canary add [componente]` para cada componente acima.

### Tela de Login

Card branco centralizado em fundo `bg-gray-100`.  
Campos: e-mail, senha + link "Esqueci minha senha".  
Logo: quadrado `bg-dark` com "V" em `text-gold`.

---

## 6. Banco de Dados — Fase 1

**Arquivo:** `sql/001_profiles.sql`

### Tabela `profiles`

```sql
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
```

### Triggers

- `profiles_updated_at` — atualiza `updated_at` em todo UPDATE
- `handle_new_user` — cria `profile` automaticamente ao criar usuário no Auth (roda com `SECURITY DEFINER`)

### RLS

Tabela com RLS habilitado. Políticas:
- Usuário lê o próprio perfil
- `owner`/`admin` leem todos os perfis
- Usuário atualiza o próprio perfil (nome, telefone, avatar)
- `owner`/`admin` atualizam qualquer perfil

### Criação de usuários

- Feita dentro do sistema em **Configurações → Usuários** (só `owner` e `admin`)
- Server Action usa `SUPABASE_SECRET_KEY` (service role) → `supabase.auth.admin.createUser()`
- Trigger cria o `profile` automaticamente
- Novo usuário recebe e-mail para definir senha
- `SUPABASE_SECRET_KEY` nunca é exposta ao browser

---

## 7. Variáveis de Ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=...       # browser + server
NEXT_PUBLIC_SUPABASE_ANON_KEY=...  # browser + server
SUPABASE_SECRET_KEY=...            # somente server-side
```

---

## 8. Entregáveis da Fase 1

- [ ] Design system configurado (Tailwind v4 + tokens + Inter)
- [ ] shadcn/ui instalado e configurado
- [ ] Clientes Supabase: browser (`client.ts`) e server (`server.ts`)
- [ ] Middleware de proteção de rotas por perfil
- [ ] Tela de login (card centralizado)
- [ ] Tela de reset de senha
- [ ] Layout base: Sidebar com grupos + Header
- [ ] Sheet mobile (drawer) + grid de atalhos
- [ ] Páginas placeholder para todos os módulos
- [ ] Página Configurações → Usuários (CRUD básico)
- [ ] `sql/001_profiles.sql` com tabela, triggers e RLS
