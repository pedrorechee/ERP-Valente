'use client'

/**
 * Toggle "Controlar na conta corrente do fornecedor".
 * Aparece apenas quando há um fornecedor vinculado ao lançamento.
 * Define o campo in_supplier_account (via hidden input) que faz o
 * lançamento entrar no saldo e no extrato em Contas de Fornecedores.
 */
interface Props {
  enabled: boolean
  onChange: (enabled: boolean) => void
}

export function SupplierAccountToggle({ enabled, onChange }: Props) {
  return (
    <div className="space-y-2 rounded-lg border border-gold/30 bg-cream/20 p-4">
      {/* Valor enviado no submit; só é true quando o toggle está ligado */}
      <input type="hidden" name="in_supplier_account" value={enabled ? 'true' : 'false'} />
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-brown">
          Controlar na conta corrente do fornecedor
        </label>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onChange(!enabled)}
          className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
          style={{ backgroundColor: enabled ? '#C68B59' : '#d1d5db' }}
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
            style={{ left: enabled ? '22px' : '2px' }}
          />
        </button>
      </div>
      <p className="text-xs text-gray-400">
        Quando ativado, este lançamento entra no saldo e no extrato do fornecedor em Contas de Fornecedores.
      </p>
    </div>
  )
}
