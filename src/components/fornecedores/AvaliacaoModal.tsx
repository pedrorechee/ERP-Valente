'use client'

import { useState } from 'react'
import { X, Star } from 'lucide-react'
import type { SupplierEvaluation } from '@/types/database'
import { createEvaluation } from '@/app/actions/fornecedores'
import { toast } from 'sonner'
import { toastAfterClose } from '@/lib/ui-feedback'

interface Props {
  supplierId: string
  projects: { id: string; name: string }[]
  onClose: () => void
  /** Adiciona a avaliação otimista na lista do pai (id temporário) */
  onOptimistic?: (evaluation: SupplierEvaluation) => void
  /** Troca o registro temporário pelo salvo (ou remove, se saved = null) */
  onSettled?: (tempId: string, saved: SupplierEvaluation | null) => void
}

export function AvaliacaoModal({ supplierId, projects, onClose, onOptimistic, onSettled }: Props) {
  const [quality, setQuality] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [metDeadline, setMetDeadline] = useState<boolean | null>(null)

  function persist(formData: FormData, tempId: string, optimistic: SupplierEvaluation) {
    createEvaluation(supplierId, formData)
      .then((result) => {
        if (!result.success || !result.evaluation) throw new Error(result.error ?? 'Erro ao salvar avaliação')
        onSettled?.(tempId, result.evaluation as unknown as SupplierEvaluation)
      })
      .catch((err: Error) => {
        onSettled?.(tempId, null)
        toast.error(err.message || 'Erro ao salvar avaliação', {
          action: {
            label: 'Tentar novamente',
            onClick: () => {
              onOptimistic?.(optimistic)
              persist(formData, tempId, optimistic)
            },
          },
        })
      })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('quality_score', String(quality))
    formData.set('met_deadline', metDeadline === null ? '' : String(metDeadline))

    // Atualização otimista: avaliação entra na lista e o modal fecha na hora
    const tempId = `temp-${Date.now()}`
    const projectId = formData.get('project_id') as string
    const optimistic: SupplierEvaluation = {
      id: tempId,
      supplier_id: supplierId,
      project_id: projectId,
      quality_score: quality > 0 ? quality : null,
      met_deadline: metDeadline,
      observation: ((formData.get('observation') as string) || null),
      evaluated_by: null,
      created_at: new Date().toISOString(),
      projects: projects.find((p) => p.id === projectId) ?? null,
    }
    onOptimistic?.(optimistic)
    onClose()
    toastAfterClose('Avaliação registrada')
    persist(formData, tempId, optimistic)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gold/30 px-6 py-4">
          <h2 className="font-semibold text-dark">Avaliar Fornecedor</h2>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:text-dark transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Obra */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">Obra *</label>
            <select
              name="project_id"
              required
              className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            >
              <option value="">Selecionar obra...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Star rating */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">
              Qualidade do serviço
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setQuality(star)}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${
                      star <= (hovered || quality)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'fill-gray-100 text-gray-300'
                    }`}
                  />
                </button>
              ))}
              {quality > 0 && (
                <span className="ml-2 self-center text-sm text-gray-500">
                  {['', 'Péssimo', 'Ruim', 'Regular', 'Bom', 'Excelente'][quality]}
                </span>
              )}
            </div>
          </div>

          {/* Met deadline */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">Prazo</label>
            <div className="flex gap-2">
              {[
                { value: true, label: 'Cumpriu o prazo', cls: 'border-green-300 text-green-700 bg-green-50' },
                { value: false, label: 'Atrasou', cls: 'border-red-300 text-red-700 bg-red-50' },
              ].map(({ value, label, cls }) => (
                <button
                  key={String(value)}
                  type="button"
                  onClick={() => setMetDeadline(metDeadline === value ? null : value)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    metDeadline === value
                      ? cls
                      : 'border-gray-300 text-gray-500 hover:border-gold'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Observation */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">
              Observação
            </label>
            <textarea
              name="observation"
              rows={3}
              placeholder="Comentários sobre o fornecedor nessa obra..."
              className="w-full resize-none rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-terracotta px-5 py-2.5 text-sm font-medium text-white hover:bg-brown disabled:opacity-60 transition-colors"
            >
              Salvar Avaliação
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gold/50 px-4 py-2.5 text-sm font-medium text-dark hover:bg-cream transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
