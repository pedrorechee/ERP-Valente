'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, UserPlus, Check, Search } from 'lucide-react'
import { searchClients } from '@/app/actions/search'
import { NovoClienteRapidoModal } from './NovoClienteRapidoModal'

type ClientOption = { id: string; name: string }

type Props = {
  initialClients: ClientOption[]
  defaultClientId?: string
  name?: string
}

export function ClienteSelectComBusca({ initialClients, defaultClientId, name = 'client_id' }: Props) {
  const defaultClient = initialClients.find((c) => c.id === defaultClientId)

  const [options, setOptions]       = useState<ClientOption[]>(initialClients)
  const [selectedId, setSelectedId] = useState(defaultClientId ?? '')
  const [selectedName, setSelectedName] = useState(defaultClient?.name ?? '')
  const [query, setQuery]           = useState('')
  const [open, setOpen]             = useState(false)
  const [loading, setLoading]       = useState(false)
  const [quickOpen, setQuickOpen]   = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
        setOptions(initialClients)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [initialClients])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim()) {
      setOptions(initialClients)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const results = await searchClients(val)
        setOptions(results)
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  function selectClient(c: ClientOption) {
    setSelectedId(c.id)
    setSelectedName(c.name)
    setOpen(false)
    setQuery('')
    setOptions(initialClients)
  }

  function handleQuickSave(newClient: ClientOption) {
    setOptions((prev) => [newClient, ...prev])
    setSelectedId(newClient.id)
    setSelectedName(newClient.name)
    setOpen(false)
    setQuery('')
    setQuickOpen(false)
  }

  const showingInitial = !query.trim()

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={selectedId} />

      {/* Trigger / search input */}
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
              placeholder="Buscar cliente pelo nome..."
              className="flex-1 outline-none placeholder:text-gray-400"
            />
            {loading && <span className="text-xs text-gray-300 ml-1">…</span>}
          </>
        ) : (
          <>
            <span className={`flex-1 ${selectedId ? 'text-dark' : 'text-gray-400'}`}>
              {selectedId ? selectedName : 'Buscar cliente pelo nome...'}
            </span>
            {selectedId && <Check className="h-3.5 w-3.5 shrink-0 text-green-600 mr-1" />}
          </>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-gold/30 bg-white shadow-lg overflow-hidden">
          <div className="max-h-52 overflow-y-auto">
            {options.length === 0 ? (
              <div>
                <p className="px-4 py-3 text-sm text-gray-400">Nenhum cliente encontrado</p>
                {query.trim() && (
                  <button
                    type="button"
                    onClick={() => { setOpen(false); setQuickOpen(true) }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-terracotta hover:bg-cream/50 transition-colors"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    + Cadastrar &ldquo;{query}&rdquo; como novo cliente
                  </button>
                )}
              </div>
            ) : (
              options.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectClient(c)}
                  className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                    c.id === selectedId
                      ? 'bg-cream text-dark font-medium'
                      : 'text-dark hover:bg-cream/60'
                  }`}
                >
                  {c.id === selectedId && <Check className="h-3.5 w-3.5 shrink-0 text-terracotta" />}
                  <span className={c.id === selectedId ? '' : 'ml-5'}>{c.name}</span>
                </button>
              ))
            )}
          </div>

          {showingInitial && options.length > 0 && (
            <div className="border-t border-gold/10 px-4 py-2">
              <p className="text-xs text-gray-400">Digite para buscar mais clientes</p>
            </div>
          )}

          {options.length > 0 && (
            <div className="border-t border-gold/20">
              <button
                type="button"
                onClick={() => { setOpen(false); setQuickOpen(true) }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-terracotta hover:bg-cream/50 transition-colors"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Não encontrou? Cadastrar novo cliente
              </button>
            </div>
          )}
        </div>
      )}

      {quickOpen && (
        <NovoClienteRapidoModal
          onSave={handleQuickSave}
          onClose={() => setQuickOpen(false)}
        />
      )}
    </div>
  )
}
