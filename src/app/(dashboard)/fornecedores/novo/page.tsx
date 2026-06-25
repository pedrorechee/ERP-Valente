import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createSupplier } from '@/app/actions/fornecedores'
import { SUPPLIER_TYPE_LABELS } from '@/types/database'
import type { SupplierType } from '@/types/database'
import { PhoneInput } from '@/components/ui/phone-input'
import { CpfCnpjInput } from '@/components/ui/cpf-cnpj-input'
import { EmailInput } from '@/components/ui/email-input'
import { SubmitButton } from '@/components/ui/submit-button'

export default function NovoFornecedorPage() {
  async function handleCreate(formData: FormData) {
    'use server'
    await createSupplier(formData)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/fornecedores"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-dark transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Fornecedores
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-dark">Novo Fornecedor</span>
      </div>

      <h1 className="text-2xl font-bold text-dark">Cadastrar Fornecedor</h1>

      <form action={handleCreate} className="space-y-6">
        <div className="rounded-xl border border-gold/40 bg-white p-6 shadow-sm space-y-5">

          {/* Dados principais */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-brown">Dados principais</p>
            <hr className="mt-1.5 border-gold/30" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">
              Nome / Razão Social *
            </label>
            <input
              name="name"
              required
              placeholder="Nome completo ou razão social"
              className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-brown">
                Tipo *
              </label>
              <select
                name="type"
                required
                className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              >
                {(Object.entries(SUPPLIER_TYPE_LABELS) as [SupplierType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-brown">
                CPF / CNPJ
              </label>
              <CpfCnpjInput
                name="document"
                className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              />
            </div>
          </div>

          {/* Contato */}
          <div className="pt-2">
            <p className="text-xs font-bold uppercase tracking-wide text-brown">Contato</p>
            <hr className="mt-1.5 border-gold/30" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-brown">
                Telefone / WhatsApp *
              </label>
              <PhoneInput
                name="phone"
                required
                className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-brown">
                E-mail
              </label>
              <EmailInput
                name="email"
                placeholder="email@exemplo.com"
                className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">
              Chave Pix
            </label>
            <input
              name="pix_key"
              placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
              className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>

          {/* Observações */}
          <div className="pt-2">
            <p className="text-xs font-bold uppercase tracking-wide text-brown">Observações</p>
            <hr className="mt-1.5 border-gold/30" />
          </div>

          <textarea
            name="notes"
            rows={3}
            placeholder="Ex: só aceita pagamento antecipado, entrega em 3 dias, atende fins de semana..."
            className="w-full resize-none rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/fornecedores"
            className="rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-dark hover:bg-cream transition-colors"
          >
            Cancelar
          </Link>
          <SubmitButton
            label="Cadastrar Fornecedor"
            pendingLabel="Cadastrando…"
            className="flex items-center gap-2 rounded-lg bg-terracotta px-6 py-2 text-sm font-medium text-white hover:bg-brown transition-colors disabled:opacity-60"
          />
        </div>
      </form>
    </div>
  )
}
