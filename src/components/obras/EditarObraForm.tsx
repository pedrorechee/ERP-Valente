'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Project, Client } from '@/types/database'
import { updateProject } from '@/app/actions/obras'
import { toastAfterClose } from '@/lib/ui-feedback'
import { ObraFormFields } from '@/components/obras/ObraFormFields'

interface Props {
  project: Project
  clients: Pick<Client, 'id' | 'name'>[]
}

export function EditarObraForm({ project, clients }: Props) {
  const router = useRouter()

  function persist(formData: FormData) {
    updateProject(project.id, formData)
      .then((result) => {
        if (result?.error) throw new Error(result.error)
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

    // Navegação otimista: volta ao detalhe na hora; a gravação roda em background.
    // Ordem correta: navega/fecha primeiro, toast ~250ms depois.
    router.push(`/obras/${project.id}`)
    toastAfterClose('Obra atualizada com sucesso!')
    persist(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <ObraFormFields project={project} clients={clients} />

      <div className="flex items-center justify-end gap-3">
        <Link
          href={`/obras/${project.id}`}
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
