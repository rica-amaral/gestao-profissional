-- =====================================================================
-- Migration 005 — Permitir agendamento duplo (2 clientes mesmo horário)
-- =====================================================================
-- Remove a constraint UNIQUE(owner_id, date, time) da tabela appointments.
-- A partir desta migration, um mesmo slot pode ter até 2 clientes
-- (ex.: casal, pai/filho, colegas de trabalho que vêm juntos).
-- O limite de 2 por slot é imposto pela UI, não pelo banco.

alter table public.appointments
  drop constraint if exists appointments_owner_id_date_time_key;

-- Índice simples para queries por (owner_id, date, time) permanecerem rápidas
-- (o índice único foi implicitamente removido com a constraint acima).
create index if not exists idx_appointments_owner_date_time
  on public.appointments (owner_id, date, time);
