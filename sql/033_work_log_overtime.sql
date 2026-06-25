-- ============================================================
-- 033 — APONTAMENTO: HORA EXTRA + EDIÇÃO MANUAL DE CUSTO
-- ============================================================
-- Acrescenta a work_logs os campos para cálculo de hora extra
-- (jornada padrão, horas extras, multiplicador) e para sobrepor
-- o custo manualmente (override). O custo final continua em
-- computed_cost — usado na grade, no custo da obra e na folha.
-- Execute no Supabase Dashboard > SQL Editor.
-- ============================================================

ALTER TABLE work_logs
  ADD COLUMN IF NOT EXISTS standard_hours      NUMERIC DEFAULT 8,    -- jornada padrão do dia (base p/ hora extra)
  ADD COLUMN IF NOT EXISTS overtime_hours      NUMERIC DEFAULT 0,    -- horas que excederam a jornada (calculado)
  ADD COLUMN IF NOT EXISTS overtime_multiplier NUMERIC DEFAULT 1.5,  -- adicional da hora extra (1.5 = 50%)
  ADD COLUMN IF NOT EXISTS manual_cost         NUMERIC,              -- se preenchido + override, sobrepõe o automático
  ADD COLUMN IF NOT EXISTS cost_overridden     BOOLEAN NOT NULL DEFAULT FALSE; -- custo editado manualmente
