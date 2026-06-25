'use client'

import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'

interface Props {
  label: string
  pendingLabel?: string
  className?: string
}

/**
 * Botão de submit para formulários com server action (<form action={...}>).
 * Mostra loading e bloqueia duplo clique enquanto a action roda.
 */
export function SubmitButton({ label, pendingLabel = 'Salvando…', className }: Props) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? pendingLabel : label}
    </button>
  )
}
