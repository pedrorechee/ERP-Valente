export type RecurrenceFrequency = 'semanal' | 'quinzenal' | 'mensal'

export const RECURRENCE_LIMIT = 36

export const RECURRENCE_FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
}

function addDays(dateStr: string, days: number): string {
  const dt = new Date(dateStr + 'T00:00:00Z')
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().split('T')[0]
}

function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const total = (m - 1) + months
  const ny = y + Math.floor(total / 12)
  const nm = (total % 12) + 1
  // Clampa para o último dia do mês (ex.: 31/01 + 1 mês → 28/02)
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  const nd = Math.min(d, lastDay)
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`
}

/**
 * Gera as datas das ocorrências de `start` até `until` (inclusive).
 * Retorna no máximo RECURRENCE_LIMIT + 1 itens — o chamador valida o excedente.
 */
export function generateRecurrenceDates(
  start: string,
  until: string,
  frequency: RecurrenceFrequency,
): string[] {
  const dates: string[] = []
  for (let i = 0; ; i++) {
    const next =
      frequency === 'mensal'
        ? addMonths(start, i)
        : addDays(start, i * (frequency === 'semanal' ? 7 : 14))
    if (next > until) break
    dates.push(next)
    if (dates.length > RECURRENCE_LIMIT) break
  }
  return dates
}
