import Link from 'next/link'
import { Plus, Building2 } from 'lucide-react'
import { getPageClient } from '@/lib/supabase/action'
import { ProjectCard } from '@/components/obras/ProjectCard'
import type { Project } from '@/types/database'

export default async function ObrasPage() {
  const supabase = await getPageClient()

  const { data } = await supabase
    .from('projects')
    .select('id, name, type, address, status, overall_progress, technical_responsible, expected_end_date, created_at')
    .order('created_at', { ascending: false })

  const projects = (data as unknown as Project[] | null) ?? []
  const active = projects.filter((p) => p.status === 'active')
  const others = projects.filter((p) => p.status !== 'active')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark">Obras</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {projects.length === 0
              ? 'Nenhuma obra cadastrada'
              : `${active.length} em andamento · ${projects.length} no total`}
          </p>
        </div>
        <Link
          href="/obras/nova"
          className="flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brown transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova Obra
        </Link>
      </div>

      {/* Empty state */}
      {projects.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gold/50 bg-cream/30 py-16 text-center">
          <Building2 className="mb-3 h-10 w-10 text-gold" />
          <h3 className="font-semibold text-dark">Nenhuma obra cadastrada</h3>
          <p className="mt-1 text-sm text-gray-500">
            Cadastre a primeira obra para começar a acompanhar o progresso.
          </p>
          <Link
            href="/obras/nova"
            className="mt-4 flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-brown transition-colors"
          >
            <Plus className="h-4 w-4" />
            Cadastrar obra
          </Link>
        </div>
      )}

      {/* Obras em andamento */}
      {active.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Em andamento
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {active.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      )}

      {/* Outras obras */}
      {others.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Concluídas / Paralisadas
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {others.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
