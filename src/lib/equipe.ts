import type { Attendance, Employee, EmploymentType } from '@/types/database'

/**
 * Cálculo do custo de mão de obra própria — FONTE ÚNICA.
 * Usado tanto no apontamento (computed_cost de cada work_log) quanto no
 * fechamento de folha. Nunca duplicar esta lógica.
 *
 * Regras (Fase 4):
 * - Diarista: custo-dia = daily_rate. Atestado/Falta = 0; Meio período = 0,5.
 * - CLT:      custo-dia base = (monthly_salary / work_days_month) × charge_factor.
 *             Atestado conta como dia pago (=1); Falta = 0; Meio período = 0,5.
 */

type CostFields = Pick<
  Employee,
  'employment_type' | 'monthly_salary' | 'daily_rate' | 'charge_factor' | 'work_days_month'
>

// Fator de presença aplicado ao custo-dia. Atestado difere por tipo de contratação.
export function attendanceFactor(type: EmploymentType, attendance: Attendance): number {
  switch (attendance) {
    case 'falta':        return 0
    case 'meio_periodo': return 0.5
    case 'atestado':     return type === 'clt' ? 1 : 0
    case 'presente':
    default:             return 1
  }
}

// Custo-dia "cheio" do funcionário (dia presente integral), sem fator de presença.
export function dailyBaseCost(emp: CostFields): number {
  if (emp.employment_type === 'diarista') return emp.daily_rate || 0
  const days = emp.work_days_month && emp.work_days_month > 0 ? emp.work_days_month : 22
  return ((emp.monthly_salary || 0) / days) * (emp.charge_factor || 1)
}

// Custo de um apontamento (computed_cost), arredondado a 2 casas.
export function computeWorkLogCost(emp: CostFields, attendance: Attendance): number {
  const cost = dailyBaseCost(emp) * attendanceFactor(emp.employment_type, attendance)
  return Math.round(cost * 100) / 100
}

// Texto curto do custo para listagens: "R$ X/mês" (CLT) ou "R$ X/dia" (diarista).
export function costLabel(
  emp: Pick<Employee, 'employment_type' | 'monthly_salary' | 'daily_rate'>,
  formatCurrency: (n: number) => string,
): string {
  return emp.employment_type === 'clt'
    ? `${formatCurrency(emp.monthly_salary || 0)}/mês`
    : `${formatCurrency(emp.daily_rate || 0)}/dia`
}
