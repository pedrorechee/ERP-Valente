'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Plus, Sun, Cloud, CloudRain, CloudLightning,
  Pencil, Trash2, X, Check, ChevronRight, AlertTriangle, FileDown,
} from 'lucide-react'
import type { DiaryEntry, DiaryPhoto, WeatherType } from '@/types/database'
import { WEATHER_LABELS } from '@/types/database'
import {
  createDiaryEntry,
  updateDiaryEntry,
  deleteDiaryEntry,
  deleteDiaryPhoto,
} from '@/app/actions/diario'
import { toast } from 'sonner'
import { toastAfterClose } from '@/lib/ui-feedback'
import { useCompany } from '@/components/layout/CompanyProvider'

/* ─── Clima ───────────────────────────────────────────────────── */

const WEATHER_ICONS: Record<WeatherType, React.ReactNode> = {
  sun:    <Sun className="h-3.5 w-3.5 text-yellow-500" />,
  cloudy: <Cloud className="h-3.5 w-3.5 text-gray-400" />,
  rain:   <CloudRain className="h-3.5 w-3.5 text-blue-400" />,
  storm:  <CloudLightning className="h-3.5 w-3.5 text-purple-500" />,
}

/* ─── Helpers de data ─────────────────────────────────────────── */

const MONTHS_PT = [
  'janeiro','fevereiro','março','abril','maio','junho',
  'julho','agosto','setembro','outubro','novembro','dezembro',
]
const MONTHS_ABBR = [
  'jan.','fev.','mar.','abr.','mai.','jun.',
  'jul.','ago.','set.','out.','nov.','dez.',
]
const DAYS_PT = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']

function parseLocal(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00')
}

function getWeekMonday(dateStr: string): Date {
  const d = parseLocal(dateStr)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d
}

function getWeekSunday(monday: Date): Date {
  const d = new Date(monday)
  d.setDate(d.getDate() + 6)
  return d
}

function toKey(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatWeekNavLabel(monday: Date, sunday: Date): string {
  const d1 = String(monday.getDate()).padStart(2, '0')
  const d2 = String(sunday.getDate()).padStart(2, '0')
  const m1 = monday.getMonth()
  const m2 = sunday.getMonth()
  const y  = sunday.getFullYear()
  if (m1 === m2) return `${d1} – ${d2} de ${MONTHS_ABBR[m2]} de ${y}`
  return `${d1} ${MONTHS_ABBR[m1]} – ${d2} ${MONTHS_ABBR[m2]} de ${y}`
}

function formatEntryDate(dateStr: string): string {
  const d = parseLocal(dateStr)
  return `${DAYS_PT[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')} de ${MONTHS_PT[d.getMonth()]}`
}

/* ─── Tipos ───────────────────────────────────────────────────── */

type DiaryEntryFull = DiaryEntry & { diary_photos: (DiaryPhoto & { signedUrl?: string })[] }

interface Props {
  projectId:   string
  projectName: string
  entries:     DiaryEntryFull[]
  /** Equipe própria marcada como presente HOJE — pré-preenche "Equipe presente" em novos registros */
  presentToday?: string
}

/* ─── Estilos compartilhados ──────────────────────────────────── */

const INPUT = 'w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta'
const LABEL = 'text-xs font-semibold uppercase tracking-wide text-brown'

/* ─── Componente principal ────────────────────────────────────── */

export function DiarioDeObra({ projectId, projectName, entries, presentToday }: Props) {
  const { companyName } = useCompany()
  const today = new Date().toISOString().split('T')[0]
  const todayMonday = useMemo(() => getWeekMonday(today), [today])

  const [localEntries,    setLocalEntries]    = useState(entries)
  const [showForm,        setShowForm]        = useState(false)
  const [editingEntry,    setEditingEntry]    = useState<DiaryEntryFull | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [lightboxUrls,    setLightboxUrls]    = useState<string[] | null>(null)
  const [lightboxIdx,     setLightboxIdx]     = useState(0)
  const [selectedMonday,  setSelectedMonday]  = useState(todayMonday)

  // Mantém a lista local em sincronia quando o servidor revalida os dados
  // (é assim que as fotos novas com URL assinada chegam após o upload)
  useEffect(() => { setLocalEntries(entries) }, [entries])

  const selectedSunday = useMemo(() => getWeekSunday(selectedMonday), [selectedMonday])
  const isCurrentWeek  = toKey(selectedMonday) === toKey(todayMonday)
  const weekStart      = toKey(selectedMonday)
  const weekEnd        = toKey(selectedSunday)

  const weekEntries = useMemo(() =>
    localEntries
      .filter(e => e.entry_date >= weekStart && e.entry_date <= weekEnd)
      .sort((a, b) => {
        const d = a.entry_date.localeCompare(b.entry_date)
        return d !== 0 ? d : a.created_at.localeCompare(b.created_at)
      }),
    [localEntries, weekStart, weekEnd]
  )

  function prevWeek() {
    setSelectedMonday(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d })
  }

  function nextWeek() {
    if (isCurrentWeek) return
    setSelectedMonday(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d })
  }

  function confirmDelete() {
    if (!deleteConfirmId) return
    const id = deleteConfirmId
    setDeleteConfirmId(null)
    const removed = localEntries.find((e) => e.id === id)

    // Remoção otimista com rollback se a exclusão falhar
    setLocalEntries((prev) => prev.filter((e) => e.id !== id))
    toastAfterClose('Registro excluído')

    const run = () =>
      deleteDiaryEntry(id, projectId)
        .then((result) => {
          if (!result.success) throw new Error(result.error)
        })
        .catch(() => {
          if (removed) setLocalEntries((prev) => [...prev, removed])
          toast.error('Erro ao excluir registro', {
            action: {
              label: 'Tentar novamente',
              onClick: () => {
                setLocalEntries((prev) => prev.filter((e) => e.id !== id))
                run()
              },
            },
          })
        })
    run()
  }

  function exportPDF() {
    function esc(s: string | null | undefined): string {
      return (s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    }
    const pad = (n: number) => String(n).padStart(2, '0')

    // Período da semana por extenso
    const m = selectedMonday
    const s = selectedSunday
    const weekPeriod = m.getMonth() === s.getMonth()
      ? `${m.getDate()} a ${s.getDate()} de ${MONTHS_PT[s.getMonth()]} de ${s.getFullYear()}`
      : `${m.getDate()} de ${MONTHS_PT[m.getMonth()]} a ${s.getDate()} de ${MONTHS_PT[s.getMonth()]} de ${s.getFullYear()}`

    // Nome do arquivo
    const slug = projectName
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    const filename = `Diario_${slug}_${weekStart.replace(/-/g,'')}_${weekEnd.replace(/-/g,'')}`

    // Timestamp de geração
    const now = new Date()
    const generatedAt = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} às ${pad(now.getHours())}:${pad(now.getMinutes())}`

    const WEATHER_TEXT: Record<string, string> = {
      sun: 'Ensolarado', cloudy: 'Nublado', rain: 'Chuva', storm: 'Tempestade',
    }

    const bodyHtml = weekEntries.length === 0
      ? '<p style="color:#6B7280;font-size:13px;padding:16px 0;">Nenhum registro nesta semana.</p>'
      : weekEntries.map(entry => {
          const d = parseLocal(entry.entry_date)
          const dayLabel = `${DAYS_PT[d.getDay()]}, ${pad(d.getDate())} de ${MONTHS_PT[d.getMonth()]} de ${d.getFullYear()}`
          const wLabel = entry.weather ? (WEATHER_TEXT[entry.weather] ?? '') : ''
          return `
<div class="entry">
  <div class="entry-date">
    <span class="entry-dayname">${esc(dayLabel)}</span>
    ${wLabel ? `<span class="entry-weather">${esc(wLabel)}</span>` : ''}
  </div>
  <div class="section">
    <div class="section-label">Executado</div>
    <div class="section-text">${esc(entry.work_done)}</div>
  </div>
  ${entry.team_present ? `<div class="section"><div class="section-label">Equipe Presente</div><div class="section-text">${esc(entry.team_present)}</div></div>` : ''}
  ${entry.occurrences ? `<div class="section"><div class="section-label">Ocorrências</div><div class="section-text">${esc(entry.occurrences)}</div></div>` : ''}
</div>`
        }).join('')

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${esc(filename)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#3B2418}
table{width:100%;border-collapse:collapse}
thead td{padding-bottom:4px}
tfoot td{padding-top:4px}
.hdr-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}
.hdr-company{font-size:14px;font-weight:700;color:#3B2418}
.hdr-label{font-size:12px;color:#8A5A3B}
.hdr-rule{height:2px;background:#E6C07B;margin-bottom:12px}
.hdr-obra{font-size:16px;font-weight:700;color:#3B2418;margin-bottom:4px}
.hdr-period{font-size:12px;color:#8A5A3B;padding-bottom:12px}
.ftr-rule{height:1.5px;background:#E6C07B;margin-bottom:6px}
.ftr-row{display:flex;justify-content:space-between;font-size:10px;color:#9CA3AF;padding-top:2px}
.entry{page-break-inside:avoid;padding:14px 0}
.entry+.entry{border-top:1px solid #F4E2B8}
.entry-date{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.entry-dayname{font-size:14px;font-weight:700;color:#8A5A3B}
.entry-weather{font-size:11px;background:#FFF8EC;border:1px solid #E6C07B;color:#8A5A3B;padding:2px 8px;border-radius:99px}
.section{margin-bottom:10px}
.section:last-child{margin-bottom:0}
.section-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#8A5A3B;margin-bottom:4px}
.section-text{font-size:13px;color:#3B2418;white-space:pre-line;line-height:1.55}
@media print{
  @page{margin:18mm 15mm;size:A4}
  @page{@bottom-right{content:"Página " counter(page) " de " counter(pages);font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#9CA3AF}}
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
</style>
</head>
<body>
<table>
<thead><tr><td>
  <div class="hdr-top">
    <span class="hdr-company">${esc(companyName)}</span>
    <span class="hdr-label">Diário de Obra</span>
  </div>
  <div class="hdr-rule"></div>
  <div class="hdr-obra">${esc(projectName)}</div>
  <div class="hdr-period">Semana de ${esc(weekPeriod)}</div>
</td></tr></thead>
<tfoot><tr><td>
  <div class="ftr-rule"></div>
  <div class="ftr-row">
    <span>Gerado em ${esc(generatedAt)}</span>
    <span></span>
  </div>
</td></tr></tfoot>
<tbody><tr><td>${bodyHtml}</td></tr></tbody>
</table>
</body>
</html>`

    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) { toast.error('Permita pop-ups no navegador para exportar o PDF'); return }
    win.document.open()
    win.document.write(html)
    win.document.close()
    win.document.title = filename
    win.focus()
    setTimeout(() => win.print(), 500)
  }

  return (
    <div className="space-y-5">

      {/* Barra superior: navegação semanal + botão registrar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Seta anterior */}
          <button
            onClick={prevWeek}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/40 bg-white text-gray-500 hover:border-terracotta hover:text-terracotta transition-colors"
            aria-label="Semana anterior"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
          </button>

          {/* Label da semana */}
          <span className="text-sm font-semibold text-dark select-none">
            {formatWeekNavLabel(selectedMonday, selectedSunday)}
          </span>

          {/* Seta próxima */}
          <button
            onClick={nextWeek}
            disabled={isCurrentWeek}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/40 bg-white text-gray-500 hover:border-terracotta hover:text-terracotta transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-gold/40 disabled:hover:text-gray-500"
            aria-label="Próxima semana"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* Botão "Semana Atual" — aparece só quando fora da semana atual */}
          {!isCurrentWeek && (
            <button
              onClick={() => setSelectedMonday(todayMonday)}
              className="rounded-lg border border-gold px-3 py-1.5 text-xs font-medium text-brown hover:bg-cream transition-colors"
            >
              Semana Atual
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={exportPDF}
            className="flex items-center gap-2 rounded-lg border border-gold bg-white px-4 py-2 text-sm font-medium text-brown hover:bg-cream transition-colors"
          >
            <FileDown className="h-4 w-4" />
            Exportar PDF
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-brown transition-colors"
          >
            <Plus className="h-4 w-4" />
            Registrar Dia
          </button>
        </div>
      </div>

      {/* Estado vazio da semana */}
      {weekEntries.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gold/40 py-16 gap-4">
          <p className="text-sm text-gray-400 text-center">
            {localEntries.length === 0
              ? <>Nenhum registro no diário ainda.<br />Registre o primeiro dia de obra.</>
              : 'Nenhum registro nesta semana.'}
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-brown transition-colors"
          >
            <Plus className="h-4 w-4" />
            Registrar Dia
          </button>
        </div>
      )}

      {/* Entradas da semana selecionada */}
      {weekEntries.length > 0 && (
        <div className="rounded-xl border border-gold/40 bg-white shadow-sm px-5 py-5">
          {weekEntries.map((entry, ei) => {
            const signedPhotos  = entry.diary_photos.filter(p => p.signedUrl)
            const previewPhotos = signedPhotos.slice(0, 4)
            const extraCount    = signedPhotos.length - 4
            const isLast        = ei === weekEntries.length - 1

            return (
              <div key={entry.id} className="flex gap-4">
                <div className="flex w-5 shrink-0 flex-col items-center">
                  <div className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full bg-terracotta ring-2 ring-white" />
                  {!isLast && <div className="mt-1 w-px flex-1 bg-gold/30" />}
                </div>

                <div className={`flex-1 ${isLast ? '' : 'pb-7'}`}>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-dark">
                        {formatEntryDate(entry.entry_date)}
                      </span>
                      {entry.weather && (
                        <span className="flex items-center gap-1 rounded-full border border-gold/30 bg-cream/60 px-2 py-0.5 text-xs text-gray-600">
                          {WEATHER_ICONS[entry.weather as WeatherType]}
                          {WEATHER_LABELS[entry.weather as WeatherType]}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        onClick={() => setEditingEntry(entry)}
                        className="rounded p-1.5 text-brown hover:text-terracotta transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(entry.id)}
                        className="rounded p-1.5 text-brown hover:text-[#8B3A3A] transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Executado</p>
                      <p className="whitespace-pre-line text-sm text-dark">{entry.work_done}</p>
                    </div>
                    {entry.team_present && (
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Equipe</p>
                        <p className="whitespace-pre-line text-sm text-dark">{entry.team_present}</p>
                      </div>
                    )}
                    {entry.occurrences && (
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Ocorrências</p>
                        <p className="whitespace-pre-line text-sm text-dark">{entry.occurrences}</p>
                      </div>
                    )}
                    {signedPhotos.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Fotos ({signedPhotos.length})
                        </p>
                        <div className="grid grid-cols-2 gap-1.5" style={{ maxWidth: 176 }}>
                          {previewPhotos.map((photo) => (
                            <button
                              key={photo.id}
                              onClick={() => {
                                setLightboxUrls(signedPhotos.map(p => p.signedUrl!))
                                setLightboxIdx(signedPhotos.indexOf(photo))
                              }}
                              className="aspect-square overflow-hidden rounded-lg border border-gold/30 hover:opacity-90 transition-opacity"
                            >
                              <img
                                src={photo.signedUrl}
                                alt={photo.caption || 'Foto da obra'}
                                className="h-full w-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                        {extraCount > 0 && (
                          <button
                            onClick={() => {
                              setLightboxUrls(signedPhotos.map(p => p.signedUrl!))
                              setLightboxIdx(4)
                            }}
                            className="mt-1.5 text-xs text-terracotta hover:text-brown transition-colors"
                          >
                            ver todas ({signedPhotos.length})
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de confirmação — Excluir registro */}
      {deleteConfirmId && (() => {
        const target = localEntries.find(e => e.id === deleteConfirmId)
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setDeleteConfirmId(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="mb-1 font-semibold text-dark">Excluir registro</h3>
              <p className="mb-1 text-sm text-gray-500">
                Tem certeza que deseja excluir este registro do diário?
              </p>
              {target && (
                <p className="mb-5 rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-dark">
                  {formatEntryDate(target.entry_date)}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={confirmDelete}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
                >
                  Excluir
                </button>
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-dark hover:bg-cream transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal — Registrar Dia */}
      {showForm && (
        <CreateDiaryModal
          projectId={projectId}
          today={today}
          defaultTeam={presentToday}
          onClose={() => setShowForm(false)}
          onOptimistic={(entry) => setLocalEntries((prev) => [...prev, entry])}
          onSettled={(tempId, saved) =>
            setLocalEntries((prev) =>
              saved
                ? prev.map((e) => (e.id === tempId ? saved : e))
                : prev.filter((e) => e.id !== tempId)
            )
          }
        />
      )}

      {/* Modal — Editar entrada */}
      {editingEntry && (
        <EditDiaryModal
          key={editingEntry.id}
          entry={editingEntry}
          projectId={projectId}
          onClose={() => setEditingEntry(null)}
          onPatched={(updated) =>
            setLocalEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
          }
        />
      )}

      {/* Lightbox */}
      {lightboxUrls && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setLightboxUrls(null)}
        >
          <button
            onClick={() => setLightboxUrls(null)}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-white/60 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxUrls[lightboxIdx]}
            alt="Foto ampliada"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {lightboxUrls.length > 1 && (
            <div className="absolute bottom-5 flex gap-2" onClick={(e) => e.stopPropagation()}>
              {lightboxUrls.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setLightboxIdx(i)}
                  className={`h-1.5 w-5 rounded-full transition-colors ${
                    i === lightboxIdx ? 'bg-white' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Modal — Registrar Dia ───────────────────────────────────── */

function CreateDiaryModal({
  projectId,
  today,
  defaultTeam,
  onClose,
  onOptimistic,
  onSettled,
}: {
  projectId:    string
  today:        string
  defaultTeam?: string
  onClose:      () => void
  onOptimistic: (entry: DiaryEntryFull) => void
  onSettled:    (tempId: string, saved: DiaryEntryFull | null) => void
}) {
  function formAction(fd: FormData) {
    // Otimista: a entrada aparece na linha do tempo e o modal fecha na hora;
    // fotos (se houver) aparecem quando o upload conclui e a página revalida.
    const tempId = `temp-${Date.now()}`
    const nowIso = new Date().toISOString()
    const optimistic: DiaryEntryFull = {
      id: tempId,
      project_id: projectId,
      entry_date: fd.get('entry_date') as string,
      weather: (((fd.get('weather') as string) || null) as WeatherType | null),
      work_done: fd.get('work_done') as string,
      team_present: ((fd.get('team_present') as string) || null),
      occurrences: ((fd.get('occurrences') as string) || null),
      created_by: null,
      created_at: nowIso,
      updated_at: nowIso,
      diary_photos: [],
    }

    onOptimistic(optimistic)
    onClose()
    toastAfterClose('Entrada registrada com sucesso')

    const persist = () =>
      createDiaryEntry(projectId, fd)
        .then((result) => {
          if (!result.success || !result.entry) throw new Error(result.error)
          onSettled(tempId, { ...(result.entry as unknown as DiaryEntry), diary_photos: [] })
        })
        .catch((err: Error) => {
          onSettled(tempId, null)
          toast.error(err.message || 'Erro ao salvar entrada', {
            action: {
              label: 'Tentar novamente',
              onClick: () => { onOptimistic(optimistic); persist() },
            },
          })
        })
    persist()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gold/20 bg-white px-6 py-4">
          <h3 className="font-semibold text-dark">Registrar Dia</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-dark transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5">
          <DiaryForm
            defaultDate={today}
            defaultTeam={defaultTeam}
            formAction={formAction}
            onCancel={onClose}
            submitLabel="Salvar Entrada"
          />
        </div>
      </div>
    </div>
  )
}

/* ─── Modal — Editar entrada ──────────────────────────────────── */

function EditDiaryModal({
  entry: initialEntry,
  projectId,
  onClose,
  onPatched,
}: {
  entry:     DiaryEntryFull
  projectId: string
  onClose:   () => void
  onPatched: (updated: DiaryEntryFull) => void
}) {
  const [entry, setEntry] = useState(initialEntry)

  function formAction(fd: FormData) {
    // Otimista: a entrada reflete a edição e o modal fecha na hora
    const optimistic: DiaryEntryFull = {
      ...entry,
      entry_date: fd.get('entry_date') as string,
      weather: (((fd.get('weather') as string) || null) as WeatherType | null),
      work_done: fd.get('work_done') as string,
      team_present: ((fd.get('team_present') as string) || null),
      occurrences: ((fd.get('occurrences') as string) || null),
    }

    onPatched(optimistic)
    onClose()
    toastAfterClose('Entrada atualizada')

    const persist = () =>
      updateDiaryEntry(initialEntry.id, projectId, fd)
        .then((result) => {
          if (!result.success) throw new Error(result.error)
        })
        .catch((err: Error) => {
          onPatched(initialEntry)
          toast.error(err.message || 'Erro ao atualizar entrada', {
            action: {
              label: 'Tentar novamente',
              onClick: () => { onPatched(optimistic); persist() },
            },
          })
        })
    persist()
  }

  function handleDeletePhoto(photoId: string) {
    const removed = entry.diary_photos.find((p) => p.id === photoId)

    // Remoção otimista da foto, com rollback se a exclusão falhar
    const apply = (photos: DiaryEntryFull['diary_photos']) => {
      setEntry((prev) => {
        const updated = { ...prev, diary_photos: photos }
        onPatched(updated)
        return updated
      })
    }
    apply(entry.diary_photos.filter((p) => p.id !== photoId))

    deleteDiaryPhoto(photoId, projectId)
      .then((result) => {
        if (!result.success) throw new Error(result.error)
      })
      .catch(() => {
        if (removed) {
          setEntry((prev) => {
            const updated = { ...prev, diary_photos: [...prev.diary_photos, removed] }
            onPatched(updated)
            return updated
          })
        }
        toast.error('Erro ao excluir foto')
      })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gold/20 bg-white px-6 py-4">
          <h3 className="font-semibold text-dark">Editar Entrada</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-dark transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5">
          <DiaryForm
            defaultDate={entry.entry_date}
            defaultWeather={entry.weather ?? undefined}
            defaultWorkDone={entry.work_done}
            defaultTeam={entry.team_present ?? undefined}
            defaultOccurrences={entry.occurrences ?? undefined}
            existingPhotos={entry.diary_photos}
            onDeletePhoto={handleDeletePhoto}
            formAction={formAction}
            onCancel={onClose}
            submitLabel="Salvar Alterações"
          />
        </div>
      </div>
    </div>
  )
}

/* ─── Formulário compartilhado ────────────────────────────────── */

interface DiaryFormProps {
  defaultDate:         string
  defaultWeather?:     string
  defaultWorkDone?:    string
  defaultTeam?:        string
  defaultOccurrences?: string
  existingPhotos?:     (DiaryPhoto & { signedUrl?: string })[]
  onDeletePhoto?:      (photoId: string) => void
  formAction:          (payload: FormData) => void
  onCancel:            () => void
  submitLabel:         string
}

function DiaryForm({
  defaultDate,
  defaultWeather,
  defaultWorkDone,
  defaultTeam,
  defaultOccurrences,
  existingPhotos,
  onDeletePhoto,
  formAction,
  onCancel,
  submitLabel,
}: DiaryFormProps) {
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={LABEL}>Data</label>
          <input
            name="entry_date"
            type="date"
            required
            defaultValue={defaultDate}
            max={new Date().toLocaleDateString('en-CA')}
            className={INPUT}
          />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL}>Clima</label>
          <select name="weather" defaultValue={defaultWeather ?? ''} className={INPUT}>
            <option value="">Selecionar...</option>
            {Object.entries(WEATHER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={LABEL}>O que foi executado *</label>
        <textarea
          name="work_done"
          required
          rows={4}
          defaultValue={defaultWorkDone ?? ''}
          placeholder="Descreva as atividades realizadas no dia..."
          className={INPUT + ' resize-none'}
        />
      </div>

      <div className="space-y-1.5">
        <label className={LABEL}>Equipe Presente</label>
        <textarea
          name="team_present"
          rows={2}
          defaultValue={defaultTeam ?? ''}
          placeholder="Nomes dos trabalhadores presentes..."
          className={INPUT + ' resize-none'}
        />
      </div>

      <div className="space-y-1.5">
        <label className={LABEL}>Ocorrências</label>
        <textarea
          name="occurrences"
          rows={2}
          defaultValue={defaultOccurrences ?? ''}
          placeholder="Imprevistos, problemas ou observações..."
          className={INPUT + ' resize-none'}
        />
      </div>

      {/* Fotos existentes (somente no modo edição) */}
      {existingPhotos && existingPhotos.length > 0 && (
        <div className="space-y-1.5">
          <label className={LABEL}>Fotos existentes</label>
          <div className="grid grid-cols-3 gap-2">
            {existingPhotos.map((photo) =>
              photo.signedUrl ? (
                <div key={photo.id} className="relative aspect-square">
                  <img
                    src={photo.signedUrl}
                    alt={photo.caption || 'Foto da obra'}
                    className="h-full w-full rounded-lg object-cover border border-gold/30"
                  />
                  <button
                    type="button"
                    onClick={() => onDeletePhoto?.(photo.id)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}


      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex items-center gap-2 rounded-lg bg-terracotta px-5 py-2 text-sm font-medium text-white hover:bg-brown disabled:opacity-60 transition-colors"
        >
          <Check className="h-4 w-4" />
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-dark hover:bg-cream transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
