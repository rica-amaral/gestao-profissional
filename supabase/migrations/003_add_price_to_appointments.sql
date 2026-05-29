-- =====================================================================
-- Migration 003 — Adicionar campo price em appointments
-- =====================================================================

-- Adiciona coluna price (numeric) com default 0
alter table public.appointments
add column price numeric not null default 0;

-- Backfill: extrai valores de "Valor: R$ XXX" dos notes
-- Exemplo: "Valor: R$ 180" → 180
update public.appointments
set price = (
  coalesce(
    (regexp_matches(notes, 'Valor:\s*R\$\s*(\d+(?:[.,]\d+)?)', 'g'))[1]::numeric,
    0
  )
)
where notes is not null and notes like '%Valor:%';

-- Se não houver pattern, deixa como 0 (já é default)
