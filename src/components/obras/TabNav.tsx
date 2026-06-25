'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  Loader2, LayoutDashboard, Layers, BookOpen,
  FileText, Flag, DollarSign,
} from 'lucide-react'

const TABS = [
  { key: 'visao-geral', label: 'Visão Geral',     icon: LayoutDashboard },
  { key: 'fases',       label: 'Fases e Tarefas',  icon: Layers },
  { key: 'diario',      label: 'Diário',           icon: BookOpen },
  { key: 'documentos',  label: 'Documentos',       icon: FileText },
  { key: 'marcos',      label: 'Marcos',           icon: Flag },
  { key: 'financeiro',  label: 'Financeiro',       icon: DollarSign },
]

interface Props {
  projectId: string
  activeTab: string
}

export function TabNav({ projectId, activeTab }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  function handleClick(key: string) {
    if (key === activeTab && !isPending) return
    setPendingKey(key)
    startTransition(() => {
      router.push(`/obras/${projectId}?tab=${key}`, { scroll: false })
    })
  }

  return (
    <div className="flex min-w-max gap-1 rounded-xl border border-gold/30 bg-cream/30 p-1">
      {TABS.map(({ key, label, icon: Icon }) => {
        const isActive = activeTab === key && !isPending
        const isLoading = isPending && pendingKey === key

        return (
          <button
            key={key}
            onClick={() => handleClick(key)}
            disabled={isPending}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap disabled:cursor-default ${
              isActive
                ? 'bg-white text-dark shadow-sm'
                : 'text-gray-500 hover:text-dark hover:bg-white/60'
            }`}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Icon className="h-3.5 w-3.5" />
            )}
            {label}
          </button>
        )
      })}
    </div>
  )
}
