'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Pencil, FileText, Printer, X } from 'lucide-react'
import type {
  Contract,
  ContractAmendment,
  ContractStatus,
  Measurement,
} from '@/types/database'
import { CONTRACT_STATUS_LABELS } from '@/types/database'
import { formatCurrency, formatDate } from '@/lib/format'
import { retidoMedicao } from '@/lib/medicao'
import { useCompany } from '@/components/layout/CompanyProvider'
import { CurrencyInput } from '@/components/ui/currency-input'
import { updateContract, getContractDocUrl } from '@/app/actions/contratos'
import { toast } from 'sonner'
import { toastAfterClose } from '@/lib/ui-feedback'
import { AditivosTab } from './AditivosTab'
import { MedicoesTab } from './MedicoesTab'

type ContractWithProject = Contract & {
  projects?: { id: string; name: string; client_id: string | null; expected_end_date: string } | null
}

interface Props {
  contract:       ContractWithProject
  clientName:     string | null
  amendments:     ContractAmendment[]
  measurements:   Measurement[]
  approvedBudget: { total_with_bdi: number } | null
}

// Soma dias a uma data yyyy-mm-dd (meio-dia evita problemas de fuso)
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatPercent1(n: number): string {
  return `${n.toFixed(1).replace('.', ',')}%`
}

function statusBadge(status: ContractStatus): { className: string; style?: React.CSSProperties } {
  if (status === 'ativo') return { className: 'bg-green-100 text-green-700' }
  if (status === 'suspenso')
    return { className: '', style: { backgroundColor: 'rgba(230,192,123,0.30)', color: '#8A5A3B' } }
  if (status === 'cancelado')
    return { className: '', style: { backgroundColor: 'rgba(139,58,58,0.12)', color: '#8B3A3A' } }
  return { className: 'bg-gray-100 text-gray-600' }
}

const inputCls =
  'w-full rounded-lg border border-gold/50 bg-white px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta'
const labelCls = 'text-xs font-semibold uppercase tracking-wide text-brown'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#8A5A3B' }}>
        {children}
      </span>
      <div className="h-px flex-1 bg-gold/30" />
    </div>
  )
}

export function ContratoDetalhe({ contract, clientName, amendments, measurements, approvedBudget }: Props) {
  const { companyName } = useCompany()
  const [localContract, setLocalContract] = useState<ContractWithProject>(contract)
  // Estado elevado — as Seções 4 e 5 mutam estas listas de forma otimista
  // e os cards de resumo recalculam na hora.
  const [localAmendments, setLocalAmendments]     = useState<ContractAmendment[]>(amendments)
  const [localMeasurements, setLocalMeasurements] = useState<Measurement[]>(measurements)

  const [tab, setTab] = useState<'aditivos' | 'medicoes'>('aditivos')
  const [editOpen, setEditOpen] = useState(false)
  const [editStatus, setEditStatus] = useState<ContractStatus>(contract.status)

  // ── Resumo (cards) ─────────────────────────────────────────
  const summary = useMemo(() => {
    const amendmentsValue = localAmendments.reduce((s, a) => s + (a.value_change || 0), 0)
    const totalValue = (localContract.original_value || 0) + amendmentsValue
    const totalMeasured = localMeasurements.reduce((s, m) => s + (m.amount || 0), 0)
    const balanceToInvoice = totalValue - totalMeasured
    const percentInvoiced = totalValue > 0 ? (totalMeasured / totalValue) * 100 : 0
    const daysAdded = localAmendments.reduce((s, a) => s + (a.days_change || 0), 0)
    const currentDeadline = localContract.end_date ? addDays(localContract.end_date, daysAdded) : null
    // Retenção acumulada: soma a retenção REAL de cada medição aprovada/faturada
    // (cada medição pode ter seu próprio % — sql/029)
    const totalRetained = localMeasurements
      .filter((m) => m.status === 'aprovada' || m.status === 'faturada')
      .reduce((s, m) => s + retidoMedicao(m.amount || 0, m.retention_percent || 0), 0)
    return {
      amendmentsValue,
      totalValue,
      totalMeasured,
      balanceToInvoice,
      percentInvoiced,
      daysAdded,
      currentDeadline,
      totalRetained,
    }
  }, [localContract, localAmendments, localMeasurements])

  // ── Editar contrato (otimista) ─────────────────────────────
  function persistEdit(
    formData: FormData,
    optimistic: ContractWithProject,
    prev: ContractWithProject,
  ) {
    updateContract(localContract.id, formData)
      .then((res) => {
        if (!res.success || !res.contract) throw new Error(res.error ?? 'Erro ao atualizar contrato')
        setLocalContract(res.contract as unknown as ContractWithProject)
      })
      .catch((err: Error) => {
        setLocalContract(prev)
        toast.error(err.message || 'Erro ao atualizar contrato', {
          action: {
            label: 'Tentar novamente',
            onClick: () => {
              setLocalContract(optimistic)
              persistEdit(formData, optimistic, prev)
            },
          },
        })
      })
  }

  function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('status', editStatus)

    const prev = localContract
    const optimistic: ContractWithProject = {
      ...localContract,
      contract_number:   (formData.get('contract_number') as string) || null,
      original_value:    Number(formData.get('original_value')) || 0,
      signing_date:      (formData.get('signing_date') as string) || null,
      start_date:        (formData.get('start_date') as string) || null,
      end_date:          (formData.get('end_date') as string) || null,
      retention_percent: Number(formData.get('retention_percent')) || 0,
      status:            editStatus,
      notes:             (formData.get('notes') as string) || null,
    }

    setLocalContract(optimistic)
    setEditOpen(false)
    toastAfterClose('Contrato atualizado')
    persistEdit(formData, optimistic, prev)
  }

  async function viewDoc() {
    if (!localContract.document_path) return
    const res = await getContractDocUrl(localContract.document_path)
    if (res.success && res.url) window.open(res.url, '_blank')
    else toast.error(res.error || 'Erro ao abrir o documento')
  }

  const badge = statusBadge(localContract.status)

  return (
    <div className="space-y-6">
      {/* CSS de impressão: só a área #contrato-print aparece no PDF */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #contrato-print, #contrato-print * { visibility: visible; }
          #contrato-print { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Breadcrumb */}
      <div className="no-print flex items-center gap-2">
        <Link
          href="/contratos"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-dark transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Contratos
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-dark font-medium">{localContract.projects?.name ?? 'Contrato'}</span>
      </div>

      {/* Cabeçalho */}
      <div className="no-print rounded-xl border border-gold/30 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-dark">{localContract.projects?.name ?? 'Contrato'}</h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                style={badge.style}
              >
                {CONTRACT_STATUS_LABELS[localContract.status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {clientName ? `Cliente: ${clientName}` : 'Sem cliente vinculado'}
              {localContract.contract_number ? ` · Contrato nº ${localContract.contract_number}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {localContract.document_path && (
              <button
                onClick={viewDoc}
                className="flex items-center gap-2 rounded-lg border border-gold/50 px-3 py-2 text-sm font-medium text-dark hover:bg-[#F9F7F4] transition-colors"
              >
                <FileText className="h-4 w-4" />
                Ver PDF
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg border border-gold/50 px-3 py-2 text-sm font-medium text-dark hover:bg-[#F9F7F4] transition-colors"
            >
              <Printer className="h-4 w-4" />
              Exportar PDF
            </button>
            <button
              onClick={() => { setEditStatus(localContract.status); setEditOpen(true) }}
              className="flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-brown transition-colors"
            >
              <Pencil className="h-4 w-4" />
              Editar
            </button>
          </div>
        </div>

        {/* Datas */}
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <p className={labelCls}>Assinatura</p>
            <p className="mt-0.5 text-sm text-dark">{formatDate(localContract.signing_date ?? '')}</p>
          </div>
          <div>
            <p className={labelCls}>Início da Vigência</p>
            <p className="mt-0.5 text-sm text-dark">{formatDate(localContract.start_date ?? '')}</p>
          </div>
          <div>
            <p className={labelCls}>Término</p>
            <p className="mt-0.5 text-sm text-dark">{formatDate(localContract.end_date ?? '')}</p>
          </div>
        </div>
      </div>

      {/* Blocos superiores: Faturamento (destaque) + Prazo */}
      <div className="no-print grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* BLOCO 1 — Faturamento (destaque principal) */}
        <div className="lg:col-span-2 rounded-xl border border-gold/30 bg-white p-5 shadow-sm">
          <SectionTitle>Faturamento</SectionTitle>

          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:items-center">
            {/* Destaque: Saldo a Faturar */}
            <div>
              <p className="text-xs font-medium text-gray-500">Saldo a Faturar</p>
              <p
                className="mt-1 text-3xl font-bold leading-tight"
                style={{ color: summary.balanceToInvoice > 0 ? '#4A7C59' : '#3B2418' }}
              >
                {formatCurrency(summary.balanceToInvoice)}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">quanto ainda há para faturar</p>
            </div>

            {/* Barra de progresso: % Faturado */}
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-gray-500">% Faturado</span>
                <span className="font-semibold" style={{ color: '#C68B59' }}>
                  {formatPercent1(summary.percentInvoiced)}
                </span>
              </div>
              <div
                className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: '#F4E2B8' }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.max(0, summary.percentInvoiced))}%`,
                    backgroundColor: '#C68B59',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Valores de apoio */}
          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-gold/20 pt-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-gray-500">Valor Total</p>
              <p className="mt-1 text-lg font-bold text-dark">{formatCurrency(summary.totalValue)}</p>
              {summary.amendmentsValue !== 0 && (
                <p className="mt-0.5 text-xs text-gray-400">
                  Original {formatCurrency(localContract.original_value)} + aditivos{' '}
                  {formatCurrency(summary.amendmentsValue)}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Total Medido</p>
              <p className="mt-1 text-lg font-bold text-dark">{formatCurrency(summary.totalMeasured)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">
                Retenção Acumulada
                {localContract.retention_percent > 0 ? ` (${formatPercent1(localContract.retention_percent)})` : ''}
              </p>
              <p className="mt-1 text-lg font-bold text-dark">{formatCurrency(summary.totalRetained)}</p>
            </div>
          </div>
        </div>

        {/* BLOCO 2 — Prazo */}
        <div className="rounded-xl border border-gold/30 bg-white p-5 shadow-sm">
          <SectionTitle>Prazo</SectionTitle>
          <div className="mt-4">
            <p className="text-xs font-medium text-gray-500">Prazo Atual</p>
            <p className="mt-1 text-2xl font-bold text-dark">
              {summary.currentDeadline ? formatDate(summary.currentDeadline) : '—'}
            </p>
            {summary.daysAdded !== 0 && (
              <p className="mt-0.5 text-xs text-gray-400">
                {summary.daysAdded > 0 ? '+' : ''}{summary.daysAdded} dias de aditivos
              </p>
            )}
          </div>
          {summary.daysAdded !== 0 && localContract.end_date && (
            <div
              className="mt-4 rounded-lg px-3 py-2 text-xs"
              style={{ backgroundColor: '#F9F7F4', color: '#8A5A3B' }}
            >
              Término original {formatDate(localContract.end_date)} → atual{' '}
              {summary.currentDeadline ? formatDate(summary.currentDeadline) : '—'}
            </div>
          )}
        </div>
      </div>

      {/* BLOCO 3 — Estimado x Contratado (só com orçamento aprovado) */}
      {approvedBudget && (
        <div className="no-print rounded-xl border border-gold/30 bg-white p-5 shadow-sm">
          <SectionTitle>Estimado x Contratado</SectionTitle>
          {(() => {
            const estimado = approvedBudget.total_with_bdi
            const contratado = summary.totalValue
            const diff = contratado - estimado
            const diffPct = estimado > 0 ? (diff / estimado) * 100 : 0
            const positive = diff >= 0
            return (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg p-4" style={{ backgroundColor: '#F9F7F4' }}>
                  <p className="text-xs font-medium text-gray-500">Estimado (orçamento)</p>
                  <p className="mt-1 text-lg font-bold text-dark">{formatCurrency(estimado)}</p>
                </div>
                <div className="rounded-lg p-4" style={{ backgroundColor: '#F9F7F4' }}>
                  <p className="text-xs font-medium text-gray-500">Contratado (Valor Total)</p>
                  <p className="mt-1 text-lg font-bold text-dark">{formatCurrency(contratado)}</p>
                </div>
                <div
                  className="rounded-lg p-4"
                  style={{ backgroundColor: positive ? 'rgba(74,124,89,0.08)' : 'rgba(139,58,58,0.08)' }}
                >
                  <p className="text-xs font-medium text-gray-500">Margem comercial</p>
                  <p className="mt-1 text-lg font-bold" style={{ color: positive ? '#4A7C59' : '#8B3A3A' }}>
                    {positive ? '+' : '−'}{formatCurrency(Math.abs(diff))}
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: positive ? '#4A7C59' : '#8B3A3A' }}>
                    {positive ? 'vendido acima do orçado' : 'vendido abaixo do orçado'} ({formatPercent1(Math.abs(diffPct))})
                  </p>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Abas */}
      <div className="no-print flex gap-1 rounded-xl border border-gold/30 bg-cream/30 p-1 w-fit">
        <button
          onClick={() => setTab('aditivos')}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === 'aditivos' ? 'bg-white text-dark shadow-sm' : 'text-gray-500 hover:text-dark'
          }`}
        >
          Aditivos {localAmendments.length > 0 && `(${localAmendments.length})`}
        </button>
        <button
          onClick={() => setTab('medicoes')}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === 'medicoes' ? 'bg-white text-dark shadow-sm' : 'text-gray-500 hover:text-dark'
          }`}
        >
          Medições {localMeasurements.length > 0 && `(${localMeasurements.length})`}
        </button>
      </div>

      {/* Corpo das abas — CRUD completo entra nas Seções 4 (Aditivos) e 5 (Medições) */}
      <div className="no-print">
        {tab === 'aditivos' ? (
          <AditivosTab
            contractId={localContract.id}
            amendments={localAmendments}
            setAmendments={setLocalAmendments}
          />
        ) : (
          <MedicoesTab
            contractId={localContract.id}
            retentionPercent={localContract.retention_percent}
            measurements={localMeasurements}
            setMeasurements={setLocalMeasurements}
          />
        )}
      </div>

      {/* ── Área de impressão (PDF) ── */}
      <div id="contrato-print" className="hidden print:block">
        <div className="mb-4 border-b-2 pb-3" style={{ borderColor: '#C68B59' }}>
          <h1 className="text-2xl font-bold" style={{ color: '#3B2418' }}>{companyName}</h1>
          <p className="text-sm" style={{ color: '#8A5A3B' }}>Resumo de Contrato</p>
        </div>
        <div className="mb-3 text-sm" style={{ color: '#3B2418' }}>
          <p><strong>Obra:</strong> {localContract.projects?.name ?? '—'}</p>
          {clientName && <p><strong>Cliente:</strong> {clientName}</p>}
          {localContract.contract_number && <p><strong>Contrato nº:</strong> {localContract.contract_number}</p>}
          <p><strong>Status:</strong> {CONTRACT_STATUS_LABELS[localContract.status]}</p>
          <p>
            <strong>Assinatura:</strong> {formatDate(localContract.signing_date ?? '')} &nbsp;·&nbsp;
            <strong> Início:</strong> {formatDate(localContract.start_date ?? '')} &nbsp;·&nbsp;
            <strong> Término:</strong> {formatDate(localContract.end_date ?? '')}
          </p>
          <p><strong>Emissão:</strong> {formatDate(new Date().toISOString().slice(0, 10))}</p>
        </div>

        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #F4E2B8' }}>
              <td className="py-1">Valor Original</td>
              <td className="py-1 text-right">{formatCurrency(localContract.original_value)}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #F4E2B8' }}>
              <td className="py-1">Aditivos (valor)</td>
              <td className="py-1 text-right">{formatCurrency(summary.amendmentsValue)}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #E6C07B' }}>
              <td className="py-1 font-semibold">Valor Total</td>
              <td className="py-1 text-right font-semibold">{formatCurrency(summary.totalValue)}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #F4E2B8' }}>
              <td className="py-1">Total Medido</td>
              <td className="py-1 text-right">{formatCurrency(summary.totalMeasured)}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #F4E2B8' }}>
              <td className="py-1">Saldo a Faturar</td>
              <td className="py-1 text-right">{formatCurrency(summary.balanceToInvoice)}</td>
            </tr>
            <tr>
              <td className="py-1">% Faturado</td>
              <td className="py-1 text-right">{formatPercent1(summary.percentInvoiced)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 border-t-2 pt-2 text-sm" style={{ borderColor: '#C68B59', color: '#3B2418' }}>
          <p className="text-right">
            <strong>Prazo Atual:</strong>{' '}
            {summary.currentDeadline ? formatDate(summary.currentDeadline) : '—'}
          </p>
          {localContract.retention_percent > 0 && (
            <p className="text-right">
              <strong>Retenção Acumulada ({formatPercent1(localContract.retention_percent)}):</strong>{' '}
              {formatCurrency(summary.totalRetained)}
            </p>
          )}
        </div>
      </div>

      {/* Modal Editar Contrato */}
      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setEditOpen(false) }}
        >
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gold/30 bg-white px-6 py-4">
              <h2 className="font-semibold text-dark">Editar Contrato</h2>
              <button
                onClick={() => setEditOpen(false)}
                className="rounded p-1 text-gray-400 hover:text-dark transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 p-6">
              <SectionTitle>Dados do Contrato</SectionTitle>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelCls}>Nº do Contrato</label>
                  <input
                    name="contract_number"
                    defaultValue={localContract.contract_number ?? ''}
                    placeholder="Ex: 2025-001"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Valor Original (R$)</label>
                  <CurrencyInput
                    name="original_value"
                    defaultValue={localContract.original_value}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as ContractStatus)}
                  className={inputCls}
                >
                  {(Object.keys(CONTRACT_STATUS_LABELS) as ContractStatus[]).map((s) => (
                    <option key={s} value={s}>{CONTRACT_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>

              <SectionTitle>Vigência e Retenção</SectionTitle>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelCls}>Data de Assinatura</label>
                  <input
                    name="signing_date"
                    type="date"
                    defaultValue={localContract.signing_date ?? ''}
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Retenção (%)</label>
                  <input
                    name="retention_percent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    defaultValue={localContract.retention_percent || ''}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Início da Vigência</label>
                  <input
                    name="start_date"
                    type="date"
                    defaultValue={localContract.start_date ?? ''}
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Término</label>
                  <input
                    name="end_date"
                    type="date"
                    defaultValue={localContract.end_date ?? ''}
                    className={inputCls}
                  />
                </div>
              </div>

              <SectionTitle>Documento e Observações</SectionTitle>

              <div className="space-y-1.5">
                <label className={labelCls}>
                  PDF do Contrato {localContract.document_path && '(substituir)'}
                </label>
                <input
                  name="document"
                  type="file"
                  accept=".pdf"
                  className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm text-gray-500 file:mr-3 file:rounded file:border-0 file:bg-terracotta/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-terracotta hover:file:bg-terracotta/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Observações</label>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={localContract.notes ?? ''}
                  placeholder="Observações opcionais…"
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="flex-1 rounded-lg border border-gold/50 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-[#F9F7F4]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-terracotta py-2.5 text-sm font-medium text-white transition-colors hover:bg-brown"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
