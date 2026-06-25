-- ============================================================
-- 016 — Peso das fases (progresso ponderado)
-- Rodar no SQL Editor do Supabase
-- ============================================================

-- Peso da fase de 1 a 10. Default 1 mantém retrocompatibilidade:
-- com todos os pesos = 1, a média ponderada equivale à média simples.
ALTER TABLE project_phases
  ADD COLUMN IF NOT EXISTS weight integer NOT NULL DEFAULT 1
  CHECK (weight >= 1 AND weight <= 10);
