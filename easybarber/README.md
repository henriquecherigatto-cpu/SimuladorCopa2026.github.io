# Easy Barber

Sua barbearia organizada de forma simples. Plataforma de agendamento e gestão de barbearias por assinatura mensal.

## Status deste projeto

Esta é a **Etapa 1** do desenvolvimento: a interface visual completa do Easy Barber, com as 12 telas previstas, componentes reutilizáveis e dados de demonstração.

**O que já existe:**

- Next.js (App Router) + TypeScript + Tailwind CSS v4.
- Sistema de design com os tokens de cor da marca (laranja/grafite/branco).
- Componentes reutilizáveis: `Button`, `Input`, `Select`, `Textarea`, `Card`, `Modal`, `Badge`/`StatusBadge`, `Avatar`, `EmptyState`, `StatCard`, `Alert`, `Switch`, `Tabs`, `Fab`.
- Layout responsivo com sidebar (desktop) e navegação inferior + menu "Mais" (mobile).
- As 12 telas do briefing: Login, Cadastro da barbearia, Painel inicial, Agenda (dia e semana), Novo agendamento, Clientes, Profissionais, Serviços, Configurações, Plano e assinatura, Painel administrativo multiempresa.
- Lógica de cálculo de horários disponíveis (respeitando horário de funcionamento, jornada do profissional e conflitos de agendamento) em `src/lib/scheduling.ts` — roda no cliente, apenas para fins de demonstração.

**O que NÃO existe ainda (próximas etapas):**

- Banco de dados real (Supabase/PostgreSQL), autenticação real, RLS.
- Persistência de dados — tudo é mantido em memória do React e reseta ao recarregar a página.
- Integração de pagamento real (Asaas) — os botões de assinatura mostram avisos de "modo de demonstração".
- Autorização de servidor / isolamento real entre empresas.

Todas as telas exibem um selo **"Demonstração"** para deixar claro que os dados são fictícios.

## Rodando localmente

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) — você será redirecionado para `/login`. Use qualquer e-mail e uma senha com 4+ caracteres para entrar (não há autenticação real nesta etapa).

## Scripts

- `npm run dev` — ambiente de desenvolvimento.
- `npm run build` — build de produção.
- `npm run lint` — ESLint.

## Estrutura

```
src/
  app/
    (auth)/        # login, cadastro, recuperar senha (layout centralizado)
    (app)/         # dashboard, agenda, clientes, etc. (layout com sidebar)
  components/
    ui/            # componentes de interface reutilizáveis
    layout/        # sidebar, topbar, navegação mobile
    agenda/        # agenda do dia/semana, novo agendamento
    clientes/ profissionais/ servicos/ configuracoes/ plano/ admin/
  lib/
    mock-data.ts   # dados de demonstração (claramente fictícios)
    scheduling.ts  # cálculo de horários disponíveis
    nav.ts         # itens de navegação
    utils.ts       # helpers (cn, formatação de moeda, etc.)
  types/           # tipos TypeScript do domínio
```
