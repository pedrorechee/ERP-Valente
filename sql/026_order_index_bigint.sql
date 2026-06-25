-- ============================================================
-- 026 — order_index de INTEGER para BIGINT em project_phases
-- Necessário porque o código usa Date.now() (milissegundos)
-- que excede o limite do tipo INTEGER (2.147.483.647).
-- ============================================================

ALTER TABLE project_phases
  ALTER COLUMN order_index TYPE BIGINT;
