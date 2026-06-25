-- ============================================================
-- 011 — Índices de performance
-- Cobre as colunas mais usadas em filtros, joins e ordenações.
-- Execute no SQL Editor do Supabase. Seguro re-executar
-- (todos usam IF NOT EXISTS).
-- ============================================================

-- ── financial_entries ───────────────────────────────────────
-- Filtros do /financeiro (período, tipo, status) e joins por obra/fornecedor
create index if not exists idx_financial_entries_project_id
  on public.financial_entries (project_id);

create index if not exists idx_financial_entries_supplier_id
  on public.financial_entries (supplier_id);

create index if not exists idx_financial_entries_entry_date
  on public.financial_entries (entry_date desc);

create index if not exists idx_financial_entries_entry_type
  on public.financial_entries (entry_type);

create index if not exists idx_financial_entries_status
  on public.financial_entries (status);

-- Composto para a query principal do /financeiro (range de data + tipo)
create index if not exists idx_financial_entries_date_type
  on public.financial_entries (entry_date, entry_type);

-- ── supplier_account_entries (conta corrente) ───────────────
create index if not exists idx_sae_supplier_id
  on public.supplier_account_entries (supplier_id);

create index if not exists idx_sae_project_id
  on public.supplier_account_entries (project_id);

create index if not exists idx_sae_date
  on public.supplier_account_entries (date);

-- ── projects ────────────────────────────────────────────────
create index if not exists idx_projects_client_id
  on public.projects (client_id);

create index if not exists idx_projects_status
  on public.projects (status);

-- ── fases e tarefas ─────────────────────────────────────────
create index if not exists idx_project_phases_project_id
  on public.project_phases (project_id);

create index if not exists idx_phase_tasks_phase_id
  on public.phase_tasks (phase_id);

-- Composto para as contagens de progresso (phase_id + completed)
create index if not exists idx_phase_tasks_phase_completed
  on public.phase_tasks (phase_id, completed);

-- ── diário de obra ──────────────────────────────────────────
create index if not exists idx_project_diary_project_date
  on public.project_diary (project_id, entry_date desc);

create index if not exists idx_diary_photos_diary_id
  on public.diary_photos (diary_id);

-- ── documentos e marcos ─────────────────────────────────────
create index if not exists idx_project_documents_project_id
  on public.project_documents (project_id);

create index if not exists idx_critical_milestones_project_id
  on public.critical_milestones (project_id);

-- ── avaliações de fornecedor ────────────────────────────────
create index if not exists idx_supplier_evaluations_supplier_id
  on public.supplier_evaluations (supplier_id);

-- ── notificações ────────────────────────────────────────────
-- Contador de não lidas (user_id + read) e listagem (user_id + created_at)
create index if not exists idx_notifications_user_read
  on public.notifications (user_id, read);

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

-- ── busca por nome (clientes/fornecedores) ──────────────────
-- pg_trgm permite que buscas ILIKE '%texto%' usem índice
create extension if not exists pg_trgm;

create index if not exists idx_clients_name_trgm
  on public.clients using gin (name gin_trgm_ops);

create index if not exists idx_suppliers_name_trgm
  on public.suppliers using gin (name gin_trgm_ops);
