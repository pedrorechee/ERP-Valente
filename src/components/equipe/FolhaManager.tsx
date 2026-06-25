'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal'
import { formatCurrency } from '@/lib/format'
import { FINANCIAL_STATUS_LABELS, type FinancialEntryStatus } from '@/types/database'
import { closePayroll, reopenPayroll, type CreatedPayrollEntry } from '@/app/actions/equipe'

export type FolhaProject = { id: string; name: string }
export type PreviewGroup = {
  key: string
  employee_name: string
  project_id: string
  project_name: string
  phase_id: string | null
  phase_name: string | null
  cost: number
  days: number
}
export type ExistingEntry = {
  id: string
  description: string
  amount: number
  status: string
  project_id: string
  project_name: string
  phase_name: string | null
}

const selectCls =
  'rounded-lg border border-gold/50 bg-white px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta'
const labelCls = 'text-xs font-semibold uppercase tracking-wide text-brown'
const thBase = 'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400'

interface Props {
  mes: string
  periodStart: string
  periodEnd: string
  projects: FolhaProject[]
  groups: PreviewGroup[]
  existing: ExistingEntry[]
}

export function FolhaManager({ mes, periodStart, periodEnd, projects, groups, existing }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [obra, setObra] = useState('')
  const [status, setStatus] = useState<'pendente' | 'pago'>('pendente')
  const [generating, setGenerating] = useState(false)
  const [localGroups, setLocalGroups] = useState<PreviewGroup[]>(groups)
  const [localExisting, setLocalExisting] = useState<ExistingEntry[]>(existing)
  const [estornoId, setEstornoId] = useState<string | null>(null)

  const filteredGroups = useMemo(
    () => (obra ? localGroups.filter((g) => g.project_id === obra) : localGroups),
    [localGroups, obra],
  )
  const filteredExisting = useMemo(
    () => (obra ? localExisting.filter((e) => e.project_id === obra) : localExisting),
    [localExisting, obra],
  )
  const previewTotal = filteredGroups.reduce((s, g) => s + g.cost, 0)

  function changeMes(value: string) {
    startTransition(() => router.push(`/equipe/folha?mes=${value}`))
  }

  function handleGenerate() {
    if (filteredGroups.length === 0) {
      toast.error('Nenhum apontamento pendente de lançamento neste período.')
      return
    }
    const projectId = obra || null
    const today = new Date().toISOString().slice(0, 10)
    setGenerating(true)
    closePayroll({
      period_start: periodStart,
      period_end: periodEnd,
      project_id: projectId,
      status,
      payment_date: status === 'pago' ? today : null,
    })
      .then((r) => {
        if (!r.success) throw new Error(r.error)
        // Remove os grupos lançados da prévia
        setLocalGroups((prev) => (projectId ? prev.filter((g) => g.project_id !== projectId) : []))
        // Adiciona os lançamentos gerados à lista de gerados
        setLocalExisting((prev) => [
          ...r.created.map((c: CreatedPayrollEntry) => ({
            id: c.id,
            description: c.description,
            amount: c.amount,
            status: c.status,
            project_id: c.project_id,
            project_name: c.project_name,
            phase_name: c.phase_name,
          })),
          ...prev,
        ])
        toast.success(
          r.created.length > 0
            ? `${r.created.length} lançamento${r.created.length !== 1 ? 's' : ''} gerado${r.created.length !== 1 ? 's' : ''} — ${formatCurrency(r.total)}`
            : 'Nenhum lançamento gerado (apenas faltas no período).',
        )
      })
      .catch((err: Error) => {
        toast.error(err.message || 'Erro ao gerar lançamentos')
      })
      .finally(() => setGenerating(false))
  }

  function confirmEstorno() {
    if (!estornoId) return
    const id = estornoId
    const entry = localExisting.find((e) => e.id === id)
    setEstornoId(null)
    setLocalExisting((prev) => prev.filter((e) => e.id !== id))
    reopenPayroll(id, entry?.project_id ?? null)
      .then((r) => {
        if (!r.success) throw new Error(r.error)
        toast.success('Folha estornada. Os apontamentos voltaram a ficar pendentes.')
      })
      .catch((err: Error) => {
        if (entry) setLocalExisting((prev) => [entry, ...prev])
        toast.error(err.message || 'Erro ao estornar folha', {
          action: { label: 'Tentar novamente', onClick: () => setEstornoId(id) },
        })
      })
  }

  return (
    <div className="space-y-5">
      {/* Controles */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gold/30 bg-white p-4 shadow-sm">
        <div className="space-y-1.5">
          <label className={labelCls}>Período (mês)</label>
          <div className="flex items-center gap-2">
            <input type="month" value={mes} onChange={(e) => changeMes(e.target.value)} className={selectCls} />
            {isPending && <Loader2 className="h-4 w-4 animate-spin text-terracotta" />}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Obra</label>
          <select value={obra} onChange={(e) => setObra(e.target.value)} className={`${selectCls} w-56`}>
            <option value="">Todas as obras</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Situação do lançamento</label>
          <div className="flex gap-1 rounded-lg border border-gold/40 bg-cream/30 p-1">
            {(['pendente', 'pago'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  status === s ? 'bg-white text-dark shadow-sm' : 'text-gray-500 hover:text-dark'
                }`}
              >
                {s === 'pendente' ? 'A pagar' : 'Pago'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Prévia */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-dark">Prévia — apontamentos pendentes de lançamento</h2>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || filteredGroups.length === 0}
            className="flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-brown transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating && <Loader2 className="h-4 w-4 animate-spin" />}
            Gerar lançamentos no Financeiro
          </button>
        </div>

        {filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gold/40 py-12 text-center">
            <p className="text-sm font-medium text-gray-400">Nenhum apontamento pendente neste período.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gold/20 bg-cream/30">
                  <tr>
                    <th className={`${thBase} text-left`}>Funcionário</th>
                    <th className={`${thBase} text-left`}>Obra</th>
                    <th className={`${thBase} text-left hidden sm:table-cell`}>Fase</th>
                    <th className={`${thBase} text-center`}>Dias</th>
                    <th className={`${thBase} text-right`}>Custo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold/10">
                  {filteredGroups.map((g) => (
                    <tr key={g.key} className="hover:bg-cream/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-dark">{g.employee_name}</td>
                      <td className="px-4 py-3 text-gray-600">{g.project_name}</td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                        {g.phase_name || <span className="text-gray-300">Sem fase</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{g.days}</td>
                      <td className="px-4 py-3 text-right font-semibold text-dark whitespace-nowrap">
                        {formatCurrency(g.cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-gold/20 bg-cream/20">
                  <tr>
                    <td colSpan={4} className={`${thBase} text-left`}>Total do período</td>
                    <td className="px-4 py-3 text-right font-bold text-dark whitespace-nowrap">{formatCurrency(previewTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Lançamentos gerados (estorno) */}
      {filteredExisting.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-dark">Folhas lançadas neste período</h2>
          <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gold/20 bg-cream/30">
                  <tr>
                    <th className={`${thBase} text-left`}>Descrição</th>
                    <th className={`${thBase} text-left hidden sm:table-cell`}>Obra</th>
                    <th className={`${thBase} text-left hidden md:table-cell`}>Fase</th>
                    <th className={`${thBase} text-center`}>Situação</th>
                    <th className={`${thBase} text-right`}>Valor</th>
                    <th className="px-4 py-3 w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold/10">
                  {filteredExisting.map((e) => (
                    <tr key={e.id} className="hover:bg-cream/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-dark">{e.description}</td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{e.project_name}</td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                        {e.phase_name || <span className="text-gray-300">Sem fase</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          e.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {FINANCIAL_STATUS_LABELS[e.status as FinancialEntryStatus] ?? e.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-dark whitespace-nowrap">{formatCurrency(e.amount)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setEstornoId(e.id)}
                          className="text-xs font-medium text-gray-500 hover:text-danger transition-colors"
                        >
                          Estornar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={!!estornoId}
        title="Estornar folha"
        message="O lançamento será excluído do Financeiro e os apontamentos voltarão a ficar pendentes. Deseja continuar?"
        onConfirm={confirmEstorno}
        onCancel={() => setEstornoId(null)}
      />
    </div>
  )
}
