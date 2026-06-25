-- ============================================================
-- 034 — CRIAR USUÁRIO DE ACESSO (owner)
-- ============================================================
-- Cria um usuário no Supabase Auth + perfil (via trigger handle_new_user).
-- Já confirmado (login imediato). Execute no Supabase Dashboard > SQL Editor.
--
-- Credenciais criadas por este script:
--   E-mail: pedro@valenteeng.com.br
--   Senha:  Valente@2025
--   Papel:  owner (acesso total)
--
-- Troque os valores em v_email / v_password / v_name / v_role se quiser.
-- ============================================================

DO $$
DECLARE
  v_email    TEXT := 'pedro@valenteeng.com.br';
  v_password TEXT := 'Valente@2025';
  v_name     TEXT := 'Pedro Reche';
  v_role     TEXT := 'owner';   -- owner | admin | foreman | client
  v_id       UUID := gen_random_uuid();
BEGIN
  -- Se já existir um usuário com esse e-mail, apenas atualiza a senha/perfil
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    UPDATE auth.users
       SET encrypted_password = crypt(v_password, gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
           updated_at         = NOW()
     WHERE email = v_email;

    UPDATE profiles p
       SET role = v_role, full_name = v_name
      FROM auth.users u
     WHERE u.email = v_email AND p.id = u.id;

    RAISE NOTICE 'Usuário % já existia — senha e perfil atualizados.', v_email;
    RETURN;
  END IF;

  -- Cria o usuário no Auth
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    v_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', v_email,
    crypt(v_password, gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', v_name, 'role', v_role),
    NOW(), NOW(),
    '', '', '', ''   -- evita erro do GoTrue (converting NULL to string) no login
  );

  -- O trigger handle_new_user já criou o profile; garante nome e role corretos
  UPDATE profiles SET role = v_role, full_name = v_name WHERE id = v_id;
END $$;
