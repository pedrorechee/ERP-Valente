-- ============================================================
-- 029 — Retenção por medição (percentual ajustável na própria medição)
-- ============================================================
-- Antes, a retenção era sempre o percentual fixo do contrato
-- (contracts.retention_percent). Agora cada medição guarda o
-- percentual de retenção EFETIVAMENTE aplicado nela, podendo ser
-- ajustado no popup (ex.: negociar 0% ou 10% numa medição específica).
--
-- Modelo (inalterado): measurements.amount = valor BRUTO medido.
-- O LÍQUIDO (= bruto − bruto × retention_percent/100) é derivado e é
-- o que alimenta a receita a receber no Financeiro. Por isso não é
-- necessária uma coluna gross_amount: o bruto já é `amount`.
-- ============================================================

-- a) Coluna: percentual de retenção aplicado NESTA medição
ALTER TABLE public.measurements
  ADD COLUMN IF NOT EXISTS retention_percent numeric NOT NULL DEFAULT 0;

-- b) Backfill: medições existentes herdam o percentual do contrato,
--    preservando o líquido/retenção que já era exibido até aqui.
UPDATE public.measurements m
SET retention_percent = COALESCE(c.retention_percent, 0)
FROM public.contracts c
WHERE m.contract_id = c.id
  AND m.retention_percent = 0
  AND COALESCE(c.retention_percent, 0) <> 0;
