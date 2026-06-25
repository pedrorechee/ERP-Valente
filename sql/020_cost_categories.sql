-- ============================================================
-- 020 — PLANO DE CUSTO (PLANO DE CONTAS) + vínculo nos lançamentos
-- ============================================================
-- Cria a tabela cost_categories (contas da DRE), adiciona
-- financial_entries.category_id, faz o seed do plano padrão e
-- migra os lançamentos existentes para uma conta (sem deixar
-- nenhum lançamento sem category_id).
-- ============================================================

-- ── Tabela do plano de contas ──────────────────────────────
CREATE TABLE IF NOT EXISTS cost_categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT NOT NULL,
  name         TEXT NOT NULL,
  nature       TEXT NOT NULL CHECK (nature IN ('income', 'expense')),
  dre_group    TEXT NOT NULL CHECK (dre_group IN (
                 'receita_bruta', 'deducoes', 'custo_direto',
                 'despesa_operacional', 'despesa_financeira')),
  dre_subgroup TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  -- UNIQUE em code: necessário para o seed idempotente e para
  -- gerar códigos sequenciais na migração de dados (regra "código único")
  UNIQUE (code)
);

ALTER TABLE cost_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "cost_categories_owner_admin"
    ON cost_categories FOR ALL TO authenticated
    USING    (get_my_role() IN ('owner', 'admin'))
    WITH CHECK (get_my_role() IN ('owner', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Vínculo no lançamento (mantém category text p/ compatibilidade) ──
ALTER TABLE financial_entries
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES cost_categories(id);

CREATE INDEX IF NOT EXISTS idx_financial_entries_category_id
  ON financial_entries (category_id);

CREATE INDEX IF NOT EXISTS idx_cost_categories_group
  ON cost_categories (dre_group, code);

-- ── Seed do plano de contas padrão ─────────────────────────
INSERT INTO cost_categories (code, name, nature, dre_group, dre_subgroup, sort_order) VALUES
  ('1.01',   'Recebimento de cliente',      'income',  'receita_bruta',       NULL,          10),
  ('1.02',   'Adiantamento de cliente',     'income',  'receita_bruta',       NULL,          20),
  ('1.03',   'Medição',                     'income',  'receita_bruta',       NULL,          30),
  ('2.01',   'ISS',                         'expense', 'deducoes',            NULL,          40),
  ('2.02',   'PIS/COFINS',                  'expense', 'deducoes',            NULL,          50),
  ('3.1.01', 'Material de construção',      'expense', 'custo_direto',        'Material',    60),
  ('3.2.01', 'Mão de obra terceirizada',    'expense', 'custo_direto',        'Mão de obra', 70),
  ('3.2.02', 'Mão de obra própria',         'expense', 'custo_direto',        'Mão de obra', 80),
  ('3.3.01', 'Aluguel de equipamento',      'expense', 'custo_direto',        'Equipamentos',90),
  ('3.4.01', 'Transporte / frete',          'expense', 'custo_direto',        'Transporte',  100),
  ('3.5.01', 'Instalações elétricas',       'expense', 'custo_direto',        'Instalações', 110),
  ('3.5.02', 'Instalações hidráulicas',     'expense', 'custo_direto',        'Instalações', 120),
  ('4.01',   'Alimentação',                 'expense', 'despesa_operacional', NULL,          130),
  ('4.02',   'Pousada e hospedagem',        'expense', 'despesa_operacional', NULL,          140),
  ('4.03',   'Despesas administrativas',    'expense', 'despesa_operacional', NULL,          150),
  ('5.01',   'Juros e tarifas bancárias',   'expense', 'despesa_financeira',  NULL,          160),
  ('5.02',   'Multas',                      'expense', 'despesa_financeira',  NULL,          170)
ON CONFLICT (code) DO NOTHING;

-- ── Migração dos dados existentes ──────────────────────────
-- 1) Apelidos conhecidos (texto antigo ≠ name da nova conta)
UPDATE financial_entries fe SET category_id = cc.id
  FROM cost_categories cc
 WHERE fe.category_id IS NULL AND cc.code = '1.02'   AND fe.category = 'Adiantamento';
UPDATE financial_entries fe SET category_id = cc.id
  FROM cost_categories cc
 WHERE fe.category_id IS NULL AND cc.code = '3.4.01' AND fe.category = 'Transporte';
UPDATE financial_entries fe SET category_id = cc.id
  FROM cost_categories cc
 WHERE fe.category_id IS NULL AND cc.code = '3.3.01' AND fe.category = 'Equipamentos';

-- 2) Casamento direto por nome
UPDATE financial_entries fe SET category_id = cc.id
  FROM cost_categories cc
 WHERE fe.category_id IS NULL AND cc.name = fe.category;

-- 3) Sem correspondência: cria a conta automaticamente e vincula
--    (income -> receita_bruta '1.99.*' ; expense -> despesa_operacional '4.99.*')
DO $$
DECLARE
  rec  RECORD;
  seqn INT := 0;
  grp  TEXT;
  pfx  TEXT;
  newcode TEXT;
  newid   UUID;
BEGIN
  FOR rec IN
    SELECT DISTINCT category, entry_type
      FROM financial_entries
     WHERE category_id IS NULL AND category IS NOT NULL AND category <> ''
  LOOP
    seqn := seqn + 1;
    IF rec.entry_type = 'income' THEN
      grp := 'receita_bruta';  pfx := '1.99.';
    ELSE
      grp := 'despesa_operacional'; pfx := '4.99.';
    END IF;
    newcode := pfx || LPAD(seqn::text, 2, '0');

    INSERT INTO cost_categories (code, name, nature, dre_group, sort_order)
    VALUES (newcode, rec.category, rec.entry_type, grp, 900 + seqn)
    RETURNING id INTO newid;

    UPDATE financial_entries
       SET category_id = newid
     WHERE category_id IS NULL AND category = rec.category AND entry_type = rec.entry_type;
  END LOOP;
END $$;
