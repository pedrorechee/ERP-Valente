-- ============================================================
-- 028 — Número único sequencial dos lançamentos financeiros
-- ============================================================
-- Cria um identificador ÚNICO, SEQUENCIAL e AUTOMÁTICO para cada
-- lançamento (financial_entries.entry_number):
--   - Gerado automaticamente em TODO insert (default = nextval da sequence).
--   - Imutável e nunca reaproveitado (mesmo após exclusões).
--   - Único em todo o sistema (constraint UNIQUE).
--   - Seguro contra concorrência (valor vem de uma SEQUENCE).
-- Exibição no front: "FIN-000123" (prefixo + 6 dígitos), via helper.
-- ============================================================

-- a) Coluna nova
ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS entry_number bigint;

-- b) Sequence dedicada
CREATE SEQUENCE IF NOT EXISTS public.financial_entries_entry_number_seq;

-- c) Backfill dos lançamentos existentes, numerando por ordem cronológica de criação
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM public.financial_entries
  WHERE entry_number IS NULL
)
UPDATE public.financial_entries fe
SET entry_number = o.rn
FROM ordered o
WHERE fe.id = o.id;

-- d) Avançar a sequence para continuar após o maior número já usado
SELECT setval(
  'public.financial_entries_entry_number_seq',
  COALESCE((SELECT MAX(entry_number) FROM public.financial_entries), 0)
);

-- e) Default automático para novos inserts
ALTER TABLE public.financial_entries
  ALTER COLUMN entry_number SET DEFAULT nextval('public.financial_entries_entry_number_seq');

-- f) Vincular a sequence à coluna
ALTER SEQUENCE public.financial_entries_entry_number_seq
  OWNED BY public.financial_entries.entry_number;

-- g) Tornar obrigatório e único (garantia definitiva de não-duplicação)
ALTER TABLE public.financial_entries
  ALTER COLUMN entry_number SET NOT NULL;
ALTER TABLE public.financial_entries
  ADD CONSTRAINT financial_entries_entry_number_key UNIQUE (entry_number);
