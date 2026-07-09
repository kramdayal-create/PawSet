-- ===========================================================================
-- Demo-mode user (BYPASS_AUTH=true)
-- ===========================================================================
-- Every PawSet table that carries user_id references auth.users(id). The
-- app's demo mode always uses the fixed UUID below in place of a real
-- signed-in user, so that row must exist in auth.users or every insert
-- (pets, contacts, etc.) fails its foreign key constraint.
-- Safe to re-run: no-ops if the row already exists.
-- ===========================================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'demo@pawset.app',
  crypt('pawset-demo-mode-not-a-real-login', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Demo User"}',
  '', '', '', ''
)
on conflict (id) do nothing;
