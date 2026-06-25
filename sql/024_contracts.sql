-- ============================================================
-- 024 — Módulo de Contratos (Fase 3)
-- Rodar no SQL Editor do Supabase
--
-- Cria:
--   contracts            (cabeçalho do contrato — 1 por obra)
--   contract_amendments  (aditivos: valor / prazo / escopo)
--   measurements         (medições — geram receita no financeiro)
--
-- Regras:
--   - Um contrato principal por obra (índice único em project_id).
--   - Medição vira receita em financial_entries só quando
--     'aprovada' ou 'faturada' (controlado na action, não aqui).
--   - financial_entry_id liga a medição à receita gerada
--     (antiduplicação: 1 medição = 1 receita).
-- ============================================================

-- ── Contrato (cabeçalho) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS contracts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contract_number    TEXT,
  original_value     NUMERIC NOT NULL DEFAULT 0,
  signing_date       DATE,
  start_date         DATE,                       -- início da vigência
  end_date           DATE,                       -- término/prazo do contrato
  retention_percent  NUMERIC DEFAULT 0,          -- retenção contratual (%) opcional
  status             TEXT NOT NULL DEFAULT 'ativo'
                       CHECK (status IN ('ativo','concluido','suspenso','cancelado')),
  document_path      TEXT,                        -- PDF do contrato (Supabase Storage)
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Um único contrato por obra
CREATE UNIQUE INDEX IF NOT EXISTS contracts_one_per_project
  ON contracts (project_id);

-- ── Aditivos ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contract_amendments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id       UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  amendment_number  INTEGER NOT NULL,
  type              TEXT NOT NULL
                      CHECK (type IN ('valor','prazo','escopo','valor_prazo')),
  value_change      NUMERIC DEFAULT 0,           -- + acréscimo / − supressão
  days_change       INTEGER DEFAULT 0,           -- +/- dias no prazo
  date              DATE NOT NULL,
  description       TEXT,
  document_path     TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contract_amendments_contract_idx
  ON contract_amendments (contract_id);

-- ── Medições ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS measurements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id         UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  measurement_number  INTEGER NOT NULL,
  period_start        DATE,
  period_end          DATE,
  progress_percent    NUMERIC,                    -- % do contrato medido (opcional)
  amount              NUMERIC NOT NULL DEFAULT 0, -- valor bruto da medição
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'medida'
                        CHECK (status IN ('prevista','medida','aprovada','faturada')),
  financial_entry_id  UUID NULL REFERENCES financial_entries(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS measurements_contract_idx ON measurements (contract_id);
CREATE INDEX IF NOT EXISTS measurements_project_idx  ON measurements (project_id);
CREATE INDEX IF NOT EXISTS measurements_entry_idx    ON measurements (financial_entry_id);

-- ── RLS (mesmo padrão dos demais: owner/admin total, foreman leitura) ─
ALTER TABLE contracts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contracts_owner_admin"
  ON contracts FOR ALL TO authenticated
  USING    (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "contracts_foreman_read"
  ON contracts FOR SELECT TO authenticated
  USING (get_my_role() = 'foreman');

CREATE POLICY "amendments_owner_admin"
  ON contract_amendments FOR ALL TO authenticated
  USING    (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "amendments_foreman_read"
  ON contract_amendments FOR SELECT TO authenticated
  USING (get_my_role() = 'foreman');

CREATE POLICY "measurements_owner_admin"
  ON measurements FOR ALL TO authenticated
  USING    (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "measurements_foreman_read"
  ON measurements FOR SELECT TO authenticated
  USING (get_my_role() = 'foreman');

-- ── Trigger updated_at (só contracts tem updated_at) ───────
DO $$ BEGIN
  CREATE TRIGGER set_updated_at_contracts
    BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
