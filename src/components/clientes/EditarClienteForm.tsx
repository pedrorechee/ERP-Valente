'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { toastAfterClose } from '@/lib/ui-feedback'
import type { Client, HowTheyFound } from '@/types/database'
import { HOW_THEY_FOUND_LABELS } from '@/types/database'
import { updateClient } from '@/app/actions/clientes'
import { PhoneInput } from '@/components/ui/phone-input'
import { CpfCnpjInput } from '@/components/ui/cpf-cnpj-input'
import { EmailInput } from '@/components/ui/email-input'

interface Props {
  client: Client
}

export function EditarClienteForm({ client }: Props) {
  const router = useRouter()

  function persist(formData: FormData) {
    updateClient(client.id, formData)
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

    const name = (formData.get('name') as string)?.trim()
    if (!name) {
      toast.error('Informe o nome do cliente')
      return
    }

    // Navegação otimista: volta ao detalhe na hora; a gravação roda em background.
    router.push(`/clientes/${client.id}`)
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
          <label className="text-xs font-semibold uppercase tracking-wide text-brown">Tipo *</label>
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="type"
                value="pf"
                defaultChecked={client.type === 'pf'}
                className="accent-terracotta"
              />
              <span className="text-sm">Pessoa Física</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="type"
                value="pj"
                defaultChecked={client.type === 'pj'}
                className="accent-terracotta"
              />
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
            defaultValue={client.name}
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
              defaultValue={client.document}
              className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">
              Como chegou até nós
            </label>
            <select
              name="how_they_found"
              defaultValue={client.how_they_found ?? ''}
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
              defaultValue={client.phone}
              className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">E-mail</label>
            <EmailInput
              name="email"
              defaultValue={client.email}
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
            defaultValue={client.address ?? ''}
            className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">Cidade</label>
            <input
              name="city"
              defaultValue={client.city ?? ''}
              className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">
              Estado (UF)
            </label>
            <input
              name="state"
              defaultValue={client.state ?? ''}
              maxLength={2}
              className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>
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
            defaultValue={client.notes ?? ''}
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
                defaultChecked={client.is_active}
                className="accent-terracotta"
              />
              <span className="text-sm text-dark">Ativo</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="is_active"
                value="false"
                defaultChecked={!client.is_active}
                className="accent-terracotta"
              />
              <span className="text-sm text-dark">Inativo</span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Link
          href={`/clientes/${client.id}`}
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
