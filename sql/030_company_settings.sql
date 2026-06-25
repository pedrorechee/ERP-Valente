-- ============================================================
-- 030 — Dados da Empresa (singleton) + bucket da logo
-- ============================================================
-- Tabela única (singleton) com os dados da construtora, usados nos
-- PDFs (orçamento, diário, contrato) e no cabeçalho do sistema.
-- RLS: leitura para qualquer autenticado; escrita só owner/admin.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.company_settings (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name               text,          -- Razão social
  trade_name               text,          -- Nome fantasia
  document                 text,          -- CNPJ
  state_registration       text,          -- Inscrição estadual (opcional)
  municipal_registration   text,          -- Inscrição municipal (opcional)
  phone                    text,
  email                    text,
  website                  text,
  cep                      text,
  street                   text,
  address_number           text,
  complement               text,
  neighborhood             text,
  city                     text,
  state                    text,
  logo_path                text,          -- caminho do arquivo no bucket company-assets
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Linha única inicial (singleton) — só insere se a tabela estiver vazia
INSERT INTO public.company_settings (legal_name, trade_name)
SELECT NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.company_settings);

-- RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_settings_read_authenticated"
  ON public.company_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "company_settings_write_owner_admin"
  ON public.company_settings FOR ALL TO authenticated
  USING    (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

-- Trigger updated_at (reusa a função padrão do projeto)
DO $$ BEGIN
  CREATE TRIGGER set_updated_at_company_settings
    BEFORE UPDATE ON public.company_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Bucket da logo (público para uso direto em sidebar/PDF) ──
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-assets',
  'company-assets',
  true,                      -- público: a logo aparece na sidebar e nos PDFs
  5242880,                   -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Upload/atualização da logo restritos a owner/admin; leitura pública
CREATE POLICY "company_assets_write_owner_admin"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-assets' AND get_my_role() IN ('owner', 'admin'));

CREATE POLICY "company_assets_update_owner_admin"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'company-assets' AND get_my_role() IN ('owner', 'admin'));

CREATE POLICY "company_assets_delete_owner_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'company-assets' AND get_my_role() IN ('owner', 'admin'));

CREATE POLICY "company_assets_public_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'company-assets');
