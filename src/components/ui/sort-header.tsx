'use client'

import { ChevronUp, ChevronDown } from 'lucide-react'
import type { SortDir } from '@/hooks/useTableSort'

interface Props {
  label: string
  sortKey: string
  currentKey: string
  currentDir: SortDir
  onSort: (key: string) => void
  /** Pass responsive + alignment classes: e.g. "text-right hidden lg:table-cell" */
  className?: string
}

export function SortHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  className = '',
}: Props) {
  const isActive = currentKey === sortKey && currentDir !== null

  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-wide transition-colors hover:bg-cream/60 ${
        isActive ? 'text-terracotta' : 'text-gray-400 hover:text-brown'
      } ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && currentDir === 'asc' && (
          <ChevronUp className="h-3.5 w-3.5 shrink-0" style={{ color: '#C68B59' }} />
        )}
        {isActive && currentDir === 'desc' && (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: '#C68B59' }} />
        )}
      </span>
    </th>
  )
}
