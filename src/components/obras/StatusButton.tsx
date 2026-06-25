'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { updateProjectStatus } from '@/app/actions/obras'
import type { ProjectStatus } from '@/types/database'
import { PROJECT_STATUS_LABELS } from '@/types/database'
import { toast } from 'sonner'

const STATUS_BADGE: Record<ProjectStatus, string> = {
  active:    'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  paused:    'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-red-100 text-red-800',
}

const STATUS_OPTIONS: ProjectStatus[] = ['active', 'paused', 'completed', 'cancelled']

type Modal =
  | { type: 'blocked';   progress: number }
  | { type: 'completed' }
  | { type: 'cancelled'; reason: string }
  | null

interface StatusButtonProps {
  projectId:       string
  currentStatus:   ProjectStatus
  overallProgress: number
}

export function StatusButton({ projectId, currentStatus, overallProgress }: StatusButtonProps) {
  const [status, setStatus]   = useState<ProjectStatus>(currentStatus)
  const [open, setOpen]       = useState(false)
  const [modal, setModal]     = useState<Modal>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Sync quando o servidor revalida e envia um novo currentStatus
  useEffect(() => { setStatus(currentStatus) }, [currentStatus])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Troca otimista de status com rollback se a gravação falhar
  function applyStatus(
    next: ProjectStatus,
    options?: { actual_end_date?: string; cancellation_reason?: string },
  ) {
    const prev = status
    setStatus(next)

    const run = () =>
      updateProjectStatus(projectId, next, options)
        .then((result) => {
          if (result?.error) throw new Error(result.error)
        })
        .catch(() => {
          setStatus(prev)
          toast.error('Erro ao atualizar status da obra', {
            action: { label: 'Tentar novamente', onClick: () => { setStatus(next); run() } },
          })
        })
    run()
  }

  function handleOptionClick(next: ProjectStatus) {
    if (next === status) { setOpen(false); return }
    if (next === 'completed') {
      setOpen(false)
      if (overallProgress < 100) {
        setModal({ type: 'blocked', progress: overallProgress })
      } else {
        setModal({ type: 'completed' })
      }
      return
    }
    if (next === 'cancelled') {
      setModal({ type: 'cancelled', reason: '' })
      setOpen(false)
      return
    }
    setOpen(false)
    applyStatus(next)
  }

  function handleConfirmCompleted() {
    if (modal?.type !== 'completed') return
    setModal(null)
    applyStatus('completed')
  }

  function handleConfirmCancelled() {
    if (modal?.type !== 'cancelled' || !modal.reason.trim()) return
    const reason = modal.reason.trim()
    setModal(null)
    applyStatus('cancelled', { cancellation_reason: reason })
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity ${STATUS_BADGE[status]} hover:opacity-75 cursor-pointer`}
        >
          {PROJECT_STATUS_LABELS[status]}
          <ChevronDown className="h-3 w-3" />
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1.5 z-50 min-w-[160px] rounded-xl border border-gold/40 bg-white shadow-lg overflow-hidden">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleOptionClick(s)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-dark hover:bg-cream transition-colors"
              >
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[s]}`}>
                  {PROJECT_STATUS_LABELS[s]}
                </span>
                {s === status && <Check className="h-3.5 w-3.5 text-terracotta ml-2 shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget && modal.type !== 'blocked') setModal(null) }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">

            {/* Modal de bloqueio — progresso < 100% */}
            {modal.type === 'blocked' && (
              <>
                <h3 className="text-base font-bold text-dark">Não é possível concluir a obra</h3>
                <p className="mt-2 text-sm text-gray-500">
                  O progresso geral da obra está em <strong className="text-dark">{modal.progress}%</strong>. Para marcar como concluída, todas as fases devem estar 100% concluídas.
                </p>
                <div className="mt-5">
                  <button
                    onClick={() => setModal(null)}
                    className="w-full rounded-lg bg-terracotta px-4 py-2.5 text-sm font-medium text-white hover:bg-brown transition-colors"
                  >
                    Entendi
                  </button>
                </div>
              </>
            )}

            {/* Modal de confirmação — progresso = 100% */}
            {modal.type === 'completed' && (
              <>
                <h3 className="text-base font-bold text-dark">Concluir obra</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Deseja marcar esta obra como concluída? Esta ação indica que todos os trabalhos foram finalizados.
                </p>
                <div className="mt-5 flex justify-end gap-3">
                  <button
                    onClick={() => setModal(null)}
                    className="rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-dark hover:bg-cream transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmCompleted}
                    className="rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-brown transition-colors"
                  >
                    Confirmar conclusão
                  </button>
                </div>
              </>
            )}

            {/* Modal de cancelamento */}
            {modal.type === 'cancelled' && (
              <>
                <h3 className="text-base font-bold text-dark">Cancelar Obra</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Informe o motivo do cancelamento desta obra.
                </p>
                <div className="mt-4 space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-brown">
                    Motivo do cancelamento *
                  </label>
                  <textarea
                    value={modal.reason}
                    onChange={(e) => setModal({ ...modal, reason: e.target.value })}
                    rows={3}
                    placeholder="Descreva o motivo do cancelamento..."
                    className="w-full resize-none rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
                    autoFocus
                  />
                </div>
                <div className="mt-5 flex justify-end gap-3">
                  <button
                    onClick={() => setModal(null)}
                    className="rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-dark hover:bg-cream transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleConfirmCancelled}
                    disabled={!modal.reason.trim()}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    Cancelar obra
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </>
  )
}
