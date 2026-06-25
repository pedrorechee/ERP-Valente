'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Pencil, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { toastAfterClose } from '@/lib/ui-feedback'
import { formatCurrency, formatDate, formatDocument, formatPhone } from '@/lib/format'
import { costLabel } from '@/lib/equipe'
import { FuncionarioModal } from './FuncionarioModal'
import { allocateEmployee, removeAllocation } from '@/app/actions/equipe'
import {
  ATTENDANCE_LABELS, EMPLOYMENT_TYPE_LABELS,
  type Employee, type ProjectTeam,
} from '@/types/database'
import type { AllocationRow, WorkLogRow, ProjectOption } from '@/app/(dashboard)/equipe/[id]/page'

type Tab = 'dados' | 'obras' | 'apontamentos'

const inputCls =
  'w-full rounded-lg border border-gold/50 bg-white px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta'
const labelCls = 'text-xs font-semibold uppercase tracking-wide text-brown'
const thBase = 'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className={labelCls}>{label}</p>
      <p className="mt-0.5 text-sm text-dark">{value || <span className="text-gray-300">—</span>}</p>
    </div>
  )
}

interface Props {
  employee: Employee
  allocations: AllocationRow[]
  workLogs: WorkLogRow[]
  projects: ProjectOption[]
}

export function FuncionarioDetalhe({ employee, allocations, workLogs, projects }: Props) {
  const [emp, setEmp] = useState<Employee>(employee)
  const [allocs, setAllocs] = useState<AllocationRow[]>(allocations)
  const [tab, setTab] = useState<Tab>('dados')
  const [editing, setEditing] = useState(false)
  const [allocOpen, setAllocOpen] = useState(false)

  // Filtros da aba apontamentos
  const [filterObra, setFilterObra] = useState('')
  const [filterMonth, setFilterMonth] = useState('')

  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
  const summary = useMemo(() => {
    const costThisMonth = workLogs
      .filter((w) => w.log_date.slice(0, 7) === currentMonth)
      .reduce((s, w) => s + (w.computed_cost ?? 0), 0)
    const launched = workLogs
      .filter((w) => w.financial_entry_id)
      .reduce((s, w) => s + (w.computed_cost ?? 0), 0)
    return {
      activeAllocs: allocs.filter((a) => !a.end_date).length,
      costThisMonth,
      daysLogged: workLogs.length,
      launched,
    }
  }, [allocs, workLogs, currentMonth])

  const filteredLogs = useMemo(
    () =>
      workLogs.filter((w) => {
        if (filterObra && w.project_id !== filterObra) return false
        if (filterMonth && w.log_date.slice(0, 7) !== filterMonth) return false
        return true
      }),
    [workLogs, filterObra, filterMonth],
  )

  // Obras disponíveis para alocar: não-alocadas e não canceladas
  const allocatableProjects = useMemo(() => {
    const taken = new Set(allocs.map((a) => a.project_id))
    return projects.filter((p) => !taken.has(p.id) && p.status !== 'cancelled')
  }, [projects, allocs])

  // Obras presentes nos apontamentos (para o filtro)
  const logProjects = useMemo(() => {
    const map = new Map<string, string>()
    workLogs.forEach((w) => { if (w.projects) map.set(w.projects.id, w.projects.name) })
    return [...map.entries()]
  }, [workLogs])

  function handleAllocated(alloc: ProjectTeam) {
    const proj = projects.find((p) => p.id === alloc.project_id) ?? null
    setAllocs((prev) => [{ ...alloc, projects: proj }, ...prev])
  }

  function handleRemove(alloc: AllocationRow) {
    const original = allocs
    setAllocs((prev) => prev.filter((a) => a.id !== alloc.id))
    toastAfterClose('Funcionário desalocado')
    removeAllocation(alloc.id, { projectId: alloc.project_id, employeeId: emp.id })
      .then((r) => { if (!r.success) throw new Error(r.error) })
      .catch((err: Error) => {
        setAllocs(original)
        toast.error(err.message || 'Erro ao desalocar', {
          action: { label: 'Tentar novamente', onClick: () => handleRemove(alloc) },
        })
      })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border border-gold/40 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-dark">{emp.name}</h1>
              <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-medium text-brown">
                {EMPLOYMENT_TYPE_LABELS[emp.employment_type]}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                emp.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {emp.is_active ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
              {emp.role && <span>{emp.role}</span>}
              {emp.document && <span>{formatDocument(emp.document)}</span>}
              {emp.phone && <span>{formatPhone(emp.phone)}</span>}
              {emp.pix_key && <span>PIX: {emp.pix_key}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 rounded-lg border border-gold/50 px-3 py-1.5 text-sm font-medium text-dark hover:bg-cream transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
        </div>
      </div>

      {/* Cards de resumo (sem ícones) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Obras alocadas', value: String(summary.activeAllocs) },
          { label: 'Custo no mês atual', value: formatCurrency(summary.costThisMonth) },
          { label: 'Total apontado (dias)', value: String(summary.daysLogged) },
          { label: 'Total lançado no financeiro', value: formatCurrency(summary.launched) },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-400">{c.label}</p>
            <p className="mt-1 text-xl font-bold text-dark">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-gold/30 bg-cream/30 p-1 w-fit">
        {([
          ['dados', 'Dados cadastrais'],
          ['obras', 'Obras'],
          ['apontamentos', 'Apontamentos'],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-dark shadow-sm' : 'text-gray-500 hover:text-dark'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Aba: Dados cadastrais */}
      {tab === 'dados' && (
        <div className="rounded-xl border border-gold/40 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Tipo de contratação" value={EMPLOYMENT_TYPE_LABELS[emp.employment_type]} />
            <Field label="Custo" value={costLabel(emp, formatCurrency)} />
            <Field label="Função" value={emp.role} />
            <Field label="CPF" value={formatDocument(emp.document)} />
            {emp.employment_type === 'clt' && (
              <>
                <Field label="Dias úteis/mês" value={String(emp.work_days_month)} />
                <Field label="Fator de encargos" value={emp.charge_factor.toFixed(2)} />
              </>
            )}
            <Field label="Telefone" value={formatPhone(emp.phone)} />
            <Field label="Chave PIX" value={emp.pix_key} />
            <Field label="Data de admissão" value={emp.admission_date ? formatDate(emp.admission_date) : null} />
            <Field label="Status" value={emp.is_active ? 'Ativo' : 'Inativo'} />
            <Field label="Cadastrado em" value={formatDate(emp.created_at)} />
          </div>
          {emp.notes && (
            <div className="mt-5 border-t border-gold/20 pt-4">
              <p className={`${labelCls} mb-1`}>Observações</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{emp.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Aba: Obras */}
      {tab === 'obras' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setAllocOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-brown transition-colors"
            >
              <Plus className="h-4 w-4" /> Alocar em obra
            </button>
          </div>

          {allocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gold/40 py-12 text-center">
              <p className="text-sm font-medium text-gray-400">
                Este funcionário não está alocado em nenhuma obra.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gold/20 bg-cream/30">
                    <tr>
                      <th className={`${thBase} text-left`}>Obra</th>
                      <th className={`${thBase} text-left hidden sm:table-cell`}>Função na obra</th>
                      <th className={`${thBase} text-left hidden md:table-cell`}>Período</th>
                      <th className={`${thBase} text-center`}>Situação</th>
                      <th className="px-4 py-3 w-24" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gold/10">
                    {allocs.map((a) => (
                      <tr key={a.id} className="hover:bg-cream/20 transition-colors">
                        <td className="px-4 py-3">
                          {a.projects ? (
                            <Link
                              href={`/obras/${a.projects.id}?tab=equipe`}
                              className="font-medium text-dark hover:text-terracotta transition-colors"
                            >
                              {a.projects.name}
                            </Link>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-left text-gray-600 hidden sm:table-cell">
                          {a.role_in_project || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-left text-gray-500 hidden md:table-cell whitespace-nowrap">
                          {a.start_date ? formatDate(a.start_date) : '—'}
                          {a.end_date ? ` – ${formatDate(a.end_date)}` : ''}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            a.end_date ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'
                          }`}>
                            {a.end_date ? 'Encerrada' : 'Ativo'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemove(a)}
                            className="text-xs font-medium text-gray-500 hover:text-danger transition-colors"
                          >
                            Desalocar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Aba: Apontamentos */}
      {tab === 'apontamentos' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <select value={filterObra} onChange={(e) => setFilterObra(e.target.value)} className={`${inputCls} sm:w-64`}>
              <option value="">Todas as obras</option>
              {logProjects.map(([pid, pname]) => (
                <option key={pid} value={pid}>{pname}</option>
              ))}
            </select>
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className={`${inputCls} sm:w-48`}
            />
          </div>

          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gold/40 py-12 text-center">
              <p className="text-sm font-medium text-gray-400">Nenhum apontamento registrado.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gold/20 bg-cream/30">
                    <tr>
                      <th className={`${thBase} text-left`}>Data</th>
                      <th className={`${thBase} text-left hidden sm:table-cell`}>Obra</th>
                      <th className={`${thBase} text-left hidden md:table-cell`}>Fase</th>
                      <th className={`${thBase} text-center`}>Presença</th>
                      <th className={`${thBase} text-right hidden sm:table-cell`}>Horas</th>
                      <th className={`${thBase} text-right`}>Custo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gold/10">
                    {filteredLogs.map((w) => (
                      <tr key={w.id} className="hover:bg-cream/20 transition-colors">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(w.log_date)}</td>
                        <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{w.projects?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{w.project_phases?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-medium text-brown">
                            {ATTENDANCE_LABELS[w.attendance]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 hidden sm:table-cell">{w.hours_worked}</td>
                        <td className="px-4 py-3 text-right font-semibold text-dark whitespace-nowrap">
                          {formatCurrency(w.computed_cost ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {editing && (
        <FuncionarioModal
          employee={emp}
          onSave={(saved) => setEmp(saved)}
          onClose={() => setEditing(false)}
        />
      )}

      {allocOpen && (
        <AllocateModal
          employeeId={emp.id}
          projects={allocatableProjects}
          onAllocated={handleAllocated}
          onClose={() => setAllocOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Modal de alocação (abertura instantânea) ────────────────
function AllocateModal({
  employeeId, projects, onAllocated, onClose,
}: {
  employeeId: string
  projects: ProjectOption[]
  onAllocated: (alloc: ProjectTeam) => void
  onClose: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [projectId, setProjectId] = useState('')
  const [role, setRole] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [error, setError] = useState(false)

  function persist(input: Parameters<typeof allocateEmployee>[0]) {
    allocateEmployee(input)
      .then((r) => {
        if (!r.success) throw new Error(r.error)
        onAllocated(r.allocation)
      })
      .catch((err: Error) => {
        toast.error(err.message || 'Erro ao alocar funcionário', {
          action: { label: 'Tentar novamente', onClick: () => persist(input) },
        })
      })
  }

  function handleSubmit() {
    if (!projectId) { setError(true); return }
    const input = {
      project_id: projectId,
      employee_id: employeeId,
      role_in_project: role,
      start_date: startDate,
    }
    onClose()
    toastAfterClose('Funcionário alocado')
    persist(input)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gold/20 px-5 py-4">
          <h2 className="text-base font-semibold text-dark">Alocar em obra</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-dark">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className={labelCls}>Obra <span className="text-danger">*</span></label>
            <select
              value={projectId}
              onChange={(e) => { setProjectId(e.target.value); setError(false) }}
              className={inputCls}
            >
              <option value="">Selecionar obra…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {projects.length === 0 && (
              <p className="text-xs text-gray-400">Este funcionário já está alocado em todas as obras disponíveis.</p>
            )}
            {error && <p className="text-xs text-danger">Selecione uma obra.</p>}
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Função na obra</label>
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Opcional" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Data de início</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-dark hover:bg-[#F9F7F4] transition-colors">
              Cancelar
            </button>
            <button type="button" onClick={handleSubmit} className="rounded-lg bg-terracotta px-5 py-2 text-sm font-medium text-white hover:bg-brown transition-colors">
              Alocar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
