'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format'
import {
  computeAutoCost, DEFAULT_STANDARD_HOURS, DEFAULT_OVERTIME_MULTIPLIER,
} from '@/lib/equipe'
import { CurrencyInput } from '@/components/ui/currency-input'
import { upsertWorkLog, deleteWorkLog } from '@/app/actions/equipe'
import { toastAfterClose } from '@/lib/ui-feedback'
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

// Formata horas com vírgula decimal: 2.5 → "2,5"
function fmtHours(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

const ATT_OPTIONS: { value: Attendance | ''; label: string }[] = [
  { value: '', label: '—' },
  { value: 'presente', label: ATTENDANCE_LABELS.presente },
  { value: 'meio_periodo', label: ATTENDANCE_LABELS.meio_periodo },
  { value: 'falta', label: ATTENDANCE_LABELS.falta },
  { value: 'atestado', label: ATTENDANCE_LABELS.atestado },
]

function defaultHours(att: Attendance, std: number): number {
  if (att === 'presente') return std
  if (att === 'meio_periodo') return std / 2
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

  // Célula em edição (modal de ajuste de custo/hora extra)
  const [editCell, setEditCell] = useState<{ emp: GradeEmployee; dateKey: string } | null>(null)

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

  // ── Gravação de uma célula (cria/atualiza/limpa) ──
  type CellPatch = {
    attendance: Attendance | ''
    hours_worked?: number
    standard_hours?: number
    overtime_multiplier?: number
    cost_overridden?: boolean
    manual_cost?: number | null
  }

  function saveCell(emp: GradeEmployee, dateKey: string, patch: CellPatch) {
    const key = `${emp.id}|${dateKey}`
    const existing = logs.get(key)
    const snapshot = new Map(logs)

    // Limpar célula → remover apontamento
    if (!patch.attendance) {
      if (!existing) return
      const next = new Map(logs); next.delete(key); setLogs(next)
      if (String(existing.id).startsWith('temp-')) return
      deleteWorkLog(existing.id, { projectId: selectedObra, employeeId: emp.id })
        .then((r) => { if (!r.success) throw new Error(r.error) })
        .catch((err: Error) => { setLogs(snapshot); toast.error(err.message || 'Erro ao remover apontamento') })
      return
    }

    const attendance = patch.attendance
    const standard_hours = patch.standard_hours ?? existing?.standard_hours ?? DEFAULT_STANDARD_HOURS
    const overtime_multiplier = patch.overtime_multiplier ?? existing?.overtime_multiplier ?? DEFAULT_OVERTIME_MULTIPLIER
    const hours_worked = patch.hours_worked ?? existing?.hours_worked ?? defaultHours(attendance, standard_hours)
    const cost_overridden = patch.cost_overridden ?? existing?.cost_overridden ?? false
    const manual_cost = cost_overridden ? (patch.manual_cost ?? existing?.manual_cost ?? 0) : null
    const phase_id = existing?.phase_id ?? rowPhase[emp.id] ?? null

    const auto = computeAutoCost(emp, { attendance, hours_worked, standard_hours, overtime_multiplier })
    const computed_cost = manual_cost != null ? Math.round(manual_cost * 100) / 100 : auto.cost

    const optimistic: WorkLog = {
      id: existing?.id ?? `temp-${key}`,
      employee_id: emp.id,
      project_id: selectedObra,
      phase_id,
      log_date: dateKey,
      attendance,
      hours_worked,
      standard_hours,
      overtime_hours: auto.overtimeHours,
      overtime_multiplier,
      manual_cost,
      cost_overridden,
      computed_cost,
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
      hours_worked,
      standard_hours,
      overtime_multiplier,
      cost_overridden,
      manual_cost,
    })
      .then((r) => {
        if (!r.success) throw new Error(r.error)
        setLogs((prev) => { const m = new Map(prev); m.set(key, r.workLog); return m })
      })
      .catch((err: Error) => { setLogs(snapshot); toast.error(err.message || 'Erro ao salvar apontamento') })
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
          <Link
            href={`/obras/${selectedObra}?tab=equipe`}
            className="mt-2 text-xs text-terracotta hover:underline"
          >
            Aloque a equipe na aba Equipe da obra →
          </Link>
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
                        const ot = log?.overtime_hours ?? 0
                        const normalH = log ? Math.max(0, (log.hours_worked ?? 0) - ot) : 0
                        return (
                          <td key={dateKey} className="px-2 py-2 text-center">
                            <select
                              value={att}
                              onChange={(e) => saveCell(emp, dateKey, { attendance: e.target.value as Attendance | '' })}
                              className={`w-full min-w-[96px] rounded-md border px-1.5 py-1 text-xs focus:outline-none ${
                                att === '' ? 'border-gold/30 text-gray-400' : 'border-gold/50 text-dark'
                              }`}
                              title={att ? ATTENDANCE_LABELS[att as Attendance] : 'Sem marcação'}
                            >
                              {ATT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            {(att === 'presente' || att === 'meio_periodo') && (
                              <input
                                type="number"
                                min={0}
                                max={24}
                                step={0.5}
                                value={log?.hours_worked ?? 0}
                                onChange={(e) => saveCell(emp, dateKey, { attendance: att, hours_worked: Number(e.target.value) })}
                                className="mt-1 w-16 rounded-md border border-gold/30 px-1 py-0.5 text-center text-[11px] text-gray-600 focus:border-terracotta focus:outline-none"
                                title="Horas trabalhadas"
                              />
                            )}
                            {ot > 0 && (
                              <p className="mt-0.5 text-[10px] text-brown whitespace-nowrap">
                                {fmtHours(normalH)}h + {fmtHours(ot)}h extra
                              </p>
                            )}
                            {log && (log.computed_cost ?? 0) > 0 && (
                              <button
                                type="button"
                                onClick={() => setEditCell({ emp, dateKey })}
                                title={log.cost_overridden ? 'Custo ajustado manualmente — clique para editar' : 'Clique para ajustar custo / hora extra'}
                                className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-terracotta hover:text-brown hover:underline whitespace-nowrap"
                              >
                                {formatCurrency(log.computed_cost)}
                                {log.cost_overridden && <span className="text-[#8A5A3B]" title="Custo ajustado manualmente">*</span>}
                              </button>
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
        As marcações são salvas automaticamente. Clique no valor em terracota para ajustar hora extra ou o custo manualmente.
      </p>

      {editCell && (
        <CellEditModal
          emp={editCell.emp}
          dateKey={editCell.dateKey}
          log={logs.get(`${editCell.emp.id}|${editCell.dateKey}`) ?? null}
          onSave={(patch) => saveCell(editCell.emp, editCell.dateKey, patch)}
          onClose={() => setEditCell(null)}
        />
      )}
    </div>
  )
}

// ── Modal de ajuste do apontamento (hora extra + custo manual) ──
function CellEditModal({
  emp, dateKey, log, onSave, onClose,
}: {
  emp: GradeEmployee
  dateKey: string
  log: WorkLog | null
  onSave: (patch: {
    attendance: Attendance
    hours_worked: number
    standard_hours: number
    overtime_multiplier: number
    cost_overridden: boolean
    manual_cost: number | null
  }) => void
  onClose: () => void
}) {
  const [attendance, setAttendance] = useState<Attendance>((log?.attendance as Attendance) || 'presente')
  const [standardHours, setStandardHours] = useState<number>(log?.standard_hours ?? DEFAULT_STANDARD_HOURS)
  const [hours, setHours] = useState<number>(log?.hours_worked ?? log?.standard_hours ?? DEFAULT_STANDARD_HOURS)
  const [multiplier, setMultiplier] = useState<number>(log?.overtime_multiplier ?? DEFAULT_OVERTIME_MULTIPLIER)
  const [overrideOn, setOverrideOn] = useState<boolean>(log?.cost_overridden ?? false)
  const [manualCost, setManualCost] = useState<number>(log?.manual_cost ?? log?.computed_cost ?? 0)

  const usesHours = attendance === 'presente' || attendance === 'meio_periodo'
  const auto = computeAutoCost(emp, {
    attendance,
    hours_worked: hours,
    standard_hours: standardHours,
    overtime_multiplier: multiplier,
  })
  const normalH = Math.max(0, hours - auto.overtimeHours)
  const finalCost = overrideOn ? manualCost : auto.cost

  function handleSave() {
    onClose()
    toastAfterClose('Apontamento atualizado')
    onSave({
      attendance,
      hours_worked: hours,
      standard_hours: standardHours,
      overtime_multiplier: multiplier,
      cost_overridden: overrideOn,
      manual_cost: overrideOn ? manualCost : null,
    })
  }

  const inputCls = 'w-full rounded-lg border border-gold/50 bg-white px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta'
  const lbl = 'text-xs font-semibold uppercase tracking-wide text-brown'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gold/20 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-dark">Ajustar apontamento</h2>
            <p className="text-xs text-gray-400">{emp.name} · {dateKey.split('-').reverse().join('/')}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-dark">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className={lbl}>Presença</label>
            <select value={attendance} onChange={(e) => setAttendance(e.target.value as Attendance)} className={inputCls}>
              <option value="presente">{ATTENDANCE_LABELS.presente}</option>
              <option value="meio_periodo">{ATTENDANCE_LABELS.meio_periodo}</option>
              <option value="falta">{ATTENDANCE_LABELS.falta}</option>
              <option value="atestado">{ATTENDANCE_LABELS.atestado}</option>
            </select>
          </div>

          {usesHours && (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className={lbl}>Horas</label>
                <input type="number" min={0} max={24} step={0.5} value={hours}
                  onChange={(e) => setHours(Number(e.target.value))} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className={lbl}>Jornada</label>
                <input type="number" min={1} max={24} step={0.5} value={standardHours}
                  onChange={(e) => setStandardHours(Number(e.target.value))} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className={lbl}>Mult. extra</label>
                <input type="number" min={1} step={0.1} value={multiplier}
                  onChange={(e) => setMultiplier(Number(e.target.value))} className={inputCls} />
              </div>
            </div>
          )}

          {/* Resumo do cálculo automático */}
          <div className="rounded-lg border border-gold/30 bg-cream/20 px-3 py-2.5 text-sm">
            {attendance === 'presente' && auto.overtimeHours > 0 ? (
              <p className="text-gray-600">
                {fmtHours(normalH)}h normais + <span className="text-brown font-medium">{fmtHours(auto.overtimeHours)}h extra</span> × {fmtHours(multiplier)}
              </p>
            ) : (
              <p className="text-gray-500">{ATTENDANCE_LABELS[attendance]}</p>
            )}
            <p className="mt-0.5 text-dark">Custo automático: <span className="font-semibold">{formatCurrency(auto.cost)}</span></p>
          </div>

          {/* Override manual */}
          <div className="space-y-2 rounded-lg border border-gold/30 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-dark">Ajustar custo manualmente</span>
              <button
                type="button"
                role="switch"
                aria-checked={overrideOn}
                onClick={() => setOverrideOn((v) => !v)}
                className={`relative h-6 w-11 rounded-full transition-colors ${overrideOn ? 'bg-terracotta' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${overrideOn ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
            {overrideOn && (
              <div className="space-y-2">
                <CurrencyInput name="manual_cost" defaultValue={manualCost} onValueChange={setManualCost} className={inputCls} />
                <button
                  type="button"
                  onClick={() => setOverrideOn(false)}
                  className="text-xs font-medium text-terracotta hover:underline"
                >
                  Recalcular automático
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-gold/20 pt-3">
            <span className="text-sm text-gray-500">Custo final</span>
            <span className="text-base font-bold text-dark">{formatCurrency(finalCost)}</span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-dark hover:bg-[#F9F7F4] transition-colors">
              Cancelar
            </button>
            <button type="button" onClick={handleSave} className="rounded-lg bg-terracotta px-5 py-2 text-sm font-medium text-white hover:bg-brown transition-colors">
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
