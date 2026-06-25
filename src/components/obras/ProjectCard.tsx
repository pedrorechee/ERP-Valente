'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MapPin, Calendar, User, TrendingUp, AlertTriangle } from 'lucide-react'
import type { Project } from '@/types/database'
import { PROJECT_STATUS_LABELS, PROJECT_TYPE_LABELS } from '@/types/database'
import { formatDate, isOverdue, formatProjectAddress } from '@/lib/format'

interface ProjectCardProps {
  project: Project
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-red-100 text-red-800',
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter()
  const overdue = project.status === 'active' && isOverdue(project.expected_end_date)
  const progress = project.overall_progress

  return (
    <Link
      href={`/obras/${project.id}`}
      className="block group"
      onMouseEnter={() => router.prefetch(`/obras/${project.id}`)}
    >
      <div className="rounded-xl border border-gold/40 bg-white p-5 shadow-sm transition-all hover:border-gold hover:shadow-md">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="truncate font-semibold text-dark group-hover:text-terracotta transition-colors">
              {project.name}
            </h3>
            <p className="mt-0.5 text-xs text-gray-400">
              {PROJECT_TYPE_LABELS[project.type]}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              STATUS_COLORS[project.status]
            }`}
          >
            {PROJECT_STATUS_LABELS[project.status]}
          </span>
        </div>

        {/* Info */}
        <div className="mb-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{formatProjectAddress(project)}</span>
          </div>
          {project.technical_responsible && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{project.technical_responsible}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>
              Prazo: {formatDate(project.expected_end_date)}
            </span>
            {overdue && (
              <span className="flex items-center gap-0.5 text-red-500 font-medium">
                <AlertTriangle className="h-3 w-3" />
                Atrasada
              </span>
            )}
          </div>
        </div>

        {/* Progress */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Progresso</span>
            </div>
            <span className="text-xs font-semibold text-dark">{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full transition-all ${
                overdue ? 'bg-red-400' : 'bg-terracotta'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  )
}
