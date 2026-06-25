'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Pencil, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { toastAfterClose } from '@/lib/ui-feedback'
import type { CostCategory, CostNature, DreGroup } from '@/types/database'
import { DRE_GROUP_LABELS } from '@/types/database'
import {
  createCostCategory, updateCostCategory, setCostCategoryActive,
  type CostCategoryInput,
} from '@/app/actions/cost-categories'

interface Props {
  categories: CostCategory[]
}

const GROUPS: { key: DreGroup; label: string; help: string }[] = [
  { key: 'receita_bruta',       label: 'Receita Bruta',        help: 'Tudo que a empresa fatura e recebe dos clientes.' },
  { key: 'deducoes',            label: 'Deduções',             help: 'Impostos sobre o faturamento (ISS, PIS/COFINS), abatidos da receita bruta.' },
  { key: 'custo_direto',        label: 'Custos Diretos',       help: 'Gastos diretamente ligados à execução da obra: material, mão de obra, equipamento, transporte, instalações.' },
  { key: 'despesa_operacional', label: 'Despesas Operacionais', help: 'Gastos de apoio / indiretos: alimentação, hospedagem, administrativo.' },
  { key: 'despesa_financeira',  label: 'Despesas Financeiras', help: 'Juros, tarifas bancárias e multas.' },
]
const GROUP_HELP = Object.fromEntries(GROUPS.map((g) => [g.key, g.help])) as Record<DreGroup, string>
const SUBGROUP_SUGGESTIONS = ['Material', 'Mão de obra', 'Equipamentos', 'Transporte', 'Instalações']
const CODE_HELP = 'Use a numeração do grupo: 1 receitas · 2 deduções · 3 custos diretos · 4 despesas operacionais · 5 financeiras'

// Tipo e grupo derivados do primeiro dígito do código
const DIGIT_MAP: Record<string, { nature: CostNature; dre_group: DreGroup }> = {
  '1': { nature: 'income',  dre_group: 'receita_bruta' },
  '2': { nature: 'expense', dre_group: 'deducoes' },
  '3': { nature: 'expense', dre_group: 'custo_direto' },
  '4': { nature: 'expense', dre_group: 'despesa_operacional' },
  '5': { nature: 'expense', dre_group: 'despesa_financeira' },
}
function deriveFromCode(code: string) {
  const first = code.trim()[0]
  return first ? (DIGIT_MAP[first] ?? null) : null
}

const inputCls =
  'w-full rounded-lg border border-gold/50 px-3 py-1.5 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta'
const labelCls = 'text-xs font-semibold uppercase tracking-wide text-brown'

export function PlanoCustoClient({ categories }: Props) {
  const [cats, setCats] = useState<CostCategory[]>(categories)
  const [eduOpen, setEduOpen] = useState(true)
  const [formMounted, setFormMounted] = useState(false) // presente no DOM
  const [formOpen, setFormOpen] = useState(false)        // classe de altura/opacidade (anima)
  const [newFormSeq, setNewFormSeq] = useState(0)
  const [editing, setEditing] = useState<CostCategory | null>(null)

  useEffect(() => { setCats(categories) }, [categories])

  // Card educativo: aberto na primeira visita, lembra a preferência
  useEffect(() => {
    try {
      if (localStorage.getItem('planoCusto.eduOpen') === '0') setEduOpen(false)
    } catch { /* storage indisponível */ }
  }, [])
  function toggleEdu() {
    setEduOpen((v) => {
      const next = !v
      try { localStorage.setItem('planoCusto.eduOpen', next ? '1' : '0') } catch { /* noop */ }
      return next
    })
  }

  const byGroup = useMemo(() => {
    const map: Record<DreGroup, CostCategory[]> = {
      receita_bruta: [], deducoes: [], custo_direto: [], despesa_operacional: [], despesa_financeira: [],
    }
    for (const c of [...cats].sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true }))) {
      map[c.dre_group].push(c)
    }
    return map
  }, [cats])

  const allCodes = useMemo(() => cats.map((c) => c.code), [cats])

  function openNewForm() {
    setNewFormSeq((s) => s + 1) // remonta o form com estado limpo
    setFormMounted(true)
    setTimeout(() => setFormOpen(true), 10) // dispara a transição no próximo frame
  }
  function closeNewForm() {
    setFormOpen(false)
    setTimeout(() => setFormMounted(false), 200) // remove do DOM após animar
  }

  function persistCreate(input: CostCategoryInput, optimistic: CostCategory) {
    createCostCategory(input)
      .then((res) => {
        if (!res.success) throw new Error(res.error)
        // Troca o registro temporário pelo salvo (id real)
        setCats((prev) => prev.map((c) => (c.id === optimistic.id ? res.category : c)))
      })
      .catch((err: Error) => {
        // Rollback: remove o registro temporário
        setCats((prev) => prev.filter((c) => c.id !== optimistic.id))
        toast.error(err.message || 'Erro ao criar a conta', {
          action: {
            label: 'Tentar novamente',
            onClick: () => {
              setCats((prev) => [...prev, optimistic])
              persistCreate(input, optimistic)
            },
          },
        })
      })
  }

  function handleCreate(input: CostCategoryInput) {
    // Atualização otimista: a conta entra na lista e o form fecha na hora;
    // a gravação roda em background com rollback se falhar.
    const optimistic: CostCategory = {
      id: `temp-${Date.now()}`,
      code: input.code,
      name: input.name,
      nature: input.nature,
      dre_group: input.dre_group,
      dre_subgroup: input.dre_subgroup,
      is_active: input.is_active,
      sort_order: cats.length,
      created_at: new Date().toISOString(),
    }
    setCats((prev) => [...prev, optimistic])
    closeNewForm()
    toastAfterClose('Conta criada')
    persistCreate(input, optimistic)
  }

  function persistUpdate(id: string, input: CostCategoryInput, optimistic: CostCategory, snapshot: CostCategory) {
    updateCostCategory(id, input)
      .then((res) => {
        if (!res.success) throw new Error(res.error)
        setCats((prev) => prev.map((c) => (c.id === res.category.id ? res.category : c)))
      })
      .catch((err: Error) => {
        // Rollback: restaura o registro original
        setCats((prev) => prev.map((c) => (c.id === id ? snapshot : c)))
        toast.error(err.message || 'Erro ao atualizar a conta', {
          action: {
            label: 'Tentar novamente',
            onClick: () => {
              setCats((prev) => prev.map((c) => (c.id === id ? optimistic : c)))
              persistUpdate(id, input, optimistic, snapshot)
            },
          },
        })
      })
  }

  function handleUpdate(input: CostCategoryInput) {
    if (!editing) return
    const snapshot = editing
    const optimistic: CostCategory = {
      ...editing,
      code: input.code,
      name: input.name,
      nature: input.nature,
      dre_group: input.dre_group,
      dre_subgroup: input.dre_subgroup,
      is_active: input.is_active,
    }
    // Atualização otimista: a lista reflete a edição e o modal fecha na hora.
    setCats((prev) => prev.map((c) => (c.id === optimistic.id ? optimistic : c)))
    setEditing(null)
    toastAfterClose('Conta atualizada')
    persistUpdate(snapshot.id, input, optimistic, snapshot)
  }

  function handleToggleActive(c: CostCategory) {
    const next = !c.is_active
    setCats((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_active: next } : x)))
    setCostCategoryActive(c.id, next)
      .then((res) => { if (!res.success) throw new Error(res.error) })
      .catch(() => {
        setCats((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_active: c.is_active } : x)))
        toast.error('Erro ao alterar a conta')
      })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark">Plano de Custo</h1>
        <p className="text-sm text-gray-400">Cadastro das contas que estruturam a sua DRE</p>
      </div>

      {/* Bloco educativo */}
      <div className="rounded-xl border border-gold/30" style={{ backgroundColor: '#F9F7F4' }}>
        <button onClick={toggleEdu} className="flex w-full items-center justify-between px-4 py-3 text-left">
          <span className="text-sm font-semibold text-dark">Como o Plano de Custo monta a sua DRE</span>
          <ChevronDown className={`h-4 w-4 text-brown transition-transform ${eduOpen ? 'rotate-180' : ''}`} />
        </button>
        {eduOpen && (
          <div className="space-y-2 px-4 pb-4 text-sm text-gray-600">
            <p>
              O Plano de Custo é a base da sua DRE. Cada categoria aqui é uma <strong>conta</strong>. O <strong>tipo</strong>
              {' '}e o <strong>grupo na DRE</strong> são definidos pelo <strong>primeiro dígito do código</strong>, e o sistema monta sua DRE automaticamente:
            </p>
            <p className="rounded-lg bg-white px-3 py-2 text-xs text-dark">
              Receita − Deduções = <strong>Receita Líquida</strong> · − Custos Diretos = <strong>Lucro Bruto</strong> ·
              − Despesas Operacionais = <strong>Resultado Operacional</strong> · − Despesas Financeiras = <strong>Resultado Líquido</strong>
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Listagem agrupada */}
        <div className="space-y-5 lg:col-span-2">
          {GROUPS.map((g) => {
            const list = byGroup[g.key]
            return (
              <div key={g.key} className="overflow-hidden rounded-xl border border-gold/30 bg-white shadow-sm">
                <div className="border-b border-gold/20 bg-cream/30 px-4 py-2.5">
                  <h2 className="text-sm font-semibold text-dark">{g.label}</h2>
                </div>
                {list.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-gray-400">Nenhuma conta neste grupo.</p>
                ) : (
                  <div className="divide-y divide-gold/10">
                    {list.map((c) => {
                      return (
                        <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className={`w-16 shrink-0 font-mono text-xs ${c.is_active ? 'text-gray-500' : 'text-gray-400'}`}>{c.code}</span>
                          <div className={`min-w-0 flex-1 ${c.is_active ? '' : 'opacity-60'}`}>
                            <p className="truncate text-sm font-medium text-dark">{c.name}</p>
                            {c.dre_subgroup && <span className="text-xs text-gray-400">{c.dre_subgroup}</span>}
                          </div>
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                            style={c.nature === 'income'
                              ? { backgroundColor: 'rgba(74,124,89,0.12)', color: '#4A7C59' }
                              : { backgroundColor: 'rgba(139,58,58,0.12)', color: '#8B3A3A' }}
                          >
                            {c.nature === 'income' ? 'Receita' : 'Despesa'}
                          </span>
                          {/* Pill de status (clicável) */}
                          <button
                            onClick={() => handleToggleActive(c)}
                            title={c.is_active ? 'Clique para inativar' : 'Clique para ativar'}
                            className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                            style={{ backgroundColor: c.is_active ? '#4A7C59' : '#8A5A3B' }}
                          >
                            {c.is_active ? 'Ativa' : 'Inativa'}
                          </button>
                          <button
                            onClick={() => setEditing(c)}
                            title="Editar"
                            className="shrink-0 rounded p-1 text-brown transition-colors hover:text-terracotta"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Coluna direita: botão + form (oculto) + pré-visualização */}
        <div className="space-y-5">
          {!formMounted && (
            <button
              onClick={openNewForm}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-terracotta px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brown"
            >
              <Plus className="h-4 w-4" /> Nova conta
            </button>
          )}

          {/* Form de nova conta — animado (fade + expansão de altura) */}
          {formMounted && (
            <div
              className={`overflow-hidden transition-all duration-200 ease-out ${
                formOpen ? 'max-h-[640px] opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold text-dark">Nova conta</h2>
                <ContaForm
                  key={`new-${newFormSeq}`}
                  existingCodes={allCodes}
                  submitLabel="Adicionar conta"
                  onSave={handleCreate}
                  onCancel={closeNewForm}
                />
              </div>
            </div>
          )}

          {/* Pré-visualização da DRE — visível por padrão */}
          <div className="rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-dark">Pré-visualização da DRE</h2>
            <p className="mb-3 text-xs text-gray-400">Estrutura montada a partir das contas ativas (sem valores).</p>
            <DrePreview byGroup={byGroup} />
          </div>
        </div>
      </div>

      {/* Modal de edição */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(59,36,24,0.4)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null) }}
        >
          <div className="form-slide-down w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gold/20 px-5 py-3.5">
              <h2 className="text-base font-bold text-dark">Editar conta</h2>
              <button onClick={() => setEditing(null)} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-cream hover:text-dark">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <ContaForm
                initial={editing}
                existingCodes={allCodes.filter((code) => code !== editing.code)}
                submitLabel="Salvar alterações"
                onSave={handleUpdate}
                onCancel={() => setEditing(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Formulário compartilhado (nova conta inline + edição no modal) ──
function ContaForm({
  initial, existingCodes, submitLabel, onSave, onCancel,
}: {
  initial?: CostCategory
  existingCodes: string[]
  submitLabel: string
  onSave: (input: CostCategoryInput) => void
  onCancel: () => void
}) {
  const [code, setCode] = useState(initial?.code ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [subgroup, setSubgroup] = useState(initial?.dre_subgroup ?? '')
  const [touchedName, setTouchedName] = useState(false)

  const trimmed = code.trim()
  const derived = deriveFromCode(trimmed)
  const formatOk = /^\d+(\.\d+)*$/.test(trimmed)
  const dup = trimmed !== '' && existingCodes.includes(trimmed)

  let codeError: string | null = null
  if (trimmed) {
    if (!formatOk && !trimmed.endsWith('.')) {
      codeError = 'Use apenas números e pontos (ex: 1, 1.02, 3.1.03).'
    } else if (formatOk && !derived) {
      codeError = 'O código deve começar com 1 (receita), 2 (deduções), 3 (custos diretos), 4 (despesas operacionais) ou 5 (despesas financeiras).'
    } else if (dup) {
      codeError = 'Já existe uma conta com este código.'
    }
  }
  const nameError = touchedName && !name.trim() ? 'Informe a descrição da conta.' : null
  const valid = formatOk && !!derived && !dup && !!name.trim()

  function handleSubmit() {
    setTouchedName(true)
    if (!valid || !derived) return
    onSave({
      code: trimmed,
      name: name.trim(),
      nature: derived.nature,
      dre_group: derived.dre_group,
      dre_subgroup: subgroup.trim() || null,
      is_active: initial?.is_active ?? true,
    })
  }

  return (
    <div className="space-y-3">
      {/* Código */}
      <div className="space-y-1">
        <label className={labelCls}>Código *</label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder="3.1.03"
          title={CODE_HELP}
          className={`${inputCls} font-mono`}
          autoFocus
        />
        {codeError
          ? <p className="text-[11px] font-medium" style={{ color: '#8B3A3A' }}>{codeError}</p>
          : <p className="text-[11px] text-gray-400">{CODE_HELP}</p>}
      </div>

      {/* Tipo + Grupo derivados (read-only) */}
      <div className="space-y-1.5">
        <label className={labelCls}>Tipo e grupo (definidos pelo código)</label>
        {derived ? (
          <div>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={derived.nature === 'income'
                ? { backgroundColor: 'rgba(74,124,89,0.12)', color: '#4A7C59' }
                : { backgroundColor: 'rgba(139,58,58,0.12)', color: '#8B3A3A' }}
            >
              {derived.nature === 'income' ? 'Receita' : 'Despesa'}
            </span>
            <span className="ml-2 text-xs font-medium text-dark">{DRE_GROUP_LABELS[derived.dre_group]}</span>
            <p className="mt-1 text-[11px] text-gray-400">{GROUP_HELP[derived.dre_group]}</p>
          </div>
        ) : (
          <p className="text-xs text-gray-400">Digite o código (começando em 1–5) para definir o tipo e o grupo.</p>
        )}
      </div>

      {/* Descrição */}
      <div className="space-y-1">
        <label className={labelCls}>Descrição *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouchedName(true)}
          placeholder="Ex: Locação de andaimes"
          className={inputCls}
        />
        {nameError && <p className="text-[11px] font-medium" style={{ color: '#8B3A3A' }}>{nameError}</p>}
      </div>

      {/* Subgrupo */}
      <div className="space-y-1">
        <label className={labelCls}>Subgrupo (opcional)</label>
        <input
          type="text"
          list="subgroup-suggestions"
          value={subgroup ?? ''}
          onChange={(e) => setSubgroup(e.target.value)}
          placeholder="Material, Mão de obra…"
          className={inputCls}
        />
        <datalist id="subgroup-suggestions">
          {SUBGROUP_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
        </datalist>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-cream"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={!valid}
          className="rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brown disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  )
}

function DrePreview({ byGroup }: { byGroup: Record<DreGroup, CostCategory[]> }) {
  const active = (g: DreGroup) => byGroup[g].filter((c) => c.is_active)
  const Section = ({ title, group }: { title: string; group: DreGroup }) => {
    const list = active(group)
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brown">{title}</p>
        {list.length === 0 ? (
          <p className="pl-3 text-xs text-gray-300">—</p>
        ) : (
          <ul className="pl-3">
            {list.map((c) => (
              <li key={c.id} className="text-xs text-gray-500">
                <span className="font-mono text-gray-400">{c.code}</span> {c.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }
  const Result = ({ label }: { label: string }) => (
    <p className="border-t border-gold/20 pt-1 text-xs font-semibold text-dark">{label}</p>
  )

  return (
    <div className="space-y-2">
      <Section title="Receita Bruta" group="receita_bruta" />
      <Section title="(−) Deduções" group="deducoes" />
      <Result label="(=) Receita Líquida" />
      <Section title="(−) Custos Diretos" group="custo_direto" />
      <Result label="(=) Lucro Bruto" />
      <Section title="(−) Despesas Operacionais" group="despesa_operacional" />
      <Result label="(=) Resultado Operacional" />
      <Section title="(−) Despesas Financeiras" group="despesa_financeira" />
      <Result label="(=) Resultado Líquido" />
    </div>
  )
}
