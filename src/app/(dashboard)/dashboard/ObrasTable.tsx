'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Calendar, ArrowRight } from 'lucide-react'
import type { Project } from '@/types/database'
import { PROJECT_STATUS_LABELS } from '@/types/database'
import { formatCurrency, formatDate, isOverdue, daysUntil } from '@/lib/format'

interface Props {
  projects: Project[]
}

export function ObrasTable({ projects }: Props) {
  const router = useRouter()

  // Prefetch all listed project pages as soon as the component mounts
  useEffect(() => {
    projects.forEach((p) => router.prefetch(`/obras/${p.id}`))
  }, [projects, router])

  return (
    <section className="hidden md:block">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-dark">Obras em Andamento</h3>
        <Link
          href="/obras"
          className="flex items-center gap-1 text-sm text-terracotta hover:text-brown transition-colors"
        >
          Ver todas <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-gold/20 bg-cream/30">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                Obra
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 hidden lg:table-cell">
                Tipo
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                Progresso
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 hidden xl:table-cell">
                Início
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                Prazo
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 hidden xl:table-cell">
                Situação
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 hidden lg:table-cell">
                Contrato
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gold/10">
            {projects.slice(0, 8).map((project) => {
              const delayed  = isOverdue(project.expected_end_date)
              const days     = daysUntil(project.expected_end_date)
              const daysLate = delayed ? Math.abs(days) : 0
              const daysLeft = !delayed ? days : 0
              return (
                <tr
                  key={project.id}
                  className="hover:bg-cream/20 transition-colors cursor-pointer"
                  onMouseEnter={() => router.prefetch(`/obras/${project.id}`)}
                >
                  <td className="px-4 py-3">
                    <Link href={`/obras/${project.id}`} className="flex items-center gap-2">
                      <span className="font-medium text-dark hover:text-terracotta transition-colors">
                        {project.name}
                      </span>
                      {delayed && (
                        <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">
                    {PROJECT_STATUS_LABELS[project.status]}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${delayed ? 'bg-red-400' : 'bg-terracotta'}`}
                          style={{ width: `${project.overall_progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-dark">
                        {project.overall_progress}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400 hidden xl:table-cell">
                    {formatDate(project.start_date)}
                  </td>
                  <td
                    className={`px-4 py-3 text-sm ${delayed ? 'text-red-500 font-medium' : 'text-gray-400'}`}
                  >
                    {formatDate(project.expected_end_date)}
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    {delayed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                        <AlertTriangle className="h-3 w-3" />
                        {daysLate}d de atraso
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${daysLeft <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        <Calendar className="h-3 w-3" />
                        {daysLeft}d restantes
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {project.contract_value != null ? (
                      <span className="text-sm text-gray-600">
                        {formatCurrency(project.contract_value)}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
