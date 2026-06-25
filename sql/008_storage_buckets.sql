-- ============================================================
-- Cria os buckets de storage que ainda não existem
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'obra-documentos',
    'obra-documentos',
    false,
    52428800, -- 50 MB
    ARRAY[
      'application/pdf',
      'image/jpeg', 'image/jpg', 'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  ),
  (
    'obra-comprovantes',
    'obra-comprovantes',
    false,
    20971520, -- 20 MB
    ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
  )
ON CONFLICT (id) DO NOTHING;

-- Políticas RLS para obra-documentos
CREATE POLICY "Usuários autenticados podem fazer upload de documentos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'obra-documentos');

CREATE POLICY "Usuários autenticados podem ler documentos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'obra-documentos');

CREATE POLICY "Usuários autenticados podem excluir documentos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'obra-documentos');

-- Políticas RLS para obra-comprovantes
CREATE POLICY "Usuários autenticados podem fazer upload de comprovantes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'obra-comprovantes');

CREATE POLICY "Usuários autenticados podem ler comprovantes"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'obra-comprovantes');

CREATE POLICY "Usuários autenticados podem excluir comprovantes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'obra-comprovantes');
