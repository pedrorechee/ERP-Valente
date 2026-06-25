'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface AreaInputProps {
  name: string
  defaultValue?: number | null
  required?: boolean
  className?: string
}

export function AreaInput({ name, defaultValue, required, className }: AreaInputProps) {
  const [digits, setDigits] = useState(() =>
    defaultValue != null && defaultValue > 0 ? String(Math.round(defaultValue)) : ''
  )

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').replace(/^0+/, '')
    setDigits(raw)
  }, [])

  const displayValue = digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        placeholder="0"
        required={required}
        className={cn(className, 'pr-10')}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 select-none text-sm text-gray-400">
        m²
      </span>
      <input type="hidden" name={name} value={digits} />
    </div>
  )
}
