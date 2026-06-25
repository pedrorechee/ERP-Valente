'use client'

import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type {
  ProjectPhase, PhaseTask, CriticalMilestone, DiaryEntry, FinancialEntry,
} from '@/types/database'
import { formatDate, formatCurrency } from '@/lib/format'

interface Props {
  phases:           (ProjectPhase & { phase_tasks: PhaseTask[] })[]
  milestones:       CriticalMilestone[]
  diaryEntries:     DiaryEntry[]
  financialEntries: FinancialEntry[]
}

type TLType    = 'fase' | 'marco' | 'diario' | 'entrada' | 'saida'
type FilterType = TLType | 'medicao'

interface TLEvent {
  id:    string
  date:  string
  type:  TLType
  label: string
  title: string
  color: string
}

const COLOR: Record<TLType, string> = {
  fase:    '#4A7C59',
  marco:   '#C68B59',
  diario:  '#8A5A3B',
  entrada: '#4A7C59',
  saida:   '#8B3A3A',
}

const TYPE_LABEL: Record<TLType, string> = {
  fase:    'Fase',
  marco:   'Marco',
  diario:  'Diário',
  entrada: 'Entrada',
  saida:   'Saída',
}

const FILTER_CHIPS: { key: FilterType; label: string }[] = [
  { key: 'entrada', label: 'Entradas'  },
  { key: 'saida',   label: 'Saídas'   },
  { key: 'diario',  label: 'Diário'   },
  { key: 'fase',    label: 'Fases'    },
  { key: 'marco',   label: 'Marcos'   },
  { key: 'medicao', label: 'Medições' },
]

const MAX_EVENTS = 30
const INITIAL    = 6
const STEP       = 10

function truncate(text: string, max = 90): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

export function LinhaDoTempo({ phases, milestones, diaryEntries, financialEntries }: Props) {
  const [shown,       setShown]       = useState(INITIAL)
  const [order,       setOrder]       = useState<'recentes' | 'cronologica'>('recentes')
  const [activeTypes, setActiveTypes] = useState<Set<FilterType>>(() => new Set())
  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')

  // Feed montado em memória a partir dos dados já carregados
  const events = useMemo<TLEvent[]>(() => {
    const list: TLEvent[] = []

    for (const p of phases) {
      if (p.status === 'completed' && p.actual_end) {
        list.push({
          id: `fase-${p.id}`,
          date: p.actual_end,
          type: 'fase',
          label: TYPE_LABEL.fase,
          title: `Fase concluída: ${p.name}`,
          color: COLOR.fase,
        })
      }
    }

    for (const m of milestones) {
      if (m.status === 'completed') {
        list.push({
          id: `marco-${m.id}`,
          date: m.actual_date ?? m.planned_date,
          type: 'marco',
          label: TYPE_LABEL.marco,
          title: `Marco atingido: ${m.description}`,
          color: COLOR.marco,
        })
      }
    }

    for (const d of diaryEntries) {
      list.push({
        id: `diario-${d.id}`,
        date: d.entry_date,
        type: 'diario',
        label: TYPE_LABEL.diario,
        title: truncate(d.work_done),
        color: COLOR.diario,
      })
    }

    for (const f of financialEntries) {
      const isIncome = f.entry_type === 'income'
      list.push({
        id: `fin-${f.id}`,
        date: f.entry_date,
        type: isIncome ? 'entrada' : 'saida',
        label: isIncome ? TYPE_LABEL.entrada : TYPE_LABEL.saida,
        title: `${formatCurrency(f.amount)} — ${truncate(f.description, 70)}`,
        color: isIncome ? COLOR.entrada : COLOR.saida,
      })
    }

    return list
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, MAX_EVENTS)
  }, [phases, milestones, diaryEntries, financialEntries])

  const filtered = useMemo(() => {
    let result = events
    if (activeTypes.size > 0) {
      result = result.filter(e => activeTypes.has(e.type as FilterType))
    }
    if (dateFrom) result = result.filter(e => e.date >= dateFrom)
    if (dateTo)   result = result.filter(e => e.date <= dateTo)
    return result
  }, [events, activeTypes, dateFrom, dateTo])

  const ordered = useMemo(
    () => (order === 'recentes' ? filtered : [...filtered].reverse()),
    [filtered, order]
  )
  const visible     = ordered.slice(0, shown)
  const canShowMore = shown < ordered.length
  const hasFilter   = activeTypes.size > 0 || !!dateFrom || !!dateTo

  function toggleType(key: FilterType) {
    setShown(INITIAL)
    setActiveTypes(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function selectAll() {
    setActiveTypes(new Set())
    setShown(INITIAL)
  }

  function clearAll() {
    setActiveTypes(new Set())
    setDateFrom('')
    setDateTo('')
    setShown(INITIAL)
  }

  function changeOrder(next: 'recentes' | 'cronologica') {
    setOrder(next)
    setShown(INITIAL)
  }

  return (
    <div className="space-y-4">

      {/* Cabeçalho: título + ordenação */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-dark">Linha do tempo</h2>
          {events.length > 0 && (
            <span className="text-xs text-gray-400">
              {filtered.length}
              {!hasFilter && events.length === MAX_EVENTS ? '+' : ''}
              {' '}evento{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {events.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Ordenar:</span>
            <div className="flex rounded-lg border border-gold/40 p-0.5">
              {([
                { key: 'recentes',    label: 'Mais recentes' },
                { key: 'cronologica', label: 'Cronológica'   },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => changeOrder(opt.key)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    order === opt.key
                      ? 'bg-terracotta text-white'
                      : 'text-brown hover:bg-cream'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filtros — só aparecem quando há eventos */}
      {events.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">

          {/* Chips de tipo */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={selectAll}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                activeTypes.size === 0
                  ? 'border-terracotta bg-terracotta text-white'
                  : 'border-gold bg-[#F9F7F4] text-brown hover:bg-gold hover:text-dark'
              }`}
            >
              Todos
            </button>
            {FILTER_CHIPS.map(chip => {
              const active = activeTypes.has(chip.key)
              return (
                <button
                  key={chip.key}
                  onClick={() => toggleType(chip.key)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'border-terracotta bg-terracotta text-white'
                      : 'border-gold bg-[#F9F7F4] text-brown hover:bg-gold hover:text-dark'
                  }`}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>

          {/* Divisor vertical */}
          <div className="hidden h-5 w-px bg-gold/40 sm:block" />

          {/* Período */}
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setShown(INITIAL) }}
                className="h-7 rounded-lg border border-gold/50 bg-white pl-2 pr-6 text-xs text-dark focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              />
              {dateFrom && (
                <button
                  onClick={() => { setDateFrom(''); setShown(INITIAL) }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-dark"
                  aria-label="Limpar data de início"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <span className="text-xs text-gray-400">até</span>
            <div className="relative">
              <input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setShown(INITIAL) }}
                className="h-7 rounded-lg border border-gold/50 bg-white pl-2 pr-6 text-xs text-dark focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              />
              {dateTo && (
                <button
                  onClick={() => { setDateTo(''); setShown(INITIAL) }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-dark"
                  aria-label="Limpar data final"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Limpar filtros */}
          {hasFilter && (
            <button
              onClick={clearAll}
              className="text-xs font-medium text-terracotta hover:text-brown transition-colors"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* Lista de eventos */}
      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gold/40 py-12 text-center">
          <p className="text-sm text-gray-400">
            Nenhum evento registrado ainda. Fases concluídas, marcos, registros do diário e lançamentos financeiros aparecem aqui.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gold/40 py-12 text-center">
          <p className="text-sm text-gray-400">Nenhum evento corresponde aos filtros selecionados.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gold/40 bg-white p-5 shadow-sm">
          <ol className="relative ml-1 border-l border-gold/30">
            {visible.map((e) => (
              <li key={e.id} className="relative pl-5 pb-4 last:pb-0">
                <span
                  className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white"
                  style={{ backgroundColor: e.color }}
                />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-xs font-medium text-gray-400">{formatDate(e.date)}</span>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: e.color, backgroundColor: `${e.color}14` }}
                  >
                    {e.label}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-dark">{e.title}</p>
              </li>
            ))}
          </ol>

          {canShowMore && (
            <button
              onClick={() => setShown((s) => Math.min(s + STEP, ordered.length))}
              className="mt-2 text-sm font-medium text-terracotta hover:text-brown transition-colors"
            >
              Ver mais
            </button>
          )}
        </div>
      )}
    </div>
  )
}
