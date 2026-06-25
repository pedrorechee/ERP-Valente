'use client'

import { Trash2 } from 'lucide-react'

interface Props {
  isOpen:    boolean
  onConfirm: () => void
  onCancel:  () => void
  title?:    string
  message?:  string
}

export function ConfirmDeleteModal({
  isOpen,
  onConfirm,
  onCancel,
  title   = 'Excluir lançamento',
  message = 'Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.',
}: Props) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <Trash2 className="h-6 w-6 text-red-600" />
          </div>
        </div>

        <h2 className="mb-2 text-center text-base font-semibold text-dark">{title}</h2>
        <p className="mb-6 text-center text-sm text-gray-500">{message}</p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gold/50 py-2.5 text-sm font-medium text-dark hover:bg-cream transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  )
}
