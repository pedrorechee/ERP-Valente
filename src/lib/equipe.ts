import type { Attendance, Employee } from '@/types/database'

/**
 * Cálculo do custo de mão de obra própria — FONTE ÚNICA.
 * Usado no apontamento (preview na grade + computed_cost de cada work_log) e,
 * via computed_cost, no fechamento de folha. Nunca duplicar esta lógica.
 *
 * Regras (Fase 4 + hora extra):
 * - custo-dia: diarista = daily_rate; CLT = (monthly_salary / work_days_month) × charge_factor
 * - custo-hora = custo-dia ÷ jornada padrão (standard_hours)
 * - Falta → 0 · Meio período → custo-dia × 0,5 · Atestado → custo-dia (CLT) ou 0 (diarista)
 * - Presente → (horas normais × custo-hora) + (horas extras × custo-hora × multiplicador)
 *   onde horas normais = min(hours_worked, standard_hours) e
 *         horas extras  = max(0, hours_worked − standard_hours)
 * O override manual (cost_overridden) substitui este cálculo e é aplicado fora do helper.
 */

export const DEFAULT_STANDARD_HOURS = 8
export const DEFAULT_OVERTIME_MULTIPLIER = 1.5

type CostFields = Pick<
  Employee,
  'employment_type' | 'monthly_salary' | 'daily_rate' | 'charge_factor' | 'work_days_month'
>

const round2 = (n: number) => Math.round(n * 100) / 100

// Custo-dia "cheio" do funcionário (dia presente integral), sem fator de presença/hora.
export function dailyBaseCost(emp: CostFields): number {
  if (emp.employment_type === 'diarista') return emp.daily_rate || 0
  const days = emp.work_days_month && emp.work_days_month > 0 ? emp.work_days_month : 22
  return ((emp.monthly_salary || 0) / days) * (emp.charge_factor || 1)
}

export interface AutoCostInput {
  attendance:          Attendance
  hours_worked:        number
  standard_hours:      number
  overtime_multiplier: number
}

// Custo automático do apontamento + horas extras calculadas (ambos arredondados).
export function computeAutoCost(emp: CostFields, input: AutoCostInput): { cost: number; overtimeHours: number } {
  const std = input.standard_hours && input.standard_hours > 0 ? input.standard_hours : DEFAULT_STANDARD_HOURS
  const dia = dailyBaseCost(emp)

  switch (input.attendance) {
    case 'falta':
      return { cost: 0, overtimeHours: 0 }
    case 'atestado':
      return { cost: round2(emp.employment_type === 'clt' ? dia : 0), overtimeHours: 0 }
    case 'meio_periodo':
      return { cost: round2(dia * 0.5), overtimeHours: 0 }
    case 'presente':
    default: {
      const h = input.hours_worked && input.hours_worked > 0 ? input.hours_worked : std
      const normal = Math.min(h, std)
      const overtime = Math.max(0, h - std)
      const hourly = dia / std
      const mult = input.overtime_multiplier && input.overtime_multiplier > 0
        ? input.overtime_multiplier
        : DEFAULT_OVERTIME_MULTIPLIER
      const cost = normal * hourly + overtime * hourly * mult
      return { cost: round2(cost), overtimeHours: round2(overtime) }
    }
  }
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
