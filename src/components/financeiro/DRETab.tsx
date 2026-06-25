'use client'

import { useMemo, useState } from 'react'
import { Printer, FileSpreadsheet, RotateCcw, ChevronRight } from 'lucide-react'
import type { FinancialEntry, CostCategory, DreGroup } from '@/types/database'
import { formatCurrency } from '@/lib/format'

type EntryWithJoins = FinancialEntry & {
  projects?: { id: string; name: string } | null
}

type Preset = 'este-ano' | 'ano-passado' | 'ultimos-12' | 'custom'

interface Props {
  entries:    EntryWithJoins[]
  projects:   { id: string; name: string }[]
  categories: CostCategory[]
  // Mantido por compatibilidade com o chamador (não usado na visão matriz)
  orcadoByProject?: Record<string, { total: number; byCategory: Record<string, number> }>
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function monthYearLabel(ym: string): string {
  return `${ym.slice(5, 7)}/${ym.slice(0, 4)}`
}

// ── Cálculo da DRE a partir do plano de contas (category_id → cost_categories) ──
interface AccountLine { key: string; code: string; name: string; subgroup: string | null; amount: number }
interface GroupCalc { total: number; accounts: AccountLine[] }
interface DreCalc {
  receita: GroupCalc
  deducoes: GroupCalc
  custos: GroupCalc
  operacionais: GroupCalc
  financeiras: GroupCalc
  receitaBruta: number
  receitaLiquida: number
  lucroBruto: number
  resultadoOperacional: number
  resultadoLiquido: number
  byKey: Record<string, number>
}

function emptyGroup(): { map: Map<string, AccountLine> } {
  return { map: new Map() }
}
function finalizeGroup(g: { map: Map<string, AccountLine> }): GroupCalc {
  const accounts = [...g.map.values()].sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true }))
  return { total: accounts.reduce((s, a) => s + a.amount, 0), accounts }
}

function computeDre(list: EntryWithJoins[], catById: Map<string, CostCategory>): DreCalc {
  const groups: Record<DreGroup, { map: Map<string, AccountLine> }> = {
    receita_bruta: emptyGroup(), deducoes: emptyGroup(), custo_direto: emptyGroup(),
    despesa_operacional: emptyGroup(), despesa_financeira: emptyGroup(),
  }

  for (const e of list) {
    const c = e.category_id ? catById.get(e.category_id) : undefined
    let group: DreGroup, code: string, name: string, subgroup: string | null, key: string
    if (c) {
      group = c.dre_group; code = c.code; name = c.name; subgroup = c.dre_subgroup; key = c.id
    } else {
      // Lançamento sem conta vinculada: encaixa pela natureza, com a descrição antiga
      group = e.entry_type === 'income' ? 'receita_bruta' : 'despesa_operacional'
      code = 'zzz'; name = e.category || 'Sem categoria'; subgroup = null
      key = `fb-${e.entry_type}-${name}`
    }
    const map = groups[group].map
    const ex = map.get(key)
    if (ex) ex.amount += e.amount
    else map.set(key, { key, code, name, subgroup, amount: e.amount })
  }

  const receita      = finalizeGroup(groups.receita_bruta)
  const deducoes     = finalizeGroup(groups.deducoes)
  const custos       = finalizeGroup(groups.custo_direto)
  const operacionais = finalizeGroup(groups.despesa_operacional)
  const financeiras  = finalizeGroup(groups.despesa_financeira)

  const receitaBruta = receita.total
  const receitaLiquida = receitaBruta - deducoes.total
  const lucroBruto = receitaLiquida - custos.total
  const resultadoOperacional = lucroBruto - operacionais.total
  const resultadoLiquido = resultadoOperacional - financeiras.total

  const byKey: Record<string, number> = {}
  for (const g of [receita, deducoes, custos, operacionais, financeiras]) {
    for (const a of g.accounts) byKey[a.key] = a.amount
  }

  return {
    receita, deducoes, custos, operacionais, financeiras,
    receitaBruta, receitaLiquida, lucroBruto, resultadoOperacional, resultadoLiquido,
    byKey,
  }
}

// Subgrupos dos custos diretos (ordenados pelo menor código)
function bySubgroup(accounts: AccountLine[]) {
  const m = new Map<string, AccountLine[]>()
  for (const a of accounts) {
    const sg = a.subgroup || 'Outros'
    if (!m.has(sg)) m.set(sg, [])
    m.get(sg)!.push(a)
  }
  return [...m.entries()]
    .map(([subgroup, accs]) => {
      const sorted = accs.sort((x, y) => x.code.localeCompare(y.code, 'pt-BR', { numeric: true }))
      return { subgroup, accounts: sorted, minCode: sorted[0]?.code ?? 'zzz' }
    })
    .sort((a, b) => a.minCode.localeCompare(b.minCode, 'pt-BR', { numeric: true }))
}

// ── Linha da matriz: estrutura fixa + acessor para extrair o valor de cada mês ──
interface MatrixRow {
  label: string
  level: 0 | 1 | 2
  emphasis: 'group' | 'subgroup' | 'account' | 'result'
  sign: '+' | '-' | ''
  accessor: (d: DreCalc) => number
  groupId?: string   // linha de grupo recolhível
  parent?: string    // linha filha (pertence a um grupo)
}

function buildRows(accum: DreCalc): MatrixRow[] {
  const R: MatrixRow[] = []
  const acc = (key: string) => (d: DreCalc) => d.byKey[key] ?? 0

  // Receita Bruta
  R.push({ label: 'Receita Bruta', level: 0, emphasis: 'group', sign: '+', accessor: (d) => d.receitaBruta, groupId: 'receita' })
  for (const a of accum.receita.accounts)
    R.push({ label: `${a.code} — ${a.name}`, level: 1, emphasis: 'account', sign: '', accessor: acc(a.key), parent: 'receita' })

  // Deduções
  R.push({ label: '(−) Deduções', level: 0, emphasis: 'group', sign: '-', accessor: (d) => d.deducoes.total, groupId: 'deducoes' })
  for (const a of accum.deducoes.accounts)
    R.push({ label: `${a.code} — ${a.name}`, level: 1, emphasis: 'account', sign: '-', accessor: acc(a.key), parent: 'deducoes' })

  // Receita Líquida
  R.push({ label: '(=) Receita Líquida', level: 0, emphasis: 'result', sign: '', accessor: (d) => d.receitaLiquida })

  // Custos Diretos (subgrupo → conta)
  R.push({ label: '(−) Custos Diretos', level: 0, emphasis: 'group', sign: '-', accessor: (d) => d.custos.total, groupId: 'custos' })
  for (const sg of bySubgroup(accum.custos.accounts)) {
    const keys = sg.accounts.map((a) => a.key)
    R.push({ label: sg.subgroup, level: 1, emphasis: 'subgroup', sign: '-', accessor: (d) => keys.reduce((s, k) => s + (d.byKey[k] ?? 0), 0), parent: 'custos' })
    for (const a of sg.accounts)
      R.push({ label: `${a.code} — ${a.name}`, level: 2, emphasis: 'account', sign: '-', accessor: acc(a.key), parent: 'custos' })
  }
  R.push({ label: '(=) Lucro Bruto', level: 0, emphasis: 'result', sign: '', accessor: (d) => d.lucroBruto })

  // Despesas Operacionais
  R.push({ label: '(−) Despesas Operacionais', level: 0, emphasis: 'group', sign: '-', accessor: (d) => d.operacionais.total, groupId: 'operacionais' })
  for (const a of accum.operacionais.accounts)
    R.push({ label: `${a.code} — ${a.name}`, level: 1, emphasis: 'account', sign: '-', accessor: acc(a.key), parent: 'operacionais' })
  R.push({ label: '(=) Resultado Operacional', level: 0, emphasis: 'result', sign: '', accessor: (d) => d.resultadoOperacional })

  // Despesas Financeiras
  R.push({ label: '(−) Despesas Financeiras', level: 0, emphasis: 'group', sign: '-', accessor: (d) => d.financeiras.total, groupId: 'financeiras' })
  for (const a of accum.financeiras.accounts)
    R.push({ label: `${a.code} — ${a.name}`, level: 1, emphasis: 'account', sign: '-', accessor: acc(a.key), parent: 'financeiras' })
  R.push({ label: '(=) Resultado Líquido', level: 0, emphasis: 'result', sign: '', accessor: (d) => d.resultadoLiquido })

  return R
}

// Lista de meses (YYYY-MM) entre dois meses, inclusivo
function monthsBetween(fromM: string, toM: string) {
  const [fy, fm] = fromM.split('-').map(Number)
  const [ty, tm] = toM.split('-').map(Number)
  const out: { key: string; label: string }[] = []
  let y = fy, m = fm - 1
  const endY = ty, endM = tm - 1
  let guard = 0
  while ((y < endY || (y === endY && m <= endM)) && guard < 120) {
    out.push({ key: `${y}-${String(m + 1).padStart(2, '0')}`, label: `${MONTHS[m]}/${String(y).slice(2)}` })
    m++; if (m > 11) { m = 0; y++ }
    guard++
  }
  return out
}

const TERRACOTTA = '#C68B59'
const BROWN = '#8A5A3B'
const RESULT_BG = '#F9F7F4'
// Realce de grupo: equivalente OPACO de rgba(230,192,123,0.18) sobre branco
// (precisa ser sólido para cobrir o conteúdo que rola sob as colunas fixas)
const GROUP_BG = '#FAF4E7'
// Sombras nas bordas internas das colunas fixas (separam do conteúdo rolante)
const SHADOW_LEFT  = '2px 0 4px -2px rgba(230,192,123,0.55)'
const SHADOW_RIGHT = '-2px 0 4px -2px rgba(230,192,123,0.55)'
const GREEN = '#4A7C59'
const RED = '#8B3A3A'
const DARK = '#3B2418'

// Cor/texto de cada célula segundo as regras de estilo
function cellRender(row: MatrixRow, v: number): { text: string; color: string } {
  if (v === 0) return { text: 'R$ 0,00', color: '#9ca3af' }
  if (row.emphasis === 'result') return { text: formatCurrency(v), color: v >= 0 ? GREEN : RED }
  if (row.sign === '-') return { text: `(${formatCurrency(v)})`, color: RED }
  return { text: formatCurrency(v), color: DARK }
}

export function DRETab({ entries, projects, categories }: Props) {
  const [obra, setObra]     = useState('all')

  const now = new Date()
  const [fromMonth, setFromMonth] = useState(`${now.getFullYear()}-01`)
  const [toMonth, setToMonth]     = useState(`${now.getFullYear()}-12`)
  const [preset, setPreset] = useState<Preset>('este-ano')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const catById = useMemo(() => {
    const m = new Map<string, CostCategory>()
    for (const c of categories) m.set(c.id, c)
    return m
  }, [categories])

  const scoped = useMemo(
    () => (obra === 'all' ? entries : entries.filter((e) => e.project_id === obra)),
    [entries, obra],
  )

  const months = useMemo(() => monthsBetween(fromMonth, toMonth), [fromMonth, toMonth])

  // ── Cálculo em memória: bucket por mês → DRE por mês + acumulado ──
  const { monthlyDre, accumDre, periodEntries } = useMemo(() => {
    const monthSet = new Set(months.map((m) => m.key))
    const buckets = new Map<string, EntryWithJoins[]>()
    for (const m of months) buckets.set(m.key, [])
    for (const e of scoped) {
      // Regime de competência: usa a data de emissão (entry_date)
      const d = e.entry_date
      if (!d) continue
      const k = d.slice(0, 7)
      if (monthSet.has(k)) buckets.get(k)!.push(e)
    }
    const monthly = new Map(months.map((m) => [m.key, computeDre(buckets.get(m.key)!, catById)]))
    const all = [...buckets.values()].flat()
    return { monthlyDre: monthly, accumDre: computeDre(all, catById), periodEntries: all }
  }, [scoped, months, catById])

  const rows = useMemo(() => buildRows(accumDre), [accumDre])
  const visibleRows = rows.filter((r) => !(r.parent && collapsed.has(r.parent)))

  const hasData = periodEntries.length > 0

  const obraNome = obra === 'all' ? 'Consolidado — todas as obras' : (projects.find((p) => p.id === obra)?.name ?? '')
  const regimeLabel = 'Competência'
  const periodoLabel = `${monthYearLabel(fromMonth)} a ${monthYearLabel(toMonth)}`
  const isFiltered = obra !== 'all' || preset !== 'este-ano'

  function applyPreset(key: Preset) {
    setPreset(key)
    if (key === 'custom') return
    const y = now.getFullYear(), m = now.getMonth()
    if (key === 'este-ano')    { setFromMonth(`${y}-01`); setToMonth(`${y}-12`) }
    if (key === 'ano-passado') { setFromMonth(`${y - 1}-01`); setToMonth(`${y - 1}-12`) }
    if (key === 'ultimos-12') {
      const s = new Date(y, m - 11, 1)
      setFromMonth(`${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}`)
      setToMonth(`${y}-${String(m + 1).padStart(2, '0')}`)
    }
  }

  function clearFilters() {
    setObra('all')
    setCollapsed(new Set())
    applyPreset('este-ano')
  }

  function toggleGroup(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function exportExcel() {
    const XLSX = await import('xlsx')
    const head = ['Conta', ...months.map((m) => m.label), 'Acumulado']
    const aoa: (string | number)[][] = [
      [`DRE — ${obraNome}`],
      [`Período: ${periodoLabel}  ·  Regime: ${regimeLabel}`],
      [],
      head,
    ]
    for (const r of rows) {
      const indent = '   '.repeat(r.level)
      const row: (string | number)[] = [indent + r.label]
      for (const m of months) row.push(r.accessor(monthlyDre.get(m.key)!))
      row.push(r.accessor(accumDre))
      aoa.push(row)
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'DRE')
    const today = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `dre-${today}.xlsx`)
  }

  // Estilos por tipo de linha
  function rowBg(row: MatrixRow): string {
    if (row.emphasis === 'result') return RESULT_BG
    if (row.emphasis === 'group') return GROUP_BG
    return '#FFFFFF'
  }
  const PAD_LEFT = ['1rem', '2rem', '3rem'] as const

  return (
    <div className="space-y-5">
      <style>{`
        @media print {
          @page { size: landscape; }
          body * { visibility: hidden; }
          #dre-print, #dre-print * { visibility: visible; }
          #dre-print { position: absolute; left: 0; top: 0; width: 100%; }
          #dre-print table { font-size: 9px; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Filtros */}
      <div className="no-print space-y-4 rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">Obra</label>
            <select value={obra} onChange={(e) => setObra(e.target.value)} className="rounded-lg border border-gold/50 px-3 py-1.5 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta">
              <option value="all">Consolidado — todas as obras</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">Emissão — de</label>
            <input type="month" value={fromMonth} onChange={(e) => { setFromMonth(e.target.value); setPreset('custom') }} className="rounded-lg border border-gold/50 px-3 py-1.5 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">até</label>
            <input type="month" value={toMonth} onChange={(e) => { setToMonth(e.target.value); setPreset('custom') }} className="rounded-lg border border-gold/50 px-3 py-1.5 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta" />
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

        <div className="flex flex-wrap items-end gap-x-5 gap-y-3 border-t border-gold/20 pt-3">
          <div className="ml-auto flex items-end gap-2">
            <button
              onClick={() => window.print()}
              disabled={!hasData}
              className="flex items-center gap-2 rounded-lg border bg-white px-4 py-1.5 text-sm font-medium text-brown transition-colors hover:bg-cream disabled:opacity-50"
              style={{ borderColor: '#E6C07B' }}
            >
              <Printer className="h-4 w-4" /> Exportar PDF
            </button>
            <button
              onClick={exportExcel}
              disabled={!hasData}
              className="flex items-center gap-2 rounded-lg border bg-white px-4 py-1.5 text-sm font-medium text-brown transition-colors hover:bg-cream disabled:opacity-50"
              style={{ borderColor: '#E6C07B' }}
            >
              <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
            </button>
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="rounded-xl border border-dashed border-gold/40 py-14 text-center">
          <p className="text-sm text-gray-400">Sem dados para o período selecionado.</p>
        </div>
      ) : (
        <>
          <div id="dre-print" className="space-y-5">
            <div className="hidden border-b border-gold/20 pb-3 print:block">
              <h2 className="text-lg font-bold text-dark">DRE — {obraNome}</h2>
              <p className="text-xs text-gray-500">Período: {periodoLabel} · Regime: {regimeLabel}</p>
            </div>

            {/* Matriz DRE: contas × meses + acumulado */}
            <div className="overflow-auto rounded-xl border border-gold/30 bg-white shadow-sm" style={{ maxHeight: '82vh' }}>
              <table className="border-collapse text-[14px]" style={{ minWidth: 'max-content' }}>
                <thead>
                  <tr>
                    <th
                      className="sticky left-0 top-0 z-40 px-3 py-2.5 text-left text-[13px] font-semibold uppercase tracking-wide text-white"
                      style={{ backgroundColor: BROWN, minWidth: 240, boxShadow: SHADOW_LEFT }}
                    >
                      Conta
                    </th>
                    {months.map((m) => (
                      <th
                        key={m.key}
                        className="sticky top-0 z-30 px-3 py-2.5 text-right text-[13px] font-semibold uppercase tracking-wide text-white whitespace-nowrap"
                        style={{ backgroundColor: TERRACOTTA, minWidth: 110 }}
                      >
                        {m.label}
                      </th>
                    ))}
                    <th
                      className="sticky right-0 top-0 z-40 px-3 py-2.5 text-right text-[13px] font-semibold uppercase tracking-wide text-white whitespace-nowrap"
                      style={{ backgroundColor: BROWN, minWidth: 130, borderLeft: '2px solid #E6C07B', boxShadow: SHADOW_RIGHT }}
                    >
                      Acumulado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r, i) => {
                    const bg = rowBg(r)
                    const isBold = r.emphasis === 'result' || r.emphasis === 'group'
                    const labelColor = r.emphasis === 'account' ? '#6b7280' : r.emphasis === 'subgroup' ? BROWN : DARK
                    const collapsible = r.emphasis === 'group' && !!r.groupId
                    const isCollapsed = r.groupId ? collapsed.has(r.groupId) : false
                    const accumVal = r.accessor(accumDre)
                    const accumCell = cellRender(r, accumVal)
                    return (
                      <tr key={i} style={{ backgroundColor: bg }}>
                        {/* Conta — coluna fixa */}
                        <td
                          className="sticky left-0 z-20 py-2.5 pr-3"
                          style={{ backgroundColor: bg, paddingLeft: PAD_LEFT[r.level], minWidth: 240, boxShadow: SHADOW_LEFT }}
                        >
                          {collapsible ? (
                            <button
                              onClick={() => toggleGroup(r.groupId!)}
                              className="flex items-center gap-1.5 font-semibold"
                              style={{ color: labelColor }}
                            >
                              <ChevronRight
                                className="h-3.5 w-3.5 transition-transform"
                                style={{ transform: isCollapsed ? 'none' : 'rotate(90deg)' }}
                              />
                              {r.label}
                            </button>
                          ) : (
                            <span
                              className={isBold ? 'font-semibold' : r.emphasis === 'subgroup' ? 'font-medium' : ''}
                              style={{ color: labelColor }}
                            >
                              {r.label}
                            </span>
                          )}
                        </td>

                        {/* Meses */}
                        {months.map((m) => {
                          const v = r.accessor(monthlyDre.get(m.key)!)
                          const c = cellRender(r, v)
                          return (
                            <td
                              key={m.key}
                              className={`px-3 py-2.5 text-right whitespace-nowrap ${isBold ? 'font-bold' : r.emphasis === 'subgroup' ? 'font-semibold' : ''}`}
                              style={{ color: c.color }}
                            >
                              {c.text}
                            </td>
                          )
                        })}

                        {/* Acumulado — coluna fixa à direita */}
                        <td
                          className="sticky right-0 z-20 px-3 py-2.5 text-right font-bold whitespace-nowrap"
                          style={{ backgroundColor: bg, color: accumCell.color, borderLeft: '2px solid #E6C07B', boxShadow: SHADOW_RIGHT }}
                        >
                          {accumCell.text}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
