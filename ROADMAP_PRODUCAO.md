# Roadmap de produção — `ceribelli-quiropraxia`

**Objetivo:** colocar o SaaS no ar com Supabase + Vercel, descomissionar Lovable, entregar pro Felipe Ceribelli usar.

**Estratégia:** trabalhamos em paralelo — você faz cliques nos painéis (Supabase, Vercel, Lovable), eu mexo no código aqui. Cada fase tem o que VOCÊ faz e o que EU faço.

---

## FASE 0 — Preparação do código (faço sozinho aqui)

- [x] Revisão completa do código (já feito — ver `REVISAO_ceribelli-quiropraxia.md`)
- [ ] Adicionar `.env` ao `.gitignore` e remover do tracking
- [ ] Corrigir `<html lang="pt-BR">`
- [ ] Traduzir página 404
- [ ] Remover dados de exemplo (clientes Maria Silva, João Santos fictícios)
- [ ] Adicionar validação de variáveis de ambiente
- [ ] Criar `.env.example` documentando as variáveis necessárias

**Você não precisa fazer nada nessa fase.** Sigo trabalhando enquanto você executa a FASE 1.

---

## FASE 1 — Supabase de verdade

### 1.1 — Você cria o projeto no Supabase (5 min)

1. Vá em https://supabase.com e crie uma conta (pode usar GitHub login).
2. Clique em **"New Project"**.
3. Preencha:
   - **Name:** `ceribelli-quiropraxia`
   - **Database Password:** **gere uma senha forte** (Supabase tem botão "Generate") e **salve num gerenciador de senhas**. Você raramente vai usar, mas precisa guardar.
   - **Region:** São Paulo (sa-east-1) — mais perto, latência menor
   - **Plan:** Free
4. Aguarde ~2 minutos enquanto o Supabase provisiona o banco.
5. Quando estiver pronto, vá em **Project Settings → API** e me passe aqui:
   - **Project URL** (algo como `https://abc123xyz.supabase.co`)
   - **anon / public key** (essa é pública, pode mandar tranquilo)
   - **NÃO ME MANDE** a `service_role` key — essa é privada e fica só com você

### 1.2 — Eu escrevo as migrations SQL aqui

Vou criar um arquivo `supabase/migrations/001_initial.sql` com todas as tabelas (clients, appointments, evaluations, adherence_events, clinic_settings), RLS, índices e gatilhos.

### 1.3 — Você roda o SQL no Supabase (2 min)

1. No painel do Supabase, vá em **SQL Editor → New Query**.
2. Copio aqui o conteúdo do arquivo SQL que vou criar.
3. Você cola lá, clica em **Run**.
4. Se aparecer erro, você me mostra e eu corrijo.

### 1.4 — Eu refatoro o código pra usar Supabase

- Substituir `admin-persist.ts` (localStorage) por chamadas reais ao banco
- Trocar `auth-local.ts` por `supabase.auth`
- Criar componente `<ProtectedRoute>` que valida sessão real
- Adaptar `AdminDataContext` pra fazer fetch do Supabase
- Toda a lógica do admin (Schedule, Clients, Evaluation, etc.) passa a ler/escrever do Supabase

### 1.5 — Você cria a conta do Felipe (1 min)

1. No painel do Supabase, vá em **Authentication → Users → Add user**.
2. Preencha o e-mail do Felipe e uma senha temporária forte.
3. Marque "Auto Confirm User" pra ele não precisar confirmar e-mail.
4. Salva. Pronto, ele já pode fazer login.

---

## FASE 2 — Deploy no Vercel

### 2.1 — Você cria conta e conecta o repo (5 min)

1. Vá em https://vercel.com e crie conta (use o GitHub login pra facilitar).
2. Clique em **"Add New Project"**.
3. Selecione o repositório `rica-amaral/ceribelli-quiropraxia`.
4. Vercel detecta Vite automaticamente — não mexa nas configurações padrão.
5. **Não clique em Deploy ainda** — precisamos das variáveis de ambiente.

### 2.2 — Você configura as variáveis de ambiente (2 min)

Na tela de configuração do projeto no Vercel, antes de fazer o deploy:

1. Abra a seção **"Environment Variables"**.
2. Adicione:
   - `VITE_SUPABASE_URL` = (a URL que você me deu na fase 1.1)
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = (a anon key da fase 1.1)
3. Marque para aplicar em **Production, Preview, Development**.
4. Clique em **Deploy**.

### 2.3 — Aguarda o build (~2 min)

O Vercel vai buildar e te dar uma URL tipo `ceribelli-quiropraxia.vercel.app`. **Abra essa URL pra testar.**

### 2.4 — Configurar domínio próprio (opcional)

Se você tem um domínio (`ceribelli.com.br` ou similar), vai em **Project Settings → Domains** no Vercel e adiciona. Ele te dá os registros DNS pra você configurar no painel do provedor do domínio.

Se não tem domínio ainda, pode comprar um na Hostinger, GoDaddy, Registro.br (`.com.br`) — me avisa que te oriento.

---

## FASE 3 — Desconectar Lovable

### Você faz no painel do Lovable (2 min)

1. Acesse https://lovable.dev/projects/4cb164a3-2df1-4ecc-9a41-250191693538 (URL do projeto).
2. Vá em **Project Settings → GitHub** (ou similar).
3. Procure opção tipo **"Disconnect repository"** ou **"Remove GitHub integration"**.
4. Confirme.

O repositório no GitHub continua existindo, mas o Lovable para de commitar nele.

---

## FASE 4 — Entregar pro Felipe

Quando tudo estiver no ar:

1. Você manda pro Felipe:
   - URL do site (ex: `https://ceribelli.com.br/login`)
   - E-mail e senha temporária que você criou na fase 1.5
2. Orienta ele a trocar a senha no primeiro login (já vai existir o fluxo de "esqueci minha senha").
3. Acompanha as primeiras semanas pra ver se aparece bug.

---

## Checklist de segurança final (antes de entregar)

- [ ] `.env` NÃO está no GitHub (FASE 0)
- [ ] RLS habilitado em todas as tabelas do Supabase (FASE 1)
- [ ] Auth real funcionando (FASE 1)
- [ ] HTTPS no domínio final (automático no Vercel)
- [ ] Senha temporária do Felipe forte e única
- [ ] Token PAT que você criou ontem foi revogado em https://github.com/settings/tokens

---

## Quem faz o quê — resumo

| Tarefa | Quem |
|---|---|
| Limpeza inicial do código, .gitignore, lang, 404 | Eu |
| Criar conta + projeto no Supabase | Você |
| Me passar URL + anon key do Supabase | Você |
| Escrever SQL das tabelas e RLS | Eu |
| Rodar SQL no painel do Supabase | Você |
| Refatorar código pra usar Supabase real | Eu |
| Criar usuário do Felipe no Supabase Auth | Você |
| Criar conta no Vercel e conectar repo | Você |
| Configurar variáveis de ambiente no Vercel | Você (com minha orientação) |
| Apontar domínio (se você tem) | Você |
| Desconectar Lovable | Você |
| Mandar acesso pro Felipe | Você |

---

## Próximo passo IMEDIATO

**Sua tarefa agora:** abrir https://supabase.com, criar conta, criar o projeto `ceribelli-quiropraxia` (região São Paulo, plano Free), e me passar aqui no chat:
- Project URL
- anon / public key

Enquanto isso, eu já vou tocando a FASE 0 (limpeza do código) aqui.
