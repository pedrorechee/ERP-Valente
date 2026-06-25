-- ============================================================
-- ERP Valente — Módulo Clientes
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'pf'
    CHECK (type IN ('pf', 'pj')),
  ADD COLUMN IF NOT EXISTS how_they_found TEXT
    CHECK (how_they_found IN ('indicacao', 'instagram', 'google', 'direto', 'outro')),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT;
