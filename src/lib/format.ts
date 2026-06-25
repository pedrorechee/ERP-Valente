export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

// Número único do lançamento financeiro: "FIN-000123" (prefixo + 6 dígitos).
// Fonte única de formatação — usar em todas as telas que exibem o entry_number.
export function formatFinanceNumber(n: number | null | undefined): string {
  // 0/ausente = lançamento otimista ainda sem número (gerado pelo banco ao salvar)
  if (!n || n < 1) return '—'
  return `FIN-${String(n).padStart(6, '0')}`
}

// Normaliza uma busca por número: aceita "123", "FIN-000123", "fin000123" etc.
// Retorna o inteiro correspondente, ou null se não houver dígitos.
export function parseFinanceNumber(input: string): number | null {
  const digits = input.replace(/\D/g, '')
  if (!digits) return null
  return Number(digits)
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  // Aceita "YYYY-MM-DD" e timestamps ISO completos ("YYYY-MM-DDTHH:MM:SS..."):
  // usa apenas a parte da data, evitando a saída quebrada com o horário cru.
  const [year, month, day] = dateStr.split('T')[0].split('-')
  if (!year || !month || !day) return dateStr
  return `${day}/${month}/${year}`
}

export function formatDateLong(dateStr: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function isOverdue(dateStr: string): boolean {
  if (!dateStr) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(dateStr + 'T00:00:00')
  return date < today
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  const d = phone.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return phone
}

export function formatDocument(doc: string | null | undefined): string {
  if (!doc) return '—'
  const d = doc.replace(/\D/g, '')
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
  return doc
}

export function daysUntil(dateStr: string): number {
  if (!dateStr) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(dateStr + 'T00:00:00')
  return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

// Monta o endereço da obra priorizando campos estruturados.
// Fallback para o campo legado `address` quando não há campos estruturados.
export function formatProjectAddress(project: {
  street?:         string | null
  address_number?: string | null
  neighborhood?:   string | null
  city?:           string | null
  state?:          string | null
  address?:        string | null
}): string {
  const street       = project.street?.trim()       || ''
  const number       = project.address_number?.trim() || ''
  const neighborhood = project.neighborhood?.trim() || ''
  const city         = project.city?.trim()         || ''
  const state        = project.state?.trim()        || ''

  // Sem campos estruturados → fallback legado
  if (!street && !city) return project.address?.trim() || ''

  // Parte de localização: "street[, number][ - neighborhood]"
  let loc = street
  if (number)       loc = loc ? `${loc}, ${number}`       : number
  if (neighborhood) loc = loc ? `${loc} - ${neighborhood}` : neighborhood

  // Cidade + estado: "city[ - state]"
  const cityState =
    city && state ? `${city} - ${state}` :
    city          ? city                  :
    state         ? state                 : ''

  if (loc && cityState) return `${loc}, ${cityState}`
  return loc || cityState
}
