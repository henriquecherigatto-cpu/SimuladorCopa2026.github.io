# Easy Barber — banco de dados, autenticação e isolamento multiempresa

Este diretório contém o schema PostgreSQL completo do Easy Barber, as políticas de Row Level Security (RLS) que garantem o isolamento entre barbearias, e uma suíte de testes que tenta ativamente quebrar esse isolamento — e falha ao tentar.

## Modelo de dados

14 tabelas, todas documentadas inline nas próprias migrações (`comment on table ...`):

| Tabela | Propósito |
|---|---|
| `profiles` | Uma linha por pessoa autenticada. `is_platform_admin` nunca é alterável pelo próprio usuário. |
| `companies` | Uma barbearia (tenant). Só pode ser criada via `create_company_with_owner()`. |
| `company_members` | Quem pertence a qual empresa, com qual papel (`owner` \| `professional`). Fonte única de verdade para autorização — nunca o `company_id` que o cliente envia. |
| `professionals` | Equipe da barbearia. Inativar nunca apaga o histórico de agendamentos. |
| `services` | Serviços oferecidos, com duração e preço em centavos. |
| `professional_services` | Quais profissionais podem realizar quais serviços. |
| `business_hours` | Horário de funcionamento por dia da semana. |
| `time_blocks` | Bloqueios pontuais (férias, feriado, manutenção). |
| `customers` | Clientes finais de cada barbearia. |
| `appointments` | Agendamentos. Tem uma **exclusion constraint** que impede dois agendamentos sobrepostos para o mesmo profissional — garantida pelo próprio PostgreSQL, não pela aplicação (veja abaixo). |
| `plans` | Catálogo comercial, editável pelo administrador da plataforma. Preço nunca é hard-coded em outro lugar. |
| `subscriptions` | Estado da assinatura por empresa (`ativa`, `pendente`, `tolerancia`, `suspensa`, `cancelada`) — deliberadamente separado do histórico financeiro. |
| `billing_events` | Ledger append-only de eventos do provedor de pagamento. `unique(provider, provider_event_id)` torna o processamento de webhooks idempotente. |
| `audit_logs` | Trilha de auditoria. Só é escrita por triggers/funções `SECURITY DEFINER` — nunca por insert direto do cliente. |

### Garantias de integridade que vão além do RLS

- **Conflito de agendamento sob concorrência**: `appointments_no_overlap_per_professional` é uma `EXCLUDE USING gist` sobre `(professional_id, tstzrange(starts_at, ends_at))`. Isso é reforçado pelo próprio Postgres durante o `INSERT`/`UPDATE` — nenhuma verificação "ler depois escrever" na aplicação consegue garantir isso sob concorrência real; uma constraint no banco sim.
- **Mesma empresa em toda a cadeia**: `appointments` referencia `(company_id, customer_id)`, `(company_id, professional_id)` e `(company_id, service_id)` como chaves estrangeiras compostas. Mesmo que uma falha de RLS deixasse passar um `professional_id` de outra empresa, a constraint do banco rejeitaria.
- **Horário de funcionamento e bloqueios**: um trigger (`check_appointment_within_hours`) rejeita agendamentos fora do horário configurado ou dentro de um bloqueio — no banco, não só na interface.
- **Pelo menos um proprietário**: um trigger em `company_members` impede remover o último `owner` de uma empresa.

## Políticas de RLS — isolamento multiempresa

Todas as 14 tabelas têm RLS habilitado. O desenho segue três regras, explicadas no topo de `20260101000010_rls_policies.sql`:

1. Toda tabela com dados de uma empresa é filtrada via `user_company_ids()` / `has_company_role()`, que derivam as empresas do usuário logado a partir de `company_members` — nunca de um `company_id` enviado pelo cliente.
2. O administrador da plataforma (`is_platform_admin()`) só tem acesso direto a linhas de tabelas **operacionais da plataforma**: `companies`, `company_members`, `profiles`, `plans`, `subscriptions`, `billing_events`, `audit_logs`. Ele **não** tem bypass em `professionals`, `services`, `business_hours`, `time_blocks`, `customers` ou `appointments` — conforme o requisito do briefing de que o administrador não deve ter acesso irrestrito aos dados pessoais dos clientes finais das barbearias sem necessidade operacional legítima. As contagens do painel administrativo (profissionais ativos, clientes) vêm de `admin_company_overview()`, uma função agregadora — não de acesso direto às linhas.
3. Tabelas que só podem ser escritas por código de servidor confiável (`subscriptions`, `billing_events`, `audit_logs`, criação de `companies`) não têm política de `insert`/`update` para o papel `authenticated` — escritas diretas do cliente são negadas por padrão; só a `service_role` (que ignora RLS) ou uma função `SECURITY DEFINER` específica pode escrever.

Um proprietário de empresa, por exemplo, **não consegue**:
- Ler, atualizar ou apagar nenhuma linha de outra empresa, em nenhuma tabela.
- Criar uma empresa diretamente (só via `create_company_with_owner()`, que cria empresa + vínculo de proprietário + assinatura inicial em uma única transação).
- Aprovar a própria assinatura (`subscriptions.status = 'ativa'`) — só o administrador ou o webhook de pagamento (via `service_role`) pode.
- Conceder a si mesmo o papel de administrador da plataforma.
- Inserir um evento de cobrança forjado.

## Autenticação

Implementada com `@supabase/ssr` (padrão atual recomendado para Next.js App Router):

- `src/lib/supabase/client.ts` — cliente para Client Components.
- `src/lib/supabase/server.ts` — cliente para Server Components/Actions, usando cookies.
- `src/proxy.ts` + `src/lib/supabase/proxy.ts` — Next.js Proxy (renomeado de "middleware" na v16): atualiza a sessão a cada requisição e faz o redirecionamento **otimista** (login ↔ dashboard). A defesa de verdade continua sendo o RLS no banco — mesmo que esse redirecionamento fosse contornado, nenhum dado de outra empresa seria alcançável.
- `src/app/(app)/layout.tsx` — checagem **segura** (consulta real ao Postgres via RLS) de sessão e vínculo com empresa antes de renderizar qualquer tela interna.
- `src/app/onboarding/empresa/` — fluxo que cria a barbearia (via `create_company_with_owner()`) logo após o primeiro login, cobrindo o caso em que o projeto Supabase exige confirmação de e-mail antes de autenticar.

## Testando o isolamento localmente (sem precisar de um projeto Supabase)

`supabase/tests/run-local-tests.sh` sobe um container Postgres descartável, aplica as migrações reais de `supabase/migrations/` **sem modificação**, adiciona um stub local do schema `auth` do Supabase (`supabase/tests/local-harness/`, usado só para teste — nunca rodado contra um projeto real) e executa a suíte de testes negativos:

```bash
bash supabase/tests/run-local-tests.sh
```

A suíte (`supabase/tests/negative/`) cria duas empresas independentes com proprietário, profissional e dados próprios, e então, autenticado como cada usuário, tenta:

- `010_cross_company_select.sql` — ler empresas, profissionais, serviços, clientes, agendamentos, assinaturas etc. de outra empresa (esperado: 0 linhas), inclusive por ID direto, inclusive como profissional tentando ver o agendamento de um colega da mesma empresa, inclusive como usuário anônimo.
- `020_cross_company_write.sql` — atualizar/apagar linhas de outra empresa (esperado: 0 linhas afetadas), criar empresa sem passar pela função segura, vincular um profissional a um serviço de outra empresa, reservar um horário usando o profissional de outra empresa, aprovar a própria assinatura.
- `030_privilege_escalation.sql` — conceder a si mesmo o papel de administrador da plataforma, chamar funções administrativas sem ser admin, ler ou forjar logs de auditoria, forjar um evento de cobrança.
- `040_concurrency_conflict.sql` — dois agendamentos sobrepostos para o mesmo profissional (bloqueado pela exclusion constraint), horário encostado é aceito, cancelar libera o horário.
- `050_admin_scope.sql` — confirma que o administrador vê dados agregados e operacionais de ambas as empresas, mas **não** consegue ler diretamente profissionais/clientes/agendamentos de nenhuma delas.

A cada execução, a suíte roda do zero contra um banco limpo e imprime `PASS`/`FAIL` por asserção — na versão atual, **69 de 69 passam**. O script sai com código diferente de zero na primeira falha.

## Checklist de segurança desta camada

- [x] RLS habilitado em todas as 14 tabelas.
- [x] Nenhuma tabela confia em `company_id` vindo do cliente — toda política deriva da sessão autenticada.
- [x] Administrador da plataforma sem acesso irrestrito a dados pessoais de clientes finais.
- [x] `is_platform_admin` protegido contra auto-promoção (trigger, não só RLS).
- [x] Criação de empresa é transacional e nunca deixa uma empresa sem proprietário válido.
- [x] Conflito de agendamento impedido no nível do banco (não só na aplicação).
- [x] Webhooks de cobrança desenhados para idempotência (`unique(provider, provider_event_id)`); nenhuma política permite que o cliente marque uma cobrança como paga.
- [x] Nenhuma credencial/chave privada no código do cliente — `SUPABASE_SERVICE_ROLE_KEY` é documentada como server-only em `.env.example` e não é referenciada em nenhum componente `"use client"`.
- [x] Testes negativos automatizados, executados e com resultado real reportado (não apenas escritos).
- [ ] **Pendente**: teste end-to-end do fluxo de autenticação (login/cadastro reais) contra uma instância do GoTrue/Supabase rodando de verdade. Tentei subir a stack local completa (`supabase start`) neste ambiente, mas o proxy de rede daqui bloqueia alguns registries de imagem Docker necessários (GHCR/ECR) — o schema e as políticas de RLS foram verificados com Postgres real, mas o código de integração do `@supabase/ssr` só foi verificado por build/typecheck e revisão contra a documentação instalada do pacote, não por um login real na UI. Recomenda-se testar isso manualmente (ou em CI com acesso de rede mais amplo) antes de ir para produção.
- [ ] **Pendente**: políticas de retenção/exclusão de dados (LGPD) e procedimento de backup/restore ainda não documentados — ficam para quando a infraestrutura de produção for definida.
- [ ] **Pendente**: rate limiting de operações sensíveis (ex: tentativas de login) — depende de configuração no painel do Supabase, não do schema.

## Custos externos conhecidos

Nenhum custo foi incorrido nesta etapa — tudo foi verificado localmente, sem projeto Supabase real provisionado. Ao conectar um projeto Supabase real, consulte a [página de preços do Supabase](https://supabase.com/pricing) para os custos do plano escolhido.
