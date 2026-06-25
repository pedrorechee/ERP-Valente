# ERP Valente — Fase 2: Obras e Financeiro — Design Spec

> Spec gerada em 2026-06-06. Base: Fase 1 concluída (Next.js 16, Tailwind v4, shadcn canary, Supabase SSR).

---

## Objetivo

Transformar o ERP de uma casca de navegação num sistema operacional real. Ao final da Fase 2, o dono consegue cadastrar obras, controlar fases e tarefas, registrar o diário diário, organizar fotos e documentos, lançar entradas e saídas financeiras por obra — e o dashboard mostrará dados reais, não placeholders.

---

## Subitem 2.1 — Módulo de Obras

### Listagem (`/obras`)

- Título da página + botão "Nova Obra" (terracota, canto direito)
- Cards de obras com: nome, endereço, status, fase atual, % de avanço (barra de progresso), prazo previsto vs real (com indicador de atraso em vermelho), responsável técnico
- Filtro por status: Todas | Em andamento | Concluídas | Paralisadas
- Busca por nome ou endereço
- Estado vazio elegante quando não há obras cadastradas
- Responsivo: grid 1 col mobile → 2 cols desktop

### Formulário de Cadastro (`/obras/nova`)

Campos obrigatórios:
- Nome da obra (texto)
- Endereço completo (texto)
- Tipo da obra (select): Residencial / Comercial / Industrial / Reforma / Outro
- Área em m² (número)
- Data de início (date picker)
- Data de término previsto (date picker)
- Responsável técnico (texto — nome e CREA)
- Status inicial: sempre "Em andamento"

Campos opcionais:
- Descrição breve (textarea)
- Cliente vinculado (select dos clientes cadastrados — tabela `clients`)
- Valor do contrato (número formatado como R$)
- Número do alvará (texto)

Comportamento:
- Validação client-side antes de submeter
- Server Action para persistir — retorna para `/obras/[id]` após salvar
- Toast de confirmação ("Obra criada com sucesso")

### Página Interna (`/obras/[id]`)

Header da obra:
- Nome da obra (título grande)
- Endereço em linha menor
- Badge de status (Em andamento / Concluída / Paralisada / Cancelada)
- Barra de progresso geral (média ponderada das fases)
- Botão "Editar Obra" (acesso ao formulário de edição)

7 tabs navegáveis (barra horizontal scrollável no mobile):
1. Visão Geral
2. Fases e Tarefas
3. Diário de Obra
4. Galeria
5. Documentos
6. Marcos Críticos
7. Financeiro

---

#### Tab 1 — Visão Geral

- Cards de resumo: Área total (m²), Tipo, Início, Término previsto, Responsável técnico, Cliente
- Barra de progresso geral da obra com % numérico
- Timeline das fases: lista visual mostrando cada fase com status (não iniciada / em andamento / concluída / atrasada), datas previstas e reais, e % de avanço
- Seção "Alertas": fases atrasadas, documentos pendentes, marcos próximos do vencimento
- Seção "Última atualização do diário": resumo do diário mais recente (data + texto da entrada)

---

#### Tab 2 — Fases e Tarefas

**Fases:**
- Lista de fases da obra (padrão pré-definido com opção de customizar)
- Fases padrão sugeridas: Fundação, Estrutura, Alvenaria, Instalações Elétricas, Instalações Hidráulicas, Acabamento, Entrega
- Cada fase tem: nome, % de conclusão (slider ou input numérico), data prevista, data real (preenchida quando concluída), status automático
- Botão "Adicionar fase" para fases customizadas
- Reordenar fases (drag ou botões de mover)
- Status automático: "Não iniciada" (0%), "Em andamento" (1–99%), "Concluída" (100%), "Atrasada" (data prevista < hoje e % < 100%)

**Tarefas dentro de cada fase:**
- Cada fase pode ser expandida para mostrar suas tarefas
- Tarefa: descrição, responsável (nome), prazo, status (check-box concluída)
- Botão "Adicionar tarefa" dentro de cada fase
- Quando todas as tarefas estão concluídas, sugere marcar a fase como 100%

---

#### Tab 3 — Diário de Obra

- Lista cronológica de entradas do diário (mais recente primeiro)
- Cada entrada mostra: data, clima (select: Sol / Nublado / Chuva), texto do que foi executado, equipe presente (textarea), ocorrências do dia, lista de fotos em miniatura vinculadas
- Botão "Nova entrada" abre formulário inline ou modal:
  - Data (default: hoje)
  - Clima (select)
  - O que foi executado hoje (textarea)
  - Equipe presente (textarea — nomes)
  - Ocorrências (textarea — opcional)
  - Fotos do dia (upload múltiplo, vai para Supabase Storage bucket `obra-fotos`, pasta `obras/{obraId}/diario/{data}/`)
- Filtro por mês/período

---

#### Tab 4 — Galeria

- Grid de fotos da obra organizadas por fase
- Cabeçalho de cada fase (seção colapsável) com as fotos em grid
- Cada foto: thumbnail clicável abre lightbox com navegação por seta
- Upload de novas fotos: botão + select da fase + upload (vai para `obras/{obraId}/galeria/{faseId}/`)
- Legenda opcional por foto
- Fotos do diário aparecem automaticamente na galeria da fase correspondente (se fase vinculada)

---

#### Tab 5 — Documentos

- Lista de documentos da obra: ART, alvará, projetos, laudos, contratos, notas fiscais
- Cada documento: nome, tipo (select), data de upload, arquivo para download
- Botão "Adicionar documento" → formulário com nome, tipo, e upload de PDF/imagem (Supabase Storage bucket `obra-documentos`, pasta `obras/{obraId}/docs/`)
- Tipos de documento: ART | Alvará | Projeto Arquitetônico | Projeto Estrutural | Projeto Elétrico | Projeto Hidráulico | Laudo | Contrato | Nota Fiscal | Outro
- Download direto pelo link do Supabase Storage

---

#### Tab 6 — Marcos Críticos

- Lista de marcos importantes da obra com prazo e status
- Exemplos: "Laje do 1º andar", "Conclusão da estrutura", "Vistoria da prefeitura"
- Cada marco: descrição, prazo previsto, data real de conclusão, status (Pendente / Concluído / Atrasado)
- Indicador visual: verde (concluído), amarelo (próximo — dentro de 7 dias), vermelho (atrasado)
- Botão "Adicionar marco"
- Ordenado por prazo previsto crescente

---

#### Tab 7 — Financeiro (= Subitem 2.2)

Ver seção 2.2 abaixo.

---

## Subitem 2.2 — Módulo Financeiro da Obra (Tab 7)

### Extrato da Obra

- Saldo atual da obra: total de entradas − total de saídas (grande e destacado no topo)
- Filtros: período (mês/trimestre/customizado), tipo (Entrada/Saída/Todos), categoria
- Lista de lançamentos: data | tipo (badge verde/vermelho) | descrição | categoria | fornecedor/cliente | valor | comprovante (ícone se tem anexo)
- Totalizadores: total de entradas, total de saídas, resultado do período

### Formulário de Lançamento

- Tipo: Entrada | Saída (radio/toggle)
- Data (date picker, default hoje)
- Descrição (texto obrigatório)
- Valor (R$ formatado)
- Categoria:
  - Para Entrada: Recebimento de cliente | Adiantamento | Outras entradas
  - Para Saída: Material | Mão de obra | Subempreiteiro | Equipamento | Serviço | Imposto | Outras saídas
- Fornecedor/Cliente (texto livre ou select dos cadastrados)
- Forma de pagamento: Dinheiro | PIX | Boleto | Cartão | Transferência | Cheque
- Comprovante (upload: PDF, JPG, PNG — bucket `obra-comprovantes`, pasta `obras/{obraId}/comprovantes/`)
- Observações (textarea, opcional)
- Salvar via Server Action — toast de confirmação

### Conta Corrente com Fornecedor

- Visão de conta corrente: todos os lançamentos de um fornecedor específico numa obra
- Saldo devedor/credor com o fornecedor
- Acesso via filtro por fornecedor no extrato, ou aba dedicada dentro do extrato

---

## Subitem 2.3 — Dashboard Principal

### Cards de Resumo (dados reais via queries ao Supabase)

- **Obras ativas**: contagem de obras com status "Em andamento"
- **Obras atrasadas**: contagem de obras com ≥1 fase atrasada
- **Receitas do mês**: soma de entradas do mês corrente (todas as obras)
- **Despesas do mês**: soma de saídas do mês corrente (todas as obras)
- **Resultado do mês**: receitas − despesas (verde se positivo, vermelho se negativo)
- **Contas a vencer em 7 dias**: contagem de marcos críticos ou lançamentos com vencimento próximo

### Lista de Obras Ativas

- Cards menores mostrando cada obra ativa: nome, fase atual, % de progresso, status de risco
- Status de risco: Normal (cinza) | Atenção (amarelo — prazo em menos de 30 dias) | Atrasada (vermelho — prazo vencido ou fase atrasada)
- Clique no card vai para `/obras/[id]`

### Alertas do Dia

- Seção colapsável no topo (se houver alertas)
- Lista de alertas: fases atrasadas, marcos vencidos, obras sem diário há mais de 7 dias

---

## Subitem 2.4 — Banco de Dados (11 novas tabelas)

### Tabelas

```sql
-- Clientes da construtora
clients (id, name, email, phone, document, address, created_at, updated_at)

-- Fornecedores
suppliers (id, name, email, phone, document, address, category, created_at, updated_at)

-- Obras
projects (
  id, name, address, type, area_m2, start_date, expected_end_date, actual_end_date,
  status, -- 'active' | 'completed' | 'paused' | 'cancelled'
  technical_responsible, client_id (FK clients), contract_value,
  permit_number, description, overall_progress (0–100),
  created_by (FK auth.users), created_at, updated_at
)

-- Fases da obra
project_phases (
  id, project_id (FK), name, order_index, progress (0–100),
  expected_start, expected_end, actual_end, status,
  created_at, updated_at
)

-- Tarefas dentro de cada fase
phase_tasks (
  id, phase_id (FK), description, responsible, due_date,
  completed, completed_at, created_at, updated_at
)

-- Entradas do diário de obra
project_diary (
  id, project_id (FK), entry_date, weather, -- 'sun' | 'cloudy' | 'rain'
  work_done, team_present, occurrences,
  created_by (FK auth.users), created_at, updated_at
)

-- Fotos do diário
diary_photos (
  id, diary_id (FK), phase_id (FK nullable),
  storage_path, caption, created_at
)

-- Documentos da obra
documents (
  id, project_id (FK), name, type, storage_path,
  uploaded_by (FK auth.users), created_at
)

-- Marcos críticos
critical_milestones (
  id, project_id (FK), description, planned_date, actual_date,
  status, -- 'pending' | 'completed' | 'delayed'
  created_at, updated_at
)

-- Lançamentos financeiros
financial_entries (
  id, project_id (FK), entry_type, -- 'income' | 'expense'
  entry_date, description, amount, category, payment_method,
  counterpart, -- fornecedor ou cliente (texto livre)
  supplier_id (FK nullable), storage_path_proof,
  notes, created_by (FK auth.users), created_at, updated_at
)

-- Saldo/conta corrente por fornecedor por obra
supplier_accounts (
  id, project_id (FK), supplier_id (FK), balance,
  last_updated
)
```

### Políticas RLS

- `projects`: dono/admin lê e escreve tudo; `foreman` lê apenas obras onde é responsável; `client` lê apenas obras vinculadas a ele via `clients.id`
- `project_phases`, `phase_tasks`, `project_diary`, `diary_photos`, `documents`, `critical_milestones`: herdadas das permissões de `projects`
- `financial_entries`, `supplier_accounts`: dono/admin lê e escreve; `foreman` sem acesso; `client` sem acesso
- `clients`, `suppliers`: dono/admin CRUD; outros sem acesso

### Buckets do Supabase Storage

Três buckets privados (não públicos — acesso via URL assinada):
- `obra-fotos` — fotos do diário e galeria
- `obra-documentos` — PDFs e arquivos de documentos
- `obra-comprovantes` — comprovantes de lançamentos financeiros

---

## Decisões Técnicas

| Tópico | Decisão | Motivo |
|---|---|---|
| Tabs da obra | Componente `Tabs` do shadcn canary | Mantém consistência com o design system existente |
| Upload de arquivos | Supabase Storage + Server Action | SUPABASE_SECRET_KEY no servidor, URL assinada retornada ao cliente |
| Lightbox de fotos | Implementação simples com Dialog do shadcn | Sem dependência externa, suficiente para o MVP |
| Formatação de moeda | `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` | Padrão nativo, zero dependências |
| Estado das tabs | URL search param `?tab=fases` | Permite compartilhar link direto para uma tab |
| Progresso da obra | Média ponderada das fases, calculada no server | Não armazenar estado derivado |
| Fases padrão | Criadas automaticamente ao criar obra | UX: não exige que o usuário crie do zero |
| Supabase Storage URLs | `createSignedUrl` com expiração de 3600s | Bucket privado — nunca URL pública |

---

## Arquitetura de Rotas

```
/obras                          — listagem
/obras/nova                     — formulário de cadastro
/obras/[id]                     — página interna (7 tabs via ?tab=)
/obras/[id]/editar              — formulário de edição
```

## Server Actions

```
src/app/actions/
  obras.ts       — createProject, updateProject, updateProjectStatus
  fases.ts       — createPhase, updatePhaseProgress, reorderPhases
  tarefas.ts     — createTask, toggleTask
  diario.ts      — createDiaryEntry, uploadDiaryPhoto
  documentos.ts  — uploadDocument, deleteDocument
  marcos.ts      — createMilestone, completeMilestone
  financeiro.ts  — createFinancialEntry, uploadProof
```

## Componentes Novos

```
src/components/obras/
  ProjectCard.tsx         — card da listagem
  ProjectHeader.tsx       — header da página interna
  ProjectTabs.tsx         — barra de tabs
  tabs/
    VisaoGeral.tsx
    FasesETarefas.tsx
    DiarioDeObra.tsx
    Galeria.tsx
    Documentos.tsx
    MarcosCriticos.tsx
    FinanceiroObra.tsx
src/components/financeiro/
  LancamentoForm.tsx
  ExtratoTabela.tsx
src/components/dashboard/
  StatsCards.tsx
  ObrasAtivas.tsx
  AlertasHoje.tsx
```

---

## Fluxo de Dados (Resumo)

1. Server Component busca dados do Supabase (sem `<Database>` generic — cast explícito)
2. Passa props tipadas para componentes client
3. Mutations via Server Actions com `revalidatePath`
4. Upload de arquivo: client envia `FormData` → Server Action → `supabase.storage.from(...).upload()` → salva path no banco
5. Leitura de arquivo: Server Action gera `createSignedUrl` → retorna URL temporária ao client

---

*Spec aprovada — pronta para writing-plans.*
