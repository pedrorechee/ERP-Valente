'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, X, ClipboardList } from 'lucide-react'
import { toast } from 'sonner'
import { toastAfterClose } from '@/lib/ui-feedback'
import { formatCurrency, formatDate } from '@/lib/format'
import { allocateEmployee, removeAllocation } from '@/app/actions/equipe'
import { EMPLOYMENT_TYPE_LABELS, type ProjectTeam, type EmploymentType } from '@/types/database'

export type EmployeeMini = {
  id: string
  name: string
  role: string | null
  employment_type: EmploymentType
  monthly_salary: number
  daily_rate: number
  is_active?: boolean
}
export type TeamMemberRow = ProjectTeam & { employees: EmployeeMini | null }

const inputCls =
  'w-full rounded-lg border border-gold/50 bg-white px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta'
const labelCls = 'text-xs font-semibold uppercase tracking-wide text-brown'
const thBase = 'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400'

interface Props {
  projectId: string
  team: TeamMemberRow[]
  costByEmployee: Record<string, { cost: number; days: number }>
  activeEmployees: EmployeeMini[]
  summary: { cost: number; launched: number; days: number }
  canManage: boolean
}

export function EquipeObra({ projectId, team, costByEmployee, activeEmployees, summary, canManage }: Props) {
  const [allocs, setAllocs] = useState<TeamMemberRow[]>(team)
  const [allocOpen, setAllocOpen] = useState(false)

  const available = useMemo(() => {
    const taken = new Set(allocs.map((a) => a.employee_id))
    return activeEmployees.filter((e) => !taken.has(e.id))
  }, [allocs, activeEmployees])

  const activeCount = allocs.filter((a) => !a.end_date).length

  function handleAllocated(alloc: ProjectTeam, employee: EmployeeMini) {
    setAllocs((prev) => [{ ...alloc, employees: employee }, ...prev])
  }

  function handleRemove(alloc: TeamMemberRow) {
    const original = allocs
    setAllocs((prev) => prev.filter((a) => a.id !== alloc.id))
    toastAfterClose('Funcionário desalocado')
    removeAllocation(alloc.id, { projectId, employeeId: alloc.employee_id })
      .then((r) => { if (!r.success) throw new Error(r.error) })
      .catch((err: Error) => {
        setAllocs(original)
        toast.error(err.message || 'Erro ao desalocar', {
          action: { label: 'Tentar novamente', onClick: () => handleRemove(alloc) },
        })
      })
  }

  return (
    <div className="space-y-4">
      {/* Cards de resumo (sem ícones) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Funcionários alocados', value: String(activeCount) },
          { label: 'Custo MO própria acumulado', value: formatCurrency(summary.cost) },
          { label: 'Total lançado no financeiro', value: formatCurrency(summary.launched) },
          { label: 'Dias apontados', value: String(summary.days) },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-400">{c.label}</p>
            <p className="mt-1 text-xl font-bold text-dark">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Ações */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href={`/equipe/apontamento?obra=${projectId}`}
          className="flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-brown transition-colors"
        >
          <ClipboardList className="h-4 w-4" /> Apontar
        </Link>
        {canManage && (
          <button
            type="button"
            onClick={() => setAllocOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-dark hover:bg-cream transition-colors"
          >
            <Plus className="h-4 w-4" /> Alocar funcionário
          </button>
        )}
      </div>

      {/* Tabela / vazio */}
      {allocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gold/40 py-12 text-center">
          <p className="text-sm font-medium text-gray-400">
            Nenhum funcionário alocado nesta obra.
          </p>
          {canManage && (
            <button
              type="button"
              onClick={() => setAllocOpen(true)}
              className="mt-3 text-xs text-terracotta hover:underline"
            >
              Clique em Alocar funcionário para começar
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gold/20 bg-cream/30">
                <tr>
                  <th className={`${thBase} text-left`}>Nome</th>
                  <th className={`${thBase} text-left hidden sm:table-cell`}>Função na obra</th>
                  <th className={`${thBase} text-center`}>Tipo</th>
                  <th className={`${thBase} text-left hidden md:table-cell`}>Período</th>
                  <th className={`${thBase} text-right`}>Custo no período</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/10">
                {allocs.map((a) => (
                  <tr key={a.id} className="hover:bg-cream/20 transition-colors">
                    <td className="px-4 py-3">
                      {a.employees ? (
                        <Link
                          href={`/equipe/${a.employee_id}`}
                          className="font-medium text-dark hover:text-terracotta transition-colors"
                        >
                          {a.employees.name}
                        </Link>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-left text-gray-600 hidden sm:table-cell">
                      {a.role_in_project || a.employees?.role || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {a.employees && (
                        <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-medium text-brown">
                          {EMPLOYMENT_TYPE_LABELS[a.employees.employment_type]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-left text-gray-500 hidden md:table-cell whitespace-nowrap">
                      {a.start_date ? formatDate(a.start_date) : '—'}
                      {a.end_date ? ` – ${formatDate(a.end_date)}` : ''}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-dark whitespace-nowrap">
                      {formatCurrency(costByEmployee[a.employee_id]?.cost ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleRemove(a)}
                          className="text-xs font-medium text-gray-500 hover:text-danger transition-colors"
                        >
                          Desalocar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {allocOpen && (
        <AllocateEmployeeModal
          projectId={projectId}
          employees={available}
          onAllocated={handleAllocated}
          onClose={() => setAllocOpen(false)}
        />
      )}
    </div>
  )
}

function AllocateEmployeeModal({
  projectId, employees, onAllocated, onClose,
}: {
  projectId: string
  employees: EmployeeMini[]
  onAllocated: (alloc: ProjectTeam, employee: EmployeeMini) => void
  onClose: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [employeeId, setEmployeeId] = useState('')
  const [role, setRole] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [error, setError] = useState(false)

  function persist(input: Parameters<typeof allocateEmployee>[0], employee: EmployeeMini) {
    allocateEmployee(input)
      .then((r) => {
        if (!r.success) throw new Error(r.error)
        onAllocated(r.allocation, employee)
      })
      .catch((err: Error) => {
        toast.error(err.message || 'Erro ao alocar funcionário', {
          action: { label: 'Tentar novamente', onClick: () => persist(input, employee) },
        })
      })
  }

  function handleSubmit() {
    const employee = employees.find((e) => e.id === employeeId)
    if (!employee) { setError(true); return }
    const input = {
      project_id: projectId,
      employee_id: employeeId,
      role_in_project: role,
      start_date: startDate,
    }
    onClose()
    toastAfterClose('Funcionário alocado')
    persist(input, employee)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gold/20 px-5 py-4">
          <h2 className="text-base font-semibold text-dark">Alocar funcionário</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-dark">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className={labelCls}>Funcionário <span className="text-danger">*</span></label>
            <select
              value={employeeId}
              onChange={(e) => { setEmployeeId(e.target.value); setError(false) }}
              className={inputCls}
            >
              <option value="">Selecionar funcionário…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}{e.role ? ` — ${e.role}` : ''}
                </option>
              ))}
            </select>
            {employees.length === 0 && (
              <p className="text-xs text-gray-400">Todos os funcionários ativos já estão alocados nesta obra.</p>
            )}
            {error && <p className="text-xs text-danger">Selecione um funcionário.</p>}
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
