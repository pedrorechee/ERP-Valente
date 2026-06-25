-- ============================================================
-- ERP Valente — Módulo Fornecedores
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- Adiciona colunas novas à tabela suppliers
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'outros'
    CHECK (type IN ('material','mao_de_obra','equipamento','transporte','alimentacao','servicos','outros')),
  ADD COLUMN IF NOT EXISTS pix_key TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Tabela de avaliações de fornecedores
CREATE TABLE IF NOT EXISTS supplier_evaluations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  quality_score INTEGER CHECK (quality_score BETWEEN 1 AND 5),
  met_deadline  BOOLEAN,
  observation   TEXT,
  evaluated_by  UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE supplier_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evaluations_owner_admin"
  ON supplier_evaluations FOR ALL TO authenticated
  USING    (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));
