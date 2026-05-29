# Handoff — Projeto ceribelli-quiropraxia

> Cole este arquivo no início de uma nova sessão pra dar contexto completo.

## 1. O projeto

**SaaS para clínica de quiropraxia** do Felipe Ceribelli (Bauru-SP). Já está em produção em `https://felipeceribelli.com.br`.

**Stack:** Vite + TypeScript + React + shadcn/ui + Tailwind + Supabase (auth + Postgres + RLS) + Vercel (deploy).

**Origem:** projeto começou no Lovable.dev, depois foi migrado pra arquitetura própria com Supabase real (Lovable ainda não foi desconectado oficialmente).

## 2. Identificadores e credenciais

- **Repositório GitHub:** `github.com/rica-amaral/ceribelli-quiropraxia` (privado)
- **Projeto Supabase ID:** `eohmrfnnwzejpfpztfdf`
- **Project URL:** `https://eohmrfnnwzejpfpztfdf.supabase.co`
- **Domínio público:** `https://felipeceribelli.com.br`
- **owner_id do Felipe (no Supabase Auth):** `cd1c4893-8200-4c08-937d-da1fa97e43d9`
- **E-mail do Ricardo (super admin):** `r_amaral@outlook.com.br`

A `anon key` do Supabase está no `.env` local (NÃO no git) e nas env vars do Vercel.

## 3. Onde os arquivos vivem

Folder montada na sessão: `/sessions/peaceful-gracious-gauss/mnt/Claude/` (no Mac do Ricardo: `~/Library/CloudStorage/.../Saas/Claude/`).

Estrutura:

```
Saas/Claude/
├── REVISAO_ceribelli-quiropraxia.md   # diagnóstico inicial do código
├── ROADMAP_PRODUCAO.md                # plano de migração (já executado)
├── HANDOFF_PARA_SONNET.md             # ESTE arquivo
└── ceribelli-quiropraxia/             # repo git
    ├── src/                           # código React
    ├── supabase/migrations/
    │   ├── 001_initial.sql            # schema base (clients, appointments, evaluations, adherence_events, clinic_settings + RLS)
    │   └── 002_super_admin.sql        # função is_super_admin + policies _or_admin
    ├── dados-felipe/                  # GITIGNORED — ICS do Google Calendar
    ├── avaliacoes/                    # GITIGNORED — 3.019 xlsx das fichas clínicas
    ├── saida-importacao/              # GITIGNORED — scripts Python + SQL gerado
    │   ├── extract.py                 # parser ICS + xlsx → JSON
    │   ├── gerar_sql.py               # JSON → SQL
    │   ├── clients.json, appointments.json, evaluations.json
    │   └── importacao.sql             # SQL final (já rodado)
    ├── .env                           # GITIGNORED — credenciais Supabase
    ├── .env.example
    ├── .gitignore                     # já bloqueia .env, dados-felipe/, avaliacoes/, saida-importacao/
    └── vercel.json                    # rewrites pra SPA
```

## 4. Arquitetura atual (resumo rápido)

**Tabelas no Supabase (todas com RLS por owner_id):**

- `clients` (id, owner_id, name, phone, birth_date, notes, payment_pending, blocked, last_visit_date)
- `appointments` (id, owner_id, client_id, date, time, confirmed, paid, notes) — UNIQUE(owner_id, date, time)
- `evaluations` (id, owner_id, client_id, seq, date, notes, details jsonb)
- `adherence_events` (id, owner_id, client_id, type, at, note)
- `clinic_settings` (owner_id PK, schedule_start, schedule_end, lunch_*, services jsonb, message_* templates, next_eval_seq)

**RLS:** policy `_own_or_admin` em cada tabela: `owner_id = auth.uid() OR public.is_super_admin()`. Super admin lê via flag `is_super_admin` em `auth.users.raw_app_meta_data` (flag setada manualmente via SQL).

**Frontend:**
- `src/integrations/supabase/client.ts` — cliente Supabase
- `src/contexts/AdminDataContext.tsx` — carrega tudo em memória no mount, expõe `{ store, patch, loading, reload }`, save serializado via fila
- `src/lib/admin-persist.ts` — `loadAdminStore()` (async, lê Supabase, enriquece appointments/evals com clientName/clientPhone via map) e `saveAdminStore(prev, next)` (diff por entidade, sincroniza só o que mudou)
- `src/lib/admin-types.ts` — tipos TS (Client, Appointment, EvaluationRecord, AdherenceEvent, ClinicSettings, AdminStore, defaultClinicSettings, defaultAdminStore)
- `src/components/ProtectedRoute.tsx` — checa sessão Supabase antes de renderizar /admin
- `src/pages/Login.tsx` — usa supabase.auth.signInWithPassword + recuperação de senha
- `src/pages/Admin.tsx` — abas Dashboard/Schedule/Clients/Evaluation/Adherence/Slots/Settings
- `src/components/admin/*.tsx` — componentes das abas (alguns grandes, candidatos a refator: Evaluation 635 linhas, Clients 517, Schedule 515)
- `src/components/landing/*.tsx` — site público
- `src/lib/csv-import.ts` — importador CSV existente (importa pra usuário logado)

**Snake_case ↔ camelCase:** `admin-persist.ts` faz toda a tradução (DB usa snake_case, TS usa camelCase).

**IDs:** todos os IDs são UUIDs gerados com `crypto.randomUUID()` no frontend.

## 5. O que já foi feito

1. **Refator completo** do projeto Lovable: auth fake → Supabase Auth real, localStorage → Postgres com RLS, .env → gitignored, lang pt-BR, 404 traduzido.
2. **Migration 001** rodada — tabelas + RLS por owner_id + trigger que cria clinic_settings ao criar user.
3. **Migration 002** rodada — super admin via JWT flag.
4. **Deploy Vercel** ativo, env vars configuradas. `vercel.json` com rewrite SPA.
5. **DNS configurado** — `felipeceribelli.com.br` apontando para Vercel (A para apex, CNAME para www). Lovable DNS records removidos.
6. **Usuário do Felipe** criado no Supabase Auth (já tem owner_id acima).
7. **Usuário do Ricardo** criado e marcado como super admin via `is_super_admin: true` em app_metadata.
8. **Importação histórica concluída** (`importacao.sql` rodado): 498 clientes, 879 agendamentos, 409 avaliações — só dados a partir de 2026-01-01 (filtro aplicado pelo Ricardo). owner_id de tudo = Felipe.
9. **Bug crítico de landing page corrigido** (`Services.tsx` usava `loadAdminStore()` síncrono que virou async).

## 6. Backlog de melhorias

| # | Status | Tarefa | Notas |
|---|---|---|---|
| 26 | ✅ | **campo `price` em appointments** | Migration 003 rodada. |
| 27 | ✅ | **UI valor + totais no Dashboard** | Implementado. |
| 28 | ✅ | **Selects de cliente em ordem alfabética** | localeCompare pt-BR. |
| 29 | ✅ | **Deduplicar clientes semelhantes** | UI em Clients.tsx. |
| 33 | ✅ | **Campos email/profissão/cidade/sexo separados** | Migration 004 + form em Clients.tsx. |
| 31 | ✅ | **Agendamento duplo (2 clientes mesmo horário)** | Ver seção abaixo — Migration 005 precisa ser rodada. |
| 30 | ⚠️ | **Reimportar avaliações da aba Plan1** | Script pronto — ver seção abaixo. Precisa rodar no Mac. |
| 32 | — | **WhatsApp automático para aniversariantes** | Botão já existe no Dashboard. Automação real precisa API paga. |

## 7. Tarefas ainda pendentes do roadmap original

- **Lovable** — ✅ Desconectado.
- **Entrega oficial pro Felipe** — mandar link + credenciais + orientar troca de senha. SMTP do Supabase em modo teste só envia pra dono do projeto, então recuperação de senha do Felipe via email NÃO funciona ainda (configurar Resend/Brevo se for necessário).

## 8. Pendências manuais (após última sessão)

### #31 — Migration 005 (rodar no Supabase)
Arquivo: `supabase/migrations/005_allow_double_booking.sql`
```sql
alter table public.appointments
  drop constraint if exists appointments_owner_id_date_time_key;
create index if not exists idx_appointments_owner_date_time
  on public.appointments (owner_id, date, time);
```
Rodar no SQL Editor do Supabase antes de usar o botão "+ 2º paciente".

### #30 — Gerar e rodar SQL das avaliações Plan1 (rodar no Mac)
1. No terminal do Mac:
   ```bash
   cd ~/Library/CloudStorage/.../Saas/Claude/ceribelli-quiropraxia
   python3 saida-importacao/gerar_sql_plan1.py
   ```
   Isso gera `saida-importacao/importacao_plan1.sql` (~816 arquivos xlsx, alguns minutos).
2. Colar o conteúdo no SQL Editor do Supabase e rodar.
   O SQL é **idempotente** (NOT EXISTS) — pode rodar mais de uma vez sem duplicar.

### Migrations 003 e 004 — confirmar se já foram rodadas no Supabase
Se ainda não rodaram, rodar antes de usar os campos `price` e email/profissão/cidade/sexo.

---

## 9. Como retomar trabalho

1. Confirmar que o site continua no ar: abrir `https://felipeceribelli.com.br/login`.
2. Logar com a conta do Ricardo (super admin) pra ver dados do Felipe.
3. Ricardo decide qual task atacar primeiro (sugiro #29 dedupe).
4. Sempre commitar do Mac do Ricardo, não do ambiente Claude (sandbox não tem acesso ao GitHub).

## 10. Convenções importantes

- **Nunca** commitar `dados-felipe/`, `avaliacoes/`, `saida-importacao/`, `.env`. Já no `.gitignore`.
- **Migration nova:** criar arquivo `supabase/migrations/00X_nome.sql`, rodar manualmente no SQL Editor (não há CI de migrations).
- **Frontend muda algo no store:** o `patch()` do AdminDataContext faz diff e sincroniza com Supabase automaticamente. Em geral nem precisa pensar em await — saves vão pra fila serializada.
- **Adicionar nova coluna numa tabela:** lembrar de (1) migration SQL, (2) atualizar `src/integrations/supabase/types.ts`, (3) atualizar tipo em `admin-types.ts`, (4) atualizar mappers em `admin-persist.ts` (from/to row), (5) atualizar componentes que consomem.
- **Caminho dos dados sensíveis no Mac:** `~/Library/CloudStorage/GoogleDrive-ricardodoamaralsilva@gmail.com/Outros computadores/Meu laptop/Amaral Business/Saas/Claude/ceribelli-quiropraxia/`

## 11. Pontos de atenção conhecidos

- **Telefone obrigatório:** schema marca `phone NOT NULL`. Na importação histórica, clientes sem telefone receberam placeholder "—". Ao editar pela UI hoje, validação exige >= 8 chars. Há proposta antiga (não executada) de mudar pra NULL.
- **Email no notes pode estar bagunçado:** alguns clientes têm dados que vazaram pra coluna errada na importação (visto pelo menos 1 caso "1,65M" como email antes do fix). Maioria OK, mas vale auditar antes de usar pra envio de email.
- **Storage do Supabase auth:** o cliente Supabase usa `localStorage` pra persistir sessão (configurado em `client.ts`). Funciona, mas SSR não suportado (não usamos SSR mesmo).
- **Bundle não tem code splitting:** todas as rotas no bundle inicial. Landing carrega código do admin. Otimização futura.
