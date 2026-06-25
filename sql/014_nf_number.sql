-- ============================================================
-- 014 — Número da Nota Fiscal nos lançamentos financeiros
-- Rodar no SQL Editor do Supabase
-- ============================================================

ALTER TABLE financial_entries
  ADD COLUMN IF NOT EXISTS nf_number text;
