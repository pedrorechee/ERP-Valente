'use client'

import { useState, useCallback, useRef } from 'react'

interface EmailInputProps {
  name: string
  defaultValue?: string | null
  required?: boolean
  placeholder?: string
  className?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function EmailInput({ name, defaultValue, required, placeholder, className }: EmailInputProps) {
  const [value, setValue] = useState(defaultValue ?? '')
  const [error, setError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleBlur = useCallback(() => {
    const val = value.trim()
    if (val === '') {
      setError(false)
      inputRef.current?.setCustomValidity('')
      return
    }
    const valid = EMAIL_RE.test(val)
    setError(!valid)
    inputRef.current?.setCustomValidity(valid ? '' : 'Digite um e-mail válido')
  }, [value])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    if (error) {
      setError(false)
      inputRef.current?.setCustomValidity('')
    }
  }, [error])

  return (
    <div>
      <input
        ref={inputRef}
        type="email"
        name={name}
        value={value}
        required={required}
        placeholder={placeholder ?? 'email@exemplo.com'}
        onChange={handleChange}
        onBlur={handleBlur}
        className={className}
        style={error ? { borderColor: '#8B3A3A', outlineColor: '#8B3A3A' } : undefined}
      />
      {error && (
        <p className="mt-1 text-xs font-medium" style={{ color: '#8B3A3A' }}>
          Digite um e-mail válido
        </p>
      )}
    </div>
  )
}
