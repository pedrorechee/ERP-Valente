-- ============================================================
-- 019 — Campos adicionais do cadastro de obras
-- Rodar no SQL Editor do Supabase
-- Todos os campos são opcionais (nullable).
-- ============================================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS land_area_m2 numeric;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS site_manager text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_representative text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority text CHECK (priority IN ('alta','media','baixa'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS floors_count integer;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS construction_system text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS foundation_type text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS finish_standard text CHECK (finish_standard IN ('popular','normal','alto','luxo'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS art_number text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cno_number text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS property_registration text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS municipal_registration text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS insurance_company text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS insurance_policy text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS insurance_expiry date;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS habite_se_number text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS habite_se_date date;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS warranty_start_date date;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS warranty_months integer DEFAULT 60;
