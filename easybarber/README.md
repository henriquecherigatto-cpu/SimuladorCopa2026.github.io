# Easy Barber

Sua barbearia organizada de forma simples. Plataforma de agendamento e gestão de barbearias por assinatura mensal.

## Status deste projeto

- **Etapa 1 — Interface visual**: as 12 telas do briefing, componentes reutilizáveis, layout responsivo. Concluída.
- **Etapa 3/4 — Banco de dados, autenticação e isolamento multiempresa**: schema PostgreSQL completo, políticas RLS, autenticação real via Supabase Auth. Concluída e **verificada com testes negativos reais** (veja [`supabase/README.md`](./supabase/README.md)).

**O que já existe:**

- Next.js (App Router) + TypeScript + Tailwind CSS v4.
- Sistema de design com os tokens de cor da marca (laranja/grafite/branco).
- Componentes reutilizáveis: `Button`, `Input`, `Select`, `Textarea`, `Card`, `Modal`, `Badge`/`StatusBadge`, `Avatar`, `EmptyState`, `StatCard`, `Alert`, `Switch`, `Tabs`, `Fab`.
- Layout responsivo com sidebar (desktop) e navegação inferior + menu "Mais" (mobile).
- As 12 telas do briefing: Login, Cadastro da barbearia, Painel inicial, Agenda (dia e semana), Novo agendamento, Clientes, Profissionais, Serviços, Configurações, Plano e assinatura, Painel administrativo multiempresa.
- **Autenticação real** via Supabase Auth (`@supabase/ssr`): login, cadastro, recuperação de senha, logout — ver [`src/lib/supabase/`](./src/lib/supabase/) e [`src/proxy.ts`](./src/proxy.ts).
- **Banco de dados PostgreSQL completo** com 14 tabelas, políticas de Row Level Security para isolamento multiempresa, restrições de concorrência (não é possível dar dois agendamentos conflitantes no mesmo horário mesmo sob concorrência) — ver [`supabase/migrations/`](./supabase/migrations/).
- Um fluxo de onboarding (`/onboarding/empresa`) garante que toda conta nova crie sua barbearia antes de usar o restante do sistema.
- Lógica de cálculo de horários disponíveis (respeitando horário de funcionamento, jornada do profissional e conflitos de agendamento) em `src/lib/scheduling.ts` — ainda roda no cliente sobre dados de demonstração (ver abaixo).

**O que ainda é dado de demonstração (próximas etapas):**

As telas internas (Painel, Agenda, Clientes, Profissionais, Serviços, Configurações, Plano) ainda leem de `src/lib/mock-data.ts` — a camada de autenticação e o banco de dados já são reais, mas as consultas dessas telas ainda não foram reconectadas às tabelas reais. Isso é intencional e está fora do escopo desta etapa (fazer isso é a próxima etapa do roteiro original: "Etapa 5/6 — desenvolver agenda, clientes, serviços, profissionais e configurações com dados reais"). Até lá:

- Essas telas continuam exibindo o selo **"Demonstração"**.
- A navegação do app (sidebar, menu "Mais", nome do usuário/empresa logado) já reflete a sessão **real** do Supabase.
- Integração de pagamento real (Asaas) ainda não existe — os botões de assinatura mostram avisos de "modo de demonstração", e a tabela `billing_events` já está pronta para receber os webhooks (idempotentes) quando essa integração for implementada.

## Rodando localmente

### 1. Interface (sem banco de dados real)

```bash
npm install
npm run dev
```

Sem um projeto Supabase configurado (veja abaixo), as telas internas continuam navegáveis com dados de demonstração, mas login/cadastro vão falhar (eles chamam a API real do Supabase).

### 2. Com autenticação e banco de dados reais

1. Crie um projeto em [supabase.com](https://supabase.com) (ou rode `npx supabase start` localmente, se sua rede permitir baixar as imagens Docker da Supabase).
2. Aplique as migrações em `supabase/migrations/` ao projeto:
   ```bash
   npx supabase link --project-ref <seu-project-ref>
   npx supabase db push
   ```
3. Copie `.env.example` para `.env.local` e preencha com a URL e a chave anônima do seu projeto (Project Settings → API no painel do Supabase).
4. `npm run dev` e abra [http://localhost:3000](http://localhost:3000).

Veja [`supabase/README.md`](./supabase/README.md) para detalhes do schema, das políticas de RLS e de como rodar os testes de isolamento localmente (sem precisar de um projeto Supabase real).

## Scripts

- `npm run dev` — ambiente de desenvolvimento.
- `npm run build` — build de produção.
- `npm run lint` — ESLint.
- `bash supabase/tests/run-local-tests.sh` — aplica as migrações reais a um Postgres descartável (Docker) e roda a suíte de testes negativos de isolamento multiempresa.

## Estrutura

```
src/
  app/
    (auth)/          # login, cadastro, recuperar/atualizar senha (layout centralizado)
    (app)/           # dashboard, agenda, clientes, etc. (layout com sidebar; checa sessão real)
    onboarding/      # criação da barbearia logo após o cadastro
  components/
    ui/              # componentes de interface reutilizáveis
    layout/          # sidebar, topbar, navegação mobile
    auth/            # formulários de login/cadastro/senha, botão de logout
    agenda/          # agenda do dia/semana, novo agendamento
    clientes/ profissionais/ servicos/ configuracoes/ plano/ admin/
  lib/
    supabase/        # clientes Supabase (browser, server, proxy) e tipos gerados do banco
    mock-data.ts     # dados de demonstração das telas ainda não reconectadas
    scheduling.ts    # cálculo de horários disponíveis (client-side, sobre mock-data)
    nav.ts           # itens de navegação
    utils.ts         # helpers (cn, formatação de moeda, etc.)
  types/             # tipos TypeScript de domínio usados pelas telas de demonstração
  proxy.ts           # Next.js Proxy (ex-middleware): refresh de sessão + redirecionamento
supabase/
  migrations/        # schema completo + RLS, versionado, aplicável com `supabase db push`
  tests/             # suíte de testes negativos de isolamento (veja supabase/README.md)
```
