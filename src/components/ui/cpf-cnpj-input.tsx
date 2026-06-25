'use client'

import { useState, useCallback } from 'react'

interface CpfCnpjInputProps {
  name: string
  defaultValue?: string | null
  required?: boolean
  className?: string
}

function formatCpfCnpj(digits: string): string {
  const d = digits.slice(0, 14)
  const len = d.length
  if (len === 0) return ''

  if (len <= 11) {
    let result = d.slice(0, 3)
    if (len > 3) result += '.' + d.slice(3, 6)
    if (len > 6) result += '.' + d.slice(6, 9)
    if (len > 9) result += '-' + d.slice(9, 11)
    return result
  } else {
    let result = d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8, 12)
    if (len > 12) result += '-' + d.slice(12, 14)
    return result
  }
}

export function CpfCnpjInput({ name, defaultValue, required, className }: CpfCnpjInputProps) {
  const [digits, setDigits] = useState(() =>
    defaultValue ? defaultValue.replace(/\D/g, '').slice(0, 14) : ''
  )

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDigits(e.target.value.replace(/\D/g, '').slice(0, 14))
  }, [])

  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        value={formatCpfCnpj(digits)}
        onChange={handleChange}
        placeholder="000.000.000-00"
        required={required}
        className={className}
      />
      <input type="hidden" name={name} value={digits} />
    </>
  )
}
