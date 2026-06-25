'use client'

import type { CostCategory, EntryType } from '@/types/database'

interface Props {
  categories: CostCategory[]
  entryType:  EntryType
  value:      string
  onChange:   (id: string) => void
  className?: string
  required?:  boolean
}

// Select de categoria baseado no plano de contas: lista as contas ATIVAS
// da natureza correspondente ao tipo do lançamento, no formato "código — descrição".
export function CategoriaSelect({ categories, entryType, value, onChange, className, required = true }: Props) {
  const nature = entryType === 'income' ? 'income' : 'expense'
  const opts = categories.filter((c) => c.is_active && c.nature === nature)

  // Garante que a conta selecionada apareça mesmo que esteja inativa (ao editar)
  const selected = value ? categories.find((c) => c.id === value) : null
  if (selected && !opts.some((c) => c.id === selected.id)) opts.unshift(selected)

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className={className}
    >
      <option value="">Selecionar…</option>
      {opts.map((c) => (
        <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
      ))}
    </select>
  )
}

// Nome da conta (para gravar em category text por compatibilidade)
export function categoryName(categories: CostCategory[], id: string): string {
  return categories.find((c) => c.id === id)?.name ?? ''
}
