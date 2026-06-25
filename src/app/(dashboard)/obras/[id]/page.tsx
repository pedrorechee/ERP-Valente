export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getPageClient } from '@/lib/supabase/action'
import { getSessionRole } from '@/lib/auth'
import { getSignedUrl } from '@/lib/storage'
import type {
  Project, ProjectPhase, PhaseTask, DiaryEntry, DiaryPhoto,
  ProjectDocument, CriticalMilestone, FinancialEntry, Client,
  ProjectTeam, EmploymentType
} from '@/types/database'
import { ToastOnMount } from '@/components/ui/toast-on-mount'
import { ObraPageClient } from '@/components/obras/ObraPageClient'

type Params      = Promise<{ id: string }>
type SearchParams = Promise<{ tab?: string; success?: string }>

export default async function ObraPage({
  params,
  searchParams,
}: {
  params:       Params
  searchParams: SearchParams
}) {
  const { id }             = await params
  const { tab, success }   = await searchParams
  const supabase           = await getPageClient()
  const today              = new Date().toISOString().slice(0, 10)

  // ── Busca em paralelo ───────────────────────────────────────
  const [
    projectResult,
    phasesResult,
    diaryResult,
    docsResult,
    milestonesResult,
    financialResult,
    expensesResult,
    approvedBudgetResult,
    realizedByPhaseResult,
    teamResult,
    workLogsAggResult,
    activeEmployeesResult,
    presentTodayResult,
  ] = await Promise.all([
    supabase.from('projects')
      .select('*, clients(id, name)')
      .eq('id', id)
      .single(),

    supabase.from('project_phases')
      .select('*, phase_tasks(*)')
      .eq('project_id', id)
      .order('order_index'),

    supabase.from('project_diary')
      .select('*, diary_photos(*)')
      .eq('project_id', id)
      .order('entry_date', { ascending: false })
      .order('created_at',  { ascending: false }),

    supabase.from('project_documents')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false }),

    supabase.from('critical_milestones')
      .select('*')
      .eq('project_id', id)
      .order('planned_date'),

    supabase.from('financial_entries')
      .select('*')
      .eq('project_id', id)
      .order('entry_date', { ascending: false })
      .limit(50),

    // Total de gastos para o resumo financeiro (sem limite)
    supabase.from('financial_entries')
      .select('amount, status')
      .eq('project_id', id)
      .eq('entry_type', 'expense'),

    // Orçamento ÚNICO da obra (qualquer status) com seus itens.
    // Só alimenta o orçado x realizado quando estiver APROVADO.
    supabase.from('budgets')
      .select('id, status, total_direct_cost, budget_items(phase_id, total)')
      .eq('project_id', id)
      .limit(1),

    // Realizado por etapa: despesas pagas da obra
    supabase.from('financial_entries')
      .select('phase_id, amount')
      .eq('project_id', id)
      .eq('entry_type', 'expense')
      .eq('status', 'pago'),

    // Equipe própria alocada à obra (com dados do funcionário)
    supabase.from('project_team')
      .select('*, employees(id, name, role, employment_type, monthly_salary, daily_rate, is_active)')
      .eq('project_id', id)
      .order('created_at', { ascending: false }),

    // Apontamentos da obra (para custo acumulado, dias e total já lançado)
    supabase.from('work_logs')
      .select('employee_id, computed_cost, financial_entry_id')
      .eq('project_id', id),

    // Funcionários ativos (para o seletor de alocação)
    supabase.from('employees')
      .select('id, name, role, employment_type, monthly_salary, daily_rate')
      .eq('is_active', true)
      .order('name'),

    // Equipe presente HOJE (para pré-preencher o diário)
    supabase.from('work_logs')
      .select('attendance, employees(name)')
      .eq('project_id', id)
      .eq('log_date', today)
      .in('attendance', ['presente', 'meio_periodo']),

  ])

  const { role } = await getSessionRole()
  const canManageTeam = role === 'owner' || role === 'admin'

  if (!projectResult.data) notFound()

  const project         = projectResult.data as Project & { clients: Pick<Client, 'id' | 'name'> | null }
  const phases          = (phasesResult.data as (ProjectPhase & { phase_tasks: PhaseTask[] })[] | null) ?? []
  const financialEntries = (financialResult.data as FinancialEntry[] | null) ?? []
  const milestones      = (milestonesResult.data as CriticalMilestone[] | null) ?? []
  const expenseRows     = (expensesResult.data ?? []) as { amount: number; status: string }[]
  const totalGasto      = expenseRows.reduce((sum, e) => sum + (e.amount ?? 0), 0)
  const totalPago       = expenseRows
    .filter((e) => e.status === 'pago')
    .reduce((sum, e) => sum + (e.amount ?? 0), 0)

  // ── Orçado x Realizado por etapa ──
  // O orçamento só "vale" quando aprovado. Em rascunho (ou sem orçamento) o
  // orçado é 0 — nunca usamos valores de rascunho nos cálculos.
  type ObraBudget = { id: string; status: string; total_direct_cost: number; budget_items: { phase_id: string | null; total: number }[] }
  const obraBudget = (approvedBudgetResult.data as ObraBudget[] | null)?.[0]
  const isApproved = obraBudget?.status === 'aprovado'
  const plannedDirectCost = isApproved ? (obraBudget?.total_direct_cost ?? 0) : 0
  const orcadoByPhase: Record<string, number> = {}
  let orcadoNoPhase = 0
  if (isApproved) {
    for (const it of obraBudget?.budget_items ?? []) {
      if (it.phase_id) orcadoByPhase[it.phase_id] = (orcadoByPhase[it.phase_id] ?? 0) + it.total
      else orcadoNoPhase += it.total
    }
  }
  const realizedByPhase: Record<string, number> = {}
  let realizedNoPhase = 0
  for (const r of (realizedByPhaseResult.data as { phase_id: string | null; amount: number }[] | null) ?? []) {
    if (r.phase_id) realizedByPhase[r.phase_id] = (realizedByPhase[r.phase_id] ?? 0) + r.amount
    else realizedNoPhase += r.amount
  }
  const orcadoRealizadoRows = phases.map((p) => ({
    id: p.id, name: p.name, orcado: orcadoByPhase[p.id] ?? 0, realizado: realizedByPhase[p.id] ?? 0,
  }))
  if (orcadoNoPhase > 0 || realizedNoPhase > 0) {
    orcadoRealizadoRows.push({ id: '__sem_etapa__', name: 'Sem etapa', orcado: orcadoNoPhase, realizado: realizedNoPhase })
  }

  // ── Orçamento único da obra: ID para navegação (existe ou não) ──
  // O botão "Ver orçamento completo" abre o orçamento da obra mesmo em rascunho.
  const budgetId: string | null = obraBudget?.id ?? null
  const budgetIsDraft = !!obraBudget && !isApproved

  // ── Equipe própria (Fase 4) ──
  type EmployeeMini = {
    id: string; name: string; role: string | null
    employment_type: EmploymentType; monthly_salary: number; daily_rate: number
    is_active?: boolean
  }
  type TeamRow = ProjectTeam & { employees: EmployeeMini | null }
  const team = (teamResult.data as TeamRow[] | null) ?? []
  const activeEmployees = (activeEmployeesResult.data as EmployeeMini[] | null) ?? []
  const workLogsAgg = (workLogsAggResult.data as
    { employee_id: string; computed_cost: number; financial_entry_id: string | null }[] | null) ?? []

  const costByEmployee: Record<string, { cost: number; days: number }> = {}
  let teamCostTotal = 0
  let teamLaunchedTotal = 0
  for (const w of workLogsAgg) {
    const c = w.computed_cost ?? 0
    teamCostTotal += c
    if (w.financial_entry_id) teamLaunchedTotal += c
    const cur = costByEmployee[w.employee_id] ?? { cost: 0, days: 0 }
    cur.cost += c
    cur.days += 1
    costByEmployee[w.employee_id] = cur
  }
  const teamSummary = { cost: teamCostTotal, launched: teamLaunchedTotal, days: workLogsAgg.length }

  // Equipe presente hoje → string para pré-preencher o diário
  type PresentRow = { attendance: string; employees: { name: string } | null }
  const presentToday = (((presentTodayResult.data as unknown as PresentRow[] | null) ?? [])
    .map((r) => r.employees?.name)
    .filter(Boolean) as string[])
    .join(', ')

  // URLs assinadas para fotos do diário e documentos — tudo em uma única
  // onda paralela (antes os dois blocos rodavam um após o outro)
  const rawDiary = (diaryResult.data as (DiaryEntry & { diary_photos: DiaryPhoto[] })[] | null) ?? []
  const rawDocs  = (docsResult.data as ProjectDocument[] | null) ?? []

  const [diaryEntries, documents] = await Promise.all([
    Promise.all(
      rawDiary.map(async (entry) => ({
        ...entry,
        diary_photos: await Promise.all(
          entry.diary_photos.map(async (p) => {
            try {
              const signedUrl = await getSignedUrl('obra-fotos', p.storage_path)
              return { ...p, signedUrl }
            } catch {
              return { ...p, signedUrl: undefined }
            }
          })
        ),
      }))
    ),
    Promise.all(
      rawDocs.map(async (doc) => {
        try {
          const signedUrl = await getSignedUrl('obra-documentos', doc.storage_path)
          return { ...doc, signedUrl }
        } catch {
          return { ...doc, signedUrl: undefined }
        }
      })
    ),
  ])

  return (
    <div className="space-y-5">
      {success === 'criada'     && <ToastOnMount message="Obra cadastrada com sucesso!" />}
      {success === 'atualizada' && <ToastOnMount message="Obra atualizada com sucesso!" />}

      <Link
        href="/obras"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-dark transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Obras
      </Link>

      <ObraPageClient
        project={project}
        phases={phases}
        diaryEntries={diaryEntries}
        documents={documents}
        milestones={milestones}
        financialEntries={financialEntries}
        totalGasto={totalGasto}
        totalPago={totalPago}
        orcadoRealizadoRows={orcadoRealizadoRows}
        plannedDirectCost={plannedDirectCost}
        budgetId={budgetId}
        budgetIsDraft={budgetIsDraft}
        team={team}
        costByEmployee={costByEmployee}
        activeEmployees={activeEmployees}
        teamSummary={teamSummary}
        canManageTeam={canManageTeam}
        presentToday={presentToday}
        initialTab={tab ?? 'visao-geral'}
      />
    </div>
  )
}
