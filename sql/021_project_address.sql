-- ============================================================
-- 021 — Endereço estruturado da obra (projects)
-- Rodar no SQL Editor do Supabase
-- Todos os campos são opcionais (nullable).
-- A coluna address (text) existente é mantida para
-- compatibilidade — passa a ser preenchida automaticamente
-- (endereço composto) ao salvar.
-- ============================================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS cep            text; -- CEP (00000-000)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS street         text; -- logradouro (rua/avenida)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS address_number text; -- número
ALTER TABLE projects ADD COLUMN IF NOT EXISTS complement     text; -- complemento
ALTER TABLE projects ADD COLUMN IF NOT EXISTS neighborhood   text; -- bairro
ALTER TABLE projects ADD COLUMN IF NOT EXISTS city           text; -- cidade
ALTER TABLE projects ADD COLUMN IF NOT EXISTS state          text; -- UF
ALTER TABLE projects ADD COLUMN IF NOT EXISTS reference      text; -- ponto de referência
