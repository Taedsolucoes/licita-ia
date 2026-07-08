# Relatório Geral de Funcionalidades — LicitaIA (Auditoria Estática)

Data: 2026-07-08 · Branch alvo: `fix/general-audit` (ver nota sobre git no final)
Escopo: auditoria estática de código (sem acesso a banco/Render ao vivo).

---

## 1. Login e autenticação de usuários (`apps/api/src/modules/auth`)

| Item | Status | Detalhe |
|---|---|---|
| Login (`POST /auth/login`) | **funcionando** | bcrypt.compare + tokens JWT + refresh token persistido com hash SHA-256 (`auth.service.ts`) |
| Refresh token (`POST /auth/refresh`) | **funcionando** | Rotação de token com revogação do anterior (`replacedByTokenHash`) |
| Logout | **funcionando** | Revoga todos os refresh tokens do usuário |
| `GET /auth/me` | **funcionando** | Retorna usuário + tenant |
| Esqueci minha senha | **com erro → CORRIGIDO** | CONFIRMADO: `resetPassword()` lançava sempre `BadRequestException('Password reset not yet implemented in dev mode')` e `forgotPassword()` só fazia `console.log` do token (`auth.service.ts`, antigas linhas ~119-140). |

**Correção aplicada (fluxo completo de reset de senha):**
- `prisma/schema.prisma`: novo model `PasswordResetToken` (token com hash SHA-256, expiração 1h, uso único) + relação em `User`.
- `prisma/migrations/20260708000000_add_password_reset_tokens/migration.sql`: migração SQL correspondente.
- `auth.service.ts` — `forgotPassword()`: invalida tokens anteriores, gera token aleatório (32 bytes), persiste hash com expiração de 1 hora, envia e-mail via `MailService`; mantém resposta genérica (anti-enumeração de e-mails); erro de envio não vaza para o caller.
- `auth.service.ts` — `resetPassword()`: valida token (hash, não usado, não expirado, usuário ativo), atualiza senha (bcrypt cost 12), marca token como usado e **revoga todos os refresh tokens** (força re-login em todos os dispositivos) — tudo em transação.
- `auth/mail.service.ts` (novo): serviço SMTP via nodemailer com **modo mock** quando `SMTP_HOST` não está setado (loga em vez de enviar — dev continua funcionando).
- `auth.module.ts`: registra `MailService`; `package.json`: adiciona `nodemailer@^6.9`.
- Envs documentadas em `.env.example` e `render.yaml`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `APP_WEB_URL` (link de reset).

**Pendência de frontend (documentada, não corrigida):** em `apps/mobile-client/src/screens/LoginScreen.tsx:120` o botão "Esqueceu a senha?" é um `TouchableOpacity` **sem `onPress`** — não há tela de forgot/reset no mobile e `authApi` não expõe esses endpoints. Backend está pronto; falta a UI (decisão de produto sobre fluxo mobile vs. web).

---

## 2. Busca e filtros de licitações (biddings/opportunities)

| Item | Status | Detalhe |
|---|---|---|
| Listagem de oportunidades com filtros (cliente) | **com erro → CORRIGIDO** | `GET /opportunities` filtrava só por `status`, `uf`, `minValue/maxValue`, `since/until`. **Faltavam filtros por modalidade e palavra-chave** (requisito declarado). Como o `ValidationPipe` usa `forbidNonWhitelisted: true`, enviar `?modality=` ou `?q=` retornaria **400**. |
| Listagem admin de licitações | **funcionando** | `GET /admin/biddings` com paginação + filtros `status`, `uf`, `dateFrom/dateTo` (`admin.service.ts:320`) |
| Detalhe/itens de licitação | **funcionando** | `GET /biddings/:id` e `GET /biddings/:id/items` |

**Correção aplicada:**
- `opportunities/dto/opportunity.dto.ts`: novos campos opcionais `modality` e `q`.
- `opportunities.service.ts` (`findAll`): filtro `modality` (case-insensitive) e busca por palavra-chave `q` com `OR` em `objectText`, `objectSummary`, `agencyName`, `biddingNumber` (todos existem no model `Bidding` do schema — verificado).

**Observação (não corrigido — mock no cliente):** `apps/mobile-client/src/screens/web/AdminBiddingsScreen.tsx:935-936` faz fallback para `MOCK_BIDDINGS` quando a API falha/retorna vazio — em produção isso pode exibir dados falsos ao admin. Decisão de produto: remover fallback antes do lançamento.

---

## 3. Geração de relatório/PDF de editais (escopo de outro worker — apenas conferência de wiring)

**Status: módulos existem e estão corretamente referenciados.** `ReportsModule` está em `app.module.ts:37`; `ReportsController` expõe `POST /reports/biddings/:id/generate`, `GET /reports/:id`, `GET /reports/:id/download`, `POST /reports/biddings/:id/impugnation`, `GET /opportunities/:id/report`; `ReportsService` implementa `scheduleReport`, `generateImpugnationPdf`, `findByOpportunity`. Render.yaml prevê disco persistente para PDFs e Chromium p/ Puppeteer. Não reauditado em profundidade.

---

## 4. Geração de propostas, impugnações e documentos

| Item | Status | Detalhe |
|---|---|---|
| Participação/proposta (`participation`) | **funcionando** | `participate`, `decline`, `updateItems` (preços/marcas por item), `submit` (consolida e notifica admins), `listParticipations` — lógica completa (`participation.service.ts`) |
| Impugnação (PDF) | **funcionando** | `POST /reports/biddings/:id/impugnation` gera PDF síncrono via template `impugnation.template.ts` |
| Documentos de habilitação | **funcionando (gestão manual)** | CRUD via admin (`PUT /admin/tenants/:id/documents/:docId`, seed de docs padrão); dashboard cliente lista documentos e vencimentos. Não há geração automática de documentos além de impugnação/relatório — se o requisito comercial inclui gerar outros documentos (ex.: declarações), isso é **não implementado** (decisão de produto). |

---

## 5. Kanban de acompanhamento de licitações

**Status: NÃO IMPLEMENTADO.** Busca por `kanban` (case-insensitive) em todo o repositório: **0 ocorrências** (API e mobile-client). Também não há componente de board/colunas/drag-and-drop. O acompanhamento hoje é por listas com status (`new/viewed/accepted/declined/expired` em opportunities; statuses em participations). Implementar um Kanban é feature nova de UI — não é correção de baixo risco; requer decisão de produto.

---

## 6. Alertas/notificações (WhatsApp, e-mail)

| Item | Status | Detalhe |
|---|---|---|
| Push (Firebase/FCM) | **funcionando** | `push.service.ts` + registro de devices; respeita preferências e quiet hours |
| WhatsApp | **funcionando (modo mock sem credenciais)** | `whatsapp.service.ts` usa WhatsApp Business API; sem `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` roda em **mock mode** (loga e retorna id fake, com warning no boot). Para produção real, basta setar as envs (já previstas no `render.yaml`). |
| E-mail de notificação de oportunidade | **não implementado** | O pipeline de notificações (`notifications.service.ts`) cobre apenas **push + WhatsApp**. Não há canal e-mail para alertas de oportunidade (o novo `MailService` cobre somente reset de senha). O schema (`NotificationPreference`) só tem `allowPush`/`allowWhatsapp` — adicionar canal e-mail é decisão de produto (documentado). |
| Preferências + quiet hours + listagem/read | **funcionando** | `GET/PUT /notification-preferences`, `GET /notifications`, `PATCH /notifications/:id/read` |

---

## 7. Monitoramento de chat do pregoeiro

**Status: NÃO IMPLEMENTADO.** Busca por `pregoeiro`/`chat` no repositório: única ocorrência é texto estático no template de impugnação (`reports/templates/impugnation.template.ts`). Não existe módulo, model, scraper ou UI relacionados a chat de sessão pública. Feature ausente por completo (requer integração com portais de pregão — decisão de produto/infra).

---

## 8. Integrações com terceiros (PNCP, portais estaduais, CAPAG)

| Item | Status | Detalhe |
|---|---|---|
| AlertaLicitacao (agregador) | **funcionando (mock sem token)** | `alerta-licitacao.provider.ts`: modo real com `ALERTALICITACAO_TOKEN`, fetch por data, timeout, tratamento de erro; sem token roda mock. Scheduler roda sync a cada intervalo + enfileira matching (`integration.scheduler.ts`) |
| Pipeline de sync + upsert + matching | **funcionando** | `integration.service.ts`: cria `IntegrationSyncRun`, deduplica por `source+sourceExternalId`, dispara fila de matching |
| CAPAG | **funcionando (dataset seed)** | `capag.service.ts`: sync a partir de `CAPAG_SEED_DATA` (dataset estático embarcado) + cache Redis 24h + histórico. **Atenção**: não busca dados ao vivo do Tesouro Nacional — atualização anual do dataset é manual (documentado; decisão de produto). |
| PNCP (integração direta) | **não implementado** | Única menção a PNCP está em `plan.md` (planejamento). Não há provider PNCP; a cobertura de portais depende do agregador AlertaLicitacao. |
| Portais estaduais (direto) | **não implementado** | Idem — sem providers dedicados. |

---

## 9. Dashboard e relatórios gerenciais (admin)

| Item | Status | Detalhe |
|---|---|---|
| Dashboard cliente | **funcionando** | `GET /dashboard/summary`, `/documents`, `/results` (`dashboard.service.ts`) |
| Dashboard admin | **funcionando** | `GET /admin/dashboard/overview`, `/stats`, `/participations`, `/companies`, `/documents/expiring` + CRUD de tenants/users/keywords/regions/results; telas `AdminDashboardScreen`, `AdminTenantsScreen`, web screens |
| Relatórios gerenciais (tela mobile "Relatórios") | **não implementado (stub)** | `StubScreens.tsx:39` — `ReportsScreen` é placeholder ("Relatórios gerenciais"), assim como `BiddingsScreen`, `DocumentsScreen`, `CertificatesScreen`, `ResultsScreen`, `SettingsScreen` no mobile. Backend tem os dados; faltam as telas. |

---

## Verificações adicionais

### CORS (`apps/api/src/main.ts`) — CORRIGIDO
Antes: `origin: process.env.CORS_ORIGIN || '*'`. Agora:
- Loga **SECURITY WARNING** via `console.error` quando `NODE_ENV=production` e `CORS_ORIGIN` ausente ou `*`.
- Suporta lista de domínios separada por vírgula.
- `render.yaml`: `CORS_ORIGIN` mudou de valor fixo `"*"` para `sync: false` (deve ser configurado com domínio explícito no painel do Render antes do lançamento).

### Varredura de segredos (segunda passada)
- **Nenhum segredo real hardcoded** encontrado (padrões `sk-`, `AIza`, api keys literais, tokens longos: 0 matches em `apps/` e configs).
- `render.yaml`: todos os segredos com `sync: false` (corretos).
- **Atenção 1 (documentado):** fallback `'dev-secret'` para `JWT_SECRET` em `auth.module.ts:16` e `jwt.strategy.ts:23`. Não é vazamento (é default de dev), mas se `JWT_SECRET` não for setado em produção os JWTs ficam forjáveis. `render.yaml` exige `JWT_SECRET` (`sync: false`), o que mitiga; recomenda-se em follow-up falhar o boot em produção sem `JWT_SECRET` (mesmo padrão do warning de CORS). Não alterado para não arriscar quebrar ambientes de dev sem aprovação.
- **Atenção 2 (documentado):** `prisma/seed.ts:28` cria usuários com senha padrão `Admin@123`. É seed de desenvolvimento; **não rodar seed em produção** e/ou trocar senhas dos usuários seed antes do lançamento (decisão de operação).

---

## Arquivos alterados/criados nesta auditoria

| Arquivo | Mudança |
|---|---|
| `apps/api/prisma/schema.prisma` | +model `PasswordResetToken` + relação em `User` |
| `apps/api/prisma/migrations/20260708000000_add_password_reset_tokens/migration.sql` | novo (migração) |
| `apps/api/src/modules/auth/auth.service.ts` | `forgotPassword`/`resetPassword` implementados de verdade |
| `apps/api/src/modules/auth/mail.service.ts` | novo (SMTP nodemailer + mock mode) |
| `apps/api/src/modules/auth/auth.module.ts` | registra `MailService` |
| `apps/api/package.json` | +`nodemailer` |
| `apps/api/src/modules/opportunities/dto/opportunity.dto.ts` | +filtros `modality`, `q` |
| `apps/api/src/modules/opportunities/opportunities.service.ts` | aplica filtros de modalidade e palavra-chave |
| `apps/api/src/main.ts` | warning de CORS em produção + suporte a múltiplas origens |
| `apps/api/.env.example` | documenta SMTP/APP_WEB_URL/CORS_ORIGIN |
| `render.yaml` | CORS_ORIGIN sem wildcard + envs SMTP |

## Notas de ambiente (importante)

- **Git não está instalado nesta máquina** — não foi possível criar o branch `fix/general-audit` nem commitar. As mudanças estão aplicadas no working directory; commitar assim que houver git disponível: `git checkout -b fix/general-audit && git add -A && git commit -m "fix: password reset flow, opportunity filters (modality/keyword), CORS hardening"`.
- **Node/pnpm não estão instalados** — typecheck (`tsc`) e `prisma generate` não puderam ser executados. Após instalar dependências, rodar: `pnpm install && pnpm --filter api exec prisma generate && pnpm --filter api run build` (o Prisma Client precisa ser regenerado por causa do novo model `PasswordResetToken`).
