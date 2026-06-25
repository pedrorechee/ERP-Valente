-- ============================================================
-- ERP Valente — Criação do primeiro usuário dono
-- Execute no Supabase Dashboard > SQL Editor
-- ANTES de rodar: substitua o e-mail, nome e senha abaixo
-- ============================================================

DO $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Gera um UUID para o novo usuário
  new_user_id := gen_random_uuid();

  -- Cria o usuário no Auth do Supabase
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    role,
    aud
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    'pedro@valenteeng.com.br',              -- << TROQUE pelo seu e-mail
    crypt('Valente@2025', gen_salt('bf')),  -- << TROQUE pela sua senha
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Pedro Reche","role":"owner"}', -- << TROQUE pelo seu nome
    NOW(),
    NOW(),
    'authenticated',
    'authenticated'
  );

  -- O trigger handle_new_user já criou o profile com role='owner'
  -- (pois raw_user_meta_data contém "role":"owner")
  -- Garante que o full_name e role estão corretos:
  UPDATE profiles
  SET
    role      = 'owner',
    full_name = 'Pedro Reche'              -- << TROQUE pelo seu nome
  WHERE id = new_user_id;

END $$;
