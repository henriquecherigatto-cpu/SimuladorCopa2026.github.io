# Easy Barber

Sua barbearia organizada de forma simples. Plataforma de agendamento e gestão de barbearias por assinatura mensal.

## Status deste projeto

- **Etapa 1 — Interface visual**: as 12 telas do briefing, componentes reutilizáveis, layout responsivo. Concluída.
- **Etapa 3/4 — Banco de dados, autenticação e isolamento multiempresa**: schema PostgreSQL completo, políticas RLS, autenticação real via Supabase Auth. Concluída e **verificada com testes negativos reais** (veja [`supabase/README.md`](./supabase/README.md)).
- **Etapa 5 — Agenda, clientes, serviços, profissionais e painel com dados reais**: cadastro, edição, listagem e cancelamento completos, disponibilidade e conflitos de horário validados no servidor. Concluída.
- **Etapa 6 — Máquina de estados de assinatura**: vencimento, tolerância (10 dias), suspensão e reativação implementados e testados com eventos simulados; integração real com o provedor de pagamento (Asaas) preparada (webhook verificado, checkout hospedado, nenhum dado de cartão armazenado). Concluída — ver [`docs/billing-integration.md`](./docs/billing-integration.md).

**O que já existe:**

- Next.js (App Router) + TypeScript + Tailwind CSS v4.
- Sistema de design com os tokens de cor da marca (laranja/grafite/branco).
- Componentes reutilizáveis: `Button`, `Input`, `Select`, `Textarea`, `Card`, `Modal`, `Badge`/`StatusBadge`, `Avatar`, `EmptyState`, `StatCard`, `Alert`, `Switch`, `Tabs`, `Fab`.
- Layout responsivo com sidebar (desktop) e navegação inferior + menu "Mais" (mobile).
- As 12 telas do briefing: Login, Cadastro da barbearia, Painel inicial, Agenda (dia e semana), Novo agendamento, Clientes, Profissionais, Serviços, Configurações, Plano e assinatura, Painel administrativo multiempresa.
- **Autenticação real** via Supabase Auth (`@supabase/ssr`): login, cadastro, recuperação de senha, logout — ver [`src/lib/supabase/`](./src/lib/supabase/) e [`src/proxy.ts`](./src/proxy.ts).
- **Banco de dados PostgreSQL completo** com 14 tabelas, políticas de Row Level Security para isolamento multiempresa, restrições de concorrência (não é possível dar dois agendamentos conflitantes no mesmo horário mesmo sob concorrência) — ver [`supabase/migrations/`](./supabase/migrations/).
- **Painel, Agenda (dia/semana/novo agendamento), Clientes, Profissionais e Serviços rodam 100% sobre o banco real** — cadastro/edição/listagem/cancelamento, disponibilidade calculada no servidor (`get_available_slots()`) e conflito de horário impedido pelo próprio Postgres, não só na interface.
- **Máquina de estados de assinatura** (`subscriptions.status`: `pendente → ativa → tolerancia → suspensa`, com reativação em qualquer ponto e cancelamento terminal) — só muda via `service_role` (webhook de pagamento verificado ou a varredura diária de vencimento/tolerância), nunca por uma sessão de usuário. Ver [`docs/billing-integration.md`](./docs/billing-integration.md).
- Um fluxo de onboarding (`/onboarding/empresa`) garante que toda conta nova crie sua barbearia antes de usar o restante do sistema.

**O que ainda é dado de demonstração:**

- **Configurações** e o **painel administrativo multiempresa** (`/admin`) ainda leem de `src/lib/mock-data.ts` — ainda não reconectados ao banco real.
- A tela **Plano e assinatura** (`src/components/plano/PlanoPageClient.tsx`) também ainda lê dados de demonstração — o backend por trás dela (máquina de estados, webhook, criação de checkout) já é real e testado (ver acima), só falta religar essa tela específica para chamá-lo.
- Essas três telas continuam exibindo o selo **"Demonstração"**.
- A navegação do app (sidebar, menu "Mais", nome do usuário/empresa logado) já reflete a sessão **real** do Supabase em todas as telas.

## Rodando localmente

A maioria das telas agora faz consultas reais ao Postgres (via Server Components/Actions protegidos por RLS), então rodar sem um banco só deixa `/login` e `/cadastro` navegáveis visualmente — qualquer tentativa real de entrar falha. Para testar o app de verdade, use um backend real:

### Opção A — Supabase local (Docker, recomendado para desenvolvimento)

Requer [Docker](https://www.docker.com/) rodando.

```bash
npm install
npx supabase start        # sobe Postgres + Auth + API local (primeira vez baixa as imagens)
cp .env.example .env.local
```

O `supabase start` imprime a URL da API e as chaves `anon`/`service_role` locais — cole-as em `.env.local` (para o stack local do Supabase CLI, essas chaves são sempre as mesmas, fixas no `supabase/config.toml`, então também dá para copiar de outro ambiente local já configurado). As migrações em `supabase/migrations/` são aplicadas automaticamente no primeiro `supabase start`; depois de puxar migrações novas, rode `npx supabase db push --local` para aplicá-las sem apagar os dados locais.

```bash
npm run dev
```

Abra [http://localhost:3000/cadastro](http://localhost:3000/cadastro) — como a confirmação de e-mail vem desligada no stack local (`supabase/config.toml`), o cadastro já loga direto, sem precisar confirmar nada. O Supabase Studio (painel para inspecionar as tabelas) fica em [http://127.0.0.1:54323](http://127.0.0.1:54323).

Variáveis de cobrança (`ASAAS_*`, `CRON_SECRET`) são opcionais para só testar o app — necessárias apenas para exercitar as rotas `/api/billing/*` (veja [`docs/billing-integration.md`](./docs/billing-integration.md)).

### Opção B — projeto Supabase real

1. Crie um projeto em [supabase.com](https://supabase.com).
2. `npx supabase link --project-ref <seu-project-ref>` e `npx supabase db push`.
3. Copie `.env.example` para `.env.local` com a URL e as chaves do seu projeto (Project Settings → API).
4. `npm run dev` e abra [http://localhost:3000](http://localhost:3000).

Veja [`supabase/README.md`](./supabase/README.md) para detalhes do schema e das políticas de RLS, e [`docs/billing-integration.md`](./docs/billing-integration.md) para a integração de pagamento. `bash supabase/tests/run-local-tests.sh` roda a suíte de testes negativos de isolamento (e da máquina de estados de assinatura) sem precisar de nenhum projeto Supabase — sobe e derruba seu próprio Postgres descartável.

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
    api/billing/     # webhook do provedor de pagamento + rota de varredura (service_role only)
    onboarding/      # criação da barbearia logo após o cadastro
  components/
    ui/              # componentes de interface reutilizáveis
    layout/          # sidebar, topbar, navegação mobile
    auth/            # formulários de login/cadastro/senha, botão de logout
    agenda/          # agenda do dia/semana, novo agendamento
    clientes/ profissionais/ servicos/ configuracoes/ plano/ admin/
  lib/
    actions/         # Server Actions (CRUD de cada tela + checkout de assinatura)
    billing/         # tipos + adaptador do provedor de pagamento (Asaas), sem acesso ao banco
    supabase/        # clientes Supabase (browser, server, service-role, proxy) e tipos gerados
    mock-data.ts     # dados de demonstração — só usado por Configurações, Plano e Admin ainda
    scheduling.ts    # cálculo de horários disponíveis no cliente (legado; o servidor usa get_available_slots())
    nav.ts           # itens de navegação
    utils.ts         # helpers (cn, formatação de moeda, etc.)
  types/             # tipos TypeScript de domínio usados pelas telas de demonstração
  proxy.ts           # Next.js Proxy (ex-middleware): refresh de sessão + redirecionamento (exclui /api/**)
supabase/
  migrations/        # schema completo + RLS + máquina de estados, versionado, aplicável com `supabase db push`
  tests/             # suíte de testes negativos de isolamento e da máquina de estados (veja supabase/README.md)
docs/
  billing-integration.md  # como ativar o Asaas de verdade e como testar sem ele
```
