-- ============================================================
-- ERP Valente — RESET COMPLETO DO BANCO
-- ATENÇÃO: apaga TODAS as tabelas, funções e triggers do projeto.
-- Execute no Supabase Dashboard > SQL Editor
-- Depois rode os scripts 001 → 024 na ordem.
-- ============================================================

-- Trigger do Auth (Phase 1)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Tabelas (ordem: dependentes primeiro; CASCADE remove o que sobrar)
-- ── Fase 3 — Contratos (024) ──
DROP TABLE IF EXISTS measurements         CASCADE;
DROP TABLE IF EXISTS contract_amendments  CASCADE;
DROP TABLE IF EXISTS contracts            CASCADE;

-- ── Fase 3 — Orçamentos (023) ──
DROP TABLE IF EXISTS budget_items         CASCADE;
DROP TABLE IF EXISTS budgets              CASCADE;

-- ── Plano de contas (020) ──
DROP TABLE IF EXISTS cost_categories      CASCADE;

-- ── Conta corrente de fornecedores (010) ──
DROP TABLE IF EXISTS supplier_account_entries CASCADE;

-- ── Avaliações de fornecedores (005) ──
DROP TABLE IF EXISTS supplier_evaluations CASCADE;

-- ── Notificações (007) ──
DROP TABLE IF EXISTS notifications        CASCADE;

-- ── Fase 2 — Obras e Financeiro (003) ──
DROP TABLE IF EXISTS supplier_accounts   CASCADE;
DROP TABLE IF EXISTS financial_entries   CASCADE;
DROP TABLE IF EXISTS critical_milestones CASCADE;
DROP TABLE IF EXISTS project_documents   CASCADE;
DROP TABLE IF EXISTS diary_photos        CASCADE;
DROP TABLE IF EXISTS project_diary       CASCADE;
DROP TABLE IF EXISTS phase_tasks         CASCADE;
DROP TABLE IF EXISTS project_phases      CASCADE;
DROP TABLE IF EXISTS projects            CASCADE;
DROP TABLE IF EXISTS clients             CASCADE;
DROP TABLE IF EXISTS suppliers           CASCADE;

-- ── Fase 1 — Perfis (001) ──
DROP TABLE IF EXISTS profiles            CASCADE;

-- Funções
DROP FUNCTION IF EXISTS get_my_role()       CASCADE;
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user()   CASCADE;
