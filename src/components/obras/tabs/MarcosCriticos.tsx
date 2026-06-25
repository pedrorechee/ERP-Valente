'use client'

import { useEffect, useMemo, useState } from 'react'
import { Flag, Plus, CheckCircle, AlertCircle, Clock, Pencil, Trash2, X, Check, RotateCcw, AlertTriangle, Search } from 'lucide-react'
import type { CriticalMilestone, MilestoneStatus } from '@/types/database'
import { formatDate, isOverdue, daysUntil } from '@/lib/format'
import { createMilestone, updateMilestone, completeMilestone, reopenMilestone, deleteMilestone } from '@/app/actions/marcos'
import { toast } from 'sonner'
import { toastAfterClose } from '@/lib/ui-feedback'

interface Props {
  projectId:  string
  milestones: CriticalMilestone[]
}

const INPUT = 'w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta'
const LABEL = 'text-xs font-semibold uppercase tracking-wide text-brown'

type Filter = 'all' | 'pending' | 'completed'

const STATUS_CONFIG: Record<MilestoneStatus, { icon: React.ReactNode; color: string; label: string }> = {
  pending:   { icon: <Clock className="h-4 w-4" />,       color: 'text-gray-500 bg-gray-100',   label: 'Pendente'  },
  completed: { icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-700 bg-green-100', label: 'Concluído' },
  delayed:   { icon: <AlertCircle className="h-4 w-4" />, color: 'text-red-700 bg-red-100',     label: 'Atrasado'  },
}

function getMilestoneStatus(m: CriticalMilestone): MilestoneStatus {
  if (m.status === 'completed') return 'completed'
  if (isOverdue(m.planned_date)) return 'delayed'
  return 'pending'
}

function sortMilestones(milestones: CriticalMilestone[]): CriticalMilestone[] {
  return [...milestones].sort((a, b) => {
    const sA = getMilestoneStatus(a)
    const sB = getMilestoneStatus(b)

    // Concluídos sempre por último
    if (sA === 'completed' && sB !== 'completed') return 1
    if (sA !== 'completed' && sB === 'completed') return -1

    // Atrasados antes de pendentes
    if (sA === 'delayed' && sB === 'pending') return -1
    if (sA === 'pending' && sB === 'delayed') return 1

    // Dentro do mesmo grupo: data planejada crescente
    // (atrasados: mais atrasado primeiro; pendentes: vencendo em breve primeiro)
    return new Date(a.planned_date).getTime() - new Date(b.planned_date).getTime()
  })
}

export function MarcosCriticos({ projectId, milestones }: Props) {
  const [localMilestones,  setLocalMilestones]  = useState(milestones)
  const [showAdd,          setShowAdd]          = useState(false)
  const [editing,          setEditing]          = useState<CriticalMilestone | null>(null)
  const [activeFilter,     setActiveFilter]     = useState<Filter>('all')
  const [search,           setSearch]           = useState('')
  const [completeConfirmId, setCompleteConfirmId] = useState<string | null>(null)
  const [reopenConfirmId,   setReopenConfirmId]   = useState<string | null>(null)
  const [deleteConfirmId,   setDeleteConfirmId]   = useState<string | null>(null)

  // Mantém a lista local em sincronia quando o servidor revalida os dados
  useEffect(() => { setLocalMilestones(milestones) }, [milestones])

  const pendingCount   = localMilestones.filter(m => getMilestoneStatus(m) !== 'completed').length
  const completedCount = localMilestones.filter(m => getMilestoneStatus(m) === 'completed').length

  const searchTerm = search.trim().toLowerCase()

  // Ordenação + filtro recalculados apenas quando dados/filtros mudam
  const filtered = useMemo(() => {
    const sorted = sortMilestones(localMilestones)
    return sorted.filter(m => {
      if (activeFilter === 'pending'   && getMilestoneStatus(m) === 'completed') return false
      if (activeFilter === 'completed' && getMilestoneStatus(m) !== 'completed') return false
      if (searchTerm && !m.description.toLowerCase().includes(searchTerm)) return false
      return true
    })
  }, [localMilestones, activeFilter, searchTerm])

  // Aplica patch otimista em um marco, com rollback se a action falhar
  function patchMilestone(
    id: string,
    patch: Partial<CriticalMilestone>,
    action: () => Promise<{ success: boolean; error?: string }>,
    successMsg: string,
    errorMsg: string,
  ) {
    const original = localMilestones.find((m) => m.id === id)
    setLocalMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
    toastAfterClose(successMsg)

    const run = () =>
      action()
        .then((result) => {
          if (!result.success) throw new Error(result.error)
        })
        .catch(() => {
          if (original) {
            setLocalMilestones((prev) => prev.map((m) => (m.id === id ? original : m)))
          }
          toast.error(errorMsg, {
            action: {
              label: 'Tentar novamente',
              onClick: () => {
                setLocalMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
                run()
              },
            },
          })
        })
    run()
  }

  function confirmComplete() {
    if (!completeConfirmId) return
    const id = completeConfirmId
    setCompleteConfirmId(null)
    patchMilestone(
      id,
      { status: 'completed', actual_date: new Date().toISOString().split('T')[0] },
      () => completeMilestone(id, projectId),
      'Marco concluído',
      'Erro ao concluir marco',
    )
  }

  function handleReopen() {
    if (!reopenConfirmId) return
    const id = reopenConfirmId
    setReopenConfirmId(null)
    patchMilestone(
      id,
      { status: 'pending', actual_date: null },
      () => reopenMilestone(id, projectId),
      'Marco reaberto',
      'Erro ao reabrir marco',
    )
  }

  function confirmDelete() {
    if (!deleteConfirmId) return
    const id = deleteConfirmId
    setDeleteConfirmId(null)
    const removed = localMilestones.find((m) => m.id === id)

    setLocalMilestones((prev) => prev.filter((m) => m.id !== id))
    toastAfterClose('Marco excluído')

    const run = () =>
      deleteMilestone(id, projectId)
        .then((result) => {
          if (!result.success) throw new Error(result.error)
        })
        .catch(() => {
          if (removed) setLocalMilestones((prev) => [...prev, removed])
          toast.error('Erro ao excluir marco', {
            action: {
              label: 'Tentar novamente',
              onClick: () => {
                setLocalMilestones((prev) => prev.filter((m) => m.id !== id))
                run()
              },
            },
          })
        })
    run()
  }

  const FILTERS: { key: Filter; label: string; count?: number }[] = [
    { key: 'all',       label: 'Todos',     count: localMilestones.length },
    { key: 'pending',   label: 'Pendentes', count: pendingCount      },
    { key: 'completed', label: 'Concluídos', count: completedCount   },
  ]

  return (
    <div className="space-y-5">

      {/* Barra superior */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-dark">Marcos Críticos</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-brown transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Marco
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              activeFilter === f.key
                ? 'border-terracotta bg-terracotta text-white'
                : 'border-gold bg-white text-brown hover:bg-cream'
            }`}
          >
            {f.label}
            {f.count !== undefined && f.count > 0 && (
              <span className={`ml-1.5 ${activeFilter === f.key ? 'opacity-80' : 'opacity-60'}`}>
                ({f.count})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar marco..."
          className="w-full rounded-lg border border-gold/50 py-2 pl-9 pr-9 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-dark transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gold/40 py-12 text-center">
          <Flag className="mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-400">
            {localMilestones.length === 0
              ? 'Nenhum marco cadastrado. Marcos são eventos importantes da obra com prazo definido.'
              : searchTerm
                ? `Nenhum marco encontrado para "${search}".`
                : activeFilter === 'pending'
                  ? 'Nenhum marco pendente.'
                  : 'Nenhum marco concluído.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((milestone) => {
            const computedStatus = getMilestoneStatus(milestone)
            const cfg  = STATUS_CONFIG[computedStatus]
            const days = daysUntil(milestone.planned_date)

            return (
              <div
                key={milestone.id}
                className="flex items-start gap-3 rounded-xl border border-gold/30 bg-white p-4 shadow-sm"
              >
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${cfg.color}`}>
                  {cfg.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-dark">{milestone.description}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400">
                    <span>Prazo: {formatDate(milestone.planned_date)}</span>
                    {milestone.actual_date && (
                      <span>Concluído em: {formatDate(milestone.actual_date)}</span>
                    )}
                    {computedStatus === 'pending' && (
                      <span className={`font-medium ${
                        days === 0 ? 'text-red-500' : days < 3 ? 'text-red-500' : days <= 7 ? 'text-orange-500' : 'text-green-600'
                      }`}>
                        {days === 0 ? 'Hoje!' : `Faltam ${days} dia${days !== 1 ? 's' : ''}`}
                      </span>
                    )}
                    {computedStatus === 'delayed' && (
                      <span className="font-medium text-red-500">
                        {Math.abs(days)} dia{Math.abs(days) !== 1 ? 's' : ''} de atraso
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setEditing(milestone)}
                    className="rounded p-1.5 text-brown hover:text-terracotta transition-colors"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>

                  {computedStatus !== 'completed' ? (
                    <button
                      onClick={() => setCompleteConfirmId(milestone.id)}
                      className="rounded p-1.5 text-brown hover:text-[#4A7C59] transition-colors"
                      title="Marcar como concluído"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </button>
                  ) : (
                    /* Ícone de concluído — clicável para reabrir */
                    <div className="relative group">
                      <button
                        onClick={() => setReopenConfirmId(milestone.id)}
                        className="rounded p-1.5 text-green-600 hover:text-orange-500 transition-colors"
                        aria-label="Reabrir Marco"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                      <span className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-800 px-2 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                        Reabrir Marco
                      </span>
                    </div>
                  )}

                  <button
                    onClick={() => setDeleteConfirmId(milestone.id)}
                    className="rounded p-1.5 text-brown hover:text-[#8B3A3A] transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de confirmação — Concluir Marco */}
      {completeConfirmId && (() => {
        const target = localMilestones.find(m => m.id === completeConfirmId)
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setCompleteConfirmId(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <h3 className="mb-1 font-semibold text-dark">Concluir Marco</h3>
              <p className="mb-1 text-sm text-gray-500">
                Deseja marcar este marco como concluído?
              </p>
              {target && (
                <p className="mb-5 rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-dark">
                  {target.description}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={confirmComplete}
                  className="flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-brown disabled:opacity-60 transition-colors"
                >
                  Concluir
                </button>
                <button
                  onClick={() => setCompleteConfirmId(null)}
                  className="rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-dark hover:bg-cream transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal de confirmação — Reabrir Marco */}
      {reopenConfirmId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setReopenConfirmId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-orange-100">
              <RotateCcw className="h-5 w-5 text-orange-600" />
            </div>
            <h3 className="mb-1 font-semibold text-dark">Reabrir Marco</h3>
            <p className="mb-5 text-sm text-gray-500">
              Deseja reabrir este marco? Ele voltará como pendente.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleReopen}
                className="flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-brown disabled:opacity-60 transition-colors"
              >
                Reabrir
              </button>
              <button
                onClick={() => setReopenConfirmId(null)}
                className="rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-dark hover:bg-cream transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação — Excluir Marco */}
      {deleteConfirmId && (() => {
        const target = localMilestones.find(m => m.id === deleteConfirmId)
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setDeleteConfirmId(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="mb-1 font-semibold text-dark">Excluir Marco</h3>
              <p className="mb-1 text-sm text-gray-500">
                Tem certeza que deseja excluir este marco?
              </p>
              {target && (
                <p className="mb-5 rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-dark">
                  {target.description}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={confirmDelete}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
                >
                  Excluir
                </button>
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-dark hover:bg-cream transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal — Novo Marco */}
      {showAdd && (
        <MilestoneModal
          projectId={projectId}
          onClose={() => setShowAdd(false)}
          onOptimistic={(m) => setLocalMilestones((prev) => [...prev, m])}
          onSettled={(tempId, saved) =>
            setLocalMilestones((prev) =>
              saved
                ? prev.map((m) => (m.id === tempId ? saved : m))
                : prev.filter((m) => m.id !== tempId)
            )
          }
        />
      )}

      {/* Modal — Editar Marco */}
      {editing && (
        <MilestoneModal
          key={editing.id}
          projectId={projectId}
          milestone={editing}
          onClose={() => setEditing(null)}
          onOptimistic={(m) => setLocalMilestones((prev) => prev.map((x) => (x.id === m.id ? m : x)))}
          onSettled={(id, saved) =>
            setLocalMilestones((prev) =>
              prev.map((m) => (m.id === id && saved ? saved : m))
            )
          }
          onRollback={(original) =>
            setLocalMilestones((prev) => prev.map((m) => (m.id === original.id ? original : m)))
          }
        />
      )}
    </div>
  )
}

/* ─── Modal unificado (criar / editar) ───────────────────────── */

function MilestoneModal({
  projectId,
  milestone,
  onClose,
  onOptimistic,
  onSettled,
  onRollback,
}: {
  projectId:  string
  milestone?: CriticalMilestone
  onClose:    () => void
  onOptimistic: (m: CriticalMilestone) => void
  onSettled:    (id: string, saved: CriticalMilestone | null) => void
  onRollback?:  (original: CriticalMilestone) => void
}) {
  const isEditing = !!milestone

  function handleSubmit(formData: FormData) {
    // Otimista: o marco entra/atualiza na lista e o modal fecha na hora
    const nowIso = new Date().toISOString()
    const id = milestone?.id ?? `temp-${Date.now()}`
    const optimistic: CriticalMilestone = {
      id,
      project_id: projectId,
      description: formData.get('description') as string,
      planned_date: formData.get('planned_date') as string,
      actual_date: milestone?.actual_date ?? null,
      status: milestone?.status ?? 'pending',
      created_at: milestone?.created_at ?? nowIso,
      updated_at: nowIso,
    }

    onOptimistic(optimistic)
    onClose()
    toastAfterClose(isEditing ? 'Marco atualizado' : 'Marco criado')

    const persist = () => {
      const call = isEditing
        ? updateMilestone(milestone.id, projectId, formData)
        : createMilestone(projectId, formData)
      call
        .then((result) => {
          if (!result.success || !result.milestone) throw new Error(result.error)
          onSettled(id, result.milestone as unknown as CriticalMilestone)
        })
        .catch((err: Error) => {
          if (isEditing && milestone) onRollback?.(milestone)
          else onSettled(id, null)
          toast.error(err.message || (isEditing ? 'Erro ao atualizar marco' : 'Erro ao criar marco'), {
            action: {
              label: 'Tentar novamente',
              onClick: () => { onOptimistic(optimistic); persist() },
            },
          })
        })
    }
    persist()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gold/20 px-6 py-4">
          <h3 className="font-semibold text-dark">
            {isEditing ? 'Editar Marco' : 'Novo Marco Crítico'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-dark transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form action={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className={LABEL}>Descrição *</label>
            <input
              name="description"
              required
              autoFocus
              defaultValue={milestone?.description ?? ''}
              placeholder="Ex: Concretagem da laje do 1º andar"
              className={INPUT}
            />
          </div>

          <div className="space-y-1.5">
            <label className={LABEL}>Prazo Previsto *</label>
            <input
              name="planned_date"
              type="date"
              required
              defaultValue={milestone?.planned_date ?? ''}
              className={INPUT}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg bg-terracotta px-5 py-2 text-sm font-medium text-white hover:bg-brown disabled:opacity-60 transition-colors"
            >
              <Check className="h-4 w-4" />
              {isEditing ? 'Salvar Alterações' : 'Criar Marco'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-dark hover:bg-cream transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
