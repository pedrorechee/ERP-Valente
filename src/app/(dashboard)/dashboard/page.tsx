import Link from 'next/link'
import {
  HardHat, BookOpen, Camera, CheckSquare,
  Building2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { getPageClient } from '@/lib/supabase/action'
import type { Project } from '@/types/database'
import { isOverdue } from '@/lib/format'
import { pctConsumido } from '@/lib/orcamento'
import { DashboardStats, type StatsEntry } from './DashboardStats'
import { CashFlowSection, type CfEntry, type CfProject } from './CashFlowSection'
import { ObrasTable } from './ObrasTable'
import { OrcamentoResumo, type OrcamentoRow } from './OrcamentoResumo'

const QUICK_ACTIONS_MOBILE = [
  { href: '/obras',     label: 'Obras',          icon: HardHat,     description: 'Ver obras ativas' },
  { href: '/obras',     label: 'Diário de Obra',  icon: BookOpen,    description: 'Registrar atividades' },
  { href: '/obras',     label: 'Fotos',           icon: Camera,      description: 'Enviar fotos' },
  { href: '/obras',     label: 'Tarefas',         icon: CheckSquare, description: 'Checklist de tarefas' },
]


export default async function DashboardPage() {
  const supabase = await getPageClient()

  const now = new Date()

  const [
    { data: projectsData },
    { data: allEntriesData },
    { data: approvedBudgetsData },
    { data: realizedByPhaseData },
    { data: activeContractsData },
  ] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, status, overall_progress, start_date, expected_end_date, contract_value')
      .order('updated_at', { ascending: false }),
    // Busca todos os lançamentos sem filtro de data — cliente filtra por período
    supabase
      .from('financial_entries')
      .select('entry_date, entry_type, amount, status, project_id, description')
      .order('entry_date', { ascending: false }),
    // Orçamentos aprovados (vigentes) — para os indicadores de orçamento
    supabase
      .from('budgets')
      .select('id, project_id, total_direct_cost')
      .eq('status', 'aprovado'),
    // Realizado = despesas pagas vinculadas a uma fase (phase_id não nulo)
    supabase
      .from('financial_entries')
      .select('project_id, amount')
      .eq('entry_type', 'expense')
      .eq('status', 'pago')
      .not('phase_id', 'is', null),
    // Contratos ativos — para o indicador de Saldo a Faturar total
    supabase
      .from('contracts')
      .select('original_value, contract_amendments(value_change), measurements(amount)')
      .eq('status', 'ativo'),
  ])

  const projects = (projectsData as unknown as Project[] | null) ?? []
  const activeProjects    = projects.filter((p) => p.status === 'active')
  const completedProjects = projects.filter((p) => p.status === 'completed')
  const overdueProjects   = activeProjects.filter((p) => isOverdue(p.expected_end_date))

  type AllEntry = StatsEntry & { project_id: string; description: string; status: 'pago' | 'pendente' | 'agendado' }
  const allEntries = (allEntriesData as AllEntry[] | null) ?? []
  const periodEntries: StatsEntry[] = allEntries
  const cfEntries: CfEntry[] = allEntries
  // Seletor de obra do Fluxo de Caixa: todas as obras, ordenadas por nome
  const cfProjects: CfProject[] = projects
    .map(p => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  // Saldo financeiro por obra (todos os tempos)
  const projectBalanceMap = new Map<string, number>()
  for (const entry of allEntries) {
    const current = projectBalanceMap.get(entry.project_id) ?? 0
    projectBalanceMap.set(
      entry.project_id,
      entry.entry_type === 'income' ? current + entry.amount : current - entry.amount,
    )
  }

  const projectsNegativeBalance = activeProjects.filter((p) => {
    const bal = projectBalanceMap.get(p.id)
    return bal !== undefined && bal < 0
  })

  // ── Indicadores de orçamento: obras ATIVAS com orçamento APROVADO ──
  type ApprovedB = { id: string; project_id: string; total_direct_cost: number }
  const approvedByProject = new Map<string, ApprovedB>()
  for (const b of (approvedBudgetsData as ApprovedB[] | null) ?? []) {
    approvedByProject.set(b.project_id, b) // só há 1 aprovado por obra (índice único)
  }
  const realizedByProject = new Map<string, number>()
  for (const r of (realizedByPhaseData as { project_id: string; amount: number }[] | null) ?? []) {
    realizedByProject.set(r.project_id, (realizedByProject.get(r.project_id) ?? 0) + r.amount)
  }
  const orcamentoRows: OrcamentoRow[] = activeProjects
    .filter((p) => approvedByProject.has(p.id))
    .map((p) => {
      const b = approvedByProject.get(p.id)!
      const orcado = b.total_direct_cost ?? 0
      const realizado = realizedByProject.get(p.id) ?? 0
      const pct = pctConsumido(orcado, realizado)
      return { budgetId: b.id, projectId: p.id, name: p.name, orcado, realizado, pct }
    })
    .sort((a, b) => b.pct - a.pct) // mais críticas primeiro
  // ── Saldo a Faturar total (contratos ativos) ──
  type ActiveContract = {
    original_value: number
    contract_amendments: { value_change: number }[]
    measurements: { amount: number }[]
  }
  const saldoAFaturarTotal = ((activeContractsData as ActiveContract[] | null) ?? []).reduce((sum, c) => {
    const total = (c.original_value || 0) + c.contract_amendments.reduce((s, a) => s + (a.value_change || 0), 0)
    const measured = c.measurements.reduce((s, m) => s + (m.amount || 0), 0)
    return sum + (total - measured)
  }, 0)

  return (
    <div className="space-y-6">
      {/* Ações rápidas mobile */}
      <div className="md:hidden">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
          Acesso Rápido
        </p>
        <div className="grid grid-cols-2 gap-3">
          {QUICK_ACTIONS_MOBILE.map((action) => {
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

      {/* Título, seletor de período e cards de resumo */}
      <DashboardStats
        entries={periodEntries}
        activeCount={activeProjects.length}
        overdueCount={overdueProjects.length}
        completedCount={completedProjects.length}
        negativeBalanceCount={projectsNegativeBalance.length}
        saldoAFaturar={saldoAFaturarTotal}
      />

      {/* Lista de obras ativas */}
      {activeProjects.length > 0 && <ObrasTable projects={activeProjects} />}

      {/* Acompanhamento orçamentário (obras ativas com orçamento aprovado) */}
      <OrcamentoResumo rows={orcamentoRows} />

      {/* Fluxo de Caixa */}
      <CashFlowSection entries={cfEntries} projects={cfProjects} />

      {/* Empty state desktop */}
      {activeProjects.length === 0 && (
        <div className="hidden md:flex flex-col items-center justify-center rounded-xl border border-dashed border-gold/40 bg-cream/20 py-16 text-center">
          <Building2 className="mb-3 h-10 w-10 text-gold" />
          <h3 className="font-semibold text-dark">Nenhuma obra ativa</h3>
          <p className="mt-1 text-sm text-gray-500">
            Cadastre a primeira obra para ver o dashboard.
          </p>
          <Link
            href="/obras/nova"
            className="mt-4 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-brown transition-colors"
          >
            Cadastrar obra
          </Link>
        </div>
      )}

    </div>
  )
}
