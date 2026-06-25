'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { updateCompanyPreferences } from '@/app/actions/configuracoes'
import type { CompanySettings } from '@/types/database'

const INPUT =
  'w-full rounded-lg border border-[#E6C07B] bg-white px-3 py-2 text-sm text-dark focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta'
const LABEL = 'text-xs font-semibold uppercase tracking-wide text-brown'

export function PreferenciasTab({ settings }: { settings: CompanySettings | null }) {
  const s = settings
  const [saving, setSaving] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setSaving(true)
    updateCompanyPreferences(formData)
      .then((res) => {
        if (!res.success) throw new Error(res.error)
        toast.success('Preferências salvas!')
      })
      .catch((err: Error) => toast.error(err.message || 'Erro ao salvar preferências.'))
      .finally(() => setSaving(false))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-xl border border-gold/30 bg-white p-5 shadow-sm">
        <p className="mb-4 text-sm text-gray-500">
          Valores usados como padrão inicial ao criar novos registros. Cada registro pode sobrescrever.
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className={LABEL}>BDI padrão (%)</label>
            <input
              name="default_bdi_percent"
              type="number" min="0" max="100" step="0.1"
              defaultValue={s?.default_bdi_percent ?? 12}
              className={INPUT}
            />
            <p className="text-xs text-gray-400">Valor inicial ao criar um orçamento.</p>
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Retenção padrão (%)</label>
            <input
              name="default_retention_percent"
              type="number" min="0" max="100" step="0.1"
              defaultValue={s?.default_retention_percent ?? 0}
              className={INPUT}
            />
            <p className="text-xs text-gray-400">Valor inicial em contrato e medição.</p>
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Garantia padrão (meses)</label>
            <input
              name="default_warranty_months"
              type="number" min="0" step="1"
              defaultValue={s?.default_warranty_months ?? 60}
              className={INPUT}
            />
            <p className="text-xs text-gray-400">Valor inicial ao cadastrar uma obra.</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-terracotta px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brown disabled:opacity-60"
        >
          {saving ? 'Salvando…' : 'Salvar preferências'}
        </button>
      </div>
    </form>
  )
}
