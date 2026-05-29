-- =====================================================================
-- Migration 004 — Separar email/profissão/cidade/sexo de notes
-- =====================================================================

-- Adiciona colunas dedicadas em clients
alter table public.clients
add column email text,
add column profession text,
add column city text,
add column gender text check (gender in ('M', 'F', 'O')) default null;

-- Backfill: extrai valores de notes usando padrões "E-mail: ...", "Profissão: ...", etc.
-- Exemplo: "E-mail: exemplo@email.com | Profissão: Dentista | Cidade: Bauru | Sexo: F"

update public.clients
set
  email = coalesce(
    (regexp_matches(notes, 'E-mail:\s*([^\|]+)', 'i'))[1],
    null
  ),
  profession = coalesce(
    (regexp_matches(notes, 'Profiss[ãa]o:\s*([^\|]+)', 'i'))[1],
    null
  ),
  city = coalesce(
    (regexp_matches(notes, 'Cidade:\s*([^\|]+)', 'i'))[1],
    null
  ),
  gender = case
    when notes ilike '%Sexo:%F%' or notes ilike '%Sexo:%Feminino%' then 'F'
    when notes ilike '%Sexo:%M%' or notes ilike '%Sexo:%Masculino%' then 'M'
    else null
  end
where notes is not null;

-- Limpar espaços em branco nos valores extraídos
update public.clients
set
  email = nullif(trim(email), ''),
  profession = nullif(trim(profession), ''),
  city = nullif(trim(city), '')
where notes is not null;
