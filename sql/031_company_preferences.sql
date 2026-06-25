-- ============================================================
-- 031 — Preferências do sistema (na mesma linha singleton de company_settings)
-- ============================================================
-- Defaults usados como valor inicial em formulários (orçamento, contrato/
-- medição, obra). O usuário pode sobrescrever em cada registro.
--
-- date_format e currency_symbol não foram adicionados: o sistema já
-- padroniza dd/MM/yyyy e R$ em toda a aplicação (seriam apenas informativos).
-- ============================================================

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS default_bdi_percent       numeric  NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS default_retention_percent numeric  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_warranty_months   integer  NOT NULL DEFAULT 60;
