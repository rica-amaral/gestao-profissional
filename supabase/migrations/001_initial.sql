-- =====================================================================
-- Migration inicial — ceribelli-quiropraxia
-- =====================================================================
-- Estratégia: cada usuário autenticado tem seus próprios dados (single-tenant
-- por owner). Se um dia precisar de múltiplos usuários compartilhando a mesma
-- clínica, troque owner_id por tenant_id e crie uma tabela "memberships".
-- =====================================================================

-- Extensão necessária para gen_random_uuid()
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- TABELA: clients
-- ---------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  birth_date date,
  notes text,
  payment_pending boolean not null default false,
  blocked boolean not null default false,
  last_visit_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_owner_idx on public.clients(owner_id);
create index clients_name_idx on public.clients(owner_id, name);

-- ---------------------------------------------------------------------
-- TABELA: appointments
-- ---------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  date date not null,
  time time not null,
  confirmed boolean not null default false,
  paid boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, date, time)
);

create index appointments_owner_date_idx on public.appointments(owner_id, date);
create index appointments_client_idx on public.appointments(client_id);

-- ---------------------------------------------------------------------
-- TABELA: evaluations (avaliações clínicas / anamneses)
-- ---------------------------------------------------------------------
create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  seq integer not null,
  date date not null,
  notes text,
  details jsonb,
  created_at timestamptz not null default now(),
  unique (owner_id, seq)
);

create index evaluations_owner_idx on public.evaluations(owner_id);
create index evaluations_client_idx on public.evaluations(client_id);

-- ---------------------------------------------------------------------
-- TABELA: adherence_events (faltas, cancelamentos, reagendamentos)
-- ---------------------------------------------------------------------
create table public.adherence_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  type text not null check (type in ('falta','cancelamento','reagendamento')),
  at timestamptz not null default now(),
  note text
);

create index adherence_owner_idx on public.adherence_events(owner_id, at desc);

-- ---------------------------------------------------------------------
-- TABELA: clinic_settings (configurações da clínica — 1 linha por owner)
-- ---------------------------------------------------------------------
create table public.clinic_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  schedule_start time not null default '06:00',
  schedule_end time not null default '20:00',
  early_block_until_hour integer not null default 8,
  lunch_start time not null default '12:00',
  lunch_end time not null default '14:00',
  day_early_unlocked jsonb not null default '{}'::jsonb,
  location_address text not null default 'Alameda Dr. Octávio Pinheiro Brisolla, 14-55 - Jardim Brasil, Bauru - SP, 17011-204',
  services jsonb not null default '[{"id":"1","name":"Sessão individual","durationLabel":"~50 min","price":180}]'::jsonb,
  message_confirmation text not null default 'Olá {nome}! Pode confirmar sua sessão de quiropraxia no dia {data} às {hora}? Responda sim para confirmar. Obrigado!',
  message_reminder text not null default 'Olá {nome}! Lembrete: você tem sessão agendada para {data} às {hora}. Até lá!',
  message_birthday text not null default 'Olá {nome}! Feliz aniversário! Desejamos um dia incrível e muita saúde. Um abraço da equipe Felipe Ceribelli Quiropraxia!',
  next_eval_seq integer not null default 1,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Trigger genérico para atualizar updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

create trigger clinic_settings_set_updated_at
  before update on public.clinic_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Trigger: ao criar usuário, cria automaticamente sua linha de settings
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.clinic_settings (owner_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

alter table public.clients enable row level security;
alter table public.appointments enable row level security;
alter table public.evaluations enable row level security;
alter table public.adherence_events enable row level security;
alter table public.clinic_settings enable row level security;

-- Policies: cada usuário só vê e mexe nas SUAS linhas.

create policy "clients_own" on public.clients
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "appointments_own" on public.appointments
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "evaluations_own" on public.evaluations
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "adherence_own" on public.adherence_events
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "settings_own" on public.clinic_settings
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
