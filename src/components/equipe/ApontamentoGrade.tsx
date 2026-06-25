'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format'
import { computeWorkLogCost } from '@/lib/equipe'
import { upsertWorkLog, deleteWorkLog } from '@/app/actions/equipe'
import {
  ATTENDANCE_LABELS, type Attendance, type EmploymentType, type WorkLog,
} from '@/types/database'

export type GradeProject = { id: string; name: string; status: string }
export type GradeEmployee = {
  id: string
  name: string
  role: string | null
  employment_type: EmploymentType
  monthly_salary: number
  daily_rate: number
  charge_factor: number
  work_days_month: number
  role_in_project: string | null
}
export type GradePhase = { id: string; name: string }

// ── Helpers de semana (mesmo padrão do Diário de Obra) ──
const DAYS_ABBR = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MONTHS_ABBR = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.']

function parseLocal(dateStr: string): Date { return new Date(dateStr + 'T12:00:00') }
function getWeekMonday(dateStr: string): Date {
  const d = parseLocal(dateStr)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d
}
function addDays(base: Date, n: number): Date { const d = new Date(base); d.setDate(d.getDate() + n); return d }
function toKey(d: Date): string {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}
function weekLabel(monday: Date, sunday: Date): string {
  const d1 = String(monday.getDate()).padStart(2, '0')
  const d2 = String(sunday.getDate()).padStart(2, '0')
  if (monday.getMonth() === sunday.getMonth())
    return `${d1} – ${d2} de ${MONTHS_ABBR[sunday.getMonth()]} de ${sunday.getFullYear()}`
  return `${d1} ${MONTHS_ABBR[monday.getMonth()]} – ${d2} ${MONTHS_ABBR[sunday.getMonth()]} de ${sunday.getFullYear()}`
}

const ATT_OPTIONS: { value: Attendance | ''; short: string }[] = [
  { value: '', short: '—' },
  { value: 'presente', short: 'P' },
  { value: 'meio_periodo', short: '½' },
  { value: 'falta', short: 'F' },
  { value: 'atestado', short: 'A' },
]

function defaultHours(att: Attendance): number {
  if (att === 'presente') return 8
  if (att === 'meio_periodo') return 4
  return 0
}

const selectCls =
  'rounded-lg border border-gold/50 bg-white px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta'
const labelCls = 'text-xs font-semibold uppercase tracking-wide text-brown'

interface Props {
  projects: GradeProject[]
  selectedObra: string
  employees: GradeEmployee[]
  phases: GradePhase[]
  workLogs: WorkLog[]
}

export function ApontamentoGrade({ projects, selectedObra, employees, phases, workLogs }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const today = new Date().toISOString().slice(0, 10)
  const todayMonday = useMemo(() => getWeekMonday(today), [today])
  const [monday, setMonday] = useState<Date>(todayMonday)
  const sunday = useMemo(() => addDays(monday, 6), [monday])
  const isCurrentWeek = toKey(monday) === toKey(todayMonday)
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday])
  const weekStart = toKey(monday)
  const weekEnd = toKey(sunday)

  // Fase padrão do período + fase por linha (funcionário)
  const [defaultPhase, setDefaultPhase] = useState<string>(phases[0]?.id ?? '')
  const [rowPhase, setRowPhase] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const e of employees) {
      const log = workLogs.find((w) => w.employee_id === e.id && w.phase_id)
      map[e.id] = log?.phase_id ?? phases[0]?.id ?? ''
    }
    return map
  })

  // Estado local dos apontamentos: chave `${employeeId}|${dateKey}`
  const [logs, setLogs] = useState<Map<string, WorkLog>>(() => {
    const m = new Map<string, WorkLog>()
    for (const w of workLogs) m.set(`${w.employee_id}|${w.log_date}`, w)
    return m
  })

  function changeObra(id: string) {
    startTransition(() => router.push(id ? `/equipe/apontamento?obra=${id}` : '/equipe/apontamento'))
  }

  function setRowPhaseFor(empId: string, phaseId: string) {
    setRowPhase((prev) => ({ ...prev, [empId]: phaseId }))
  }
  function setDefaultPhaseAll(phaseId: string) {
    setDefaultPhase(phaseId)
    setRowPhase((prev) => {
      const next = { ...prev }
      for (const e of employees) next[e.id] = phaseId
      return next
    })
  }

  function setCell(emp: GradeEmployee, dateKey: string, attendance: Attendance | '') {
    const key = `${emp.id}|${dateKey}`
    const existing = logs.get(key)
    const snapshot = new Map(logs)

    // Limpar célula → remover apontamento
    if (!attendance) {
      if (!existing) return
      const next = new Map(logs); next.delete(key); setLogs(next)
      if (String(existing.id).startsWith('temp-')) return
      deleteWorkLog(existing.id, { projectId: selectedObra, employeeId: emp.id })
        .then((r) => { if (!r.success) throw new Error(r.error) })
        .catch((err: Error) => {
          setLogs(snapshot)
          toast.error(err.message || 'Erro ao remover apontamento')
        })
      return
    }

    const phase_id = rowPhase[emp.id] || null
    const hours = defaultHours(attendance)
    const optimistic: WorkLog = {
      id: existing?.id ?? `temp-${key}`,
      employee_id: emp.id,
      project_id: selectedObra,
      phase_id,
      log_date: dateKey,
      attendance,
      hours_worked: hours,
      computed_cost: computeWorkLogCost(emp, attendance),
      notes: existing?.notes ?? null,
      financial_entry_id: existing?.financial_entry_id ?? null,
      created_at: existing?.created_at ?? '',
    }
    const next = new Map(logs); next.set(key, optimistic); setLogs(next)

    upsertWorkLog({
      employee_id: emp.id,
      project_id: selectedObra,
      phase_id,
      log_date: dateKey,
      attendance,
      hours_worked: hours,
    })
      .then((r) => {
        if (!r.success) throw new Error(r.error)
        setLogs((prev) => { const m = new Map(prev); m.set(key, r.workLog); return m })
      })
      .catch((err: Error) => {
        setLogs(snapshot)
        toast.error(err.message || 'Erro ao salvar apontamento')
      })
  }

  function setCellHours(emp: GradeEmployee, dateKey: string, hours: number) {
    const key = `${emp.id}|${dateKey}`
    const existing = logs.get(key)
    if (!existing) return
    const snapshot = new Map(logs)
    const next = new Map(logs); next.set(key, { ...existing, hours_worked: hours }); setLogs(next)
    upsertWorkLog({
      employee_id: emp.id,
      project_id: selectedObra,
      phase_id: existing.phase_id,
      log_date: dateKey,
      attendance: existing.attendance,
      hours_worked: hours,
    })
      .then((r) => { if (!r.success) throw new Error(r.error) })
      .catch((err: Error) => { setLogs(snapshot); toast.error(err.message || 'Erro ao salvar horas') })
  }

  // Totais
  const weekLogsForEmp = (empId: string) =>
    weekDays.map((d) => logs.get(`${empId}|${toKey(d)}`)).filter(Boolean) as WorkLog[]

  const grandTotal = useMemo(() => {
    let cost = 0
    for (const [, w] of logs) {
      if (w.log_date >= weekStart && w.log_date <= weekEnd) cost += w.computed_cost ?? 0
    }
    return cost
  }, [logs, weekStart, weekEnd])

  return (
    <div className="space-y-4">
      {/* Barra de controle */}
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label className={labelCls}>Obra</label>
            <select value={selectedObra} onChange={(e) => changeObra(e.target.value)} className={`${selectCls} w-56`}>
              <option value="">Selecionar obra…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {selectedObra && phases.length > 0 && (
            <div className="space-y-1.5">
              <label className={labelCls}>Fase padrão</label>
              <select value={defaultPhase} onChange={(e) => setDefaultPhaseAll(e.target.value)} className={`${selectCls} w-48`}>
                <option value="">Sem fase</option>
                {phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Navegação por semana */}
        <div className="flex items-center gap-2">
          {isPending && <Loader2 className="h-4 w-4 animate-spin text-terracotta" />}
          <button
            onClick={() => setMonday((p) => addDays(p, -7))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/40 bg-white text-gray-500 hover:border-terracotta hover:text-terracotta transition-colors"
            aria-label="Semana anterior"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
          </button>
          <span className="text-sm font-semibold text-dark select-none whitespace-nowrap">{weekLabel(monday, sunday)}</span>
          <button
            onClick={() => setMonday((p) => addDays(p, 7))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/40 bg-white text-gray-500 hover:border-terracotta hover:text-terracotta transition-colors"
            aria-label="Próxima semana"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {!isCurrentWeek && (
            <button
              onClick={() => setMonday(todayMonday)}
              className="rounded-lg border border-gold px-3 py-1.5 text-xs font-medium text-brown hover:bg-cream transition-colors"
            >
              Semana atual
            </button>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      {!selectedObra ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gold/40 py-16 text-center">
          <p className="text-sm font-medium text-gray-400">Selecione uma obra para iniciar o apontamento.</p>
        </div>
      ) : employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gold/40 py-16 text-center">
          <p className="text-sm font-medium text-gray-400">Nenhum funcionário alocado nesta obra.</p>
          <p className="mt-1 text-xs text-gray-400">Aloque funcionários na aba Equipe da obra para apontar.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gold/20 bg-cream/30">
                <tr>
                  <th className="sticky left-0 z-10 bg-cream/30 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Funcionário
                  </th>
                  {weekDays.map((d) => (
                    <th key={toKey(d)} className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">
                      <div>{DAYS_ABBR[d.getDay() === 0 ? 6 : d.getDay() - 1]}</div>
                      <div className="text-[11px] font-normal text-gray-400">{String(d.getDate()).padStart(2, '0')}/{String(d.getMonth() + 1).padStart(2, '0')}</div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/10">
                {employees.map((emp) => {
                  const empLogs = weekLogsForEmp(emp.id)
                  const rowDays = empLogs.filter((w) => w.attendance !== 'falta').length
                  const rowCost = empLogs.reduce((s, w) => s + (w.computed_cost ?? 0), 0)
                  return (
                    <tr key={emp.id} className="hover:bg-cream/10 transition-colors align-top">
                      <td className="sticky left-0 z-10 bg-white px-4 py-3">
                        <p className="font-medium text-dark">{emp.name}</p>
                        <p className="text-xs text-gray-400">
                          {emp.role_in_project || emp.role || (emp.employment_type === 'clt' ? 'CLT' : 'Diarista')}
                        </p>
                        {phases.length > 0 && (
                          <select
                            value={rowPhase[emp.id] ?? ''}
                            onChange={(e) => setRowPhaseFor(emp.id, e.target.value)}
                            className="mt-1.5 w-36 rounded-md border border-gold/40 bg-white px-1.5 py-1 text-[11px] text-gray-600 focus:border-terracotta focus:outline-none"
                            title="Fase aplicada às novas marcações desta linha"
                          >
                            <option value="">Sem fase</option>
                            {phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        )}
                      </td>
                      {weekDays.map((d) => {
                        const dateKey = toKey(d)
                        const log = logs.get(`${emp.id}|${dateKey}`)
                        const att = (log?.attendance ?? '') as Attendance | ''
                        return (
                          <td key={dateKey} className="px-2 py-2 text-center">
                            <select
                              value={att}
                              onChange={(e) => setCell(emp, dateKey, e.target.value as Attendance | '')}
                              className={`w-full rounded-md border px-1 py-1 text-xs focus:outline-none ${
                                att === '' ? 'border-gold/30 text-gray-400' : 'border-gold/50 text-dark'
                              }`}
                              title={att ? ATTENDANCE_LABELS[att as Attendance] : 'Sem marcação'}
                            >
                              {ATT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.short}</option>)}
                            </select>
                            {(att === 'presente' || att === 'meio_periodo') && (
                              <input
                                type="number"
                                min={0}
                                max={24}
                                step={0.5}
                                value={log?.hours_worked ?? 0}
                                onChange={(e) => setCellHours(emp, dateKey, Number(e.target.value))}
                                className="mt-1 w-14 rounded-md border border-gold/30 px-1 py-0.5 text-center text-[11px] text-gray-600 focus:border-terracotta focus:outline-none"
                                title="Horas"
                              />
                            )}
                            {log && (log.computed_cost ?? 0) > 0 && (
                              <p className="mt-0.5 text-[10px] text-gray-400 whitespace-nowrap">{formatCurrency(log.computed_cost)}</p>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <p className="font-semibold text-dark">{formatCurrency(rowCost)}</p>
                        <p className="text-[11px] text-gray-400">{rowDays} dia{rowDays !== 1 ? 's' : ''}</p>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t border-gold/20 bg-cream/20">
                <tr>
                  <td className="sticky left-0 z-10 bg-cream/20 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Total da semana
                  </td>
                  <td colSpan={7} />
                  <td className="px-4 py-3 text-right font-bold text-dark whitespace-nowrap">{formatCurrency(grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">
        P = Presente · ½ = Meio período · F = Falta · A = Atestado. As marcações são salvas automaticamente.
      </p>
    </div>
  )
}
