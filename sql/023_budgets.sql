-- ============================================================
-- 023 — Módulo de Orçamentos (Fase 3)
-- Rodar no SQL Editor do Supabase
--
-- Cria budgets (cabeçalho do orçamento) e budget_items (itens),
-- e adiciona phase_id em financial_entries para o orçado x
-- realizado por etapa.
--
-- Regra: só pode haver UM orçamento 'aprovado' por obra (o vigente).
-- ============================================================

-- ── Cabeçalho do orçamento ─────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version            INTEGER NOT NULL DEFAULT 1,
  description        TEXT,
  bdi_percent        NUMERIC NOT NULL DEFAULT 12,
  status             TEXT NOT NULL DEFAULT 'rascunho'
                       CHECK (status IN ('rascunho', 'aprovado', 'revisado')),
  total_direct_cost  NUMERIC DEFAULT 0,   -- custo direto (cache)
  total_with_bdi     NUMERIC DEFAULT 0,   -- preço final com BDI (cache)
  approved_at        TIMESTAMPTZ NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Apenas UM orçamento aprovado por obra (índice parcial único)
CREATE UNIQUE INDEX IF NOT EXISTS budgets_one_approved_per_project
  ON budgets (project_id)
  WHERE status = 'aprovado';

CREATE INDEX IF NOT EXISTS budgets_project_idx ON budgets (project_id);

-- ── Itens do orçamento ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS budget_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id    UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  phase_id     UUID NULL REFERENCES project_phases(id) ON DELETE SET NULL,
  description  TEXT NOT NULL,
  unit         TEXT,                          -- un, m, m², m³, kg, t, vb, h, dia, mês, L, sc, gl
  quantity     NUMERIC NOT NULL DEFAULT 1,
  unit_price   NUMERIC NOT NULL DEFAULT 0,
  total        NUMERIC NOT NULL DEFAULT 0,    -- quantity * unit_price
  category_id  UUID NULL REFERENCES cost_categories(id) ON DELETE SET NULL,
  order_index  INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS budget_items_budget_idx ON budget_items (budget_id);
CREATE INDEX IF NOT EXISTS budget_items_phase_idx  ON budget_items (phase_id);

-- ── financial_entries: vínculo com a etapa (orçado x realizado) ─
ALTER TABLE financial_entries
  ADD COLUMN IF NOT EXISTS phase_id UUID NULL REFERENCES project_phases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS financial_entries_phase_idx ON financial_entries (phase_id);

-- ── RLS (mesmo padrão de project_phases: owner/admin total, foreman leitura) ─
ALTER TABLE budgets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budgets_owner_admin"
  ON budgets FOR ALL TO authenticated
  USING    (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "budgets_foreman_read"
  ON budgets FOR SELECT TO authenticated
  USING (get_my_role() = 'foreman');

CREATE POLICY "budget_items_owner_admin"
  ON budget_items FOR ALL TO authenticated
  USING    (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "budget_items_foreman_read"
  ON budget_items FOR SELECT TO authenticated
  USING (get_my_role() = 'foreman');
