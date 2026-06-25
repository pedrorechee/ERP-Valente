export type UserRole = 'owner' | 'admin' | 'foreman' | 'client'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  phone: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// Dados da empresa (singleton) — sql/030. Preferências (sql/031) moram na mesma linha.
export interface CompanySettings {
  id:                      string
  legal_name:              string | null
  trade_name:              string | null
  document:                string | null
  state_registration:      string | null
  municipal_registration:  string | null
  phone:                   string | null
  email:                   string | null
  website:                 string | null
  cep:                     string | null
  street:                  string | null
  address_number:          string | null
  complement:              string | null
  neighborhood:            string | null
  city:                    string | null
  state:                   string | null
  logo_path:               string | null
  // Preferências (Seção 3 — sql/031)
  default_bdi_percent?:        number | null
  default_retention_percent?:  number | null
  default_warranty_months?:    number | null
  updated_at:              string
}

// ─── Fase 2 ────────────────────────────────────────────────

export type ClientType = 'pf' | 'pj'
export type HowTheyFound = 'indicacao' | 'instagram' | 'google' | 'direto' | 'outro'

export interface Client {
  id: string
  name: string
  type: ClientType
  email: string | null
  phone: string | null
  document: string | null
  address: string | null
  city: string | null
  state: string | null
  notes: string | null
  how_they_found: HowTheyFound | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type SupplierType =
  | 'material'
  | 'mao_de_obra'
  | 'equipamento'
  | 'transporte'
  | 'alimentacao'
  | 'servicos'
  | 'outros'

export interface Supplier {
  id: string
  name: string
  email: string | null
  phone: string | null
  document: string | null
  address: string | null
  category: string | null
  notes: string | null
  type: SupplierType
  pix_key: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SupplierEvaluation {
  id: string
  supplier_id: string
  project_id: string
  quality_score: number | null
  met_deadline: boolean | null
  observation: string | null
  evaluated_by: string | null
  created_at: string
  projects?: { id: string; name: string } | null
}

export type ProjectType = 'residential' | 'commercial' | 'industrial' | 'renovation' | 'other'
export type ProjectStatus = 'active' | 'completed' | 'paused' | 'cancelled'
export type ProjectPriority = 'alta' | 'media' | 'baixa'
export type FinishStandard = 'popular' | 'normal' | 'alto' | 'luxo'
export type PhaseStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed'
export type MilestoneStatus = 'pending' | 'completed' | 'delayed'
export type EntryType = 'income' | 'expense'
export type FinancialEntryStatus = 'pago' | 'pendente' | 'agendado'
export type WeatherType = 'sun' | 'cloudy' | 'rain' | 'storm'
export type PaymentMethod = 'cash' | 'pix' | 'boleto' | 'card' | 'transfer' | 'check'

export interface Project {
  id: string
  name: string
  address: string
  type: ProjectType
  area_m2: number | null
  start_date: string
  expected_end_date: string
  actual_end_date: string | null
  status: ProjectStatus
  technical_responsible: string | null
  client_id: string | null
  contract_value: number | null
  permit_number: string | null
  description: string | null
  overall_progress: number
  cancellation_reason: string | null
  // ─── Campos adicionais (migration 019) ───
  land_area_m2: number | null
  site_manager: string | null
  client_representative: string | null
  priority: ProjectPriority | null
  floors_count: number | null
  construction_system: string | null
  foundation_type: string | null
  finish_standard: FinishStandard | null
  art_number: string | null
  cno_number: string | null
  property_registration: string | null
  municipal_registration: string | null
  insurance_company: string | null
  insurance_policy: string | null
  insurance_expiry: string | null
  habite_se_number: string | null
  habite_se_date: string | null
  warranty_start_date: string | null
  warranty_months: number | null
  // ─── Endereço estruturado (migration 021) ───
  cep: string | null
  street: string | null
  address_number: string | null
  complement: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  reference: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ProjectWithClient extends Project {
  clients: Pick<Client, 'id' | 'name'> | null
}

export interface ProjectPhase {
  id: string
  project_id: string
  name: string
  order_index: number
  progress: number
  weight: number
  expected_start: string | null
  expected_end: string | null
  actual_end: string | null
  status: PhaseStatus
  created_at: string
  updated_at: string
}

export interface PhaseWithTasks extends ProjectPhase {
  phase_tasks: PhaseTask[]
}

export interface PhaseTask {
  id: string
  phase_id: string
  description: string
  responsible: string | null
  due_date: string | null
  completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface DiaryEntry {
  id: string
  project_id: string
  entry_date: string
  weather: WeatherType | null
  work_done: string
  team_present: string | null
  occurrences: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface DiaryEntryWithPhotos extends DiaryEntry {
  diary_photos: DiaryPhoto[]
}

export interface DiaryPhoto {
  id: string
  diary_id: string
  phase_id: string | null
  storage_path: string
  caption: string | null
  created_at: string
}

export interface ProjectDocument {
  id: string
  project_id: string
  name: string
  type: string
  storage_path: string
  uploaded_by: string | null
  created_at: string
}

export interface CriticalMilestone {
  id: string
  project_id: string
  description: string
  planned_date: string
  actual_date: string | null
  status: MilestoneStatus
  created_at: string
  updated_at: string
}

// ─── Plano de custo (plano de contas / DRE) ─────────────────

export type CostNature = 'income' | 'expense'
export type DreGroup =
  | 'receita_bruta'
  | 'deducoes'
  | 'custo_direto'
  | 'despesa_operacional'
  | 'despesa_financeira'

export interface CostCategory {
  id: string
  code: string
  name: string
  nature: CostNature
  dre_group: DreGroup
  dre_subgroup: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export const DRE_GROUP_LABELS: Record<DreGroup, string> = {
  receita_bruta:       'Receita Bruta',
  deducoes:            'Deduções',
  custo_direto:        'Custos Diretos',
  despesa_operacional: 'Despesas Operacionais',
  despesa_financeira:  'Despesas Financeiras',
}

export interface FinancialEntry {
  id: string
  // Número único sequencial gerado pelo banco (sql/028). Imutável, nunca reaproveitado.
  entry_number: number
  project_id: string
  entry_type: EntryType
  entry_date: string
  description: string
  amount: number
  category: string
  category_id: string | null
  payment_method: PaymentMethod | null
  counterpart: string | null
  supplier_id: string | null
  storage_path_proof: string | null
  notes: string | null
  status: FinancialEntryStatus
  payment_date: string | null
  scheduled_date: string | null
  due_date: string | null
  paid_by: string | null
  nf_number: string | null
  // Etapa da obra vinculada (opcional) — base do orçado x realizado por etapa
  phase_id: string | null
  // Quando true e com supplier_id, entra no saldo/extrato de Contas de Fornecedores
  in_supplier_account: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  link: string
  read: boolean
  reference_id: string | null
  created_at: string
}

export interface SupplierAccount {
  id: string
  project_id: string
  supplier_id: string
  balance: number
  last_updated: string
}

export type SupplierAccountEntryType = 'nota' | 'pagamento'

export interface SupplierAccountEntry {
  id:             string
  supplier_id:    string
  project_id:     string
  type:           SupplierAccountEntryType
  description:    string
  amount:         number
  date:           string
  payment_method: PaymentMethod | null
  receipt_url:    string | null
  created_by:     string | null
  created_at:     string
}

// ─── Orçamentos (Fase 3) ────────────────────────────────────

export type BudgetStatus = 'rascunho' | 'aprovado'

export interface Budget {
  id:                string
  project_id:        string
  version:           number  // legado: fixo em 1 (sem versionamento)
  description:       string | null
  bdi_percent:       number
  phase_bdi_enabled: boolean
  status:            BudgetStatus
  total_direct_cost: number
  total_with_bdi:    number
  approved_at:       string | null
  created_at:        string
  updated_at:        string
}

export interface BudgetItem {
  id:          string
  budget_id:   string
  phase_id:    string | null
  description: string
  unit:        string | null
  quantity:    number
  unit_price:  number
  total:       number
  bdi_override: number | null
  category_id: string | null
  order_index: number
  created_at:  string
}

export const BUDGET_STATUS_LABELS: Record<BudgetStatus, string> = {
  rascunho: 'Rascunho',
  aprovado: 'Aprovado',
}

// Unidades de medida usadas nos itens do orçamento.
// value = abreviação gravada no banco; name = nome completo (exibido entre parênteses).
// Ordenadas alfabeticamente pela abreviação.
export const BUDGET_UNITS = [
  { value: 'balde', name: 'Balde' },
  { value: 'barra', name: 'Barra' },
  { value: 'chapa', name: 'Chapa' },
  { value: 'cj',    name: 'Conjunto' },
  { value: 'cm',    name: 'Centímetro' },
  { value: 'ct',    name: 'Cento' },
  { value: 'dia',   name: 'Diária' },
  { value: 'dz',    name: 'Dúzia' },
  { value: 'fardo', name: 'Fardo' },
  { value: 'g',     name: 'Grama' },
  { value: 'gl',    name: 'Galão' },
  { value: 'h',     name: 'Hora' },
  { value: 'h/m',   name: 'Hora-máquina' },
  { value: 'jg',    name: 'Jogo' },
  { value: 'kg',    name: 'Quilograma' },
  { value: 'km',    name: 'Quilômetro' },
  { value: 'L',     name: 'Litro' },
  { value: 'lata',  name: 'Lata' },
  { value: 'm',     name: 'Metro' },
  { value: 'm²',    name: 'Metro quadrado' },
  { value: 'm³',    name: 'Metro cúbico' },
  { value: 'mês',   name: 'Mês' },
  { value: 'ml',    name: 'Metro linear' },
  { value: 'mlh',   name: 'Milheiro' },
  { value: 'par',   name: 'Par' },
  { value: 'pç',    name: 'Peça' },
  { value: 'pt',    name: 'Ponto' },
  { value: 'rolo',  name: 'Rolo' },
  { value: 'sc',    name: 'Saco' },
  { value: 't',     name: 'Tonelada' },
  { value: 'un',    name: 'Unidade' },
  { value: 'vb',    name: 'Verba' },
] as const

// ─── Contratos (Fase 3) ─────────────────────────────────────

export type ContractStatus = 'ativo' | 'concluido' | 'suspenso' | 'cancelado'
export type AmendmentType = 'valor' | 'prazo' | 'escopo' | 'valor_prazo'
export type MeasurementStatus = 'prevista' | 'medida' | 'aprovada' | 'faturada'

export interface Contract {
  id:                string
  project_id:        string
  contract_number:   string | null
  original_value:    number
  signing_date:      string | null
  start_date:        string | null
  end_date:          string | null
  retention_percent: number
  status:            ContractStatus
  document_path:     string | null
  notes:             string | null
  created_at:        string
  updated_at:        string
}

export interface ContractAmendment {
  id:               string
  contract_id:      string
  amendment_number: number
  type:             AmendmentType
  value_change:     number
  days_change:      number
  date:             string
  description:      string | null
  document_path:    string | null
  created_at:       string
}

export interface Measurement {
  id:                 string
  contract_id:        string
  project_id:         string
  measurement_number: number
  period_start:       string | null
  period_end:         string | null
  progress_percent:   number | null
  amount:             number             // valor BRUTO medido
  retention_percent:  number             // % de retenção aplicado NESTA medição (sql/029)
  description:        string | null
  status:             MeasurementStatus
  financial_entry_id: string | null
  created_at:         string
}

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  ativo:     'Ativo',
  concluido: 'Concluído',
  suspenso:  'Suspenso',
  cancelado: 'Cancelado',
}

export const AMENDMENT_TYPE_LABELS: Record<AmendmentType, string> = {
  valor:       'Valor',
  prazo:       'Prazo',
  escopo:      'Escopo',
  valor_prazo: 'Valor e Prazo',
}

export const MEASUREMENT_STATUS_LABELS: Record<MeasurementStatus, string> = {
  prevista: 'Prevista',
  medida:   'Medida',
  aprovada: 'Aprovada',
  faturada: 'Faturada',
}

// ─── RH e Equipe (Fase 4) ───────────────────────────────────

export type EmploymentType = 'clt' | 'diarista'
export type Attendance = 'presente' | 'falta' | 'meio_periodo' | 'atestado'

export interface Employee {
  id:              string
  name:            string
  document:        string | null   // CPF
  role:            string | null   // função/cargo
  employment_type: EmploymentType
  monthly_salary:  number          // CLT
  daily_rate:      number          // diarista
  charge_factor:   number          // multiplicador de encargos (CLT)
  work_days_month: number          // dias úteis/mês p/ ratear salário CLT
  admission_date:  string | null
  phone:           string | null
  pix_key:         string | null
  is_active:       boolean
  notes:           string | null
  created_at:      string
  updated_at:      string
}

export interface ProjectTeam {
  id:              string
  project_id:      string
  employee_id:     string
  role_in_project: string | null
  start_date:      string | null
  end_date:        string | null   // null = alocação ativa
  created_at:      string
}

export interface WorkLog {
  id:                 string
  employee_id:        string
  project_id:         string
  phase_id:           string | null
  log_date:           string
  attendance:         Attendance
  hours_worked:       number
  computed_cost:      number
  notes:              string | null
  financial_entry_id: string | null
  created_at:         string
}

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  clt:      'CLT',
  diarista: 'Diarista',
}

export const ATTENDANCE_LABELS: Record<Attendance, string> = {
  presente:     'Presente',
  falta:        'Falta',
  meio_periodo: 'Meio período',
  atestado:     'Atestado',
}

// Código do plano de contas (sql/020) usado pela folha da MO própria.
export const PAYROLL_CATEGORY_CODE = '3.2.02'

// ─── Labels de exibição ─────────────────────────────────────

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  residential: 'Residencial',
  commercial: 'Comercial',
  industrial: 'Industrial',
  renovation: 'Reforma',
  other: 'Outro',
}

export const PROJECT_PRIORITY_LABELS: Record<ProjectPriority, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
}

export const FINISH_STANDARD_LABELS: Record<FinishStandard, string> = {
  popular: 'Popular',
  normal: 'Normal',
  alto: 'Alto',
  luxo: 'Luxo',
}

export const CONSTRUCTION_SYSTEM_LABELS: Record<string, string> = {
  alvenaria_convencional: 'Alvenaria convencional',
  alvenaria_estrutural: 'Alvenaria estrutural',
  concreto_armado: 'Concreto armado',
  steel_frame: 'Steel frame',
  pre_moldado: 'Pré-moldado',
  madeira: 'Madeira',
  misto: 'Misto',
  outro: 'Outro',
}

export const FOUNDATION_TYPE_LABELS: Record<string, string> = {
  sapata: 'Sapata',
  radier: 'Radier',
  estaca: 'Estaca',
  tubulao: 'Tubulão',
  bloco: 'Bloco',
  sapata_corrida: 'Sapata corrida',
  outro: 'Outro',
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Em andamento',
  completed: 'Concluída',
  paused: 'Paralisada',
  cancelled: 'Cancelada',
}

export const PHASE_STATUS_LABELS: Record<PhaseStatus, string> = {
  not_started: 'Não iniciada',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  delayed: 'Atrasada',
}

export const WEATHER_LABELS: Record<WeatherType, string> = {
  sun: 'Sol',
  cloudy: 'Nublado',
  rain: 'Chuva',
  storm: 'Tempestade',
}

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  pf: 'Pessoa Física',
  pj: 'Pessoa Jurídica',
}

export const HOW_THEY_FOUND_LABELS: Record<HowTheyFound, string> = {
  indicacao: 'Indicação',
  instagram: 'Instagram',
  google: 'Google',
  direto: 'Contato direto',
  outro: 'Outro',
}

export const SUPPLIER_TYPE_LABELS: Record<SupplierType, string> = {
  material: 'Material de construção',
  mao_de_obra: 'Mão de obra',
  equipamento: 'Equipamento',
  transporte: 'Transporte',
  alimentacao: 'Alimentação',
  servicos: 'Serviços',
  outros: 'Outros',
}

export const FINANCIAL_STATUS_LABELS: Record<FinancialEntryStatus, string> = {
  pago: 'Pago',
  pendente: 'Pendente',
  agendado: 'Agendado',
}

export const INCOME_CATEGORIES = [
  'Recebimento de cliente',
  'Adiantamento',
  'Reembolso',
  'Outras entradas',
]

export const EXPENSE_CATEGORIES = [
  'Mão de obra própria',
  'Mão de obra terceirizada',
  'Material de construção',
  'Equipamentos',
  'Projetos e engenharia',
  'Taxas e documentos',
  'Operacional',
  'Alimentação',
  'Pousada e hospedagem',
  'Outros',
]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  pix: 'PIX',
  boleto: 'Boleto',
  card: 'Cartão',
  transfer: 'Transferência',
  check: 'Cheque',
}

export const DOCUMENT_TYPE_OPTIONS = [
  'ART',
  'Alvará',
  'Projeto Arquitetônico',
  'Projeto Estrutural',
  'Projeto Elétrico',
  'Projeto Hidráulico',
  'Laudo',
  'Contrato',
  'Nota Fiscal',
  'Outro',
]

export const DEFAULT_PHASES = [
  'Fundação',
  'Estrutura',
  'Alvenaria',
  'Instalações Elétricas',
  'Instalações Hidráulicas',
  'Acabamento',
  'Entrega',
]

// ─── Database type (mantido para compatibilidade) ────────────

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
        Relationships: {
          foreignKeyName: string
          columns: string[]
          isOneToOne?: boolean
          referencedRelation: string
          referencedColumns: string[]
        }[]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
