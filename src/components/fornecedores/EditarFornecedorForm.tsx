'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Supplier, SupplierType } from '@/types/database'
import { SUPPLIER_TYPE_LABELS } from '@/types/database'
import { updateSupplier } from '@/app/actions/fornecedores'
import { toastAfterClose } from '@/lib/ui-feedback'
import { PhoneInput } from '@/components/ui/phone-input'
import { CpfCnpjInput } from '@/components/ui/cpf-cnpj-input'
import { EmailInput } from '@/components/ui/email-input'

interface Props {
  supplier: Supplier
}

export function EditarFornecedorForm({ supplier }: Props) {
  const router = useRouter()

  function persist(formData: FormData) {
    updateSupplier(supplier.id, formData)
      .then((result) => {
        if (!result.success) throw new Error(result.error)
      })
      .catch((err: Error) => {
        toast.error(err.message || 'Erro ao salvar alterações', {
          action: { label: 'Tentar novamente', onClick: () => persist(formData) },
        })
      })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    // Navegação otimista: volta ao detalhe na hora; a gravação roda em background;
    // o toast de confirmação entra logo após a navegação.
    router.push(`/fornecedores/${supplier.id}`)
    toastAfterClose('Alterações salvas')
    persist(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
            defaultValue={supplier.name}
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
              defaultValue={supplier.type}
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
              defaultValue={supplier.document}
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
              defaultValue={supplier.phone}
              className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">
              E-mail
            </label>
            <EmailInput
              name="email"
              defaultValue={supplier.email}
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
            defaultValue={supplier.pix_key ?? ''}
            className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
          />
        </div>

        {/* Observações e Status */}
        <div className="pt-2">
          <p className="text-xs font-bold uppercase tracking-wide text-brown">Observações e Status</p>
          <hr className="mt-1.5 border-gold/30" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-brown">
            Observações
          </label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={supplier.notes ?? ''}
            className="w-full resize-none rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-brown">Status</label>
          <div className="flex gap-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="is_active"
                value="true"
                defaultChecked={supplier.is_active}
                className="accent-terracotta"
              />
              <span className="text-sm text-dark">Ativo</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="is_active"
                value="false"
                defaultChecked={!supplier.is_active}
                className="accent-terracotta"
              />
              <span className="text-sm text-dark">Inativo</span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Link
          href={`/fornecedores/${supplier.id}`}
          className="rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-dark hover:bg-cream transition-colors"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          className="rounded-lg bg-terracotta px-6 py-2 text-sm font-medium text-white hover:bg-brown transition-colors"
        >
          Salvar Alterações
        </button>
      </div>
    </form>
  )
}
