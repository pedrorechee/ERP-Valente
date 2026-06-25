-- ============================================================
-- ERP Valente — Fase 2: Obras e Financeiro
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- Helper: role do usuário atual (evita repetição nas policies)
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- CLIENTES DA CONSTRUTORA
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  document    TEXT,        -- CPF ou CNPJ
  address     TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_owner_admin"
  ON clients FOR ALL TO authenticated
  USING    (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

-- ============================================================
-- FORNECEDORES
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  document    TEXT,        -- CNPJ
  address     TEXT,
  category    TEXT,        -- Materiais, Mão de obra, Serviços...
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_owner_admin"
  ON suppliers FOR ALL TO authenticated
  USING    (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

-- ============================================================
-- OBRAS (PROJECTS)
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  address               TEXT NOT NULL,
  type                  TEXT NOT NULL
                          CHECK (type IN ('residential','commercial','industrial','renovation','other')),
  area_m2               NUMERIC,
  start_date            DATE NOT NULL,
  expected_end_date     DATE NOT NULL,
  actual_end_date       DATE,
  status                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','completed','paused','cancelled')),
  technical_responsible TEXT,
  client_id             UUID REFERENCES clients(id) ON DELETE SET NULL,
  contract_value        NUMERIC,
  permit_number         TEXT,
  description           TEXT,
  overall_progress      INTEGER DEFAULT 0
                          CHECK (overall_progress BETWEEN 0 AND 100),
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_owner_admin"
  ON projects FOR ALL TO authenticated
  USING    (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "projects_foreman_read"
  ON projects FOR SELECT TO authenticated
  USING (get_my_role() = 'foreman');

-- ============================================================
-- FASES DA OBRA
-- ============================================================
CREATE TABLE IF NOT EXISTS project_phases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  order_index     INTEGER NOT NULL DEFAULT 0,
  progress        INTEGER DEFAULT 0
                    CHECK (progress BETWEEN 0 AND 100),
  expected_start  DATE,
  expected_end    DATE,
  actual_end      DATE,
  status          TEXT DEFAULT 'not_started'
                    CHECK (status IN ('not_started','in_progress','completed','delayed')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE project_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "phases_owner_admin"
  ON project_phases FOR ALL TO authenticated
  USING    (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "phases_foreman_read"
  ON project_phases FOR SELECT TO authenticated
  USING (get_my_role() = 'foreman');

-- ============================================================
-- TAREFAS DENTRO DE CADA FASE
-- ============================================================
CREATE TABLE IF NOT EXISTS phase_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id     UUID NOT NULL REFERENCES project_phases(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  responsible  TEXT,
  due_date     DATE,
  completed    BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE phase_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_owner_admin"
  ON phase_tasks FOR ALL TO authenticated
  USING    (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "tasks_foreman_read"
  ON phase_tasks FOR SELECT TO authenticated
  USING (get_my_role() = 'foreman');

-- ============================================================
-- DIÁRIO DE OBRA
-- ============================================================
CREATE TABLE IF NOT EXISTS project_diary (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entry_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  weather       TEXT CHECK (weather IN ('sun','cloudy','rain','storm')),
  work_done     TEXT NOT NULL,
  team_present  TEXT,
  occurrences   TEXT,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE project_diary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diary_owner_admin"
  ON project_diary FOR ALL TO authenticated
  USING    (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "diary_foreman_read"
  ON project_diary FOR SELECT TO authenticated
  USING (get_my_role() = 'foreman');

-- ============================================================
-- FOTOS DO DIÁRIO
-- ============================================================
CREATE TABLE IF NOT EXISTS diary_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diary_id     UUID NOT NULL REFERENCES project_diary(id) ON DELETE CASCADE,
  phase_id     UUID REFERENCES project_phases(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  caption      TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE diary_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diary_photos_owner_admin"
  ON diary_photos FOR ALL TO authenticated
  USING    (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "diary_photos_foreman_read"
  ON diary_photos FOR SELECT TO authenticated
  USING (get_my_role() = 'foreman');

-- ============================================================
-- DOCUMENTOS DA OBRA
-- ============================================================
CREATE TABLE IF NOT EXISTS project_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by  UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_owner_admin"
  ON project_documents FOR ALL TO authenticated
  USING    (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "documents_foreman_read"
  ON project_documents FOR SELECT TO authenticated
  USING (get_my_role() = 'foreman');

-- ============================================================
-- MARCOS CRÍTICOS
-- ============================================================
CREATE TABLE IF NOT EXISTS critical_milestones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  planned_date DATE NOT NULL,
  actual_date  DATE,
  status       TEXT DEFAULT 'pending'
                 CHECK (status IN ('pending','completed','delayed')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE critical_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "milestones_owner_admin"
  ON critical_milestones FOR ALL TO authenticated
  USING    (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "milestones_foreman_read"
  ON critical_milestones FOR SELECT TO authenticated
  USING (get_my_role() = 'foreman');

-- ============================================================
-- LANÇAMENTOS FINANCEIROS
-- ============================================================
CREATE TABLE IF NOT EXISTS financial_entries (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entry_type         TEXT NOT NULL CHECK (entry_type IN ('income', 'expense')),
  entry_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  description        TEXT NOT NULL,
  amount             NUMERIC NOT NULL CHECK (amount > 0),
  category           TEXT NOT NULL,
  payment_method     TEXT CHECK (payment_method IN ('cash','pix','boleto','card','transfer','check')),
  counterpart        TEXT,   -- nome do fornecedor ou cliente (texto livre)
  supplier_id        UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  storage_path_proof TEXT,
  notes              TEXT,
  created_by         UUID REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE financial_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_owner_admin"
  ON financial_entries FOR ALL TO authenticated
  USING    (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

-- ============================================================
-- CONTA CORRENTE POR FORNECEDOR/OBRA
-- ============================================================
CREATE TABLE IF NOT EXISTS supplier_accounts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  supplier_id  UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  balance      NUMERIC DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, supplier_id)
);

ALTER TABLE supplier_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_accounts_owner_admin"
  ON supplier_accounts FOR ALL TO authenticated
  USING    (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_clients
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_suppliers
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_projects
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_phases
    BEFORE UPDATE ON project_phases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_tasks
    BEFORE UPDATE ON phase_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_diary
    BEFORE UPDATE ON project_diary
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_milestones
    BEFORE UPDATE ON critical_milestones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_financial
    BEFORE UPDATE ON financial_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- SUPABASE STORAGE — Buckets privados
-- Criar manualmente no Dashboard > Storage > New Bucket:
--   Nome: obra-fotos        | Public: OFF
--   Nome: obra-documentos   | Public: OFF
--   Nome: obra-comprovantes | Public: OFF
-- ============================================================
