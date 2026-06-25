'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Check, Trash2, Pencil, X, AlertTriangle, CheckCircle } from 'lucide-react'
import type { ProjectPhase, PhaseTask, PhaseStatus } from '@/types/database'
import { PHASE_STATUS_LABELS } from '@/types/database'
import { formatDate } from '@/lib/format'
import { updatePhaseProgress, updatePhase, createPhase, deletePhase } from '@/app/actions/fases'
import { createTask, toggleTask, updateTask, deleteTask, completeLastTask } from '@/app/actions/tarefas'
import { toast } from 'sonner'
import { toastAfterClose } from '@/lib/ui-feedback'

interface Props {
  projectId: string
  phases: (ProjectPhase & { phase_tasks: PhaseTask[] })[]
}

const STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress:  'bg-blue-100 text-blue-700',
  completed:    'bg-green-100 text-green-700',
  delayed:      'bg-red-100 text-red-700',
}

function calcPhaseStatus(tasks: PhaseTask[], expectedEnd?: string | null): { progress: number; status: PhaseStatus } {
  const total = tasks.length
  const done = tasks.filter((t) => t.completed).length
  if (total === 0) return { progress: 0, status: 'not_started' }
  if (done === total) return { progress: 100, status: 'completed' }
  const progress = Math.round((done / total) * 100)
  const today = new Date().toISOString().split('T')[0]
  const delayed = expectedEnd != null && expectedEnd < today
  return { progress, status: delayed ? 'delayed' : 'in_progress' }
}

function dateDiffDays(isoFrom: string, isoTo: string): number {
  return Math.round(
    (new Date(isoTo + 'T00:00:00Z').getTime() - new Date(isoFrom + 'T00:00:00Z').getTime()) /
    86400000
  )
}

function phasePerf(actualEnd: string, expectedEnd: string): { text: string; color: string } {
  const diff = dateDiffDays(expectedEnd, actualEnd)
  const abs = Math.abs(diff)
  const dias = (n: number) => `${n} dia${n !== 1 ? 's' : ''}`
  if (diff < 0) return { text: `✓ ${dias(abs)} antes do prazo`, color: '#4A7C59' }
  if (diff === 0) return { text: '✓ Concluída no prazo', color: '#4A7C59' }
  if (diff <= 7) return { text: `⚠ ${dias(diff)} de atraso`, color: '#C68B59' }
  return { text: `✗ ${dias(diff)} de atraso`, color: '#8B3A3A' }
}

const INPUT = 'w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-terracotta'



type PhaseCompleteModal = {
  phaseId:       string
  phaseName:     string
  expectedStart: string | null
  mode:          'button' | 'lastTask'
  taskId?:       string
  date:          string
  dateError?:    string
}

export function FasesETarefas({ projectId, phases: initialPhases }: Props) {
  const [phases, setPhases] = useState(initialPhases)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [addingPhase, setAddingPhase] = useState(false)
  const [addingTaskFor, setAddingTaskFor] = useState<string | null>(null)
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [deleteConfirmPhaseId,   setDeleteConfirmPhaseId]   = useState<string | null>(null)
  const [deleteConfirmTask,      setDeleteConfirmTask]      = useState<{ taskId: string; phaseId: string } | null>(null)
  const [incompletePhaseId,      setIncompletePhaseId]      = useState<string | null>(null)
  const [phaseCompleteModal,     setPhaseCompleteModal]     = useState<PhaseCompleteModal | null>(null)

  function toggleExpand(phaseId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(phaseId) ? next.delete(phaseId) : next.add(phaseId)
      return next
    })
  }

  // Aplica o toggle de uma tarefa no estado local, recalculando a fase
  function applyTaskToggle(taskId: string, phaseId: string, completed: boolean) {
    setPhases((prev) =>
      prev.map((p) => {
        if (p.id !== phaseId) return p
        const newTasks = p.phase_tasks.map((t) => (t.id === taskId ? { ...t, completed } : t))
        const calc = calcPhaseStatus(newTasks, p.expected_end)
        return {
          ...p,
          phase_tasks: newTasks,
          ...calc,
          actual_end: calc.status === 'completed' ? p.actual_end : null,
        }
      })
    )
  }

  function handleToggleTask(taskId: string, phaseId: string, completed: boolean) {
    // Se é a última tarefa sendo concluída, pedir data antes de salvar
    if (completed) {
      const phase = phases.find(p => p.id === phaseId)
      if (phase && phase.status !== 'completed') {
        const otherPending = phase.phase_tasks.filter(t => !t.completed && t.id !== taskId)
        if (otherPending.length === 0 && phase.phase_tasks.length > 0) {
          setPhaseCompleteModal({
            phaseId,
            phaseName:     phase.name,
            expectedStart: phase.expected_start,
            mode:          'lastTask',
            taskId,
            date:          new Date().toISOString().split('T')[0],
          })
          return
        }
      }
    }

    // Caminho normal: otimista + rollback
    applyTaskToggle(taskId, phaseId, completed)
    toggleTask(taskId, projectId, completed)
      .then((result) => {
        if (!result.success) throw new Error(result.error)
      })
      .catch(() => {
        applyTaskToggle(taskId, phaseId, !completed)
        toast.error('Erro ao atualizar tarefa', {
          action: { label: 'Tentar novamente', onClick: () => handleToggleTask(taskId, phaseId, completed) },
        })
      })
  }

  function handleDeleteTask(taskId: string, phaseId: string) {
    const phase = phases.find((p) => p.id === phaseId)
    const index = phase?.phase_tasks.findIndex((t) => t.id === taskId) ?? -1
    const removed = phase?.phase_tasks[index]

    setPhases((prev) =>
      prev.map((p) => {
        if (p.id !== phaseId) return p
        const newTasks = p.phase_tasks.filter((t) => t.id !== taskId)
        return { ...p, phase_tasks: newTasks, ...calcPhaseStatus(newTasks, p.expected_end) }
      })
    )

    deleteTask(taskId, projectId)
      .then((result) => {
        if (!result.success) throw new Error(result.error)
      })
      .catch(() => {
        if (removed) {
          setPhases((prev) =>
            prev.map((p) => {
              if (p.id !== phaseId) return p
              const newTasks = [...p.phase_tasks]
              newTasks.splice(Math.min(index, newTasks.length), 0, removed)
              return { ...p, phase_tasks: newTasks, ...calcPhaseStatus(newTasks) }
            })
          )
        }
        toast.error('Erro ao excluir tarefa', {
          action: { label: 'Tentar novamente', onClick: () => handleDeleteTask(taskId, phaseId) },
        })
      })
  }

  function handleMarkPhaseComplete(phaseId: string, complete: boolean) {
    const phase = phases.find(p => p.id === phaseId)
    if (complete) {
      const pending = (phase?.phase_tasks ?? []).filter(t => !t.completed)
      if (pending.length > 0) {
        setIncompletePhaseId(phaseId)
        return
      }
      // Pede data antes de salvar
      setPhaseCompleteModal({
        phaseId,
        phaseName:     phase!.name,
        expectedStart: phase!.expected_start,
        mode:          'button',
        date:          new Date().toISOString().split('T')[0],
      })
      return
    }

    // Desmarcar conclusão — caminho inalterado
    const previous = phase ? { status: phase.status, progress: phase.progress, actual_end: phase.actual_end } : null
    const newCalc = calcPhaseStatus(phase?.phase_tasks ?? [], phase?.expected_end)
    setPhases((prev) => prev.map((p) => (p.id === phaseId ? { ...p, ...newCalc, actual_end: null } : p)))

    updatePhaseProgress(phaseId, projectId, newCalc.progress)
      .then((result) => {
        if (!result.success) throw new Error(result.error)
      })
      .catch(() => {
        if (previous) {
          setPhases((prev) => prev.map((p) => (p.id === phaseId ? { ...p, ...previous } : p)))
        }
        toast.error('Erro ao atualizar fase', {
          action: { label: 'Tentar novamente', onClick: () => handleMarkPhaseComplete(phaseId, complete) },
        })
      })
  }

  function performDeletePhase(phaseId: string, index: number, removed?: ProjectPhase & { phase_tasks: PhaseTask[] }) {
    setPhases((prev) => prev.filter((p) => p.id !== phaseId))

    deletePhase(phaseId, projectId)
      .then((result) => {
        if (!result.success) throw new Error(result.error)
      })
      .catch(() => {
        if (removed) {
          setPhases((prev) => {
            const next = [...prev]
            next.splice(Math.min(index, next.length), 0, removed)
            return next
          })
        }
        toast.error('Erro ao excluir fase', {
          action: { label: 'Tentar novamente', onClick: () => performDeletePhase(phaseId, index, removed) },
        })
      })
  }

  function confirmDeletePhase() {
    if (!deleteConfirmPhaseId) return
    const phaseId = deleteConfirmPhaseId
    const index = phases.findIndex((p) => p.id === phaseId)
    const removed = phases[index]
    setDeleteConfirmPhaseId(null)
    performDeletePhase(phaseId, index, removed)
  }

  function handleConfirmPhaseComplete() {
    if (!phaseCompleteModal) return
    const { phaseId, phaseName, expectedStart, mode, taskId, date } = phaseCompleteModal

    const today = new Date().toISOString().split('T')[0]
    if (date > today) {
      setPhaseCompleteModal(prev => prev ? { ...prev, dateError: 'A data não pode ser futura' } : null)
      return
    }
    if (expectedStart && date < expectedStart) {
      const [y, m, d] = expectedStart.split('-')
      setPhaseCompleteModal(prev => prev ? { ...prev, dateError: `A data não pode ser anterior ao início previsto (${d}/${m}/${y})` } : null)
      return
    }

    setPhaseCompleteModal(null)

    const prevPhase = phases.find(p => p.id === phaseId)
    const optimistic = { progress: 100, status: 'completed' as PhaseStatus, actual_end: date }

    if (mode === 'lastTask' && taskId) {
      setPhases(prev => prev.map(p => {
        if (p.id !== phaseId) return p
        const newTasks = p.phase_tasks.map(t =>
          t.id === taskId ? { ...t, completed: true, completed_at: new Date().toISOString() } : t
        )
        return { ...p, phase_tasks: newTasks, ...optimistic }
      }))

      const run = () =>
        completeLastTask(taskId, phaseId, projectId, date)
          .then(r => { if (!r.success) throw new Error(r.error) })
          .catch(() => {
            if (prevPhase) setPhases(prev => prev.map(p => p.id === phaseId ? prevPhase : p))
            toast.error('Erro ao concluir fase', {
              action: {
                label: 'Tentar novamente',
                onClick: () => { setPhases(prev => prev.map(p => p.id === phaseId ? { ...p, ...optimistic } : p)); run() },
              },
            })
          })
      run()
    } else {
      const prevState = prevPhase
        ? { status: prevPhase.status, progress: prevPhase.progress, actual_end: prevPhase.actual_end }
        : null
      setPhases(prev => prev.map(p => p.id === phaseId ? { ...p, ...optimistic } : p))

      const run = () =>
        updatePhaseProgress(phaseId, projectId, 100, date)
          .then(r => { if (!r.success) throw new Error(r.error) })
          .catch(() => {
            if (prevState) setPhases(prev => prev.map(p => p.id === phaseId ? { ...p, ...prevState } : p))
            toast.error('Erro ao concluir fase', {
              action: {
                label: 'Tentar novamente',
                onClick: () => { setPhases(prev => prev.map(p => p.id === phaseId ? { ...p, ...optimistic } : p)); run() },
              },
            })
          })
      run()
    }

    const fmt = date.split('-').reverse().join('/')
    toastAfterClose(`Fase '${phaseName}' concluída em ${fmt}`)
  }

  // Dados para os modais de tarefa
  const addingPhaseData = phases.find((p) => p.id === addingTaskFor) ?? null
  const editingTaskPhase = phases.find((p) => p.phase_tasks.some((t) => t.id === editingTaskId)) ?? null
  const editingTask = editingTaskPhase?.phase_tasks.find((t) => t.id === editingTaskId) ?? null

  return (
    <div className="space-y-4">
      {/* Lista de fases */}
      {phases.map((phase) => {
        const tasks = phase.phase_tasks ?? []
        const isOpen = expanded.has(phase.id)
        const completedCount = tasks.filter((t) => t.completed).length

        const pendingTasks    = tasks.filter(t => !t.completed)
        const hasPending      = pendingTasks.length > 0
        const canComplete     = phase.status !== 'completed' && !hasPending
        const blockedComplete = phase.status !== 'completed' && hasPending && tasks.length > 0

        return (
          <div
            key={phase.id}
            className="rounded-xl border border-gold/40 bg-white shadow-sm overflow-hidden"
          >
            {/* Header da fase */}
            <div
              className="flex cursor-pointer items-center gap-3 p-4 hover:bg-cream/30 transition-colors"
              onClick={() => toggleExpand(phase.id)}
            >
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-dark">{phase.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[phase.status]}`}>
                    {PHASE_STATUS_LABELS[phase.status]}
                  </span>
                  {tasks.length > 0 && (
                    <span className="text-xs text-gray-400">
                      {completedCount}/{tasks.length} tarefas
                    </span>
                  )}
                </div>
                {phase.expected_end && (
                  <div className="mt-0.5">
                    <p className="text-xs text-gray-400">
                      Previsto até {formatDate(phase.expected_end)}
                      {phase.status === 'completed' && phase.actual_end && (() => {
                        const perf = phasePerf(phase.actual_end, phase.expected_end!)
                        return (
                          <>
                            <span style={{ color: 'rgba(138,90,59,0.4)' }}> · </span>
                            <span style={{ color: '#4A7C59' }}>Concluída em {formatDate(phase.actual_end)}</span>
                            <span style={{ color: 'rgba(138,90,59,0.4)' }}> · </span>
                            <span style={{ color: perf.color }}>{perf.text}</span>
                          </>
                        )
                      })()}
                    </p>
                    {phase.status === 'completed' && phase.actual_end && phase.expected_start && (() => {
                      const dur = dateDiffDays(phase.expected_start, phase.actual_end)
                      return (
                        <p className="text-xs" style={{ color: 'rgba(138,90,59,0.7)' }}>
                          Duração: {dur} dia{dur !== 1 ? 's' : ''} (de {formatDate(phase.expected_start)} a {formatDate(phase.actual_end)})
                        </p>
                      )
                    })()}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                <span className="w-8 text-right text-sm font-semibold text-dark">
                  {phase.progress}%
                </span>
                <div className="flex items-center gap-0.5">
                  {/* Botão concluir fase */}
                  {phase.status !== 'completed' && (
                    <div className="relative group/complete">
                      <button
                        onClick={() => handleMarkPhaseComplete(phase.id, true)}
                        className={`rounded p-1 transition-colors ${
                          blockedComplete
                            ? 'text-brown opacity-40 cursor-pointer'
                            : 'text-brown hover:text-[#4A7C59]'
                        }`}
                        title={blockedComplete ? undefined : 'Marcar como concluída'}
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                      </button>
                      {blockedComplete && (
                        <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 w-max max-w-[180px] rounded-md bg-gray-800 px-2 py-1 text-[11px] leading-snug text-white opacity-0 transition-opacity group-hover/complete:opacity-100 z-10">
                          {pendingTasks.length} tarefa{pendingTasks.length !== 1 ? 's' : ''} pendente{pendingTasks.length !== 1 ? 's' : ''} para concluir esta fase
                        </span>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => setEditingPhaseId(phase.id)}
                    className="rounded p-1 text-brown hover:text-terracotta transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmPhaseId(phase.id)}
                    className="rounded p-1 text-brown hover:text-[#8B3A3A] transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Tarefas */}
            {isOpen && (
              <div className="border-t border-gold/20 p-4 space-y-2">
                {tasks.length === 0 ? (
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-gray-400">Nenhuma tarefa nesta fase.</p>
                    {addingTaskFor !== phase.id && (
                      phase.status !== 'completed' ? (
                        <button
                          onClick={() => handleMarkPhaseComplete(phase.id, true)}
                          className="text-xs font-medium text-green-600 hover:text-green-700 transition-colors"
                        >
                          Marcar como concluída
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMarkPhaseComplete(phase.id, false)}
                          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          Desmarcar
                        </button>
                      )
                    )}
                  </div>
                ) : (
                  tasks.map((task) => (
                    <div key={task.id} className="flex items-start gap-2.5">
                      <button
                        onClick={() => handleToggleTask(task.id, phase.id, !task.completed)}
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          task.completed
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-300 hover:border-terracotta'
                        }`}
                      >
                        {task.completed && <Check className="h-3 w-3" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${task.completed ? 'line-through text-gray-400' : 'text-dark'}`}>
                          {task.description}
                        </p>
                        {(task.responsible || task.due_date) && (
                          <p className="text-xs text-gray-400">
                            {task.responsible && <span>{task.responsible}</span>}
                            {task.responsible && task.due_date && <span> · </span>}
                            {task.due_date && <span>até {formatDate(task.due_date)}</span>}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          onClick={() => setEditingTaskId(task.id)}
                          className="rounded p-1 text-brown hover:text-terracotta transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmTask({ taskId: task.id, phaseId: phase.id })}
                          className="rounded p-1 text-brown hover:text-[#8B3A3A] transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}

                <button
                  onClick={() => setAddingTaskFor(phase.id)}
                  className="flex items-center gap-1.5 text-xs text-terracotta hover:text-brown transition-colors mt-2"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar tarefa
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* Botão adicionar fase */}
      <button
        onClick={() => setAddingPhase(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-terracotta py-3 text-sm font-semibold text-brown hover:bg-cream/30 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Adicionar fase
      </button>

      {/* Modal — Nova Tarefa */}
      {addingTaskFor && addingPhaseData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setAddingTaskFor(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gold/20 px-6 py-4">
              <div>
                <p className="text-xs text-gray-400">Nova Tarefa</p>
                <h3 className="font-semibold text-dark">{addingPhaseData.name}</h3>
              </div>
              <button
                onClick={() => setAddingTaskFor(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-dark transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              action={(fd) => {
                // Otimista: tarefa entra na lista e o modal fecha na hora
                const phaseId = addingPhaseData.id
                const tempId = `temp-${Date.now()}`
                const nowIso = new Date().toISOString()
                const optimistic: PhaseTask = {
                  id: tempId,
                  phase_id: phaseId,
                  description: fd.get('description') as string,
                  responsible: ((fd.get('responsible') as string) || null),
                  due_date: ((fd.get('due_date') as string) || null),
                  completed: false,
                  completed_at: null,
                  created_at: nowIso,
                  updated_at: nowIso,
                }
                const upsertTask = (task: PhaseTask, replaceId: string) =>
                  setPhases((prev) =>
                    prev.map((p) => {
                      if (p.id !== phaseId) return p
                      const exists = p.phase_tasks.some((t) => t.id === replaceId)
                      const newTasks = exists
                        ? p.phase_tasks.map((t) => (t.id === replaceId ? task : t))
                        : [...p.phase_tasks, task]
                      const calc = calcPhaseStatus(newTasks)
                      return {
                        ...p,
                        phase_tasks: newTasks,
                        ...calc,
                        actual_end: calc.status === 'completed' ? p.actual_end : null,
                      }
                    })
                  )
                const removeTask = (taskId: string) =>
                  setPhases((prev) =>
                    prev.map((p) => {
                      if (p.id !== phaseId) return p
                      const newTasks = p.phase_tasks.filter((t) => t.id !== taskId)
                      return { ...p, phase_tasks: newTasks, ...calcPhaseStatus(newTasks) }
                    })
                  )

                upsertTask(optimistic, tempId)
                setAddingTaskFor(null)
                toastAfterClose('Tarefa criada')

                const persist = () =>
                  createTask(phaseId, projectId, fd)
                    .then((result) => {
                      if (!result.success || !result.task) throw new Error(result.error)
                      upsertTask(result.task, tempId)
                    })
                    .catch(() => {
                      removeTask(tempId)
                      toast.error('Erro ao criar tarefa', {
                        action: { label: 'Tentar novamente', onClick: () => { upsertTask(optimistic, tempId); persist() } },
                      })
                    })
                persist()
              }}
              className="space-y-4 px-6 py-5"
            >
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Descrição</label>
                <input name="description" required autoFocus placeholder="Ex: Concretar laje" className={INPUT} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Responsável</label>
                <input name="responsible" placeholder="Opcional" className={INPUT} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Prev. finalização</label>
                <input name="due_date" type="date" className={INPUT} />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-brown disabled:opacity-70"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => setAddingTaskFor(null)}
                  className="rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-dark hover:bg-cream disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal — Editar Tarefa */}
      {editingTaskId && editingTask && editingTaskPhase && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditingTaskId(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gold/20 px-6 py-4">
              <div>
                <p className="text-xs text-gray-400">Editar Tarefa</p>
                <h3 className="font-semibold text-dark">{editingTaskPhase.name}</h3>
              </div>
              <button
                onClick={() => setEditingTaskId(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-dark transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              action={(fd) => {
                // Otimista: a tarefa reflete a edição e o modal fecha na hora
                const phaseId = editingTaskPhase.id
                const taskId = editingTask.id
                const original = editingTask
                const optimistic: PhaseTask = {
                  ...original,
                  description: fd.get('description') as string,
                  responsible: ((fd.get('responsible') as string) || null),
                  due_date: ((fd.get('due_date') as string) || null),
                }
                const replaceTask = (task: PhaseTask) =>
                  setPhases((prev) =>
                    prev.map((p) =>
                      p.id !== phaseId
                        ? p
                        : { ...p, phase_tasks: p.phase_tasks.map((t) => (t.id === taskId ? task : t)) }
                    )
                  )

                replaceTask(optimistic)
                setEditingTaskId(null)
                toastAfterClose('Tarefa atualizada')

                const persist = () =>
                  updateTask(taskId, projectId, fd)
                    .then((result) => {
                      if (!result.success || !result.task) throw new Error(result.error)
                      replaceTask(result.task)
                    })
                    .catch(() => {
                      replaceTask(original)
                      toast.error('Erro ao editar tarefa', {
                        action: { label: 'Tentar novamente', onClick: () => { replaceTask(optimistic); persist() } },
                      })
                    })
                persist()
              }}
              className="space-y-4 px-6 py-5"
            >
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Descrição</label>
                <input name="description" required autoFocus defaultValue={editingTask.description} className={INPUT} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Responsável</label>
                <input name="responsible" defaultValue={editingTask.responsible ?? ''} placeholder="Opcional" className={INPUT} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Prev. finalização</label>
                <input name="due_date" type="date" defaultValue={editingTask.due_date ?? ''} className={INPUT} />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-brown disabled:opacity-70"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTaskId(null)}
                  className="rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-dark hover:bg-cream disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal — Editar Fase */}
      {editingPhaseId && (() => {
        const phase = phases.find((p) => p.id === editingPhaseId)
        if (!phase) return null
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setEditingPhaseId(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gold/20 px-6 py-4">
                <h3 className="font-semibold text-dark">Editar Fase</h3>
                <button
                  onClick={() => setEditingPhaseId(null)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-dark transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form
                action={(fd) => {
                  // Otimista: a fase reflete a edição e o modal fecha na hora
                  const phaseId = phase.id
                  const original = {
                    name: phase.name,
                    expected_start: phase.expected_start,
                    expected_end: phase.expected_end,
                    weight: phase.weight,
                  }
                  const updated = {
                    name: fd.get('name') as string,
                    expected_start: ((fd.get('expected_start') as string) || null),
                    expected_end: ((fd.get('expected_end') as string) || null),
                    weight: 1,
                  }
                  const apply = (values: typeof original) =>
                    setPhases((prev) => prev.map((p) => (p.id === phaseId ? { ...p, ...values } : p)))

                  apply(updated)
                  setEditingPhaseId(null)
                  toastAfterClose('Fase atualizada!')

                  const persist = () =>
                    updatePhase(phaseId, projectId, fd)
                      .then((result) => {
                        if (!result.success) throw new Error(result.error)
                      })
                      .catch(() => {
                        apply(original)
                        toast.error('Erro ao editar fase', {
                          action: { label: 'Tentar novamente', onClick: () => { apply(updated); persist() } },
                        })
                      })
                  persist()
                }}
                className="space-y-4 px-6 py-5"
              >
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400">Nome da fase</label>
                  <input name="name" required autoFocus defaultValue={phase.name} className={INPUT} />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-xs text-gray-400">Início previsto</label>
                    <input name="expected_start" type="date" defaultValue={phase.expected_start ?? ''} className={INPUT} />
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-xs text-gray-400">Término previsto</label>
                    <input name="expected_end" type="date" defaultValue={phase.expected_end ?? ''} className={INPUT} />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex flex-1 items-center justify-center rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-brown"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPhaseId(null)}
                    className="rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-dark hover:bg-cream"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      })()}

      {/* Modal — Concluir Fase (pede data) */}
      {phaseCompleteModal && (() => {
        const { phaseName, expectedStart, mode, date, dateError } = phaseCompleteModal
        const today = new Date().toISOString().split('T')[0]
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setPhaseCompleteModal(null) }}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-6 pt-6 pb-5">
                <h3 className="text-base font-bold text-dark">
                  {mode === 'lastTask' ? 'Fase concluída!' : 'Concluir fase'}
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  {mode === 'lastTask'
                    ? <>Todas as tarefas foram concluídas. Qual foi a data de finalização da fase <strong className="text-dark">&ldquo;{phaseName}&rdquo;</strong>?</>
                    : <>Qual foi a data de finalização da fase <strong className="text-dark">&ldquo;{phaseName}&rdquo;</strong>?</>
                  }
                </p>
                <div className="mt-4 space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-brown">
                    Data de conclusão *
                  </label>
                  <input
                    type="date"
                    value={date}
                    max={today}
                    min={expectedStart ?? undefined}
                    autoFocus
                    onChange={e =>
                      setPhaseCompleteModal(prev =>
                        prev ? { ...prev, date: e.target.value, dateError: undefined } : null
                      )
                    }
                    className={`${INPUT} ${dateError ? 'border-[#8B3A3A]' : ''}`}
                  />
                  {dateError && (
                    <p className="text-xs" style={{ color: '#8B3A3A' }}>{dateError}</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
                <button
                  onClick={() => setPhaseCompleteModal(null)}
                  className="rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-dark hover:bg-cream transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmPhaseComplete}
                  disabled={!date}
                  className="rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-brown transition-colors disabled:opacity-50"
                >
                  Confirmar conclusão
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal — Fase Incompleta */}
      {incompletePhaseId && (() => {
        const phase = phases.find(p => p.id === incompletePhaseId)
        if (!phase) return null
        const pending = phase.phase_tasks.filter(t => !t.completed)
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setIncompletePhaseId(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-6 pt-6 pb-5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-orange-50">
                  <AlertTriangle className="h-5 w-5 text-terracotta" />
                </div>
                <h3 className="text-base font-semibold text-dark">Fase incompleta</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Ainda há tarefas pendentes nesta fase. Conclua todas as tarefas antes de marcar a fase como concluída.
                </p>

                <ul className="mt-4 space-y-1.5">
                  {pending.map(task => (
                    <li key={task.id} className="flex items-start gap-2.5">
                      <span className="mt-[3px] h-3.5 w-3.5 shrink-0 rounded-sm border-2 border-[#8B3A3A]" />
                      <span className="text-sm text-dark">{task.description}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2 border-t border-gray-100 px-6 py-4">
                <button
                  onClick={() => {
                    setIncompletePhaseId(null)
                    setExpanded(prev => new Set([...prev, incompletePhaseId]))
                  }}
                  className="flex-1 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-brown transition-colors"
                >
                  Ver tarefas
                </button>
                <button
                  onClick={() => setIncompletePhaseId(null)}
                  className="flex-1 rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-dark hover:bg-cream transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal — Confirmar Exclusão de Tarefa */}
      {deleteConfirmTask && (() => {
        const task = phases
          .find(p => p.id === deleteConfirmTask.phaseId)
          ?.phase_tasks.find(t => t.id === deleteConfirmTask.taskId)
        if (!task) return null
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setDeleteConfirmTask(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-6 pt-6 pb-5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <h3 className="text-base font-semibold text-dark">Excluir tarefa</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Você está prestes a excluir a tarefa{' '}
                  <span className="font-semibold text-dark">&ldquo;{task.description}&rdquo;</span>.
                </p>
                <p className="mt-3 text-xs text-gray-400">Esta ação não pode ser desfeita.</p>
              </div>
              <div className="flex gap-2 border-t border-gray-100 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmTask(null)}
                  className="flex-1 rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-dark hover:bg-cream transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const { taskId, phaseId } = deleteConfirmTask
                    setDeleteConfirmTask(null)
                    handleDeleteTask(taskId, phaseId)
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
                >
                  Excluir tarefa
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal — Confirmar Exclusão de Fase */}
      {deleteConfirmPhaseId && (() => {
        const phase = phases.find((p) => p.id === deleteConfirmPhaseId)
        if (!phase) return null
        const taskCount = phase.phase_tasks.length
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setDeleteConfirmPhaseId(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 pt-6 pb-5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>

                <h3 className="text-base font-semibold text-dark">Excluir fase</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Você está prestes a excluir a fase{' '}
                  <span className="font-semibold text-dark">&ldquo;{phase.name}&rdquo;</span>.
                </p>

                {taskCount > 0 && (
                  <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5">
                    <p className="text-xs font-medium text-red-700">
                      {taskCount} {taskCount === 1 ? 'tarefa será excluída' : 'tarefas serão excluídas'} junto com a fase.
                    </p>
                  </div>
                )}

                <p className="mt-3 text-xs text-gray-400">Esta ação não pode ser desfeita.</p>
              </div>

              <div className="flex gap-2 border-t border-gray-100 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmPhaseId(null)}
                  className="flex-1 rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-dark hover:bg-cream transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDeletePhase}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-60"
                >
                  Excluir fase
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal — Nova Fase */}
      {addingPhase && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setAddingPhase(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gold/20 px-6 py-4">
              <h3 className="font-semibold text-dark">Nova Fase</h3>
              <button
                onClick={() => setAddingPhase(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-dark transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              action={(fd) => {
                // Otimista: fase entra na lista e o modal fecha na hora
                const tempId = `temp-${Date.now()}`
                const nowIso = new Date().toISOString()
                const optimistic: ProjectPhase & { phase_tasks: PhaseTask[] } = {
                  id: tempId,
                  project_id: projectId,
                  name: fd.get('name') as string,
                  order_index: Date.now(),
                  progress: 0,
                  weight: 1,
                  expected_start: ((fd.get('expected_start') as string) || null),
                  expected_end: ((fd.get('expected_end') as string) || null),
                  actual_end: null,
                  status: 'not_started',
                  created_at: nowIso,
                  updated_at: nowIso,
                  phase_tasks: [],
                }

                setPhases((prev) => [...prev, optimistic])
                setAddingPhase(false)
                toastAfterClose('Fase criada com sucesso!')

                const persist = () =>
                  createPhase(projectId, fd)
                    .then((result) => {
                      if (!result.success || !result.phase) throw new Error(result.error)
                      setPhases((prev) => prev.map((p) => (p.id === tempId ? result.phase! : p)))
                    })
                    .catch((err: unknown) => {
                      setPhases((prev) => prev.filter((p) => p.id !== tempId))
                      const msg = err instanceof Error ? err.message : String(err)
                      toast.error(`Erro ao criar fase: ${msg}`, {
                        action: {
                          label: 'Tentar novamente',
                          onClick: () => { setPhases((prev) => [...prev, optimistic]); persist() },
                        },
                      })
                    })
                persist()
              }}
              className="space-y-4 px-6 py-5"
            >
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Nome da fase</label>
                <input name="name" required autoFocus placeholder="Ex: Alvenaria" className={INPUT} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-xs text-gray-400">Início previsto</label>
                  <input name="expected_start" type="date" className={INPUT} />
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-xs text-gray-400">Término previsto</label>
                  <input name="expected_end" type="date" className={INPUT} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-brown disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  Criar Fase
                </button>
                <button
                  type="button"
                  onClick={() => setAddingPhase(false)}
                  className="rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-dark hover:bg-cream disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
