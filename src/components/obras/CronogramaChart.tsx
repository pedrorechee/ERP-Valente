'use client'

import { useState } from 'react'
import type { ProjectPhase, CriticalMilestone, PhaseStatus } from '@/types/database'
import { PHASE_STATUS_LABELS } from '@/types/database'
import { formatDate } from '@/lib/format'

interface Props {
  phases:          ProjectPhase[]
  milestones:      CriticalMilestone[]
  overallProgress: number
}

const GOLD = '#E6C07B'
const GREEN = '#4A7C59'
const TERRACOTTA = '#C68B59'
const RED = '#8B3A3A'
const BROWN = '#8A5A3B'
const DARK = '#3B2418'
const ALT_BG = '#F9F7F4'

const NAME_W = 220
const HEADER_H = 36
const ROW_H = 56
const BAR_H = 20
const MAX_H = 540
const MS_DAY = 86400000

const MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const STATUS_COLOR: Record<PhaseStatus, string> = {
  not_started: '#6B7280',
  in_progress: BROWN,
  completed:   GREEN,
  delayed:     RED,
}

function toMs(iso: string): number {
  return new Date(iso + 'T00:00:00Z').getTime()
}

function dayDiff(fromIso: string, toIso: string): number {
  return Math.round((toMs(toIso) - toMs(fromIso)) / MS_DAY)
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

type PhaseInfo = {
  hasPlanned: boolean
  startPct: number
  endPct: number
  isNotStarted: boolean
  fillColor: string
  prazoText: string
  prazoColor: string
}

type Tip =
  | { x: number; y: number; kind: 'phase'; phase: ProjectPhase; info: PhaseInfo }
  | { x: number; y: number; kind: 'milestone'; m: CriticalMilestone }
  | null

export default function CronogramaChart({ phases: rawPhases, milestones, overallProgress }: Props) {
  const [tip, setTip] = useState<Tip>(null)
  const today = todayIso()

  const phases = [...rawPhases].sort((a, b) => a.order_index - b.order_index)

  // ── Faixa de tempo ───────────────────────────────────────────
  const dates: number[] = [toMs(today)]
  for (const p of phases) {
    if (p.expected_start) dates.push(toMs(p.expected_start))
    if (p.expected_end) dates.push(toMs(p.expected_end))
    if (p.actual_end) dates.push(toMs(p.actual_end))
  }
  for (const m of milestones) {
    dates.push(toMs(m.planned_date))
    if (m.actual_date) dates.push(toMs(m.actual_date))
  }

  const hasDates = phases.some((p) => p.expected_start || p.expected_end) || milestones.length > 0
  if (!hasDates) {
    return (
      <div className="rounded-xl border border-dashed border-gold/40 py-12 text-center">
        <p className="text-sm text-gray-400">
          Cadastre as datas previstas das fases para visualizar o cronograma.
        </p>
      </div>
    )
  }

  let minMs = Math.min(...dates)
  let maxMs = Math.max(...dates)
  const span = Math.max(maxMs - minMs, MS_DAY)
  const pad = Math.max(span * 0.04, 3 * MS_DAY)
  minMs -= pad
  maxMs += pad
  const total = maxMs - minMs
  const pct = (ms: number) => ((ms - minMs) / total) * 100
  const todayPct = pct(toMs(today))

  // ── Marcações de mês ─────────────────────────────────────────
  const months: { pct: number; label: string }[] = []
  {
    const start = new Date(minMs)
    let y = start.getUTCFullYear()
    let m = start.getUTCMonth()
    let cursor = Date.UTC(y, m, 1)
    if (cursor < minMs) {
      m += 1
      if (m > 11) { m = 0; y += 1 }
      cursor = Date.UTC(y, m, 1)
    }
    while (cursor <= maxMs && months.length < 60) {
      months.push({ pct: pct(cursor), label: `${MONTH_ABBR[m]}/${String(y).slice(2)}` })
      m += 1
      if (m > 11) { m = 0; y += 1 }
      cursor = Date.UTC(y, m, 1)
    }
  }

  const timelineMin = Math.max(560, months.length * 88)

  // ── Cálculo por fase ─────────────────────────────────────────
  function computePhase(p: ProjectPhase): PhaseInfo {
    const hasPlanned = !!p.expected_start && !!p.expected_end
    const startPct = hasPlanned ? pct(toMs(p.expected_start!)) : 0
    const endPct = hasPlanned ? pct(toMs(p.expected_end!)) : 0
    const isNotStarted = p.status === 'not_started'

    let fillColor = GREEN
    let prazoText = '—'
    let prazoColor = BROWN

    if (p.status === 'completed') {
      const ref = p.actual_end ?? today
      if (p.expected_end) {
        const diff = dayDiff(p.expected_end, ref)
        if (diff <= 0) {
          fillColor = GREEN; prazoColor = GREEN
          prazoText = diff === 0 ? 'no prazo' : `${-diff} dia${-diff !== 1 ? 's' : ''} adiantado`
        } else if (diff <= 7) {
          fillColor = TERRACOTTA; prazoColor = TERRACOTTA
          prazoText = `${diff} dia${diff !== 1 ? 's' : ''} de atraso`
        } else {
          fillColor = RED; prazoColor = RED
          prazoText = `${diff} dia${diff !== 1 ? 's' : ''} de atraso`
        }
      } else {
        prazoText = 'no prazo'; prazoColor = GREEN
      }
    } else if (!isNotStarted) {
      if (p.expected_end) {
        if (today <= p.expected_end) {
          fillColor = GREEN; prazoColor = GREEN; prazoText = 'no prazo'
        } else {
          const diff = dayDiff(p.expected_end, today)
          fillColor = diff <= 7 ? TERRACOTTA : RED
          prazoColor = fillColor
          prazoText = `${diff} dia${diff !== 1 ? 's' : ''} de atraso`
        }
      } else {
        prazoText = 'no prazo'; prazoColor = GREEN
      }
    }

    return { hasPlanned, startPct, endPct, isNotStarted, fillColor, prazoText, prazoColor }
  }

  // ── Resumo ───────────────────────────────────────────────────
  const total_ = phases.length
  const concl = phases.filter((p) => p.status === 'completed').length
  const andamento = phases.filter((p) => p.status === 'in_progress').length
  const atrasadas = phases.filter((p) => p.status === 'delayed').length

  function showPhaseTip(e: React.MouseEvent, p: ProjectPhase, info: PhaseInfo) {
    setTip({ x: e.clientX, y: e.clientY, kind: 'phase', phase: p, info })
  }
  function showMilestoneTip(e: React.MouseEvent, m: CriticalMilestone) {
    setTip({ x: e.clientX, y: e.clientY, kind: 'milestone', m })
  }

  return (
    <div className="rounded-xl border border-gold/40 bg-white p-5 shadow-sm">

      {/* Resumo */}
      <p className="mb-3 text-sm" style={{ color: DARK }}>
        <span style={{ color: GREEN, fontWeight: 600 }}>{concl} de {total_}</span> fases concluídas
        <span className="mx-1.5 text-gray-300">·</span>
        <span style={{ color: BROWN, fontWeight: 600 }}>{andamento}</span> em andamento
        <span className="mx-1.5 text-gray-300">·</span>
        <span style={{ color: atrasadas > 0 ? RED : '#9a8b73', fontWeight: 600 }}>{atrasadas}</span> atrasadas
        <span className="mx-1.5 text-gray-300">·</span>
        Progresso geral: <span style={{ color: DARK, fontWeight: 700 }}>{overallProgress}%</span>
      </p>

      {/* Legenda */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs" style={{ color: BROWN }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-4 rounded" style={{ backgroundColor: GOLD, opacity: 0.55 }} />
          Planejado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-4 rounded" style={{ backgroundColor: GREEN }} />
          No prazo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-4 rounded" style={{ backgroundColor: TERRACOTTA }} />
          Atraso leve
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-4 rounded" style={{ backgroundColor: RED }} />
          Atraso grave
        </span>
        {milestones.length > 0 && (
          <>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rotate-45 rounded-[1px]" style={{ backgroundColor: GREEN }} />
              Marco atingido
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rotate-45 rounded-[1px]" style={{ backgroundColor: GOLD }} />
              Marco pendente
            </span>
          </>
        )}
      </div>

      {/* Gráfico — scroll horizontal + vertical, cabeçalho e coluna de nomes fixos */}
      <div className="relative overflow-auto rounded-lg border border-gold/20" style={{ maxHeight: MAX_H }}>
        <div style={{ minWidth: NAME_W + timelineMin }}>

          {/* Cabeçalho de meses (fixo no topo) */}
          <div className="sticky top-0 z-30 flex bg-white" style={{ height: HEADER_H }}>
            <div
              className="sticky left-0 z-40 shrink-0 border-b border-r border-gold/20 bg-white"
              style={{ width: NAME_W }}
            />
            <div className="relative flex-1 border-b border-gold/20">
              {months.map((mo, i) => (
                <div key={i} className="absolute inset-y-0" style={{ left: `${mo.pct}%` }}>
                  <div className="h-full w-px" style={{ backgroundColor: GOLD, opacity: 0.35 }} />
                  <span
                    className="absolute top-1/2 -translate-y-1/2 pl-1 text-[11px] font-medium whitespace-nowrap"
                    style={{ color: BROWN }}
                  >
                    {mo.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Corpo */}
          <div className="flex">
            {/* Coluna de nomes (fixa à esquerda) */}
            <div className="sticky left-0 z-20 shrink-0 bg-white" style={{ width: NAME_W }}>
              {phases.map((p, i) => (
                <div
                  key={p.id}
                  className="flex flex-col justify-center border-b border-r px-3"
                  style={{
                    height: ROW_H,
                    backgroundColor: i % 2 === 1 ? ALT_BG : '#fff',
                    borderColor: 'rgba(230,192,123,0.3)',
                  }}
                >
                  <span className="truncate text-sm font-semibold" style={{ color: DARK }}>{p.name}</span>
                  <span
                    className="mt-1 w-fit rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ color: STATUS_COLOR[p.status], backgroundColor: `${STATUS_COLOR[p.status]}1A` }}
                  >
                    {PHASE_STATUS_LABELS[p.status]}
                  </span>
                </div>
              ))}
            </div>

            {/* Área da timeline */}
            <div className="relative flex-1">
              {/* Zebra */}
              <div className="absolute inset-0 z-0">
                {phases.map((p, i) => (
                  <div key={p.id} style={{ height: ROW_H, backgroundColor: i % 2 === 1 ? ALT_BG : 'transparent' }} />
                ))}
              </div>

              {/* Grade de meses */}
              <div className="pointer-events-none absolute inset-0 z-[1]">
                {months.map((mo, i) => (
                  <div
                    key={i}
                    className="absolute inset-y-0 w-px"
                    style={{ left: `${mo.pct}%`, backgroundColor: GOLD, opacity: 0.2 }}
                  />
                ))}
              </div>

              {/* Linhas das fases com barras */}
              <div className="relative z-10">
                {phases.map((p) => {
                  const info = computePhase(p)
                  return (
                    <div
                      key={p.id}
                      className="relative border-b"
                      style={{ height: ROW_H, borderColor: 'rgba(230,192,123,0.3)' }}
                    >
                      {info.hasPlanned ? (
                        <>
                          {/* Barra (período planejado) */}
                          <div
                            className="absolute rounded-md"
                            style={{
                              left: `${info.startPct}%`,
                              width: `${Math.max(info.endPct - info.startPct, 0.8)}%`,
                              top: (ROW_H - BAR_H) / 2,
                              height: BAR_H,
                              backgroundColor: info.isNotStarted ? 'transparent' : `${GOLD}66`,
                              border: info.isNotStarted ? `1.5px dashed ${GOLD}` : 'none',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => showPhaseTip(e, p, info)}
                            onMouseMove={(e) => showPhaseTip(e, p, info)}
                            onMouseLeave={() => setTip(null)}
                          >
                            {/* Preenchimento (progresso real) */}
                            {!info.isNotStarted && (
                              <div
                                className="h-full rounded-md"
                                style={{ width: `${p.progress}%`, backgroundColor: info.fillColor }}
                              />
                            )}
                          </div>

                          {/* % ao final da barra */}
                          {!info.isNotStarted && (
                            <span
                              className="absolute text-[11px] font-semibold"
                              style={{
                                left: info.endPct > 82
                                  ? undefined
                                  : `calc(${info.endPct}% + 6px)`,
                                right: info.endPct > 82 ? `calc(${100 - info.endPct}% + 6px)` : undefined,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: DARK,
                              }}
                            >
                              {p.progress}%
                            </span>
                          )}
                        </>
                      ) : (
                        <span
                          className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] italic"
                          style={{ color: '#c9bca5' }}
                        >
                          Sem datas previstas
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Linha HOJE */}
              <div className="pointer-events-none absolute inset-y-0 z-20" style={{ left: `${todayPct}%` }}>
                <div className="h-full" style={{ width: 2, backgroundColor: TERRACOTTA }} />
                <span
                  className="absolute top-1 -translate-x-1/2 rounded px-1.5 py-0.5 text-[9px] font-bold"
                  style={{ backgroundColor: GOLD, color: DARK }}
                >
                  HOJE
                </span>
              </div>

              {/* Marcos */}
              <div className="absolute inset-x-0 top-0 z-30" style={{ height: 0 }}>
                {milestones.map((m) => {
                  const reached = m.status === 'completed'
                  return (
                    <div
                      key={m.id}
                      className="group absolute flex -translate-x-1/2 cursor-pointer items-start justify-center"
                      style={{
                        left: `${pct(toMs(m.actual_date ?? m.planned_date))}%`,
                        top: -3,
                        width: 24,
                        height: 24,
                      }}
                      onMouseEnter={(e) => showMilestoneTip(e, m)}
                      onMouseMove={(e) => showMilestoneTip(e, m)}
                      onMouseLeave={() => setTip(null)}
                    >
                      <div
                        className="mt-1.5 h-3 w-3 rotate-45 rounded-[2px] border border-white shadow-sm transition-transform group-hover:scale-150"
                        style={{ backgroundColor: reached ? GREEN : GOLD }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tip && (
        <div
          className="pointer-events-none fixed z-50 max-w-[260px] rounded-lg border bg-white px-3 py-2 text-xs shadow-xl"
          style={{ left: tip.x + 14, top: tip.y + 14, borderColor: GOLD, color: DARK }}
        >
          {tip.kind === 'phase' ? (
            <>
              <p className="mb-1 font-bold" style={{ color: DARK }}>{tip.phase.name}</p>
              <p className="mb-1.5 font-medium" style={{ color: STATUS_COLOR[tip.phase.status] }}>
                {PHASE_STATUS_LABELS[tip.phase.status]}
              </p>
              <p>Início previsto: {tip.phase.expected_start ? formatDate(tip.phase.expected_start) : '—'}</p>
              <p>Término previsto: {tip.phase.expected_end ? formatDate(tip.phase.expected_end) : '—'}</p>
              <p>Concluída em: {tip.phase.actual_end ? formatDate(tip.phase.actual_end) : '—'}</p>
              <p>Progresso: {tip.phase.progress}%</p>
              <p style={{ color: tip.info.prazoColor, fontWeight: 600 }}>Prazo: {tip.info.prazoText}</p>
            </>
          ) : (
            <>
              <p className="mb-1 font-bold" style={{ color: DARK }}>{tip.m.description}</p>
              <p className="mb-1 font-medium" style={{ color: tip.m.status === 'completed' ? GREEN : BROWN }}>
                {tip.m.status === 'completed' ? 'Marco atingido' : 'Marco pendente'}
              </p>
              <p>Previsto: {formatDate(tip.m.planned_date)}</p>
              {tip.m.actual_date && <p>Atingido em: {formatDate(tip.m.actual_date)}</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
