'use client'

import { useRef } from 'react'
import { X } from 'lucide-react'
import { createClientQuick } from '@/app/actions/clientes'
import { PhoneInput } from '@/components/ui/phone-input'
import { toast } from 'sonner'
import { toastAfterClose } from '@/lib/ui-feedback'

type Props = {
  onSave: (client: { id: string; name: string }) => void
  onClose: () => void
}

export function NovoClienteRapidoModal({ onSave, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  function persist(formData: FormData, name: string) {
    createClientQuick(formData)
      .then((result) => {
        if (!result.success) throw new Error(result.error)
        // Entrega o registro real ao pai (que o seleciona no formulário)
        onSave(result.client)
      })
      .catch((err: Error) => {
        toast.error(err.message || 'Erro ao cadastrar cliente', {
          action: { label: 'Tentar novamente', onClick: () => persist(formData, name) },
        })
      })
  }

  function handleSubmit() {
    if (!containerRef.current) return
    const formData = new FormData()
    containerRef.current.querySelectorAll<HTMLInputElement>('input[name]').forEach((el) => {
      if (el.type === 'radio' && !el.checked) return
      formData.set(el.name, el.value)
    })

    const name = (formData.get('name') as string)?.trim()
    if (!name) {
      toast.error('Informe o nome do cliente')
      return
    }

    // Fecha na hora; a gravação roda em background e o pai recebe o cliente salvo.
    onClose()
    toastAfterClose('Cliente cadastrado')
    persist(formData, name)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gold/20 px-5 py-4">
          <h2 className="text-base font-semibold text-dark">Cadastrar novo cliente</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-dark"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={containerRef} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-brown">
              Tipo *
            </label>
            <div className="flex gap-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="type"
                  value="pf"
                  defaultChecked
                  className="accent-terracotta"
                />
                <span className="text-sm">Pessoa Física</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="type"
                  value="pj"
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
              autoFocus
              placeholder="Nome completo"
              className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>

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

          <p className="text-xs text-gray-400">
            Para adicionar mais informações, edite o cadastro depois em Clientes.
          </p>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-dark hover:bg-cream transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded-lg bg-terracotta px-5 py-2 text-sm font-medium text-white hover:bg-brown transition-colors"
            >
              Cadastrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
