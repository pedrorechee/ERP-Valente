'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Plus, Trash2 } from 'lucide-react'
import type { Budget, BudgetItem, ProjectPhase, CostCategory, BudgetStatus } from '@/types/database'
import { BUDGET_STATUS_LABELS, BUDGET_UNITS } from '@/types/database'
import { formatCurrency, formatDate } from '@/lib/format'
import { saveBudget, finalizeBudget, reopenBudget, deleteBudget, type SaveBudgetItem } from '@/app/actions/orcamentos'
import { OrcadoRealizado, type OrcadoRealizadoRow } from './OrcadoRealizado'
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal'
import { toast } from 'sonner'
import { toastAfterClose } from '@/lib/ui-feedback'
import { useCompany } from '@/components/layout/CompanyProvider'

type BudgetWithProject = Budget & { projects?: { id: string; name: string } | null }

interface Props {
  budget:          BudgetWithProject
  phases:          ProjectPhase[]
  items:           BudgetItem[]
  categories:      CostCategory[]
  realizedByPhase: Record<string, number>
  realizedNoPhase: number
}

// Linha editável em memória
interface Row {
  key:         string
  phase_id:    string | null
  description: string
  unit:        string
  quantityStr: string  // texto digitado (aceita vírgula)
  priceDigits: string  // centavos, como o CurrencyInput
  category_id: string | null
}

// ── Helpers de moeda (mesma lógica do CurrencyInput) ──
function digitsToDisplay(digits: string): string {
  if (!digits) return ''
  const padded = digits.padStart(3, '0')
  const cents = padded.slice(-2)
  const reais = padded.slice(0, -2).replace(/^0+/, '') || '0'
  return `R$ ${reais.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${cents}`
}
function digitsToNumber(digits: string): number {
  return digits ? Number(digits) / 100 : 0
}
function numberToDigits(n: number): string {
  return n > 0 ? String(Math.round(n * 100)) : ''
}
function parseQty(str: string): number {
  const n = parseFloat(str.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''))
  return isNaN(n) ? 0 : n
}
function qtyToStr(n: number): string {
  return String(n).replace('.', ',')
}

const SEM_ETAPA = '__sem_etapa__'

const inputCls =
  'w-full rounded-lg border border-gold/50 bg-white px-2.5 py-1.5 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta'

function statusBadge(status: BudgetStatus): { className: string; style?: React.CSSProperties } {
  if (status === 'aprovado')
    return { className: '', style: { backgroundColor: 'rgba(74,124,89,0.15)', color: '#4A7C59' } }
  return { className: '', style: { backgroundColor: 'rgba(230,192,123,0.30)', color: '#8A5A3B' } }
}

export function OrcamentoBuilder({ budget, phases, items, categories, realizedByPhase, realizedNoPhase }: Props) {
  const { companyName } = useCompany()
  const router = useRouter()
  const keyCounter = useRef(0)
  const newKey = () => `row-${keyCounter.current++}`

  const [tab, setTab]         = useState<'itens' | 'orcado'>('itens')
  const [status, setStatus]   = useState<BudgetStatus>(budget.status)
  const [bdiStr, setBdiStr]   = useState(String(budget.bdi_percent ?? 12))
  const [description, setDescription] = useState(budget.description ?? '')
  // BDI por fase
  const [phaseBdiEnabled, setPhaseBdiEnabled] = useState(budget.phase_bdi_enabled ?? false)
  const [phaseBdiMap, setPhaseBdiMap] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {}
    for (const it of items) {
      const gid = it.phase_id ?? SEM_ETAPA
      if (it.bdi_override != null && m[gid] === undefined) m[gid] = String(it.bdi_override)
    }
    return m
  })
  // Fase em impressão (PDF por fase); null = nenhuma
  const [printGroupId, setPrintGroupId] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>(() =>
    items.map((it) => ({
      key:         `db-${it.id}`,
      phase_id:    it.phase_id,
      description: it.description,
      unit:        it.unit ?? '',
      quantityStr: qtyToStr(it.quantity),
      priceDigits: numberToDigits(it.unit_price),
      category_id: it.category_id,
    })),
  )
  const [errorKeys, setErrorKeys] = useState<Set<string>>(new Set())
  const [saving, setSaving]       = useState(false)
  const [busy, setBusy]           = useState(false) // finalizar/reabrir/excluir
  const [confirmDelete, setConfirmDelete] = useState(false)

  const bdiPercent = parseFloat(bdiStr.replace(',', '.')) || 0

  // ── Grupos: SOMENTE as fases reais da obra (sem "Sem etapa") ──
  const validPhaseIds = useMemo(() => new Set(phases.map((p) => p.id)), [phases])
  const hasPhases = phases.length > 0
  const groups = useMemo(() => phases.map((p) => ({ id: p.id, name: p.name })), [phases])

  // Item "órfão": sem fase ou com fase que não existe mais na obra. Todo item
  // precisa pertencer a uma fase real — órfãos são corrigidos no bloco de alerta.
  function isOrphan(r: Row): boolean {
    return r.phase_id === null || !validPhaseIds.has(r.phase_id)
  }

  function rowsOfGroup(groupId: string) {
    return rows.filter((r) => r.phase_id === groupId)
  }

  function rowTotal(r: Row): number {
    return parseQty(r.quantityStr) * digitsToNumber(r.priceDigits)
  }

  const directCost = useMemo(() => rows.reduce((s, r) => s + rowTotal(r), 0), [rows])
  // Linhas órfãs com conteúdo (descartamos as totalmente vazias)
  const orphanRows = rows.filter((r) => isOrphan(r) && !isEmptyRow(r))

  // BDI efetivo de uma fase: o BDI da fase (se ligado e preenchido) ou o BDI padrão
  function phaseBdiNum(groupId: string): number {
    if (!phaseBdiEnabled) return bdiPercent
    const s = phaseBdiMap[groupId]
    if (s === undefined || s.trim() === '') return bdiPercent
    return parseFloat(s.replace(',', '.')) || 0
  }
  function groupDirectCost(groupId: string): number {
    const pid = groupId === SEM_ETAPA ? null : groupId
    return rows.filter((r) => r.phase_id === pid).reduce((s, r) => s + rowTotal(r), 0)
  }
  function groupFinalPrice(groupId: string): number {
    return groupDirectCost(groupId) * (1 + phaseBdiNum(groupId) / 100)
  }

  // Preço final = soma do preço de cada fase com seu BDI (cai no comportamento
  // antigo quando o BDI por fase está desligado, pois todas usam o BDI padrão).
  // Itens órfãos (a corrigir) entram pelo BDI padrão para o total não "sumir".
  const orphanDirect = orphanRows.reduce((s, r) => s + rowTotal(r), 0)
  const finalPrice = groups.reduce((s, g) => s + groupFinalPrice(g.id), 0)
    + orphanDirect * (1 + bdiPercent / 100)
  const bdiValue   = finalPrice - directCost
  const bdiMedio   = directCost > 0 ? (bdiValue / directCost) * 100 : 0

  // Orçado x Realizado: orçado vem dos itens em edição; realizado vem das despesas pagas
  const orcadoRealizadoRows: OrcadoRealizadoRow[] = useMemo(() => {
    const total = (pid: string | null) =>
      rows.filter((r) => r.phase_id === pid)
        .reduce((s, r) => s + parseQty(r.quantityStr) * digitsToNumber(r.priceDigits), 0)
    const list: OrcadoRealizadoRow[] = phases.map((p) => ({
      id: p.id, name: p.name, orcado: total(p.id), realizado: realizedByPhase[p.id] ?? 0,
    }))
    const semOrcado = total(null)
    if (semOrcado > 0 || realizedNoPhase > 0) {
      list.push({ id: SEM_ETAPA, name: 'Sem etapa', orcado: semOrcado, realizado: realizedNoPhase })
    }
    return list
  }, [phases, rows, realizedByPhase, realizedNoPhase])

  // ── Edição de linhas ──
  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
    // Limpa o destaque de erro quando o problema é resolvido (descrição ou fase)
    const fixedDescription = patch.description !== undefined && patch.description.trim() !== ''
    const fixedPhase = patch.phase_id !== undefined && patch.phase_id !== null
    if (fixedDescription || fixedPhase) {
      setErrorKeys((prev) => {
        if (!prev.has(key)) return prev
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }
  // Sempre vinculado a uma fase real (o botão fica dentro do grupo da fase)
  function addRow(phaseId: string) {
    setRows((prev) => [
      ...prev,
      { key: newKey(), phase_id: phaseId, description: '', unit: '', quantityStr: '1', priceDigits: '', category_id: null },
    ])
  }
  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key))
    setErrorKeys((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  // Linha "vazia" (descartada silenciosamente no save)
  function isEmptyRow(r: Row): boolean {
    return r.description.trim() === '' && r.priceDigits === '' && (r.quantityStr === '' || r.quantityStr === '1')
  }
  // Linha com valor mas sem descrição → erro de obrigatório
  function isIncomplete(r: Row): boolean {
    return r.description.trim() === '' && !isEmptyRow(r)
  }

  function buildPayloadItems(): SaveBudgetItem[] {
    let order = 0
    return rows
      .filter((r) => r.description.trim() !== '')
      .map((r) => ({
        phase_id:    r.phase_id,
        description: r.description.trim(),
        unit:        r.unit || null,
        quantity:    parseQty(r.quantityStr),
        unit_price:  digitsToNumber(r.priceDigits),
        // Grava o BDI da fase em cada item quando o BDI por fase está ligado
        bdi_override: phaseBdiEnabled ? phaseBdiNum(r.phase_id ?? SEM_ETAPA) : null,
        category_id: r.category_id,
        order_index: order++,
      }))
  }

  function validate(): boolean {
    // 1) Descrição obrigatória (linha com valor mas sem descrição)
    const bad = rows.filter(isIncomplete).map((r) => r.key)
    // 2) Fase obrigatória: todo item com conteúdo precisa de uma fase real
    const noPhase = rows
      .filter((r) => !isEmptyRow(r) && isOrphan(r))
      .map((r) => r.key)

    if (bad.length > 0 || noPhase.length > 0) {
      setErrorKeys(new Set([...bad, ...noPhase]))
      if (noPhase.length > 0) {
        toast.error('Todos os itens devem estar vinculados a uma fase da obra.')
      } else {
        toast.error('Preencha os campos obrigatórios destacados')
      }
      const focusKey = bad[0]
      if (focusKey) document.getElementById(`desc-${focusKey}`)?.focus()
      return false
    }
    return true
  }

  // ── Salvar ──
  function persist(): Promise<boolean> {
    return saveBudget(budget.id, {
      bdi_percent:       bdiPercent,
      phase_bdi_enabled: phaseBdiEnabled,
      description:       description.trim() || null,
      items:             buildPayloadItems(),
    }).then((res) => {
      if (!res.success) throw new Error(res.error ?? 'Erro ao salvar')
      return true
    })
  }

  function handleSave() {
    if (!validate()) return
    setSaving(true)
    persist()
      .then(() => toast.success('Orçamento salvo'))
      .catch((err: Error) =>
        toast.error(err.message || 'Erro ao salvar', {
          action: { label: 'Tentar novamente', onClick: handleSave },
        }),
      )
      .finally(() => setSaving(false))
  }

  // ── Finalizar (salva antes → aprovado) ──
  // A partir daqui os valores passam a alimentar orçado x realizado, DRE e dashboard.
  function handleFinalize() {
    if (!validate()) return
    setBusy(true)
    persist()
      .then(() => finalizeBudget(budget.id))
      .then((res) => {
        if (!res.success) throw new Error(res.error ?? 'Erro ao finalizar')
        setStatus('aprovado')
        toast.success('Orçamento finalizado')
      })
      .catch((err: Error) =>
        toast.error(err.message || 'Erro ao finalizar', {
          action: { label: 'Tentar novamente', onClick: handleFinalize },
        }),
      )
      .finally(() => setBusy(false))
  }

  // ── Reabrir como rascunho (tira do ar enquanto reformula) ──
  function handleReopen() {
    setBusy(true)
    reopenBudget(budget.id)
      .then((res) => {
        if (!res.success) throw new Error(res.error ?? 'Erro ao reabrir')
        setStatus('rascunho')
        toast.success('Orçamento reaberto como rascunho')
      })
      .catch((err: Error) =>
        toast.error(err.message || 'Erro ao reabrir', {
          action: { label: 'Tentar novamente', onClick: handleReopen },
        }),
      )
      .finally(() => setBusy(false))
  }

  // ── Excluir orçamento (permanente) ──
  function handleDelete() {
    // Fecha o modal imediatamente; a exclusão e a navegação rodam em background.
    setConfirmDelete(false)
    toastAfterClose('Orçamento excluído')
    deleteBudget(budget.id)
      .then((res) => {
        if (!res.success) throw new Error(res.error ?? 'Erro ao excluir')
        router.push('/orcamentos')
      })
      .catch((err: Error) => {
        toast.error(err.message || 'Erro ao excluir orçamento', {
          action: { label: 'Tentar novamente', onClick: handleDelete },
        })
      })
  }

  // ── PDF por fase: marca a fase, imprime, e limpa após o diálogo ──
  useEffect(() => {
    if (!printGroupId) return
    const reset = () => setPrintGroupId(null)
    window.addEventListener('afterprint', reset, { once: true })
    const t = setTimeout(() => window.print(), 60)
    return () => {
      clearTimeout(t)
      window.removeEventListener('afterprint', reset)
    }
  }, [printGroupId])

  const badge = statusBadge(status)
  const printGroup = printGroupId ? groups.find((g) => g.id === printGroupId) ?? null : null

  return (
    <div className="space-y-6">
      {/* Print: por fase mostra #orcamento-fase-print; senão o orçamento inteiro */}
      <style>{
        printGroupId
          ? `@media print {
              body * { visibility: hidden; }
              #orcamento-fase-print, #orcamento-fase-print * { visibility: visible; }
              #orcamento-fase-print { position: absolute; left: 0; top: 0; width: 100%; }
              .no-print { display: none !important; }
            }`
          : `@media print {
              body * { visibility: hidden; }
              #orcamento-print, #orcamento-print * { visibility: visible; }
              #orcamento-print { position: absolute; left: 0; top: 0; width: 100%; }
              .no-print { display: none !important; }
            }`
      }</style>

      {/* Breadcrumb */}
      <div className="no-print flex items-center gap-2">
        <Link
          href="/orcamentos"
          prefetch
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-dark transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Orçamentos
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-dark">
          {budget.projects?.name ?? 'Obra'}
        </span>
      </div>

      {/* Cabeçalho */}
      <div className="no-print flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-dark">{budget.projects?.name ?? 'Obra'}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
              style={badge.style}
            >
              {BUDGET_STATUS_LABELS[status]}
            </span>
          </div>
          <p className="text-sm text-gray-400">Orçamento da obra</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={busy || saving}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-[#F9F7F4] disabled:opacity-60"
            onMouseEnter={(e) => (e.currentTarget.style.color = '#8B3A3A')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '')}
          >
            Excluir orçamento
          </button>
          <button
            onClick={() => window.print()}
            disabled={busy || saving}
            className="rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-brown transition-colors hover:bg-[#F9F7F4] disabled:opacity-60"
          >
            Exportar PDF
          </button>
          {status === 'aprovado' && (
            <button
              onClick={handleReopen}
              disabled={busy || saving}
              className="rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-brown transition-colors hover:bg-[#F9F7F4] disabled:opacity-60"
            >
              Reabrir como rascunho
            </button>
          )}
          {/* Rascunho: Salvar é secundário; Finalizar é a ação principal (terracota). */}
          {/* Aprovado: Salvar é a ação principal (terracota), mantendo o status. */}
          <button
            onClick={handleSave}
            disabled={busy || saving}
            className={
              status === 'aprovado'
                ? 'rounded-lg bg-terracotta px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brown disabled:opacity-60'
                : 'rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-brown transition-colors hover:bg-[#F9F7F4] disabled:opacity-60'
            }
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          {status !== 'aprovado' && (
            <button
              onClick={handleFinalize}
              disabled={busy || saving}
              className="rounded-lg bg-terracotta px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brown disabled:opacity-60"
            >
              {busy ? 'Finalizando…' : 'Finalizar orçamento'}
            </button>
          )}
        </div>
      </div>

      {/* Abas */}
      <div className="no-print flex gap-1 rounded-xl border border-gold/30 bg-cream/30 p-1 w-fit">
        {([
          { key: 'itens',  label: 'Itens' },
          { key: 'orcado', label: 'Orçado x Realizado' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-dark shadow-sm' : 'text-gray-500 hover:text-dark hover:bg-white/60'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ─── Aba Orçado x Realizado ─── */}
      {tab === 'orcado' && (
        <div className="no-print space-y-2">
          <p className="text-xs text-gray-400">
            Orçado = itens deste orçamento por etapa. Realizado = despesas pagas da obra vinculadas à etapa.
            Salve o orçamento para refletir as últimas edições.
          </p>
          <OrcadoRealizado rows={orcadoRealizadoRows} emptyMessage="Adicione itens e vincule despesas às etapas para comparar." />
        </div>
      )}

      {/* BDI + toggle por fase + descrição */}
      <div className={`${tab === 'itens' ? '' : 'hidden'} no-print space-y-4 rounded-xl border border-gold/30 bg-white p-4 shadow-sm`}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[160px_1fr_auto]">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">
              {phaseBdiEnabled ? 'BDI padrão %' : 'BDI %'}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={bdiStr}
              onChange={(e) => setBdiStr(e.target.value.replace(/[^\d.,]/g, ''))}
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">Descrição</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição/observação do orçamento (opcional)"
              className={inputCls}
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setPhaseBdiEnabled((v) => !v)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                phaseBdiEnabled ? 'border-terracotta bg-terracotta text-white' : 'border-gold/50 text-brown hover:bg-[#F9F7F4]'
              }`}
              title="Definir um BDI específico para cada fase"
            >
              <span
                className={`inline-flex h-4 w-7 items-center rounded-full transition-colors ${phaseBdiEnabled ? 'bg-white/40' : 'bg-gold/40'}`}
              >
                <span className={`h-3 w-3 rounded-full bg-white transition-transform ${phaseBdiEnabled ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
              </span>
              BDI por fase
            </button>
          </div>
        </div>
        {phaseBdiEnabled && (
          <p className="text-xs text-gray-400">
            Com o BDI por fase ligado, cada etapa usa seu próprio BDI (campo no cabeçalho da fase). O BDI padrão é usado nas fases sem valor definido.
          </p>
        )}
      </div>

      {/* Itens por etapa */}
      <div className={`${tab === 'itens' ? '' : 'hidden'} no-print space-y-6`}>

        {/* Obra sem fases: não dá para montar o orçamento */}
        {!hasPhases && (
          <div className="rounded-xl border border-dashed py-10 px-6 text-center" style={{ borderColor: '#E6C07B' }}>
            <p className="text-sm font-medium text-dark">
              Esta obra ainda não tem fases cadastradas.
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Cadastre as fases desta obra (aba Fases e Tarefas) antes de montar o orçamento.
            </p>
            <Link
              href={`/obras/${budget.project_id}?tab=fases`}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brown"
            >
              Ir para Fases e Tarefas
            </Link>
          </div>
        )}

        {/* Itens legados sem fase válida — forçar correção antes de finalizar */}
        {orphanRows.length > 0 && (
          <div className="space-y-2 rounded-xl border p-4" style={{ borderColor: '#8B3A3A', backgroundColor: 'rgba(139,58,58,0.05)' }}>
            <div>
              <h3 className="text-sm font-bold" style={{ color: '#8B3A3A' }}>
                Itens sem fase — corrija antes de finalizar
              </h3>
              <p className="mt-0.5 text-xs text-gray-500">
                Estes itens não estão vinculados a uma fase da obra. Selecione uma fase para cada um.
              </p>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gold/30 bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-gold/20 bg-cream/30">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Descrição</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 w-32">Total</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 w-56">
                      Fase <span style={{ color: '#8B3A3A' }}>*</span>
                    </th>
                    <th className="px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold/10">
                  {orphanRows.map((r) => (
                    <tr key={r.key} className="align-top">
                      <td className="px-3 py-2 text-dark">{r.description.trim() || <span className="italic text-gray-400">(sem descrição)</span>}</td>
                      <td className="px-3 py-2 text-right font-semibold text-dark whitespace-nowrap">{formatCurrency(rowTotal(r))}</td>
                      <td className="px-3 py-2">
                        <select
                          value=""
                          onChange={(e) => { if (e.target.value) updateRow(r.key, { phase_id: e.target.value }) }}
                          disabled={!hasPhases}
                          className={`${inputCls} border-[#8B3A3A]`}
                        >
                          <option value="">Selecionar fase…</option>
                          {phases.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => removeRow(r.key)}
                          className="rounded p-1 transition-colors"
                          style={{ color: '#8A5A3B' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#8B3A3A')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#8A5A3B')}
                          title="Remover item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {hasPhases && groups.map((g) => {
          const groupRows = rowsOfGroup(g.id)
          const subtotal = groupRows.reduce((s, r) => s + rowTotal(r), 0)
          const gBdi = phaseBdiNum(g.id)
          const gFinal = subtotal * (1 + gBdi / 100)
          return (
            <div key={g.id} className="space-y-2">
              {/* Título da etapa (divisor simples) */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gold/30 pb-1.5">
                <div className="flex items-center gap-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#8A5A3B' }}>
                    {g.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setPrintGroupId(g.id)}
                    className="rounded-md border px-2 py-0.5 text-[11px] font-medium text-brown transition-colors hover:bg-[#F9F7F4]"
                    style={{ borderColor: '#E6C07B' }}
                    title="Exportar PDF desta fase"
                  >
                    Exportar PDF
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  {phaseBdiEnabled && (
                    <label className="flex items-center gap-1.5 text-[11px] text-brown">
                      BDI desta fase
                      <input
                        type="text"
                        inputMode="decimal"
                        value={phaseBdiMap[g.id] ?? ''}
                        onChange={(e) =>
                          setPhaseBdiMap((prev) => ({ ...prev, [g.id]: e.target.value.replace(/[^\d.,]/g, '') }))
                        }
                        placeholder={`${bdiPercent}`}
                        className="w-16 rounded-lg border border-gold/50 bg-white px-2 py-1 text-right text-xs focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
                      />
                      %
                    </label>
                  )}
                  <span className="text-xs text-gray-400">
                    {phaseBdiEnabled
                      ? `Custo ${formatCurrency(subtotal)} · BDI ${gBdi.toFixed(1).replace('.', ',')}% · ${formatCurrency(gFinal)}`
                      : `Subtotal: ${formatCurrency(subtotal)}`}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gold/30 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead className="border-b border-gold/20 bg-cream/30">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Descrição <span style={{ color: '#8B3A3A' }}>*</span>
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 w-48">Unidade</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 w-24">Qtd.</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 w-36">Preço Unit.</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 w-32">Total</th>
                      <th className="px-3 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gold/10">
                    {groupRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-4 text-center text-xs text-gray-300">
                          Nenhum item nesta etapa.
                        </td>
                      </tr>
                    ) : (
                      groupRows.map((r) => {
                        const hasErr = errorKeys.has(r.key)
                        return (
                          <tr key={r.key} className="align-top">
                            <td className="px-3 py-2">
                              <input
                                id={`desc-${r.key}`}
                                type="text"
                                value={r.description}
                                onChange={(e) => updateRow(r.key, { description: e.target.value })}
                                placeholder="Descrição do item"
                                className={`${inputCls} ${hasErr ? 'border-[#8B3A3A]' : ''}`}
                              />
                              {hasErr && <p className="mt-1 text-xs" style={{ color: '#8B3A3A' }}>Preencha este campo</p>}
                              {/* Categoria opcional */}
                              {categories.length > 0 && (
                                <select
                                  value={r.category_id ?? ''}
                                  onChange={(e) => updateRow(r.key, { category_id: e.target.value || null })}
                                  className="mt-1 w-full rounded-lg border border-gold/40 bg-white px-2 py-1 text-xs text-gray-500 focus:border-terracotta focus:outline-none"
                                >
                                  <option value="">Categoria (opcional)</option>
                                  {categories.map((c) => (
                                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={r.unit}
                                onChange={(e) => updateRow(r.key, { unit: e.target.value })}
                                className={inputCls}
                              >
                                <option value="">—</option>
                                {BUDGET_UNITS.map((u) => (
                                  <option key={u.value} value={u.value}>{u.value} ({u.name})</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={r.quantityStr}
                                onChange={(e) => updateRow(r.key, { quantityStr: e.target.value.replace(/[^\d.,]/g, '') })}
                                className={`${inputCls} text-right`}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={digitsToDisplay(r.priceDigits)}
                                onChange={(e) =>
                                  updateRow(r.key, { priceDigits: e.target.value.replace(/\D/g, '').replace(/^0+/, '') })
                                }
                                placeholder="R$ 0,00"
                                className={`${inputCls} text-right`}
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-dark whitespace-nowrap">
                              {formatCurrency(rowTotal(r))}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => removeRow(r.key)}
                                className="rounded p-1 transition-colors"
                                style={{ color: '#8A5A3B' }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = '#8B3A3A')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = '#8A5A3B')}
                                title="Remover item"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
                <div className="border-t border-gold/20 px-3 py-2">
                  <button
                    onClick={() => addRow(g.id)}
                    className="flex items-center gap-1.5 text-xs font-medium text-terracotta transition-colors hover:text-brown"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar item
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Painel de totais (cards neutros, sem ícones) */}
      <div className={`${tab === 'itens' ? '' : 'hidden'} no-print grid grid-cols-1 gap-3 sm:grid-cols-3`}>
        <div className="rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Custo Direto Total</p>
          <p className="mt-1 text-xl font-bold text-dark">{formatCurrency(directCost)}</p>
        </div>
        <div className="rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">
            {phaseBdiEnabled
              ? `BDI médio ponderado (${bdiMedio.toFixed(1).replace('.', ',')}%)`
              : `BDI (${bdiPercent}%)`}
          </p>
          <p className="mt-1 text-xl font-bold text-dark">{formatCurrency(bdiValue)}</p>
        </div>
        <div className="rounded-xl border p-4 shadow-sm" style={{ borderColor: '#C68B59', backgroundColor: 'rgba(198,139,89,0.08)' }}>
          <p className="text-xs font-medium" style={{ color: '#8A5A3B' }}>Preço Final</p>
          <p className="mt-1 text-xl font-bold" style={{ color: '#8A5A3B' }}>{formatCurrency(finalPrice)}</p>
        </div>
      </div>

      {/* ── Área de impressão (PDF) ── */}
      <div id="orcamento-print" className="hidden print:block">
        <div className="mb-4 border-b-2 pb-3" style={{ borderColor: '#C68B59' }}>
          <h1 className="text-2xl font-bold" style={{ color: '#3B2418' }}>{companyName}</h1>
          <p className="text-sm" style={{ color: '#8A5A3B' }}>Proposta / Orçamento</p>
        </div>
        <div className="mb-3 text-sm" style={{ color: '#3B2418' }}>
          <p><strong>Obra:</strong> {budget.projects?.name ?? '—'}</p>
          <p><strong>Status:</strong> {BUDGET_STATUS_LABELS[status]}</p>
          <p><strong>Emissão:</strong> {formatDate(new Date().toISOString().slice(0, 10))}</p>
          {description.trim() && <p><strong>Descrição:</strong> {description.trim()}</p>}
        </div>

        {groups.map((g) => {
          const groupRows = rowsOfGroup(g.id).filter((r) => r.description.trim() !== '')
          if (groupRows.length === 0) return null
          const subtotal = groupRows.reduce((s, r) => s + rowTotal(r), 0)
          const gBdi = phaseBdiNum(g.id)
          const gFinal = subtotal * (1 + gBdi / 100)
          return (
            <div key={g.id} className="mb-4">
              <h3 className="mb-1 text-sm font-semibold uppercase" style={{ color: '#8A5A3B' }}>{g.name}</h3>
              <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E6C07B' }}>
                    <th className="py-1 text-left">Descrição</th>
                    <th className="py-1 text-left">Un.</th>
                    <th className="py-1 text-right">Qtd.</th>
                    <th className="py-1 text-right">Preço Unit.</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {groupRows.map((r) => (
                    <tr key={r.key} style={{ borderBottom: '1px solid #F4E2B8' }}>
                      <td className="py-1">{r.description}</td>
                      <td className="py-1">{r.unit || '—'}</td>
                      <td className="py-1 text-right">{r.quantityStr || '0'}</td>
                      <td className="py-1 text-right">{formatCurrency(digitsToNumber(r.priceDigits))}</td>
                      <td className="py-1 text-right">{formatCurrency(rowTotal(r))}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={4} className="py-1 text-right font-semibold">Subtotal (custo direto)</td>
                    <td className="py-1 text-right font-semibold">{formatCurrency(subtotal)}</td>
                  </tr>
                  {phaseBdiEnabled && (
                    <>
                      <tr>
                        <td colSpan={4} className="py-1 text-right">BDI da fase ({gBdi.toFixed(1).replace('.', ',')}%)</td>
                        <td className="py-1 text-right">{formatCurrency(gFinal - subtotal)}</td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="py-1 text-right font-semibold" style={{ color: '#8A5A3B' }}>Preço da fase</td>
                        <td className="py-1 text-right font-semibold" style={{ color: '#8A5A3B' }}>{formatCurrency(gFinal)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )
        })}

        <div className="mt-4 border-t-2 pt-2 text-sm" style={{ borderColor: '#C68B59', color: '#3B2418' }}>
          <p className="text-right"><strong>Custo Direto:</strong> {formatCurrency(directCost)}</p>
          <p className="text-right">
            <strong>{phaseBdiEnabled ? `BDI médio (${bdiMedio.toFixed(1).replace('.', ',')}%)` : `BDI (${bdiPercent}%)`}:</strong> {formatCurrency(bdiValue)}
          </p>
          <p className="text-right text-base font-bold" style={{ color: '#8A5A3B' }}>Preço Final: {formatCurrency(finalPrice)}</p>
        </div>
      </div>

      {/* ── Área de impressão (PDF) por FASE ── */}
      {printGroup && (() => {
        const groupRows = rowsOfGroup(printGroup.id).filter((r) => r.description.trim() !== '')
        const sub = groupRows.reduce((s, r) => s + rowTotal(r), 0)
        const gBdi = phaseBdiNum(printGroup.id)
        const gBdiVal = sub * (gBdi / 100)
        const gFinal = sub + gBdiVal
        return (
          <div id="orcamento-fase-print" className="hidden print:block">
            <div className="mb-4 border-b-2 pb-3" style={{ borderColor: '#C68B59' }}>
              <h1 className="text-2xl font-bold" style={{ color: '#3B2418' }}>{companyName}</h1>
              <p className="text-sm" style={{ color: '#8A5A3B' }}>Orçamento por Fase</p>
            </div>
            <div className="mb-3 text-sm" style={{ color: '#3B2418' }}>
              <p><strong>Obra:</strong> {budget.projects?.name ?? '—'}</p>
              <p><strong>Fase:</strong> {printGroup.name}</p>
              <p><strong>Emissão:</strong> {formatDate(new Date().toISOString().slice(0, 10))}</p>
            </div>

            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E6C07B', backgroundColor: 'rgba(198,139,89,0.12)' }}>
                  <th className="py-1 px-1 text-left">Descrição</th>
                  <th className="py-1 px-1 text-left">Un.</th>
                  <th className="py-1 px-1 text-right">Qtd.</th>
                  <th className="py-1 px-1 text-right">Preço Unit.</th>
                  <th className="py-1 px-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {groupRows.map((r) => (
                  <tr key={r.key} style={{ borderBottom: '1px solid #F4E2B8' }}>
                    <td className="py-1 px-1">{r.description}</td>
                    <td className="py-1 px-1">{r.unit || '—'}</td>
                    <td className="py-1 px-1 text-right">{r.quantityStr || '0'}</td>
                    <td className="py-1 px-1 text-right">{formatCurrency(digitsToNumber(r.priceDigits))}</td>
                    <td className="py-1 px-1 text-right">{formatCurrency(rowTotal(r))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 border-t-2 pt-2 text-sm" style={{ borderColor: '#C68B59', color: '#3B2418' }}>
              <p className="text-right"><strong>Custo Direto da fase:</strong> {formatCurrency(sub)}</p>
              <p className="text-right"><strong>BDI ({gBdi.toFixed(1).replace('.', ',')}%):</strong> {formatCurrency(gBdiVal)}</p>
              <p className="text-right text-base font-bold" style={{ color: '#8A5A3B' }}>Preço Final da fase: {formatCurrency(gFinal)}</p>
            </div>

            <p className="mt-6 text-xs" style={{ color: '#8A5A3B' }}>
              Orçamento — {BUDGET_STATUS_LABELS[status]}
            </p>
          </div>
        )
      })()}

      {/* Confirmação de exclusão (permanente) */}
      <ConfirmDeleteModal
        isOpen={confirmDelete}
        onConfirm={handleDelete}
        onCancel={() => { if (!busy) setConfirmDelete(false) }}
        title="Excluir orçamento"
        message="Esta ação remove o orçamento e todos os seus itens permanentemente. Não é possível desfazer."
      />
    </div>
  )
}
