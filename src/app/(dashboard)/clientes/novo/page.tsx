import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/app/actions/clientes'
import { HOW_THEY_FOUND_LABELS } from '@/types/database'
import type { HowTheyFound } from '@/types/database'
import { PhoneInput } from '@/components/ui/phone-input'
import { CpfCnpjInput } from '@/components/ui/cpf-cnpj-input'
import { EmailInput } from '@/components/ui/email-input'
import { SubmitButton } from '@/components/ui/submit-button'

export default function NovoClientePage() {
  async function handleCreate(formData: FormData) {
    'use server'
    await createClient(formData)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/clientes"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-dark transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Clientes
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-dark">Novo Cliente</span>
      </div>

      <h1 className="text-2xl font-bold text-dark">Cadastrar Cliente</h1>

      <form action={handleCreate} className="space-y-6">
        <div className="rounded-xl border border-gold/40 bg-white p-6 shadow-sm space-y-5">

          {/* Dados principais */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-brown">Dados principais</p>
            <hr className="mt-1.5 border-gold/30" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">Tipo *</label>
            <div className="flex gap-4">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="type" value="pf" defaultChecked className="accent-terracotta" />
                <span className="text-sm">Pessoa Física</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="type" value="pj" className="accent-terracotta" />
                <span className="text-sm">Pessoa Jurídica</span>
              </label>
            </div>
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
                CPF / CNPJ
              </label>
              <CpfCnpjInput
                name="document"
                className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-brown">
                Como chegou até nós
              </label>
              <select
                name="how_they_found"
                className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              >
                <option value="">Selecionar...</option>
                {(Object.entries(HOW_THEY_FOUND_LABELS) as [HowTheyFound, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
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

          {/* Endereço */}
          <div className="pt-2">
            <p className="text-xs font-bold uppercase tracking-wide text-brown">Endereço</p>
            <hr className="mt-1.5 border-gold/30" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">
              Logradouro, número e bairro
            </label>
            <input
              name="address"
              placeholder="Rua das Flores, 123, Centro"
              className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-brown">Cidade</label>
              <input
                name="city"
                placeholder="São Paulo"
                className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-brown">Estado (UF)</label>
              <input
                name="state"
                placeholder="SP"
                maxLength={2}
                className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              />
            </div>
          </div>

          {/* Observações */}
          <div className="pt-2">
            <p className="text-xs font-bold uppercase tracking-wide text-brown">Observações</p>
            <hr className="mt-1.5 border-gold/30" />
          </div>

          <textarea
            name="notes"
            rows={3}
            placeholder="Informações adicionais sobre o cliente..."
            className="w-full resize-none rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/clientes"
            className="rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-dark hover:bg-cream transition-colors"
          >
            Cancelar
          </Link>
          <SubmitButton
            label="Cadastrar Cliente"
            pendingLabel="Cadastrando…"
            className="flex items-center gap-2 rounded-lg bg-terracotta px-6 py-2 text-sm font-medium text-white hover:bg-brown transition-colors disabled:opacity-60"
          />
        </div>
      </form>
    </div>
  )
}
