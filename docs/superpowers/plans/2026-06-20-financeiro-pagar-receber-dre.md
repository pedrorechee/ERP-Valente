# Reformulação Financeiro — Aba "A Pagar / A Receber" + Enxugamento da DRE — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a seção "Agenda por vencimento" da aba "A Pagar / A Receber" por um layout de duas colunas (A Pagar | A Receber) com agrupamento por prazo e ação de quitação via mini-modal; e enxugar a aba DRE removendo os dois gráficos e ampliando a tabela.

**Architecture:** Mudança puramente de frontend (React/Next.js client components) + uma extensão na server action `bulkMarkPaid` para aceitar forma de pagamento opcional. O estado das contas continua sendo a fonte única em `FinanceiroClient` (`localEntries`), que flui para a aba como prop `entries`; a atualização otimista acontece no pai e reflete automaticamente nas colunas e nos cards do topo. Toast disparado ~250ms após o fechamento do modal, via `toastAfterClose`.

**Tech Stack:** Next.js 16 (App Router, client components), TypeScript, Tailwind CSS, Supabase, sonner (toasts), recharts (gráfico de fluxo mantido; gráficos da DRE removidos).

**Verificação:** O projeto não possui suíte de testes unitários. A verificação de cada tarefa é feita por `npm run build` (typecheck + lint do Next) e checagem visual no servidor dev (`http://localhost:3000/financeiro`). Não introduzir framework de testes — seguir o padrão do repositório.

---

## Estrutura de Arquivos

- **Modificar:** `src/app/actions/financeiro.ts` — `bulkMarkPaid` passa a aceitar `paymentMethod?` opcional.
- **Criar:** `src/components/financeiro/MarkSettledModal.tsx` — mini-modal genérico de quitação (data + forma de pagamento opcional), para "pago" e "recebido".
- **Reescrever (seção):** `src/components/financeiro/ContasPagarReceberTab.tsx` — substitui a seção "Agenda por vencimento" pelo layout de duas colunas; mantém filtros, cards e gráfico.
- **Modificar:** `src/components/financeiro/FinanceiroClient.tsx` — nova assinatura do callback `onMarkPaid` e `performBulkMarkPaid` com opções (forma de pagamento + mensagem de sucesso).
- **Modificar:** `src/components/financeiro/DRETab.tsx` — remove gráficos/imports/memos associados; amplia fonte e padding da tabela.
- **Deletar:** `src/components/financeiro/DRECharts.tsx` — não mais utilizado.

---

## Task 1: Estender `bulkMarkPaid` para aceitar forma de pagamento opcional

**Files:**
- Modify: `src/app/actions/financeiro.ts:237-251`

- [ ] **Step 1: Atualizar a assinatura e o update da action**

Substituir a função `bulkMarkPaid` (linhas 237-251) inteira por:

```typescript
export async function bulkMarkPaid(
  entryIds: string[],
  paymentDate: string,
  paymentMethod?: PaymentMethod | null,
): Promise<Result> {
  if (entryIds.length === 0) return { success: false, error: 'Nenhum lançamento selecionado' }
  const { supabase } = await getActionClient()

  const update: Record<string, unknown> = {
    status: 'pago',
    payment_date: paymentDate,
    scheduled_date: null,
  }
  // Só sobrescreve a forma de pagamento quando informada no modal de quitação
  if (paymentMethod) update.payment_method = paymentMethod

  const { error } = await supabase
    .from('financial_entries')
    .update(update)
    .in('id', entryIds)

  if (error) return { success: false, error: error.message }

  revalidatePath('/financeiro')
  revalidatePath('/dashboard')
  return { success: true }
}
```

- [ ] **Step 2: Confirmar que `PaymentMethod` já está importado**

`PaymentMethod` já é importado no topo do arquivo (linha 6: `import type { EntryType, PaymentMethod, FinancialEntryStatus } from '@/types/database'`). Nenhuma alteração de import necessária. Se por algum motivo não estiver, adicioná-lo a esse import.

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sem novos erros relacionados a `financeiro.ts` (os 3 erros pré-existentes em `.next/dev/types/routes.d.ts` podem aparecer — são gerados pelo Next e não são deste arquivo).

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/financeiro.ts
git commit -m "feat(financeiro): bulkMarkPaid aceita forma de pagamento opcional"
```

---

## Task 2: Criar `MarkSettledModal` (mini-modal de quitação)

**Files:**
- Create: `src/components/financeiro/MarkSettledModal.tsx`

Mini-modal de confirmação com **data de pagamento** (default hoje, editável) e **forma de pagamento** (opcional). Genérico: título e rótulo do botão vêm por prop, para servir tanto "Marcar como Pago" quanto "Marcar como Recebido". Segue o visual de `MarkPaidModal.tsx`.

- [ ] **Step 1: Criar o arquivo completo**

```tsx
'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { PaymentMethod } from '@/types/database'
import { PAYMENT_METHOD_LABELS } from '@/types/database'

interface Props {
  title:        string   // ex.: "Marcar como Pago" / "Marcar como Recebido"
  description:  string    // ex.: descrição do título sendo quitado
  confirmLabel: string    // ex.: "Confirmar"
  onConfirm:    (paymentDate: string, paymentMethod: PaymentMethod | null) => void
  onCancel:     () => void
}

const METHODS = Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]

export function MarkSettledModal({ title, description, confirmLabel, onConfirm, onCancel }: Props) {
  const [paymentDate, setPaymentDate]     = useState(() => new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState<'' | PaymentMethod>('')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(59,36,24,0.4)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-dark">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-cream hover:text-dark transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 truncate text-sm text-gray-500">{description}</p>

        <div className="mb-4 space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-brown">
            Data do Pagamento *
          </label>
          <input
            type="date"
            required
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            style={{ borderColor: '#E6C07B' }}
          />
        </div>

        <div className="mb-6 space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-brown">
            Forma de Pagamento
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as '' | PaymentMethod)}
            className="w-full rounded-lg border bg-white px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            style={{ borderColor: '#E6C07B' }}
          >
            <option value="">Não informar</option>
            {METHODS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gold/50 py-2.5 text-sm font-medium text-dark transition-colors hover:bg-[#F9F7F4]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!paymentDate}
            onClick={() => onConfirm(paymentDate, paymentMethod || null)}
            className="flex-1 rounded-lg bg-terracotta py-2.5 text-sm font-medium text-white hover:bg-brown disabled:opacity-60 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sem novos erros relacionados a `MarkSettledModal.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/financeiro/MarkSettledModal.tsx
git commit -m "feat(financeiro): mini-modal de quitacao com data e forma de pagamento"
```

---

## Task 3: Ajustar `FinanceiroClient` — assinatura do callback e opções de `performBulkMarkPaid`

**Files:**
- Modify: `src/components/financeiro/FinanceiroClient.tsx:490-512` (função `performBulkMarkPaid`)
- Modify: `src/components/financeiro/FinanceiroClient.tsx:1006-1010` (uso de `<ContasPagarReceberTab onMarkPaid=... />`)
- Modify: `src/components/financeiro/FinanceiroClient.tsx:1033-1040` (uso de `MarkPaidModal` em lote — ajustar a chamada para a nova assinatura)

A coluna "A Pagar" usa "pago" e a "A Receber" usa "recebido"; portanto a mensagem de sucesso e a forma de pagamento precisam fluir do tab para o pai. Refatoramos `performBulkMarkPaid` para aceitar opções.

- [ ] **Step 1: Verificar import de `PaymentMethod` no `FinanceiroClient`**

Garantir que `PaymentMethod` esteja disponível. Procurar o import de tipos de `@/types/database` no topo do arquivo e, se `PaymentMethod` não estiver na lista, adicioná-lo. (Vários tipos já são importados desse módulo no arquivo.)

Run: `grep -n "from '@/types/database'" src/components/financeiro/FinanceiroClient.tsx`
Se a linha de import de tipos não contiver `PaymentMethod`, incluí-lo nela.

- [ ] **Step 2: Refatorar `performBulkMarkPaid` para aceitar opções**

Substituir a função `performBulkMarkPaid` (linhas 490-512) inteira por:

```tsx
  function performBulkMarkPaid(
    ids: string[],
    paymentDate: string,
    opts?: { paymentMethod?: PaymentMethod | null; successMessage?: string },
  ) {
    const snapshot = localEntries
    setLocalEntries((prev) =>
      prev.map((e) =>
        ids.includes(e.id)
          ? {
              ...e,
              status: 'pago' as const,
              payment_date: paymentDate,
              payment_method: opts?.paymentMethod ?? e.payment_method,
              scheduled_date: null,
            }
          : e
      )
    )
    setSelectedIds(new Set())
    toastAfterClose(
      opts?.successMessage ??
        `${ids.length} lançamento${ids.length !== 1 ? 's' : ''} marcado${ids.length !== 1 ? 's' : ''} como pago`
    )

    bulkMarkPaid(ids, paymentDate, opts?.paymentMethod ?? undefined)
      .then((result) => {
        if (!result.success) throw new Error(result.error)
      })
      .catch(() => {
        setLocalEntries(snapshot)
        toast.error('Erro ao marcar como pago', {
          action: { label: 'Tentar novamente', onClick: () => performBulkMarkPaid(ids, paymentDate, opts) },
        })
      })
  }
```

- [ ] **Step 3: Atualizar o uso de `onMarkPaid` no `ContasPagarReceberTab`**

Localizar (linhas ~1006-1010):

```tsx
        <ContasPagarReceberTab
          entries={...}
          projects={...}
          onMarkPaid={(id, date) => performBulkMarkPaid([id], date)}
        />
```

Substituir apenas a prop `onMarkPaid` por:

```tsx
          onMarkPaid={(id, date, method, entryType) =>
            performBulkMarkPaid([id], date, {
              paymentMethod: method,
              successMessage: entryType === 'income' ? 'Título marcado como recebido' : 'Título marcado como pago',
            })
          }
```

(Manter `entries` e `projects` exatamente como estão.)

- [ ] **Step 4: Confirmar a chamada do modal de quitação em lote (aba Lançamentos)**

A ação em lote da aba Lançamentos chama `performBulkMarkPaid([...selectedIds], paymentDate)` (linha ~1038). Como o novo parâmetro `opts` é opcional, essa chamada **continua válida sem alteração** e mantém a mensagem padrão ("X lançamentos marcados como pago"). Verificar visualmente que a linha permanece:

```tsx
            performBulkMarkPaid([...selectedIds], paymentDate)
```

Nenhuma mudança necessária aqui.

- [ ] **Step 5: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: o único erro novo esperado é em `ContasPagarReceberTab.tsx` (ainda com a assinatura antiga de `onMarkPaid`), que será corrigido na Task 4. Nenhum erro dentro de `FinanceiroClient.tsx`.

- [ ] **Step 6: Commit**

```bash
git add src/components/financeiro/FinanceiroClient.tsx
git commit -m "refactor(financeiro): performBulkMarkPaid aceita forma de pagamento e mensagem"
```

---

## Task 4: Reescrever a seção de duas colunas em `ContasPagarReceberTab`

**Files:**
- Modify: `src/components/financeiro/ContasPagarReceberTab.tsx` (reescrita completa)

Mantém: barra de filtros (Obra + Vencimento De/Até), 4 cards de resumo, gráfico "Fluxo projetado". Substitui a seção "Agenda por vencimento" (linhas 343-431 do arquivo atual) por duas colunas. As colunas respeitam os filtros ativos (obra + período de vencimento De/Até).

- [ ] **Step 1: Substituir o arquivo inteiro pelo conteúdo abaixo**

```tsx
'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { RotateCcw } from 'lucide-react'
import type { FinancialEntry, PaymentMethod } from '@/types/database'
import { formatCurrency } from '@/lib/format'
import { MarkSettledModal } from './MarkSettledModal'
import type { ContasPoint } from './ContasChart'

type EntryWithJoins = FinancialEntry & {
  projects?:  { id: string; name: string } | null
  suppliers?: { id: string; name: string } | null
}

// Gráfico carregado sob demanda, fora do bundle inicial
const ContasChart = dynamic(() => import('./ContasChart'), {
  ssr: false,
  loading: () => <ChartSpinner />,
})

function ChartSpinner() {
  return (
    <div className="flex h-[380px] items-center justify-center">
      <div
        className="h-8 w-8 rounded-full border-[3px]"
        style={{
          borderColor: '#F4E2B8',
          borderTopColor: '#C68B59',
          animation: 'spin 0.8s linear infinite',
        }}
      />
    </div>
  )
}

interface Props {
  entries:    EntryWithJoins[]
  projects:   { id: string; name: string }[]
  onMarkPaid: (
    id: string,
    paymentDate: string,
    paymentMethod: PaymentMethod | null,
    entryType: 'income' | 'expense',
  ) => void
}

type Gran = 'dia' | 'semana' | 'mes'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// ── Paleta ──
const RED   = '#8B3A3A'   // a pagar / vencido
const GREEN = '#4A7C59'   // a receber
const TERRA = '#C68B59'   // vence hoje
const GOLD  = '#E6C07B'   // a vencer / bordas
const BROWN = '#8A5A3B'   // títulos
const DARK  = '#3B2418'

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
function startOfWeekMon(d: Date): Date {
  const x = new Date(d)
  const wd = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - wd)
  x.setHours(0, 0, 0, 0)
  return x
}
function dayDiff(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + 'T00:00:00').getTime()
  const b = new Date(toISO + 'T00:00:00').getTime()
  return Math.round((b - a) / 86400000)
}
function ddmm(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

const isPending = (e: EntryWithJoins) => e.status === 'pendente' || e.status === 'agendado'

// Vencimento efetivo de uma conta em aberto
function dueDate(e: EntryWithJoins): string {
  if (e.status === 'agendado') return e.scheduled_date ?? e.entry_date
  return e.due_date ?? e.entry_date
}
// Data em que o lançamento afeta (ou afetará) o caixa
function effectiveDate(e: EntryWithJoins, today: string): string {
  if (e.status === 'pago') return e.payment_date ?? e.entry_date
  const due = dueDate(e)
  return due < today ? today : due
}
function entityLabel(e: EntryWithJoins): string {
  return e.suppliers?.name ?? e.counterpart ?? '—'
}

// Selo de situação por vencimento
function situacao(due: string, today: string): { label: string; bg: string; fg: string } {
  if (due < today)  return { label: 'Vencido',    bg: RED,   fg: '#ffffff' }
  if (due === today) return { label: 'Vence hoje', bg: TERRA, fg: '#ffffff' }
  return { label: 'A vencer', bg: GOLD, fg: DARK }
}

// Faixas de prazo dentro de cada coluna
const PRAZO_BANDS: { key: string; label: string; test: (d: number) => boolean }[] = [
  { key: 'vencidos', label: 'Vencidos',         test: (d) => d < 0 },
  { key: 'prox7',    label: 'Próximos 7 dias',  test: (d) => d >= 0 && d <= 7 },
  { key: '8a30',     label: '8 a 30 dias',      test: (d) => d >= 8 && d <= 30 },
  { key: 'mais30',   label: 'Acima de 30 dias', test: (d) => d > 30 },
]

interface Band { key: string; label: string; items: EntryWithJoins[]; subtotal: number }
interface Column { bands: Band[]; total: number; count: number }

function buildColumn(items: EntryWithJoins[], type: 'income' | 'expense', today: string): Column {
  const list = items.filter((e) => isPending(e) && e.entry_type === type)
  const bands: Band[] = PRAZO_BANDS.map((b) => ({ key: b.key, label: b.label, items: [], subtotal: 0 }))
  for (const e of list) {
    const d = dayDiff(today, dueDate(e))
    const idx = PRAZO_BANDS.findIndex((b) => b.test(d))
    if (idx < 0) continue
    bands[idx].items.push(e)
    bands[idx].subtotal += e.amount
  }
  for (const b of bands) b.items.sort((a, c) => dueDate(a).localeCompare(dueDate(c)))
  const total = list.reduce((s, e) => s + e.amount, 0)
  return { bands: bands.filter((b) => b.items.length > 0), total, count: list.length }
}

// ── Gráfico: gera buckets (dia/semana/mês) e a série acumulada ──
function makeBuckets(gran: Gran, today: Date): { label: string; startISO: string; endISO: string }[] {
  const out: { label: string; startISO: string; endISO: string }[] = []
  if (gran === 'dia') {
    const start = addDays(today, -7)
    for (let i = 0; i < 38; i++) {
      const d = addDays(start, i)
      out.push({ label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, startISO: ymd(d), endISO: ymd(addDays(d, 1)) })
    }
  } else if (gran === 'semana') {
    const start = addDays(startOfWeekMon(today), -28)
    for (let i = 0; i < 17; i++) {
      const d = addDays(start, i * 7)
      out.push({ label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, startISO: ymd(d), endISO: ymd(addDays(d, 7)) })
    }
  } else {
    const base = new Date(today.getFullYear(), today.getMonth() - 3, 1)
    for (let i = 0; i < 16; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() + i, 1)
      const e = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      out.push({ label: `${MONTHS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, startISO: ymd(d), endISO: ymd(e) })
    }
  }
  return out
}

function buildSeries(entries: EntryWithJoins[], gran: Gran, todayISO: string): { points: ContasPoint[]; todayLabel: string } {
  const buckets = makeBuckets(gran, new Date(todayISO + 'T00:00:00'))
  const n = buckets.length
  const aReceber = new Array(n).fill(0)
  const aPagar = new Array(n).fill(0)
  const deltaIn = new Array(n).fill(0)
  let baseline = 0
  const rangeStart = buckets[0].startISO
  const rangeEnd = buckets[n - 1].endISO

  const idxOf = (iso: string) => {
    for (let i = 0; i < n; i++) if (iso >= buckets[i].startISO && iso < buckets[i].endISO) return i
    return -1
  }

  for (const e of entries) {
    if (isPending(e)) {
      const bi = idxOf(dueDate(e))
      if (bi >= 0) {
        if (e.entry_type === 'income') aReceber[bi] += e.amount
        else aPagar[bi] += e.amount
      }
    }
    const eff = effectiveDate(e, todayISO)
    const delta = e.entry_type === 'income' ? e.amount : -e.amount
    if (eff < rangeStart) baseline += delta
    else if (eff < rangeEnd) {
      const bi = idxOf(eff)
      if (bi >= 0) deltaIn[bi] += delta
    }
  }

  let todayIdx = idxOf(todayISO)
  if (todayIdx < 0) todayIdx = 0

  const points: ContasPoint[] = []
  let acc = baseline
  for (let i = 0; i < n; i++) {
    acc += deltaIn[i]
    points.push({
      label: buckets[i].label,
      aReceber: aReceber[i],
      aPagar: aPagar[i],
      saldoPeriodo: aReceber[i] - aPagar[i],
      saldoAcum: acc,
      saldoPast: i <= todayIdx ? acc : null,
      saldoFuture: i >= todayIdx ? acc : null,
    })
  }
  return { points, todayLabel: buckets[todayIdx].label }
}

// ── Coluna de títulos (A Pagar / A Receber) ──
function SettleColumn({
  title, headerBg, valueColor, column, today, actionLabel, emptyMsg, onAction,
}: {
  title: string
  headerBg: string
  valueColor: string
  column: Column
  today: string
  actionLabel: string
  emptyMsg: string
  onAction: (e: EntryWithJoins) => void
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gold/30 bg-white shadow-sm">
      {/* Cabeçalho fixo com total */}
      <div className="border-b border-gold/20 px-4 py-3" style={{ backgroundColor: headerBg }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: BROWN }}>{title}</p>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="text-2xl font-bold" style={{ color: valueColor }}>{formatCurrency(column.total)}</span>
          <span className="text-xs text-gray-400">({column.count} título{column.count !== 1 ? 's' : ''})</span>
        </div>
      </div>

      {/* Lista com rolagem interna */}
      {column.count === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-400">{emptyMsg}</p>
        </div>
      ) : (
        <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
          {column.bands.map((b) => (
            <div key={b.key}>
              {/* Separador de prazo */}
              <div className="flex items-center justify-between px-4 pb-1 pt-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: BROWN }}>
                  {b.label}
                </span>
                <span className="text-[11px] text-gray-400">{formatCurrency(b.subtotal)}</span>
              </div>

              {/* Títulos da faixa */}
              <div className="divide-y divide-gold/10">
                {b.items.map((e) => {
                  const due = dueDate(e)
                  const s = situacao(due, today)
                  const ent = entityLabel(e)
                  return (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-cream/30">
                      {/* Esquerda: vencimento + selo */}
                      <div className="flex w-[60px] shrink-0 flex-col items-start gap-1">
                        <span className="text-sm font-semibold text-dark">{ddmm(due)}</span>
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-medium leading-none"
                          style={{ backgroundColor: s.bg, color: s.fg }}
                        >
                          {s.label}
                        </span>
                      </div>

                      {/* Meio: descrição + obra/entidade */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-dark">{e.description}</p>
                        <p className="truncate text-xs text-gray-500">
                          {e.projects?.name ?? '—'}{ent !== '—' ? ` · ${ent}` : ''}
                        </p>
                      </div>

                      {/* Direita: valor + ação */}
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="whitespace-nowrap text-sm font-bold" style={{ color: valueColor }}>
                          {formatCurrency(e.amount)}
                        </span>
                        <button
                          onClick={() => onAction(e)}
                          className="whitespace-nowrap rounded-lg border px-2 py-0.5 text-[11px] font-medium text-brown transition-colors hover:border-terracotta hover:bg-terracotta hover:text-white"
                          style={{ borderColor: GOLD }}
                        >
                          {actionLabel}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ContasPagarReceberTab({ entries, projects, onMarkPaid }: Props) {
  const today = useMemo(() => new Date().toISOString().split('T')[0], [])
  const [obra, setObra] = useState('all')
  const [de,  setDe]  = useState('')
  const [ate, setAte] = useState('')
  const [gran, setGran] = useState<Gran>('mes')
  const [settleTarget, setSettleTarget] = useState<EntryWithJoins | null>(null)

  // Escopo: respeita a obra selecionada
  const scoped = useMemo(
    () => (obra === 'all' ? entries : entries.filter((e) => e.project_id === obra)),
    [entries, obra]
  )

  // ── Cards (refletem o período) ──
  const cards = useMemo(() => {
    const start = de || today
    const end = ate || '9999-12-31'
    let aReceber = 0, aPagar = 0, vencRec = 0, vencPag = 0
    for (const e of scoped) {
      if (!isPending(e)) continue
      const due = dueDate(e)
      if (due < today) {
        if (e.entry_type === 'income') vencRec += e.amount
        else vencPag += e.amount
      }
      if (due >= start && due <= end) {
        if (e.entry_type === 'income') aReceber += e.amount
        else aPagar += e.amount
      }
    }
    return { aReceber, aPagar, saldo: aReceber - aPagar, vencRec, vencPag }
  }, [scoped, de, ate, today])

  // ── Colunas (respeitam obra + período de vencimento De/Até) ──
  const dateFiltered = useMemo(
    () => scoped.filter((e) => {
      if (!isPending(e)) return false
      const due = dueDate(e)
      if (de && due < de) return false
      if (ate && due > ate) return false
      return true
    }),
    [scoped, de, ate]
  )
  const colPagar   = useMemo(() => buildColumn(dateFiltered, 'expense', today), [dateFiltered, today])
  const colReceber = useMemo(() => buildColumn(dateFiltered, 'income',  today), [dateFiltered, today])

  const series = useMemo(() => buildSeries(scoped, gran, today), [scoped, gran, today])

  const totalAberto = useMemo(() => scoped.filter(isPending).length, [scoped])

  const isFiltered = obra !== 'all' || !!de || !!ate

  function clearFilters() {
    setObra('all')
    setDe('')
    setAte('')
  }

  function handleAction(e: EntryWithJoins) {
    setSettleTarget(e)
  }

  function confirmSettle(paymentDate: string, paymentMethod: PaymentMethod | null) {
    if (!settleTarget) return
    onMarkPaid(settleTarget.id, paymentDate, paymentMethod, settleTarget.entry_type)
    setSettleTarget(null)
  }

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="space-y-4 rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">Obra</label>
            <select
              value={obra}
              onChange={(e) => setObra(e.target.value)}
              className="rounded-lg border border-gold/50 px-3 py-1.5 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            >
              <option value="all">Todas as obras</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">Vencimento — de</label>
            <input
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
              className="rounded-lg border border-gold/50 px-3 py-1.5 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">até</label>
            <input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="rounded-lg border border-gold/50 px-3 py-1.5 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>

          {isFiltered && (
            <button
              onClick={clearFilters}
              className="ml-auto flex items-center gap-1.5 self-end rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-cream"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">A receber</p>
          <p className="mt-1 text-xl font-bold" style={{ color: GREEN }}>{formatCurrency(cards.aReceber)}</p>
          <p className="mt-0.5 text-[11px] text-gray-400">no período</p>
        </div>
        <div className="rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">A pagar</p>
          <p className="mt-1 text-xl font-bold" style={{ color: RED }}>{formatCurrency(cards.aPagar)}</p>
          <p className="mt-0.5 text-[11px] text-gray-400">no período</p>
        </div>
        <div className="rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Saldo projetado</p>
          <p className="mt-1 text-xl font-bold" style={{ color: cards.saldo >= 0 ? GREEN : RED }}>
            {formatCurrency(cards.saldo)}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-400">a receber − a pagar</p>
        </div>
        <div
          className="rounded-xl border bg-white p-4 shadow-sm"
          style={{ borderColor: cards.vencRec + cards.vencPag > 0 ? 'rgba(139,58,58,0.35)' : '#E6C07B' }}
        >
          <p className="text-xs font-medium text-gray-500">Vencidos</p>
          <div className="mt-1.5 space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-500">A receber</span>
              <span className="font-semibold" style={{ color: RED }}>{formatCurrency(cards.vencRec)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-500">A pagar</span>
              <span className="font-semibold" style={{ color: RED }}>{formatCurrency(cards.vencPag)}</span>
            </div>
          </div>
        </div>
      </div>

      {totalAberto === 0 ? (
        <div className="rounded-xl border border-dashed border-gold/40 py-14 text-center">
          <p className="text-sm text-gray-400">Nenhuma conta em aberto para esta obra.</p>
        </div>
      ) : (
        <>
          {/* Duas colunas: A Pagar | A Receber */}
          <div className="grid gap-4 lg:grid-cols-2">
            <SettleColumn
              title="A Pagar"
              headerBg="rgba(139,58,58,0.06)"
              valueColor={RED}
              column={colPagar}
              today={today}
              actionLabel="Marcar pago"
              emptyMsg="Nenhum título a pagar no período"
              onAction={handleAction}
            />
            <SettleColumn
              title="A Receber"
              headerBg="rgba(74,124,89,0.07)"
              valueColor={GREEN}
              column={colReceber}
              today={today}
              actionLabel="Marcar recebido"
              emptyMsg="Nenhum título a receber no período"
              onAction={handleAction}
            />
          </div>

          {/* Gráfico */}
          <div className="rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-dark">Fluxo projetado</h2>
                <p className="text-xs text-gray-400">A receber e a pagar por período, com saldo acumulado</p>
              </div>
              <div className="flex gap-1 rounded-lg border border-gold/30 bg-cream/30 p-1">
                {([
                  { key: 'dia',    label: 'Diário' },
                  { key: 'semana', label: 'Semanal' },
                  { key: 'mes',    label: 'Mensal' },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setGran(key)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      gran === key ? 'bg-white text-dark shadow-sm' : 'text-gray-500 hover:text-dark'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <ContasChart data={series.points} todayLabel={series.todayLabel} />
          </div>
        </>
      )}

      {settleTarget && (
        <MarkSettledModal
          title={settleTarget.entry_type === 'income' ? 'Marcar como Recebido' : 'Marcar como Pago'}
          description={settleTarget.description}
          confirmLabel="Confirmar"
          onConfirm={confirmSettle}
          onCancel={() => setSettleTarget(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sem novos erros (a assinatura de `onMarkPaid` agora bate com o que `FinanceiroClient` passa). Os 3 erros pré-existentes em `.next/dev/types/routes.d.ts` são ignoráveis.

- [ ] **Step 3: Verificar visualmente no servidor dev**

Garantir que o dev server esteja rodando (`npm run dev`). Abrir `http://localhost:3000/financeiro`, aba "A Pagar / A Receber". Confirmar:
- Filtros, 4 cards e gráfico inalterados.
- Duas colunas lado a lado (A Pagar à esquerda em vermelho, A Receber à direita em verde), com total grande + contagem.
- Faixas de prazo com subtotal; faixas vazias omitidas.
- Clique em "Marcar pago"/"Marcar recebido" abre o modal; ao confirmar, o título some na hora, totais atualizam e o toast aparece após o modal fechar.

- [ ] **Step 4: Commit**

```bash
git add src/components/financeiro/ContasPagarReceberTab.tsx
git commit -m "feat(financeiro): aba A Pagar/A Receber em duas colunas com quitacao por titulo"
```

---

## Task 5: DRE — remover os dois gráficos e código associado

**Files:**
- Modify: `src/components/financeiro/DRETab.tsx`
- Delete: `src/components/financeiro/DRECharts.tsx`

Remover: o componente dinâmico `DRECharts`, o `ChartSpinner`, o import `dynamic`, o bloco `<DRECharts ... />`, o memo `evolucao`, e o campo derivado `porCategoria` (usado apenas pelos gráficos).

- [ ] **Step 1: Remover o import de `dynamic` e o componente `DRECharts`/`ChartSpinner`**

No topo de `DRETab.tsx`, remover a linha:

```tsx
import dynamic from 'next/dynamic'
```

E remover o bloco completo (linhas atuais 13-27):

```tsx
const DRECharts = dynamic(() => import('./DRECharts'), {
  ssr: false,
  loading: () => <ChartSpinner />,
})

function ChartSpinner() {
  return (
    <div className="flex h-[220px] items-center justify-center">
      <div
        className="h-8 w-8 rounded-full border-[3px]"
        style={{ borderColor: '#F4E2B8', borderTopColor: '#C68B59', animation: 'spin 0.8s linear infinite' }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Remover `porCategoria` da interface `DreCalc`**

Na interface `DreCalc`, remover a linha:

```tsx
  porCategoria: { cat: string; amount: number }[]
```

- [ ] **Step 3: Remover o cálculo e o retorno de `porCategoria` em `computeDre`**

Remover este bloco dentro de `computeDre` (logo após o cálculo de `byKey`):

```tsx
  const porCategoria = [...deducoes.accounts, ...custos.accounts, ...operacionais.accounts, ...financeiras.accounts]
    .map((a) => ({ cat: a.name, amount: a.amount }))
    .sort((a, b) => b.amount - a.amount)
```

E no `return` de `computeDre`, remover `porCategoria` da lista de campos retornados. O retorno passa a ser:

```tsx
  return {
    receita, deducoes, custos, operacionais, financeiras,
    receitaBruta, receitaLiquida, lucroBruto, resultadoOperacional, resultadoLiquido,
    byKey,
  }
```

- [ ] **Step 4: Remover o memo `evolucao`**

Remover (linhas atuais 272-275):

```tsx
  const evolucao = useMemo(
    () => months.map((m) => ({ label: m.label, resultado: monthlyDre.get(m.key)!.resultadoLiquido })),
    [months, monthlyDre],
  )
```

- [ ] **Step 5: Remover o bloco de gráficos do JSX**

Remover (linhas atuais 538-541):

```tsx
          {/* Gráficos (lazy) */}
          <div className="no-print">
            <DRECharts composicao={accumDre.porCategoria} evolucao={evolucao} />
          </div>
```

- [ ] **Step 6: Deletar o arquivo `DRECharts.tsx`**

```bash
git rm src/components/financeiro/DRECharts.tsx
```

- [ ] **Step 7: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sem novos erros. Confirmar que nenhuma outra referência a `DRECharts`, `porCategoria` ou `evolucao` permaneceu.

Run: `grep -rn "DRECharts\|porCategoria\|evolucao" src/`
Expected: nenhum resultado.

- [ ] **Step 8: Commit**

```bash
git add src/components/financeiro/DRETab.tsx
git commit -m "refactor(financeiro): remove graficos da DRE (composicao e evolucao)"
```

---

## Task 6: DRE — ampliar fonte e padding da tabela

**Files:**
- Modify: `src/components/financeiro/DRETab.tsx` (cabeçalho e células da matriz)

A coluna CONTA (sticky à esquerda) e ACUMULADO (sticky à direita) **permanecem sticky** — não alterar o posicionamento, apenas fonte/padding. A tabela já é `text-sm` (14px); o ganho visível vem do padding maior das linhas e da fonte maior do cabeçalho.

- [ ] **Step 1: Ampliar o cabeçalho (Conta, meses, Acumulado)**

No `<thead>`, nas três células de cabeçalho, trocar `text-xs` por `text-sm` e `py-2` por `py-2.5`:

- Célula "Conta": `... px-3 py-2 text-left text-xs font-semibold ...` → `... px-3 py-2.5 text-left text-sm font-semibold ...`
- Cada célula de mês: `... px-3 py-2 text-right text-xs font-semibold ...` → `... px-3 py-2.5 text-right text-sm font-semibold ...`
- Célula "Acumulado": `... px-3 py-2 text-right text-xs font-semibold ...` → `... px-3 py-2.5 text-right text-sm font-semibold ...`

- [ ] **Step 2: Ampliar o padding vertical das células do corpo**

No `<tbody>`, aumentar o padding vertical de `py-2` para `py-2.5` nas três células de cada linha:

- Célula "Conta" (sticky esquerda): `className="sticky left-0 z-20 py-2 pr-3"` → `className="sticky left-0 z-20 py-2.5 pr-3"`
- Célula de cada mês: `className={`px-3 py-2 text-right whitespace-nowrap ...`}` → `className={`px-3 py-2.5 text-right whitespace-nowrap ...`}`
- Célula "Acumulado" (sticky direita): `className="sticky right-0 z-20 px-3 py-2 text-right font-bold whitespace-nowrap"` → `className="sticky right-0 z-20 px-3 py-2.5 text-right font-bold whitespace-nowrap"`

(A tabela mantém `text-sm` = 14px nas células do corpo. Não alterar cores, estrutura de linhas, sticky ou os botões Exportar.)

- [ ] **Step 3: Verificar typecheck/build**

Run: `npx tsc --noEmit`
Expected: sem novos erros.

- [ ] **Step 4: Verificar visualmente**

Abrir `http://localhost:3000/financeiro`, aba "DRE". Confirmar:
- Não há mais os gráficos no fim.
- Tabela com linhas mais espaçadas e cabeçalho de meses um pouco maior.
- Coluna Conta continua fixa à esquerda e Acumulado fixa à direita ao rolar.
- Filtros, cálculos, cores e botões Exportar PDF/Excel inalterados.

- [ ] **Step 5: Commit**

```bash
git add src/components/financeiro/DRETab.tsx
git commit -m "style(financeiro): amplia fonte e padding da tabela DRE"
```

---

## Task 7: Build final e verificação

**Files:** nenhum (verificação)

- [ ] **Step 1: Rodar o build de produção**

Run: `npm run build`
Expected: build conclui com sucesso (sem erros de tipo nem de lint). O arquivo gerado `.next/dev/types/routes.d.ts` é recriado durante o build — os 3 erros vistos com `tsc --noEmit` em dev não devem aparecer no build do Next.

- [ ] **Step 2: Checagem funcional no dev server**

Com `npm run dev` ativo, validar o roteiro completo:
1. Aba "A Pagar / A Receber": filtrar por obra e por período de vencimento → totais das duas colunas e cards do topo refletem o filtro.
2. Marcar um título como pago e outro como recebido → some da lista na hora, totais atualizam, toast correto ("Título marcado como pago" / "...recebido") após o modal fechar.
3. Forçar erro (opcional) não é necessário, mas o rollback com toast "Tentar novamente" está preservado.
4. Aba "DRE": gráficos ausentes, tabela ampliada, sticky preservado, exportações funcionando.

- [ ] **Step 3: Commit final (se houver ajustes pendentes)**

Caso o build tenha exigido pequenos ajustes:

```bash
git add -A
git commit -m "chore(financeiro): ajustes finais pos-build"
```

---

## Self-Review (cobertura do spec)

**A Pagar / A Receber:**
- Filtros (Obra + Vencimento De/Até) mantidos → Task 4 (filtros idênticos).
- 4 cards do topo mantidos → Task 4 (cards idênticos).
- Gráfico "Fluxo projetado" mantido → Task 4 (mantido com `buildSeries`/`ContasChart`).
- Layout duas colunas (A Pagar esq. / A Receber dir.) → Task 4 (`grid lg:grid-cols-2` + `SettleColumn`).
- Cabeçalho com total grande colorido (#8B3A3A / #4A7C59) + contagem → Task 4 (`SettleColumn` header).
- Totais respeitam filtros (obra + período) → Task 4 (`dateFiltered` aplica De/Até; `scoped` aplica obra).
- Lista ordenada por vencimento (mais antigo primeiro) → Task 4 (bands em ordem + sort por `dueDate`).
- Linha-card: data dd/mm + selo (Vencido/Vence hoje/A vencer com cores corretas) + descrição bold + obra/fornecedor + valor + botão → Task 4 (`SettleColumn` item).
- Botão ghost borda #E6C07B, hover terracota → Task 4 (botão item).
- Separadores por prazo (Vencidos / Próximos 7 / 8 a 30 / Acima de 30) com subtotal, omitindo vazios → Task 4 (`PRAZO_BANDS` + `buildColumn` filtra vazias).
- Estado vazio por coluna → Task 4 (`emptyMsg`).
- Rolagem interna com cabeçalho de total visível → Task 4 (header fora do scroll; lista `maxHeight 60vh overflow-y-auto`).
- Mini-modal com data (default hoje) + forma de pagamento opcional → Task 2 (`MarkSettledModal`).
- Optimistic UI (some na hora, totais atualizam) → Task 3 (`performBulkMarkPaid` atualiza `localEntries`, que reflete nas colunas e cards).
- Toast após modal fechar (~250ms) "Título marcado como pago/recebido" → Task 3 (`toastAfterClose` com `successMessage`).
- Atualiza status 'pago' + payment_date (+ forma quando informada) → Task 1 (`bulkMarkPaid`).
- Estilo (R$ com milhar via `formatCurrency`, inputs borda #E6C07B, acentos leves) → Tasks 2 e 4.

**DRE:**
- Remover "Composição de custos" e "Evolução do resultado" + imports/queries → Task 5.
- Aumentar fonte das células para 14px (text-sm, já vigente) → Task 6.
- Aumentar padding vertical das linhas (py-2 → py-2.5) → Task 6.
- Aumentar levemente a fonte do cabeçalho dos meses (text-xs → text-sm) → Task 6.
- Manter Conta sticky à esquerda e Acumulado sticky à direita → Task 6 (não altera sticky).
- Não alterar filtros, cálculos, cores, estrutura de linhas, botões Exportar → Tasks 5 e 6 (apenas remoção de gráficos e ajuste de fonte/padding).

Sem placeholders. Tipos consistentes: `onMarkPaid(id, paymentDate, paymentMethod, entryType)` definido na Task 4 e consumido na Task 3; `bulkMarkPaid(entryIds, paymentDate, paymentMethod?)` definido na Task 1 e consumido na Task 3.
