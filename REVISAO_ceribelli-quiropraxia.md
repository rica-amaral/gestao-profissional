# Revisão de código — `ceribelli-quiropraxia`

**Data:** 18/05/2026
**Revisor:** Claude (Cowork)
**Stack:** Vite + TypeScript + React + shadcn/ui + Tailwind + Supabase (configurado mas não usado) + Lovable
**Total de linhas (sem shadcn/ui):** ~4.760
**Último commit:** `ae47c47` — "Melhora fluxo operacional do admin com atalhos e importação CSV"

---

## 1. Visão geral

SaaS para a clínica de quiropraxia do Felipe Ceribelli (Bauru-SP). Tem duas frentes:

- **Site público** (`/`): landing page com Hero, Sobre, Benefícios, Serviços, Localização, Depoimentos, CTA, Footer, e botão flutuante de WhatsApp.
- **Painel administrativo** (`/admin`): gestão de clientes, agenda, avaliações clínicas (com anamneses), aderência (faltas/cancelamentos), horários disponíveis e configurações da clínica.

O projeto foi gerado pelo **Lovable.dev** e está conectado ao GitHub (sync automático).

---

## 2. O que está bem feito ✅

- **Landing page bonita e bem estruturada** — uso adequado de Tailwind, responsividade (breakpoints sm/lg), acessibilidade básica (`aria-label`, alt em imagens), animações sutis, SEO meta tags configuradas.
- **Organização de pastas clara** — `pages/`, `components/landing/`, `components/admin/`, `lib/`, `contexts/`, `hooks/`, `integrations/`. Fácil de navegar.
- **TypeScript consistente** — tipos bem definidos em `admin-types.ts` (Client, Appointment, EvaluationRecord, ClinicSettings, etc.).
- **Stack moderna** — React Query, Sonner toasts, shadcn/ui (49 componentes prontos), Tailwind.
- **Integração WhatsApp bem implementada** — `lib/contact.ts` faz tratamento de telefone (E.164), encoding correto de mensagens, links seguros (`rel="noopener noreferrer"`).
- **Funcionalidades clínicas robustas no admin** — anamneses padronizadas (18 perguntas de Anamnese 1, 3 de Anamnese 2 com escala 0-5), histórico de evolução, gestão de aderência, sequência numerada de avaliações.
- **Importação CSV** com templates separados para clientes, agendamentos, avaliações e pagamentos. Parsing tolerante (aceita `,` e `;`, lida com aspas).
- **Mensagens parametrizáveis** — templates de confirmação, lembrete e aniversário com variáveis `{nome}`, `{data}`, `{hora}`.
- **Dashboard funcional** — sessões do dia, contagem semanal, pagamentos pendentes, aniversariantes do dia com atalho de WhatsApp.

---

## 3. Problemas críticos 🚨

### 3.1 Autenticação é completamente fake (CRÍTICO)

**Arquivo:** `src/pages/Login.tsx`, `src/lib/auth-local.ts`, `src/pages/Admin.tsx`

O "login" é cosmético:

- Salva e-mail/senha em **texto plano** no `localStorage` (`auth-local.ts`).
- O **primeiro acesso define as credenciais** — quem chegar primeiro vira o "admin".
- O check de autenticação no `Admin.tsx` é apenas:
  ```js
  localStorage.getItem("isAuthenticated") === "true"
  ```
- Qualquer pessoa que abra o DevTools e rode `localStorage.setItem("isAuthenticated", "true")` entra no admin sem nenhuma senha.

**Risco real:** se essa aplicação tem URL pública, o painel administrativo é efetivamente público.

### 3.2 Supabase configurado mas nunca usado

**Arquivo:** `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`

O cliente Supabase é criado, mas:

- Em todo o `src/`, apenas o `client.ts` referencia `supabase`. Nenhum componente, hook ou utilitário usa o cliente.
- `types.ts` tem `Tables: { [_ in never]: never }` — não existe tabela criada no banco.
- Não há pasta `supabase/migrations/`.
- Toda a persistência é feita em `localStorage` via `admin-persist.ts`.

**Implicação:** o Supabase é dependência morta. Tem chave de API consumida sem propósito, e dá a falsa sensação de que existe um backend.

### 3.3 Dados sensíveis de saúde apenas no navegador

**Arquivo:** `src/lib/admin-persist.ts`, `src/components/admin/Evaluation.tsx`

Anamneses clínicas (incluindo questões sobre doenças, medicações, sintomas neurológicos) ficam apenas no `localStorage` do navegador. Isso significa:

- **Se o usuário limpar o cache, perde TUDO** — clientes, agendamentos, avaliações.
- **Cada dispositivo tem dados diferentes** — Felipe não pode acessar do celular o que cadastrou no desktop.
- **Sem backup**.
- **Exposição via XSS** — qualquer script malicioso (extensão de navegador, vulnerabilidade futura) lê tudo.
- **LGPD:** dados de saúde são "sensíveis" pela LGPD; armazenamento em `localStorage` sem criptografia provavelmente não atende o padrão exigido.

### 3.4 `.env` commitado no GitHub

**Status atual:** `.env` está no histórico (commit `39b718c`), `.gitignore` não cobre `.env`.

Suas chaves do Supabase (mesmo a "anon"/"publishable", que é pública por design, mas ainda assim convém rotacionar) estão expostas no repositório.

---

## 4. Problemas de qualidade e manutenibilidade ⚠️

### 4.1 Arquivos grandes (refatoração recomendada)

| Arquivo | Linhas | Observação |
|---|---|---|
| `Evaluation.tsx` | 635 | Anamneses + diálogos + lista + busca + criação. Daria pra quebrar em ≥3 componentes. |
| `Clients.tsx` | 517 | Provavelmente lista + cadastro + edição no mesmo arquivo. |
| `Schedule.tsx` | 515 | Lógica de calendário + diálogos. |
| `csv-import.ts` | 309 | Pode separar parser, normalização, e templates. |

### 4.2 Sem error boundary

Se qualquer componente lançar exceção em render, **a aplicação inteira quebra** (tela em branco). React Error Boundary não existe.

### 4.3 Sem lazy loading de rotas

`Admin`, `Home`, `Login` e `NotFound` estão todos no bundle inicial. Para um visitante da landing page, isso significa baixar o código do painel administrativo também. Solução: `React.lazy` + `Suspense`.

### 4.4 `<html lang="en">` com conteúdo em português

**Arquivo:** `index.html` linha 2. Deve ser `lang="pt-BR"` — afeta SEO, leitores de tela e correção ortográfica do navegador.

### 4.5 Página 404 em inglês

**Arquivo:** `src/pages/NotFound.tsx` — "Oops! Page not found", "Return to Home". Resto da aplicação é em português.

### 4.6 Sem validação de variáveis de ambiente

**Arquivo:** `src/integrations/supabase/client.ts`. Se `VITE_SUPABASE_URL` ou `VITE_SUPABASE_PUBLISHABLE_KEY` faltarem, `createClient` recebe `undefined` e a aplicação quebra silenciosamente em runtime.

### 4.7 Sem testes

Zero arquivos `.test.ts` ou `.spec.ts`. Refatorar com segurança fica difícil.

### 4.8 `setTimeout` cosmético no Login

`Login.tsx` linhas 26 e 33 — `setTimeout(..., 400)` e `setTimeout(..., 500)` para fingir delay de loading. Não é catastrófico, mas é um anti-padrão herdado de quando o código foi gerado.

---

## 5. Observações funcionais e UX

- **Dashboard** está bem pensado, com atalhos práticos (WhatsApp por sessão, parabéns automatizado).
- **Settings** é abrangente — horário de atendimento, bloqueio de manhã, horário de almoço, serviços, mensagens template.
- **Avaliação** tem estrutura clínica séria (anamnese padronizada, evolução, sequência numerada).
- **Importação CSV** permite migrar dados — bom para onboarding.
- **Botão flutuante de WhatsApp** na landing — boa prática para conversão.

---

## 6. Recomendações priorizadas

### 🔴 Prioridade 1 — Fazer agora (segurança e dados)

1. **Adicionar `.env` ao `.gitignore`** e remover do tracking (`git rm --cached .env`).
2. **Rotacionar a chave anônima do Supabase** (mesmo que pública, é boa higiene).
3. **Migrar persistência para Supabase** com tabelas reais (clients, appointments, evaluations, settings) e **Row Level Security (RLS)** habilitado.
4. **Implementar auth real do Supabase** (`supabase.auth.signInWithPassword`) e remover `auth-local.ts` e o check de `localStorage`. Criar um `<ProtectedRoute>` que valida sessão antes de renderizar `/admin`.

### 🟡 Prioridade 2 — Próximas semanas

5. **Adicionar `lang="pt-BR"`** no `index.html` e traduzir a página 404.
6. **Wrap da aplicação com Error Boundary** (ex: `react-error-boundary`).
7. **Lazy loading das rotas** com `React.lazy` para reduzir bundle inicial.
8. **Quebrar `Evaluation.tsx`, `Clients.tsx`, `Schedule.tsx`** em subcomponentes.
9. **Validação de env vars** — usar `zod` ou similar pra falhar com mensagem clara se faltar variável.
10. **Backup/export local** enquanto Supabase não está pronto — botão "Exportar tudo (JSON)" pra Felipe não perder dados se algo acontecer com o navegador.

### 🟢 Prioridade 3 — Depois

11. **Testes** — começar pelos utilitários (`lib/admin-persist.ts`, `csv-import.ts`, helpers de datas em `AdminDataContext.tsx`).
12. **Audit de acessibilidade** — Lighthouse / axe-core.
13. **Otimização de imagens** — logo e assets em formato moderno (webp/avif).
14. **Monitoramento** — Sentry ou similar pra erros em produção.

---

## 7. Quando "subir" o Supabase de verdade (esboço)

Tabelas mínimas sugeridas:

```sql
-- Usuários autenticados via Supabase Auth (auth.users)

create table clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) not null,
  name text not null,
  phone text not null,
  birth_date date,
  notes text,
  payment_pending boolean default false,
  blocked boolean default false,
  last_visit_date date,
  created_at timestamptz default now()
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) not null,
  client_id uuid references clients(id) on delete cascade,
  date date not null,
  time time not null,
  confirmed boolean default false,
  paid boolean default false,
  notes text,
  created_at timestamptz default now()
);

create table evaluations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) not null,
  client_id uuid references clients(id) on delete cascade,
  seq int not null,
  date date not null,
  notes text,
  details jsonb,
  created_at timestamptz default now()
);

create table clinic_settings (
  owner_id uuid primary key references auth.users(id),
  data jsonb not null,
  updated_at timestamptz default now()
);

create table adherence_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) not null,
  client_id uuid references clients(id) on delete cascade,
  type text not null check (type in ('falta','cancelamento','reagendamento')),
  at timestamptz default now(),
  note text
);

-- RLS: cada usuário só vê seus próprios dados
alter table clients enable row level security;
create policy "Own clients" on clients
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- (repetir para as demais tabelas)
```

Plus migração: script de export do `localStorage` atual + import via SQL, para o Felipe não perder o que já tem cadastrado.

---

## 8. Resumo executivo

O projeto é **visualmente excelente e funcionalmente abrangente**, mas **arquiteturalmente é um protótipo**. Está pronto para demonstração, mas não para uso real em uma clínica com dados de pacientes. Os dois bloqueios são:

1. **Não há backend de verdade** — tudo no `localStorage` significa um dispositivo, sem backup, sem multi-usuário.
2. **Não há autenticação de verdade** — qualquer um com a URL acessa o admin.

A boa notícia é que a stack já tem tudo pra resolver isso (Supabase está plugado, só falta usar). Estimo que migrar pra Supabase + auth real seja um trabalho de **1-2 semanas** de desenvolvimento dedicado, e isso transformaria o projeto em um SaaS real pronto pra clínica.
