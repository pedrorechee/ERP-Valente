'use client'

import { useState, useCallback } from 'react'

interface CurrencyInputProps {
  name: string
  defaultValue?: number | null
  required?: boolean
  className?: string
  /** Callback opcional com o valor numérico atual (para previews ao vivo) */
  onValueChange?: (value: number) => void
}

function digitsToDisplay(digits: string): string {
  const padded = digits.padStart(3, '0')
  const cents = padded.slice(-2)
  const reais = padded.slice(0, -2).replace(/^0+/, '') || '0'
  return `R$ ${reais.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${cents}`
}

function digitsToDecimal(digits: string): string {
  const padded = digits.padStart(3, '0')
  const cents = padded.slice(-2)
  const reais = padded.slice(0, -2).replace(/^0+/, '') || '0'
  return `${reais}.${cents}`
}

export function CurrencyInput({ name, defaultValue, required, className, onValueChange }: CurrencyInputProps) {
  const [digits, setDigits] = useState(() =>
    defaultValue != null && defaultValue > 0
      ? String(Math.round(defaultValue * 100))
      : ''
  )

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').replace(/^0+/, '')
    setDigits(raw)
    onValueChange?.(raw ? Number(digitsToDecimal(raw)) : 0)
  }, [onValueChange])

  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        value={digits ? digitsToDisplay(digits) : ''}
        onChange={handleChange}
        placeholder="R$ 0,00"
        required={required}
        className={className}
      />
      <input type="hidden" name={name} value={digits ? digitsToDecimal(digits) : ''} />
    </>
  )
}
