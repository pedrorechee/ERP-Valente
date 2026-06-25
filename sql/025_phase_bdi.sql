-- ============================================================
-- 025 — BDI por fase no Orçamento
-- Rodar no SQL Editor do Supabase
--
-- - budget_items.bdi_override: BDI específico do item (NULL = usa o BDI
--   geral/padrão do orçamento). Todos os itens de uma mesma fase recebem
--   o mesmo valor quando o BDI por fase está ligado.
-- - budgets.phase_bdi_enabled: liga/desliga o BDI por fase.
-- ============================================================

ALTER TABLE budget_items
  ADD COLUMN IF NOT EXISTS bdi_override NUMERIC NULL;

ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS phase_bdi_enabled BOOLEAN NOT NULL DEFAULT false;
