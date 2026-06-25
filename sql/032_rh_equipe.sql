-- ============================================================
-- 032 — RH E EQUIPE (MÃO DE OBRA PRÓPRIA)
-- ============================================================
-- Funcionários próprios (CLT/diarista), alocação em obras e
-- apontamento diário (presença + horas + custo). O custo de cada
-- apontamento é consolidado no Financeiro via fechamento de folha
-- (financial_entries), nunca duplicado.
-- Execute no Supabase Dashboard > SQL Editor.
-- ============================================================

-- ── Funcionários próprios ──────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  document        TEXT,                       -- CPF
  role            TEXT,                        -- função/cargo (Pedreiro, Servente, Mestre...)
  employment_type TEXT NOT NULL CHECK (employment_type IN ('clt','diarista')),
  monthly_salary  NUMERIC DEFAULT 0,           -- usado quando CLT
  daily_rate      NUMERIC DEFAULT 0,           -- usado quando diarista
  charge_factor   NUMERIC DEFAULT 1,           -- multiplicador de encargos (CLT). 1 = sem encargos
  work_days_month INTEGER DEFAULT 22,          -- dias úteis/mês p/ ratear salário CLT em custo-dia
  admission_date  DATE,
  phone           TEXT,
  pix_key         TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Leitura para autenticados (encarregado precisa ver para apontar)
DO $$ BEGIN
  CREATE POLICY "employees_read_authenticated"
    ON employees FOR SELECT TO authenticated
    USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Escrita apenas owner/admin
DO $$ BEGIN
  CREATE POLICY "employees_write_owner_admin"
    ON employees FOR ALL TO authenticated
    USING    (get_my_role() IN ('owner', 'admin'))
    WITH CHECK (get_my_role() IN ('owner', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Alocação de funcionário em obra ────────────────────────
CREATE TABLE IF NOT EXISTS project_team (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role_in_project TEXT,                        -- função naquela obra (opcional)
  start_date      DATE,
  end_date        DATE,                        -- null = alocação ativa
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, employee_id)             -- não alocar o mesmo funcionário 2x na obra
);

ALTER TABLE project_team ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "project_team_read_authenticated"
    ON project_team FOR SELECT TO authenticated
    USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "project_team_write_owner_admin"
    ON project_team FOR ALL TO authenticated
    USING    (get_my_role() IN ('owner', 'admin'))
    WITH CHECK (get_my_role() IN ('owner', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Apontamento diário (presença + horas + custo) ──────────
CREATE TABLE IF NOT EXISTS work_logs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id        UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  project_id         UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_id           UUID REFERENCES project_phases(id) ON DELETE SET NULL,
  log_date           DATE NOT NULL,
  attendance         TEXT NOT NULL DEFAULT 'presente'
                       CHECK (attendance IN ('presente','falta','meio_periodo','atestado')),
  hours_worked       NUMERIC DEFAULT 8,
  computed_cost      NUMERIC DEFAULT 0,         -- custo calculado deste apontamento
  notes              TEXT,
  -- preenchido quando o custo já foi lançado na folha (Financeiro)
  financial_entry_id UUID REFERENCES financial_entries(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employee_id, project_id, log_date)    -- 1 apontamento por funcionário/obra/dia
);

ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "work_logs_read_authenticated"
    ON work_logs FOR SELECT TO authenticated
    USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Apontamento: owner/admin e encarregado (foreman) podem escrever
DO $$ BEGIN
  CREATE POLICY "work_logs_write_owner_admin_foreman"
    ON work_logs FOR ALL TO authenticated
    USING    (get_my_role() IN ('owner', 'admin', 'foreman'))
    WITH CHECK (get_my_role() IN ('owner', 'admin', 'foreman'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Índices úteis ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_work_logs_project        ON work_logs (project_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_employee       ON work_logs (employee_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_log_date       ON work_logs (log_date);
CREATE INDEX IF NOT EXISTS idx_work_logs_financial      ON work_logs (financial_entry_id);
CREATE INDEX IF NOT EXISTS idx_project_team_project     ON project_team (project_id);
CREATE INDEX IF NOT EXISTS idx_project_team_employee    ON project_team (employee_id);

-- ── Trigger updated_at (reutiliza update_updated_at da 003) ─
DO $$ BEGIN
  CREATE TRIGGER set_updated_at_employees
    BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
