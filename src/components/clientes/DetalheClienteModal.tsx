'use client'

import { X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Client } from '@/types/database'
import { CLIENT_TYPE_LABELS, HOW_THEY_FOUND_LABELS } from '@/types/database'
import { formatPhone, formatDocument } from '@/lib/format'

interface Props {
  client:  Client
  onClose: () => void
}

function Field({ label, value, full = false }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={`space-y-0.5 ${full ? 'sm:col-span-2' : ''}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-brown">{label}</p>
      <p className="text-sm text-dark">{value}</p>
    </div>
  )
}

export function DetalheClienteModal({ client, onClose }: Props) {
  const router = useRouter()

  const endereco = [client.address, [client.city, client.state].filter(Boolean).join('/')]
    .filter(Boolean)
    .join(' — ')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(59,36,24,0.4)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gold/20 px-6 py-4">
          <h2 className="text-lg font-bold text-dark">Detalhes do Cliente</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-cream hover:text-dark transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome" value={client.name} />
            <Field label="Tipo" value={CLIENT_TYPE_LABELS[client.type] ?? client.type} />
            <Field label="CPF/CNPJ" value={formatDocument(client.document)} />
            <Field label="Telefone" value={client.phone ? formatPhone(client.phone) : '—'} />
            <Field label="E-mail" value={client.email ?? '—'} />
            <Field
              label="Como conheceu"
              value={client.how_they_found ? (HOW_THEY_FOUND_LABELS[client.how_they_found] ?? client.how_they_found) : '—'}
            />
            <Field label="Endereço" value={endereco || '—'} full />
            <Field label="Observações" value={client.notes || 'Nenhuma observação.'} full />
          </div>

          {/* Ações */}
          <div className="flex items-center justify-end gap-3 border-t border-gold/20 pt-4">
            <button
              type="button"
              onClick={() => router.push(`/clientes/${client.id}`)}
              className="rounded-lg border bg-white px-5 py-2.5 text-sm font-medium text-brown transition-colors hover:bg-cream"
              style={{ borderColor: '#E6C07B' }}
            >
              Ver página completa
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gold/50 px-5 py-2.5 text-sm font-medium text-dark hover:bg-cream transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
