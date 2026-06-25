'use client'

import { useState } from 'react'
import { Building2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { updateCompanySettings } from '@/app/actions/configuracoes'
import type { CompanySettings } from '@/types/database'

const INPUT =
  'w-full rounded-lg border border-[#E6C07B] bg-white px-3 py-2 text-sm text-dark focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta'
const LABEL = 'text-xs font-semibold uppercase tracking-wide text-brown'

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

function maskCnpj(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function maskCep(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

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

interface Props {
  settings: CompanySettings | null
  logoUrl:  string | null
}

export function DadosEmpresaForm({ settings, logoUrl }: Props) {
  const s = settings
  const [saving, setSaving] = useState(false)

  const [document, setDocument] = useState(s?.document ?? '')
  const [cep, setCep]           = useState(s?.cep ?? '')
  const [street, setStreet]           = useState(s?.street ?? '')
  const [neighborhood, setNeighborhood] = useState(s?.neighborhood ?? '')
  const [city, setCity]               = useState(s?.city ?? '')
  const [uf, setUf]                   = useState(s?.state ?? '')
  const [loadingCep, setLoadingCep]   = useState(false)

  const [logoPreview, setLogoPreview] = useState<string | null>(logoUrl)

  async function lookupCep() {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    setLoadingCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      if (!res.ok) return
      const data = await res.json()
      if (data?.erro) return
      if (data.logradouro) setStreet(data.logradouro)
      if (data.bairro) setNeighborhood(data.bairro)
      if (data.localidade) setCity(data.localidade)
      if (data.uf) setUf(data.uf)
    } catch {
      /* falha de rede — silencioso */
    } finally {
      setLoadingCep(false)
    }
  }

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) setLogoPreview(URL.createObjectURL(file))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setSaving(true)
    updateCompanySettings(formData)
      .then((res) => {
        if (!res.success) throw new Error(res.error)
        if (res.logoUrl) setLogoPreview(res.logoUrl)
        toast.success('Dados da empresa salvos!')
      })
      .catch((err: Error) => {
        toast.error(err.message || 'Erro ao salvar os dados da empresa.')
      })
      .finally(() => setSaving(false))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Logo */}
      <div className="flex flex-wrap items-center gap-5 rounded-xl border border-gold/30 bg-white p-5 shadow-sm">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gold/30 bg-[#F9F7F4]">
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview} alt="Logo da empresa" className="h-full w-full object-contain" />
          ) : (
            <Building2 className="h-8 w-8 text-gold" />
          )}
        </div>
        <div className="space-y-1.5">
          <p className={LABEL}>Logo da empresa</p>
          <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-[#E6C07B] px-3 py-2 text-sm font-medium text-dark transition-colors hover:bg-cream">
            <Upload className="h-4 w-4" />
            {logoPreview ? 'Trocar logo' : 'Enviar logo'}
            <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={onLogoChange} className="hidden" />
          </label>
          <p className="text-xs text-gray-400">PNG, JPG ou WebP — até 5&nbsp;MB. Usada nos PDFs e no topo do sistema.</p>
        </div>
      </div>

      {/* Identificação */}
      <SectionTitle>Identificação</SectionTitle>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={LABEL}>Razão social</label>
          <input name="legal_name" defaultValue={s?.legal_name ?? ''} className={INPUT} />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL}>Nome fantasia</label>
          <input name="trade_name" defaultValue={s?.trade_name ?? ''} placeholder="Aparece na sidebar e PDFs" className={INPUT} />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL}>CNPJ</label>
          <input
            name="document"
            value={document}
            onChange={(e) => setDocument(maskCnpj(e.target.value))}
            placeholder="00.000.000/0000-00"
            inputMode="numeric"
            className={INPUT}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={LABEL}>Inscrição estadual</label>
            <input name="state_registration" defaultValue={s?.state_registration ?? ''} className={INPUT} />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Inscrição municipal</label>
            <input name="municipal_registration" defaultValue={s?.municipal_registration ?? ''} className={INPUT} />
          </div>
        </div>
      </div>

      {/* Contato */}
      <SectionTitle>Contato</SectionTitle>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className={LABEL}>Telefone</label>
          <input name="phone" defaultValue={s?.phone ?? ''} className={INPUT} />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL}>E-mail</label>
          <input name="email" type="email" defaultValue={s?.email ?? ''} className={INPUT} />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL}>Website</label>
          <input name="website" defaultValue={s?.website ?? ''} placeholder="https://" className={INPUT} />
        </div>
      </div>

      {/* Endereço */}
      <SectionTitle>Endereço</SectionTitle>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={LABEL}>CEP</label>
          <div className="relative">
            <input
              name="cep"
              value={cep}
              onChange={(e) => setCep(maskCep(e.target.value))}
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
        <div className="space-y-1.5">
          <label className={LABEL}>Rua / Logradouro</label>
          <input name="street" value={street} onChange={(e) => setStreet(e.target.value)} className={INPUT} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={LABEL}>Número</label>
            <input name="address_number" defaultValue={s?.address_number ?? ''} className={INPUT} />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Complemento</label>
            <input name="complement" defaultValue={s?.complement ?? ''} className={INPUT} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className={LABEL}>Bairro</label>
          <input name="neighborhood" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className={INPUT} />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL}>Cidade</label>
          <input name="city" value={city} onChange={(e) => setCity(e.target.value)} className={INPUT} />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL}>UF</label>
          <select name="state" value={uf} onChange={(e) => setUf(e.target.value)} className={INPUT}>
            <option value="">—</option>
            {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-terracotta px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brown disabled:opacity-60"
        >
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  )
}
