'use server'

import { revalidatePath } from 'next/cache'
import { getActionClient } from '@/lib/supabase/action'
import { computeAutoCost } from '@/lib/equipe'
import {
  PAYROLL_CATEGORY_CODE,
  type Attendance, type Employee, type EmploymentType, type ProjectTeam, type WorkLog,
} from '@/types/database'

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]
function monthLabel(dateStr: string): string {
  const [y, m] = dateStr.split('-')
  const idx = Number(m) - 1
  return `${MONTHS_PT[idx] ?? m}/${y}`
}

type EmployeeResult =
  | { success: true; employee: Employee }
  | { success: false; error: string }

// Monta o payload do funcionário a partir do FormData, normalizando números.
function buildEmployeePayload(formData: FormData) {
  const type = (formData.get('employment_type') as EmploymentType) || 'clt'
  const num = (key: string, fallback = 0) => {
    const raw = formData.get(key) as string
    const n = Number(raw)
    return raw && !Number.isNaN(n) ? n : fallback
  }
  return {
    name:            (formData.get('name') as string)?.trim() ?? '',
    document:        ((formData.get('document') as string) || '').trim() || null,
    role:            ((formData.get('role') as string) || '').trim() || null,
    employment_type: type,
    monthly_salary:  type === 'clt' ? num('monthly_salary') : 0,
    daily_rate:      type === 'diarista' ? num('daily_rate') : 0,
    charge_factor:   type === 'clt' ? num('charge_factor', 1) : 1,
    work_days_month: type === 'clt' ? Math.round(num('work_days_month', 22)) : 22,
    admission_date:  (formData.get('admission_date') as string) || null,
    phone:           ((formData.get('phone') as string) || '').trim() || null,
    pix_key:         ((formData.get('pix_key') as string) || '').trim() || null,
    is_active:       (formData.get('is_active') as string) !== 'false',
    notes:           ((formData.get('notes') as string) || '').trim() || null,
  }
}

export async function createEmployee(formData: FormData): Promise<EmployeeResult> {
  const payload = buildEmployeePayload(formData)
  if (!payload.name) return { success: false, error: 'Informe o nome do funcionário' }

  const { supabase } = await getActionClient()
  const { data, error } = await supabase
    .from('employees')
    .insert(payload)
    .select('*')
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath('/equipe')
  return { success: true, employee: data as Employee }
}

export async function updateEmployee(id: string, formData: FormData): Promise<EmployeeResult> {
  const payload = buildEmployeePayload(formData)
  if (!payload.name) return { success: false, error: 'Informe o nome do funcionário' }

  const { supabase } = await getActionClient()
  const { data, error } = await supabase
    .from('employees')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath('/equipe')
  revalidatePath(`/equipe/${id}`)
  return { success: true, employee: data as Employee }
}

export async function deleteEmployee(id: string): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await getActionClient()
  const { error } = await supabase.from('employees').delete().eq('id', id)
  if (error) {
    // FK em work_logs/project_team usa ON DELETE CASCADE; erro só em casos atípicos.
    return { success: false, error: error.message }
  }
  revalidatePath('/equipe')
  return { success: true }
}

// ─── Alocação de funcionário em obra (project_team) ──────────

type AllocationResult =
  | { success: true; allocation: ProjectTeam }
  | { success: false; error: string }

export async function allocateEmployee(input: {
  project_id: string
  employee_id: string
  role_in_project?: string | null
  start_date?: string | null
}): Promise<AllocationResult> {
  if (!input.project_id || !input.employee_id) {
    return { success: false, error: 'Funcionário e obra são obrigatórios' }
  }
  const { supabase } = await getActionClient()
  const { data, error } = await supabase
    .from('project_team')
    .insert({
      project_id:      input.project_id,
      employee_id:     input.employee_id,
      role_in_project: input.role_in_project?.trim() || null,
      start_date:      input.start_date || null,
    })
    .select('*')
    .single()

  if (error) {
    return {
      success: false,
      error: error.code === '23505'
        ? 'Este funcionário já está alocado nesta obra'
        : error.message,
    }
  }
  revalidatePath(`/obras/${input.project_id}`)
  revalidatePath(`/equipe/${input.employee_id}`)
  revalidatePath('/equipe')
  return { success: true, allocation: data as ProjectTeam }
}

// Desalocar = remover a alocação (libera o funcionário para nova alocação).
// O histórico de custo permanece preservado em work_logs.
export async function removeAllocation(
  allocationId: string,
  ctx: { projectId: string; employeeId: string },
): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await getActionClient()
  const { error } = await supabase.from('project_team').delete().eq('id', allocationId)
  if (error) return { success: false, error: error.message }
  revalidatePath(`/obras/${ctx.projectId}`)
  revalidatePath(`/equipe/${ctx.employeeId}`)
  revalidatePath('/equipe')
  return { success: true }
}

// ─── Apontamento (work_logs) ─────────────────────────────────

type WorkLogResult =
  | { success: true; workLog: WorkLog }
  | { success: false; error: string }

export interface WorkLogInput {
  employee_id:         string
  project_id:          string
  phase_id:            string | null
  log_date:            string
  attendance:          Attendance
  hours_worked:        number
  standard_hours:      number
  overtime_multiplier: number
  cost_overridden:     boolean
  manual_cost:         number | null
}

// Cria/atualiza UM apontamento (1 por funcionário/obra/dia). O custo é
// calculado no servidor a partir dos dados do funcionário — fonte única.
// Quando cost_overridden, computed_cost = manual_cost (override manual).
// Mantém o vínculo com a folha (financial_entry_id) intacto em updates.
export async function upsertWorkLog(input: WorkLogInput): Promise<WorkLogResult> {
  const { supabase } = await getActionClient()

  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .select('employment_type, monthly_salary, daily_rate, charge_factor, work_days_month')
    .eq('id', input.employee_id)
    .single()
  if (empErr || !emp) return { success: false, error: empErr?.message || 'Funcionário não encontrado' }

  const auto = computeAutoCost(emp as Employee, {
    attendance: input.attendance,
    hours_worked: input.hours_worked,
    standard_hours: input.standard_hours,
    overtime_multiplier: input.overtime_multiplier,
  })
  const manual_cost = input.cost_overridden ? (input.manual_cost ?? 0) : null
  const computed_cost = manual_cost != null ? Math.round(manual_cost * 100) / 100 : auto.cost

  const { data, error } = await supabase
    .from('work_logs')
    .upsert(
      {
        employee_id:         input.employee_id,
        project_id:          input.project_id,
        phase_id:            input.phase_id,
        log_date:            input.log_date,
        attendance:          input.attendance,
        hours_worked:        input.hours_worked,
        standard_hours:      input.standard_hours,
        overtime_hours:      auto.overtimeHours,
        overtime_multiplier: input.overtime_multiplier,
        manual_cost,
        cost_overridden:     input.cost_overridden,
        computed_cost,
      },
      { onConflict: 'employee_id,project_id,log_date' },
    )
    .select('*')
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath(`/obras/${input.project_id}`)
  revalidatePath(`/equipe/${input.employee_id}`)
  return { success: true, workLog: data as WorkLog }
}

export async function deleteWorkLog(
  id: string,
  ctx: { projectId: string; employeeId: string },
): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await getActionClient()
  const { error } = await supabase.from('work_logs').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath(`/obras/${ctx.projectId}`)
  revalidatePath(`/equipe/${ctx.employeeId}`)
  return { success: true }
}

// ─── Fechamento de folha → Financeiro ────────────────────────

export interface CreatedPayrollEntry {
  id:           string
  description:  string
  amount:       number
  status:       string
  project_id:   string
  project_name: string
  phase_name:   string | null
}

type ClosePayrollResult =
  | { success: true; created: CreatedPayrollEntry[]; total: number }
  | { success: false; error: string }

// Consolida os work_logs do período AINDA NÃO lançados (financial_entry_id nulo),
// agrupando por funcionário + obra + fase, e gera UM lançamento de despesa por grupo.
// Vincula os work_logs ao lançamento criado para nunca duplicar o custo.
export async function closePayroll(input: {
  period_start: string
  period_end:   string
  project_id?:  string | null
  status:       'pago' | 'pendente'
  payment_date?: string | null
}): Promise<ClosePayrollResult> {
  const { supabase, userId } = await getActionClient()

  // Conta do plano de contas: "Mão de obra própria" (3.2.02)
  const { data: cat } = await supabase
    .from('cost_categories')
    .select('id, name')
    .eq('code', PAYROLL_CATEGORY_CODE)
    .maybeSingle()
  if (!cat) {
    return { success: false, error: 'Conta "Mão de obra própria" (3.2.02) não encontrada no plano de contas.' }
  }
  const category = cat as { id: string; name: string }

  // Apontamentos não lançados no período
  let q = supabase
    .from('work_logs')
    .select('id, employee_id, project_id, phase_id, computed_cost, employees(name), projects(name), project_phases(name)')
    .is('financial_entry_id', null)
    .gte('log_date', input.period_start)
    .lte('log_date', input.period_end)
  if (input.project_id) q = q.eq('project_id', input.project_id)

  const { data: logData, error: logErr } = await q
  if (logErr) return { success: false, error: logErr.message }

  type LogRow = {
    id: string; employee_id: string; project_id: string; phase_id: string | null
    computed_cost: number
    employees: { name: string } | null
    projects: { name: string } | null
    project_phases: { name: string } | null
  }
  const rows = (logData as unknown as LogRow[] | null) ?? []

  // Agrupa por funcionário + obra + fase
  type Group = {
    project_id: string; phase_id: string | null
    employee_name: string; project_name: string; phase_name: string | null
    cost: number; ids: string[]
  }
  const groups = new Map<string, Group>()
  for (const w of rows) {
    const key = `${w.employee_id}|${w.project_id}|${w.phase_id ?? 'none'}`
    const g = groups.get(key) ?? {
      project_id: w.project_id,
      phase_id: w.phase_id,
      employee_name: w.employees?.name ?? 'Funcionário',
      project_name: w.projects?.name ?? '',
      phase_name: w.project_phases?.name ?? null,
      cost: 0,
      ids: [],
    }
    g.cost += w.computed_cost ?? 0
    g.ids.push(w.id)
    groups.set(key, g)
  }

  const created: CreatedPayrollEntry[] = []
  let total = 0
  const label = monthLabel(input.period_start)
  const touchedProjects = new Set<string>()

  for (const g of groups.values()) {
    if (g.cost <= 0) continue // amount > 0 (faltas não geram lançamento)
    const amount = Math.round(g.cost * 100) / 100

    const { data: entry, error: insErr } = await supabase
      .from('financial_entries')
      .insert({
        project_id:          g.project_id,
        entry_type:          'expense',
        entry_date:          input.period_end,
        description:         `Folha ${label} — ${g.employee_name}`,
        amount,
        category:            category.name,
        category_id:         category.id,
        payment_method:      null,
        counterpart:         null,
        supplier_id:         null,
        phase_id:            g.phase_id,
        status:              input.status,
        payment_date:        input.status === 'pago' ? (input.payment_date || input.period_end) : null,
        in_supplier_account: false,
        created_by:          userId,
      })
      .select('id')
      .single()

    if (insErr || !entry) return { success: false, error: insErr?.message || 'Erro ao gerar lançamento' }
    const entryId = (entry as { id: string }).id

    const { error: linkErr } = await supabase
      .from('work_logs')
      .update({ financial_entry_id: entryId })
      .in('id', g.ids)
    if (linkErr) return { success: false, error: linkErr.message }

    created.push({
      id: entryId,
      description: `Folha ${label} — ${g.employee_name}`,
      amount,
      status: input.status,
      project_id: g.project_id,
      project_name: g.project_name,
      phase_name: g.phase_name,
    })
    total += amount
    touchedProjects.add(g.project_id)
  }

  revalidatePath('/financeiro')
  revalidatePath('/equipe')
  revalidatePath('/equipe/folha')
  revalidatePath('/dashboard')
  touchedProjects.forEach((pid) => revalidatePath(`/obras/${pid}`))

  return { success: true, created, total: Math.round(total * 100) / 100 }
}

// Estorno/reabertura: desvincula os work_logs e exclui o lançamento gerado.
export async function reopenPayroll(
  financialEntryId: string,
  projectId?: string | null,
): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await getActionClient()

  // Desvincula os apontamentos (voltam a "não lançados")
  const { error: unlinkErr } = await supabase
    .from('work_logs')
    .update({ financial_entry_id: null })
    .eq('financial_entry_id', financialEntryId)
  if (unlinkErr) return { success: false, error: unlinkErr.message }

  const { error } = await supabase.from('financial_entries').delete().eq('id', financialEntryId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/financeiro')
  revalidatePath('/equipe')
  revalidatePath('/equipe/folha')
  revalidatePath('/dashboard')
  if (projectId) revalidatePath(`/obras/${projectId}`)
  return { success: true }
}
