-- ============================================================
-- 027 — Orçamento ÚNICO por obra (fim do versionamento)
-- Rodar no SQL Editor do Supabase
--
-- A partir daqui cada obra tem APENAS UM orçamento. Acaba o
-- versionamento: não há mais "nova versão", "duplicar" nem o
-- status 'revisado'. Só o orçamento 'aprovado' alimenta os
-- cálculos (orçado x realizado, DRE, dashboard, etc.).
--
-- O que este script faz:
--   1. Deduplica: mantém 1 orçamento por obra (preferindo o
--      'aprovado'; senão o mais recente). Os perdedores e seus
--      itens são removidos.
--   2. Migra status 'revisado' -> 'aprovado'.
--   3. Fixa version = 1 (coluna mantida como legado).
--   4. Troca o CHECK de status para ('rascunho','aprovado').
--   5. Substitui o índice "1 aprovado por obra" por uma
--      restrição UNIQUE(project_id) — 1 orçamento por obra.
-- ============================================================

BEGIN;

-- 1a) Remove os ITENS dos orçamentos perdedores (não vencedores por obra).
--     Vencedor por obra: 'aprovado' primeiro, depois o created_at mais recente.
DELETE FROM budget_items
WHERE budget_id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY project_id
             ORDER BY (status = 'aprovado') DESC, created_at DESC
           ) AS rn
    FROM budgets
  ) t
  WHERE t.rn > 1
);

-- 1b) Remove os orçamentos perdedores (sobra 1 por obra).
DELETE FROM budgets
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY project_id
             ORDER BY (status = 'aprovado') DESC, created_at DESC
           ) AS rn
    FROM budgets
  ) t
  WHERE t.rn > 1
);

-- 2) 'revisado' deixa de existir — o que sobrou vira 'aprovado'.
UPDATE budgets SET status = 'aprovado' WHERE status = 'revisado';

-- 3) version não é mais usada — fixa em 1 (coluna mantida como legado).
UPDATE budgets SET version = 1;

-- 4) Atualiza o CHECK de status (agora só rascunho/aprovado).
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_status_check;
ALTER TABLE budgets
  ADD CONSTRAINT budgets_status_check CHECK (status IN ('rascunho', 'aprovado'));

-- 5) Antes: índice parcial "1 aprovado por obra". Agora: 1 orçamento por obra.
DROP INDEX IF EXISTS budgets_one_approved_per_project;
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_project_unique;
ALTER TABLE budgets ADD CONSTRAINT budgets_project_unique UNIQUE (project_id);

COMMIT;
