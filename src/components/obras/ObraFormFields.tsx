'use client'

import { useState } from 'react'
import type { Project, Client } from '@/types/database'
import {
  PROJECT_TYPE_LABELS, PROJECT_PRIORITY_LABELS, FINISH_STANDARD_LABELS,
  CONSTRUCTION_SYSTEM_LABELS, FOUNDATION_TYPE_LABELS,
} from '@/types/database'
import { ClienteSelectComBusca } from '@/components/clientes/ClienteSelectComBusca'
import { CurrencyInput } from '@/components/ui/currency-input'
import { AreaInput } from '@/components/ui/area-input'

interface Props {
  clients:          Pick<Client, 'id' | 'name'>[]
  project?:         Project
  defaultClientId?: string
  defaultWarrantyMonths?: number  // padrão das Preferências (nova obra)
}

const INPUT = 'w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta'
const LABEL = 'text-xs font-semibold uppercase tracking-wide text-brown'

const PRIORITY_COLOR: Record<string, string> = {
  alta: '#8B3A3A',
  media: '#C68B59',
  baixa: '#6B7280',
}

const UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

function formatCep(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

/* ─── Cabeçalho de seção (apenas divisor visual) ──────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-brown">{title}</p>
        <hr className="mt-1.5 border-gold/30" />
      </div>
      {children}
    </div>
  )
}

/* ─── Select de prioridade (com cor) ──────────────────────────── */
function PrioritySelect({ defaultValue }: { defaultValue?: string | null }) {
  const [value, setValue] = useState(defaultValue ?? '')
  return (
    <select
      name="priority"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className={INPUT}
      style={{ color: value ? PRIORITY_COLOR[value] : undefined, fontWeight: value ? 600 : undefined }}
    >
      <option value="">Selecionar...</option>
      {(Object.keys(PROJECT_PRIORITY_LABELS) as (keyof typeof PROJECT_PRIORITY_LABELS)[]).map((k) => (
        <option key={k} value={k}>{PROJECT_PRIORITY_LABELS[k]}</option>
      ))}
    </select>
  )
}

/* ─── Validade do seguro (com aviso de vencido) ───────────────── */
function InsuranceExpiry({ defaultValue }: { defaultValue?: string | null }) {
  const [value, setValue] = useState(defaultValue ?? '')
  const expired = value && value < todayIso()
  return (
    <div className="space-y-1.5">
      <label className={LABEL}>Validade do Seguro</label>
      <input
        name="insurance_expiry"
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={INPUT}
      />
      {expired && (
        <p className="text-xs font-medium" style={{ color: '#8B3A3A' }}>Seguro vencido</p>
      )}
    </div>
  )
}

/* ─── Campo Garantia (meses) com tooltip ──────────────────────── */
function WarrantyMonths({ defaultValue }: { defaultValue?: number | null }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <label className={LABEL}>Garantia (meses)</label>
        <span className="relative group/w inline-flex">
          <span className="flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full bg-gray-200 text-[9px] font-bold text-gray-500">?</span>
          <span className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 w-max max-w-[230px] -translate-x-1/2 rounded-md bg-gray-800 px-2 py-1 text-[11px] leading-snug text-white opacity-0 transition-opacity group-hover/w:opacity-100 z-10">
            Garantia estrutural legal: 60 meses (Código Civil art. 618).
          </span>
        </span>
      </div>
      <input
        name="warranty_months"
        type="number"
        min={0}
        defaultValue={defaultValue ?? 60}
        className={INPUT}
      />
    </div>
  )
}

/* ─── Seção de Endereço (CEP + ViaCEP + UF) ───────────────────── */
function AddressSection({ project }: { project?: Project }) {
  const p = project
  const [cep, setCep] = useState(p?.cep ?? '')
  const [street, setStreet] = useState(p?.street ?? '')
  const [neighborhood, setNeighborhood] = useState(p?.neighborhood ?? '')
  const [city, setCity] = useState(p?.city ?? '')
  const [uf, setUf] = useState(p?.state ?? '')
  const [loadingCep, setLoadingCep] = useState(false)

  // Registro antigo: tem address em texto mas nenhum campo estruturado preenchido.
  const hasStructured = !!(p?.cep || p?.street || p?.neighborhood || p?.city || p?.state)
  const legacyAddress = !hasStructured && p?.address ? p.address : null

  async function lookupCep() {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    setLoadingCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      if (!res.ok) return
      const data = await res.json()
      if (data?.erro) return // CEP não existe — trata silenciosamente
      if (data.logradouro) setStreet(data.logradouro)
      if (data.bairro) setNeighborhood(data.bairro)
      if (data.localidade) setCity(data.localidade)
      if (data.uf) setUf(data.uf)
    } catch {
      /* falha de rede — trata silenciosamente */
    } finally {
      setLoadingCep(false)
    }
  }

  return (
    <Section title="Endereço">
      {/* Campo oculto: preserva o endereço legado quando os campos estruturados ficam vazios */}
      <input type="hidden" name="address" defaultValue={p?.address ?? ''} />

      {legacyAddress && (
        <p className="rounded-lg border border-gold/30 bg-cream/40 px-3 py-2 text-xs text-brown">
          Endereço atual: {legacyAddress}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={LABEL}>CEP</label>
          <div className="relative">
            <input
              name="cep"
              value={cep}
              onChange={(e) => setCep(formatCep(e.target.value))}
              onBlur={lookupCep}
              placeholder="00000-000"
              inputMode="numeric"
              className={INPUT}
            />
            {loadingCep && (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                buscando…
              </span>
            )}
          </div>
        </div>
        <div />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-1.5">
          <label className={LABEL}>Logradouro</label>
          <input
            name="street"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            placeholder="Rua, avenida, travessa..."
            className={INPUT}
          />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL}>Número</label>
          <input name="address_number" defaultValue={p?.address_number ?? ''} placeholder="Ex: 100" className={INPUT} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={LABEL}>Complemento</label>
          <input name="complement" defaultValue={p?.complement ?? ''} placeholder="Apto, bloco, sala..." className={INPUT} />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL}>Bairro</label>
          <input
            name="neighborhood"
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            placeholder="Bairro"
            className={INPUT}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={LABEL}>Cidade *</label>
          <input
            name="city"
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Cidade"
            className={INPUT}
          />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL}>Estado (UF) *</label>
          <select name="state" required value={uf} onChange={(e) => setUf(e.target.value)} className={INPUT}>
            <option value="">Selecionar...</option>
            {UF_LIST.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={LABEL}>Ponto de Referência</label>
        <input name="reference" defaultValue={p?.reference ?? ''} placeholder="Próximo a..." className={INPUT} />
      </div>
    </Section>
  )
}

export function ObraFormFields({ clients, project, defaultClientId, defaultWarrantyMonths }: Props) {
  const p = project

  return (
    <div className="rounded-xl border border-gold/40 bg-white p-6 shadow-sm space-y-6">

      {/* ── 1. IDENTIFICAÇÃO ───────────────────────────────────── */}
      <Section title="Identificação">
        <div className="space-y-1.5">
          <label className={LABEL}>Nome da Obra *</label>
          <input name="name" required defaultValue={p?.name ?? ''} placeholder="Ex: Residência Silva - Bloco A" className={INPUT} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={LABEL}>Tipo *</label>
            <select name="type" required defaultValue={p?.type ?? 'residential'} className={INPUT}>
              {Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Área Construída (m²)</label>
            <AreaInput name="area_m2" defaultValue={p?.area_m2 ?? undefined} className={INPUT} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={LABEL}>Área do Terreno (m²)</label>
            <AreaInput name="land_area_m2" defaultValue={p?.land_area_m2 ?? undefined} className={INPUT} />
          </div>
          <div />
        </div>

        <div className="space-y-1.5">
          <label className={LABEL}>Descrição</label>
          <textarea name="description" rows={3} defaultValue={p?.description ?? ''} placeholder="Breve descrição da obra..." className={`${INPUT} resize-none`} />
        </div>
      </Section>

      {/* ── 2. ENDEREÇO ────────────────────────────────────────── */}
      <AddressSection project={project} />

      {/* ── 3. DATAS E RESPONSÁVEIS ────────────────────────────── */}
      <Section title="Datas e Responsáveis">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={LABEL}>Data de Início *</label>
            <input name="start_date" type="date" required defaultValue={p?.start_date ?? ''} className={INPUT} />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Término Previsto *</label>
            <input name="expected_end_date" type="date" required defaultValue={p?.expected_end_date ?? ''} className={INPUT} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={LABEL}>Responsável Técnico</label>
            <input name="technical_responsible" defaultValue={p?.technical_responsible ?? ''} placeholder="Nome e CREA (engenheiro da ART)" className={INPUT} />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Mestre de Obras</label>
            <input name="site_manager" defaultValue={p?.site_manager ?? ''} placeholder="Nome do mestre de obras" className={INPUT} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={LABEL}>Fiscal / Representante do Cliente</label>
            <input name="client_representative" defaultValue={p?.client_representative ?? ''} placeholder="Quem acompanha pela parte do cliente" className={INPUT} />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Prioridade</label>
            <PrioritySelect defaultValue={p?.priority} />
          </div>
        </div>
      </Section>

      {/* ── 3. DADOS TÉCNICOS ──────────────────────────────────── */}
      <Section title="Dados Técnicos">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={LABEL}>Nº de Pavimentos</label>
            <input name="floors_count" type="number" min={0} defaultValue={p?.floors_count ?? ''} placeholder="Ex: 2" className={INPUT} />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Sistema Construtivo</label>
            <select name="construction_system" defaultValue={p?.construction_system ?? ''} className={INPUT}>
              <option value="">Selecionar...</option>
              {Object.entries(CONSTRUCTION_SYSTEM_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={LABEL}>Tipo de Fundação</label>
            <select name="foundation_type" defaultValue={p?.foundation_type ?? ''} className={INPUT}>
              <option value="">Selecionar...</option>
              {Object.entries(FOUNDATION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Padrão de Acabamento</label>
            <select name="finish_standard" defaultValue={p?.finish_standard ?? ''} className={INPUT}>
              <option value="">Selecionar...</option>
              {Object.entries(FINISH_STANDARD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      {/* ── 4. LEGAL E REGULATÓRIO ─────────────────────────────── */}
      <Section title="Legal e Regulatório">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={LABEL}>Número do Alvará</label>
            <input name="permit_number" defaultValue={p?.permit_number ?? ''} placeholder="Ex: ALV-2025-001" className={INPUT} />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Nº da ART / RRT</label>
            <input name="art_number" defaultValue={p?.art_number ?? ''} placeholder="Ex: BA20240012345" className={INPUT} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={LABEL}>CNO / Matrícula CEI</label>
            <input name="cno_number" defaultValue={p?.cno_number ?? ''} placeholder="Cadastro Nacional de Obras" className={INPUT} />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Matrícula do Imóvel</label>
            <input name="property_registration" defaultValue={p?.property_registration ?? ''} placeholder="Cartório de registro de imóveis" className={INPUT} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={LABEL}>Inscrição Imobiliária (IPTU)</label>
            <input name="municipal_registration" defaultValue={p?.municipal_registration ?? ''} placeholder="Inscrição municipal" className={INPUT} />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Seguradora</label>
            <input name="insurance_company" defaultValue={p?.insurance_company ?? ''} placeholder="Nome da seguradora" className={INPUT} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={LABEL}>Nº da Apólice</label>
            <input name="insurance_policy" defaultValue={p?.insurance_policy ?? ''} placeholder="Número da apólice" className={INPUT} />
          </div>
          <InsuranceExpiry defaultValue={p?.insurance_expiry} />
        </div>
      </Section>

      {/* ── 5. DADOS COMERCIAIS ────────────────────────────────── */}
      <Section title="Dados Comerciais">
        <div className="space-y-1.5">
          <label className={LABEL}>Cliente</label>
          <ClienteSelectComBusca
            initialClients={clients}
            defaultClientId={p?.client_id ?? defaultClientId}
            name="client_id"
          />
        </div>

        <div className="space-y-1.5">
          <label className={LABEL}>Valor do Contrato (R$)</label>
          <CurrencyInput name="contract_value" defaultValue={p?.contract_value ?? undefined} className={INPUT} />
        </div>
      </Section>

      {/* ── 6. ENCERRAMENTO E GARANTIA ─────────────────────────── */}
      <Section title="Encerramento e Garantia">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={LABEL}>Nº do Habite-se</label>
            <input name="habite_se_number" defaultValue={p?.habite_se_number ?? ''} placeholder="Número do habite-se" className={INPUT} />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Data do Habite-se</label>
            <input name="habite_se_date" type="date" defaultValue={p?.habite_se_date ?? ''} className={INPUT} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={LABEL}>Início da Garantia</label>
            <input name="warranty_start_date" type="date" defaultValue={p?.warranty_start_date ?? ''} className={INPUT} />
          </div>
          <WarrantyMonths defaultValue={p?.warranty_months ?? defaultWarrantyMonths} />
        </div>
      </Section>
    </div>
  )
}
