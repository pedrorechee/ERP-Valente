'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Check, Search } from 'lucide-react'
import { searchClients, searchSuppliers } from '@/app/actions/search'
import type { EntryType } from '@/types/database'

type Option = { id: string; name: string }

type Props = {
  entryType: EntryType
  initialClients:   Option[]
  initialSuppliers: Option[]
  defaultSupplierId?: string
  defaultCounterpart?: string
  /** Notifica o pai quando o fornecedor selecionado muda (null = sem fornecedor / é cliente) */
  onSupplierChange?: (supplierId: string | null) => void
}

export function EntidadeSelect({
  entryType,
  initialClients,
  initialSuppliers,
  defaultSupplierId,
  defaultCounterpart,
  onSupplierChange,
}: Props) {
  const isIncome = entryType === 'income'
  const initial = isIncome ? initialClients : initialSuppliers

  // Try to find initial selected option
  const initOption: Option | null = (() => {
    if (!isIncome && defaultSupplierId) {
      // Pré-seleciona o fornecedor salvo. A lista inicial é limitada (top 5),
      // então se ele não estiver nela, monta a opção com o id salvo + nome (counterpart).
      return (
        initialSuppliers.find((s) => s.id === defaultSupplierId) ??
        (defaultCounterpart ? { id: defaultSupplierId, name: defaultCounterpart } : null)
      )
    }
    if (isIncome && defaultCounterpart) {
      // Cliente da entrada é identificado pelo counterpart (nome). Se não estiver na
      // lista inicial, monta a opção só com o nome (id sintético — não é enviado no form).
      return (
        initialClients.find((c) => c.name === defaultCounterpart) ??
        { id: `counterpart:${defaultCounterpart}`, name: defaultCounterpart }
      )
    }
    return null
  })()

  const [options, setOptions]           = useState<Option[]>(initial)
  const [selected, setSelected]         = useState<Option | null>(initOption)
  const [query, setQuery]               = useState('')
  const [open, setOpen]                 = useState(false)
  const [loading, setLoading]           = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Avisa o pai sobre o fornecedor selecionado (no mount, ao trocar tipo e ao selecionar).
  // Cliente (entrada) nunca tem fornecedor → reporta null.
  const onSupplierChangeRef = useRef(onSupplierChange)
  useEffect(() => { onSupplierChangeRef.current = onSupplierChange })
  useEffect(() => {
    onSupplierChangeRef.current?.(isIncome ? null : (selected?.id ?? null))
  }, [selected, isIncome])

  // Reset SOMENTE quando o usuário troca Entrada/Saída de fato.
  // Comparar com o valor anterior (em vez de "pular o mount") é imune ao
  // double-invoke de effects do React StrictMode, que reexecuta no mount.
  const prevTypeRef = useRef(entryType)
  useEffect(() => {
    if (prevTypeRef.current === entryType) return
    prevTypeRef.current = entryType
    setSelected(null)
    setOptions(isIncome ? initialClients : initialSuppliers)
    setQuery('')
  }, [entryType])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
        setOptions(isIncome ? initialClients : initialSuppliers)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [isIncome, initialClients, initialSuppliers])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim()) {
      setOptions(isIncome ? initialClients : initialSuppliers)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const results = isIncome ? await searchClients(val) : await searchSuppliers(val)
        setOptions(results)
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  function selectOption(opt: Option) {
    setSelected(opt)
    setOpen(false)
    setQuery('')
    setOptions(isIncome ? initialClients : initialSuppliers)
  }

  const showingInitial = !query.trim()
  const label = isIncome ? 'CLIENTE' : 'FORNECEDOR / PRESTADOR'
  const placeholder = isIncome ? 'Buscar cliente...' : 'Buscar fornecedor...'
  const emptyMsg = isIncome
    ? 'Nenhum resultado. Cadastre em Clientes.'
    : 'Nenhum resultado. Cadastre em Fornecedores.'

  return (
    <div ref={containerRef} className="relative">
      {/* Hidden fields for form submission */}
      {!isIncome && (
        <input type="hidden" name="supplier_id" value={selected?.id ?? ''} />
      )}
      <input type="hidden" name="counterpart" value={selected?.name ?? ''} />

      <label className="text-xs font-semibold uppercase tracking-wide text-brown">
        {label} *
      </label>
      <div className="mt-1.5">
        <div
          className="flex w-full cursor-text items-center rounded-lg border border-gold/50 bg-white px-3 py-2 text-sm focus-within:border-terracotta focus-within:ring-1 focus-within:ring-terracotta"
          onClick={() => setOpen(true)}
        >
          {open ? (
            <>
              <Search className="h-3.5 w-3.5 shrink-0 text-gray-300 mr-2" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={handleInput}
                placeholder={placeholder}
                className="flex-1 outline-none placeholder:text-gray-400"
              />
              {loading && <span className="text-xs text-gray-300 ml-1">…</span>}
            </>
          ) : (
            <>
              <span className={`flex-1 ${selected ? 'text-dark' : 'text-gray-400'}`}>
                {selected ? selected.name : placeholder}
              </span>
              {selected && <Check className="h-3.5 w-3.5 shrink-0 text-green-600 mr-1" />}
            </>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        </div>

        {/* Dropdown */}
        {open && (
          <div className="absolute z-30 mt-1 w-full rounded-lg border border-gold/30 bg-white shadow-lg overflow-hidden">
            <div className="max-h-52 overflow-y-auto">
              {options.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">{emptyMsg}</p>
              ) : (
                options.map(o => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => selectOption(o)}
                    className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                      o.id === selected?.id
                        ? 'bg-cream text-dark font-medium'
                        : 'text-dark hover:bg-cream/60'
                    }`}
                  >
                    {o.id === selected?.id && <Check className="h-3.5 w-3.5 shrink-0 text-terracotta" />}
                    <span className={o.id === selected?.id ? '' : 'ml-5'}>{o.name}</span>
                  </button>
                ))
              )}
            </div>

            {showingInitial && options.length > 0 && (
              <div className="border-t border-gold/10 px-4 py-2">
                <p className="text-xs text-gray-400">
                  {isIncome ? 'Digite para buscar mais clientes' : 'Digite para buscar mais fornecedores'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
