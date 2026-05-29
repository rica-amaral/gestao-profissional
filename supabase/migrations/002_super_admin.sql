-- =====================================================================
-- Migration 002 — Super admin role
-- =====================================================================
-- Adiciona uma flag de super admin baseada em app_metadata do JWT.
-- A flag é setada server-side via update em auth.users (ver instruções
-- abaixo) e não pode ser modificada pelo usuário via cliente.
-- =====================================================================

-- Função auxiliar: lê a flag is_super_admin do JWT do usuário atual
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security invoker
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean,
    false
  );
$$;

-- ---------------------------------------------------------------------
-- Recria as policies de todas as tabelas para honrar super admin
-- ---------------------------------------------------------------------

drop policy if exists "clients_own" on public.clients;
create policy "clients_own_or_admin" on public.clients
  for all
  using (owner_id = auth.uid() or public.is_super_admin())
  with check (owner_id = auth.uid() or public.is_super_admin());

drop policy if exists "appointments_own" on public.appointments;
create policy "appointments_own_or_admin" on public.appointments
  for all
  using (owner_id = auth.uid() or public.is_super_admin())
  with check (owner_id = auth.uid() or public.is_super_admin());

drop policy if exists "evaluations_own" on public.evaluations;
create policy "evaluations_own_or_admin" on public.evaluations
  for all
  using (owner_id = auth.uid() or public.is_super_admin())
  with check (owner_id = auth.uid() or public.is_super_admin());

drop policy if exists "adherence_own" on public.adherence_events;
create policy "adherence_own_or_admin" on public.adherence_events
  for all
  using (owner_id = auth.uid() or public.is_super_admin())
  with check (owner_id = auth.uid() or public.is_super_admin());

drop policy if exists "settings_own" on public.clinic_settings;
create policy "settings_own_or_admin" on public.clinic_settings
  for all
  using (owner_id = auth.uid() or public.is_super_admin())
  with check (owner_id = auth.uid() or public.is_super_admin());

-- =====================================================================
-- Como marcar um usuário como super admin
-- =====================================================================
-- 1. Crie o usuário no Authentication > Users (com Auto Confirm marcado)
-- 2. Rode o SQL abaixo trocando o e-mail pelo do super admin desejado:
--
--    update auth.users
--    set raw_app_meta_data =
--      coalesce(raw_app_meta_data, '{}'::jsonb)
--      || '{"is_super_admin": true}'::jsonb
--    where email = 'r_amaral@outlook.com.br';
--
-- 3. O usuário precisa FAZER LOGOUT e LOGIN novamente para o novo JWT
--    refletir a flag.
--
-- Para REMOVER super admin de alguém:
--
--    update auth.users
--    set raw_app_meta_data = raw_app_meta_data - 'is_super_admin'
--    where email = 'r_amaral@outlook.com.br';
-- =====================================================================
