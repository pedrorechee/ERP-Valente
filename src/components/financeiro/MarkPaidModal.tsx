'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface Props {
  count:     number
  onConfirm: (paymentDate: string) => void
  onCancel:  () => void
}

export function MarkPaidModal({ count, onConfirm, onCancel }: Props) {
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(59,36,24,0.4)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-dark">Marcar como Pago</h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-cream hover:text-dark transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-500">
          {count} lançamento{count !== 1 ? 's' : ''} ser{count !== 1 ? 'ão' : 'á'} marcado{count !== 1 ? 's' : ''} como pago.
        </p>

        <div className="mb-6 space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-brown">
            Data do Pagamento *
          </label>
          <input
            type="date"
            required
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gold/50 py-2.5 text-sm font-medium text-dark transition-colors hover:bg-[#F9F7F4]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!paymentDate}
            onClick={() => onConfirm(paymentDate)}
            className="flex-1 rounded-lg bg-terracotta py-2.5 text-sm font-medium text-white hover:bg-brown disabled:opacity-60 transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}
