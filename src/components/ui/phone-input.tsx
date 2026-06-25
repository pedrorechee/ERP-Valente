'use client'

import { useState, useCallback } from 'react'

interface PhoneInputProps {
  name: string
  defaultValue?: string | null
  required?: boolean
  className?: string
}

function formatPhone(digits: string): string {
  const d = digits.slice(0, 11)
  const len = d.length
  if (len === 0) return ''
  if (len <= 2) return `(${d}`
  if (len <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (len <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function PhoneInput({ name, defaultValue, required, className }: PhoneInputProps) {
  const [digits, setDigits] = useState(() =>
    defaultValue ? defaultValue.replace(/\D/g, '').slice(0, 11) : ''
  )

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDigits(e.target.value.replace(/\D/g, '').slice(0, 11))
  }, [])

  return (
    <>
      <input
        type="text"
        inputMode="tel"
        value={formatPhone(digits)}
        onChange={handleChange}
        placeholder="(00) 00000-0000"
        required={required}
        className={className}
      />
      <input type="hidden" name={name} value={digits} />
    </>
  )
}
