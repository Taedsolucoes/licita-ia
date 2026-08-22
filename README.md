# Licita IA

SaaS de gestão de licitações públicas brasileiras para a **TAED Soluções**.

Monorepo com:
- `apps/api` — Backend NestJS (Node.js 20 + TypeScript + Prisma + PostgreSQL + Redis + BullMQ)
- `apps/mobile-client` — App cliente React Native (Expo)
- `packages/shared-types` — Tipos TypeScript compartilhados

---

## Pré-requisitos

| Ferramenta | Versão mínima |
|---|---|
| Node.js | 20.x |
| pnpm | 9.x |
| PostgreSQL | 15.x |
| Redis | 7.x |

> Instale o pnpm globalmente: `npm install -g pnpm`

---

## Instalação

```bash
# 1. Clone o repositório e entre na pasta
cd licita-ia

# 2. Instale todas as dependências do monorepo
pnpm install
```

---

## Configuração de variáveis de ambiente

Copie o arquivo de exemplo e ajuste as variáveis:

```bash
cp apps/api/.env.example apps/api/.env
```

Edite `apps/api/.env` com suas credenciais:

```env
# App
NODE_ENV=development
PORT=3000

# Banco de dados PostgreSQL
DATABASE_URL=postgresql://licita:licita123@localhost:5432/licita_ia?schema=public

# JWT (altere os segredos em produção)
JWT_SECRET=dev-secret-change-in-production
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Redis local (ou use REDIS_URL em produção)
REDIS_URL=
REDIS_TLS=false
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Bcrypt
BCRYPT_ROUNDS=12
```

### Fontes públicas oficiais de licitações

A ingestão usa exclusivamente as APIs públicas oficiais do **PNCP** e do **Compras.gov.br – Dados Abertos**. Nenhum endpoint privado ou credencial do portal Alerta Licitações é necessário para este fluxo.

Para habilitar a sincronização recorrente, configure as URLs e janelas no `apps/api/.env`:

```env
PUBLIC_SOURCES_SYNC_ENABLED=true
PNCP_CONSULTA_BASE_URL=https://pncp.gov.br/api/consulta
PNCP_PAGE_SIZE=50
PNCP_LOOKBACK_DAYS=2
COMPRAS_PUBLICAS_BASE_URL=https://dadosabertos.compras.gov.br
COMPRAS_PUBLICAS_PAGE_SIZE=100
COMPRAS_PUBLICAS_LOOKBACK_DAYS=2
SYNC_INTERVAL_MS=300000
SYNC_WINDOW_OVERLAP_HOURS=6
```

O scheduler grava a recorrência no Redis/BullMQ e o worker executa os adapters oficiais. Como as APIs públicas não oferecem um webhook universal de novas licitações, “tempo real” neste sistema significa **polling contínuo**, configurável e com a menor cadência segura para o upstream. O perfil de produção usa cinco minutos (`SYNC_INTERVAL_MS=300000`) e uma sobreposição de seis horas para capturar atualizações tardias sem criar duplicidades.

A cobertura nacional não depende das regiões cadastradas pelos tenants: o PNCP consulta todas as modalidades publicadas e também o modo de propostas abertas; o Compras.gov.br consulta todas as modalidades publicadas no módulo oficial de contratações. O cursor inclui `queryMode`, modalidade e página para que publicação e propostas abertas não compartilhem posição indevidamente. O adapter PNCP limita a consulta a 50 registros por página, que é o maior tamanho aceito pelo endpoint operacional durante a validação real.

A sincronização possui lock distribuído em Redis, retries com backoff para falhas transitórias e health que diferencia fonte acessível de ingestão desatualizada. Para staging/local, o ambiente completo pode ser iniciado com `docker compose -f docker-compose.local.yml up -d --build`; os dados são mantidos nos volumes nomeados. A flag permanece `false` por padrão até PostgreSQL, Redis, credenciais de entrega e os adapters serem validados no ambiente de implantação.

---

## Banco de dados

### Criar banco e usuário (PostgreSQL)

```sql
CREATE USER licita WITH PASSWORD 'licita123';
CREATE DATABASE licita_ia OWNER licita;
```

### Gerar o Prisma Client

```bash
pnpm db:generate
```

### Rodar as migrations

```bash
pnpm db:migrate
```

> Para desenvolvimento com criação automática de migrations:
> ```bash
> cd apps/api
> npx prisma migrate dev --name init
> ```

### Aplicar RLS e Full-Text Search

Execute o arquivo de migrações personalizadas:

```bash
psql -U licita -d licita_ia -f apps/api/prisma/migrations/rls/rls_and_fts.sql
```

### Seed inicial (dados de demonstração)

Cria o tenant TAED Admin, 3 empresas clientes de exemplo e usuários de teste:

```bash
pnpm db:seed
```

Usuários criados:

| Email | Senha | Role |
|---|---|---|
| admin@taed.com.br | Admin@123 | taed_admin |
| operador@taed.com.br | Admin@123 | taed_operator |
| carlos@construmax.com.br | Admin@123 | tenant_owner |
| fernanda@techrio.com.br | Admin@123 | tenant_owner |
| roberto@limpafacil.com.br | Admin@123 | tenant_owner |

---

## Iniciar o backend

```bash
# Modo desenvolvimento (hot reload)
pnpm dev

# Ou diretamente no projeto da API
cd apps/api
pnpm dev
```

A API ficará disponível em `http://localhost:3000`.

Endpoints de saúde:
- `GET /health` — status dos serviços
- `GET /ready` — readiness check

---

## Iniciar o app mobile

```bash
cd apps/mobile-client

# Iniciar o Expo dev server
npx expo start

# Abrir no web
npx expo start --web

# Android
npx expo start --android

# iOS
npx expo start --ios
```

---

## Verificação de tipos

```bash
# Verificar ambos os projetos
pnpm typecheck

# Apenas o backend
cd apps/api && npx tsc --noEmit

# Apenas o mobile
cd apps/mobile-client && npx tsc --noEmit
```

---

## Build de produção

### Backend

```bash
cd apps/api
pnpm build
pnpm start:prod
```

### App Mobile (web export)

```bash
cd apps/mobile-client
npx expo export --platform web
# Saída em: apps/mobile-client/dist/
```

---

## Módulos implementados (backend)

| Módulo | Responsabilidade |
|---|---|
| `AuthModule` | Login JWT, refresh token rotation, logout, forgot/reset password |
| `AdminModule` | CRUD tenants, usuários, keywords, regiões; dashboard TAED |
| `IntegrationModule` | Adapters oficiais PNCP e Compras.gov.br, ingestão incremental, proveniência, scheduler BullMQ e observabilidade |
| `MatchingModule` | Motor de matching por keywords + regiões; score ponderado |
| `BiddingsModule` | Consulta facetada de licitações e itens |
| `AlertProfileModule` | Perfil de alertas por tenant: keywords, regiões/IBGE, esfera, modalidade e canais |
| `OpportunitiesModule` | Oportunidades por tenant; aceite/declínio |
| `ParticipationModule` | Proposta consolidada; submissão para TAED |
| `ReportsModule` | Geração de PDF via Puppeteer; download auditado |
| `CapagModule` | Sync e consulta de CAPAG por município/UF; cache Redis |
| `NotificationsModule` | Push (FCM), WhatsApp Business API e e-mail SMTP; preferências por usuário/tenant |
| `AnalysisModule` | Análise de editais com Claude AI (Anthropic); pontos de impugnação, risco, recomendação |

---

## Fluxo ponta a ponta

```
BullMQ Scheduler → IntegrationService.syncBiddings()
                → carrega janela/cursor por fonte
                → cria ou atualiza Bidding + BiddingItems com snapshot SHA-256
                → atualiza IntegrationSyncRun e IngestionCursor
                → publica job na fila MATCHING

Não há `setInterval` ou timer em processo: a recorrência fica persistida no Redis/BullMQ e pode ser retomada após reinício da API. Em produção, prefira `REDIS_URL=rediss://...` com TLS; o `RedisService` e o BullMQ compartilham a mesma configuração.

Queue MATCHING → MatchingProcessor
              → MatchingService.matchBiddingForAllTenants()
              → cria Opportunity por tenant elegível
              → publica jobs nas filas REPORTS e NOTIFICATIONS

Queue REPORTS → ReportsProcessor → ReportsService.generateReport()
             → Puppeteer renderiza HTML → PDF → salvo em storage/reports/
             → atualiza Report status=ready

Queue NOTIFICATIONS → NotificationsProcessor → NotificationsService.processNotification()
                   → cria Notification records (push + whatsapp + email)
                   → envia via PushService (FCM) / WhatsAppService (Meta API) / MailService (SMTP)

Queue ANALYSIS → AnalysisProcessor → AnalysisService.analyzeEdital()
              → chama Anthropic Claude claude-opus-4-5
              → extrai riskLevel, recommendation, executiveSummary, impugnationPoints, etc.
              → salva BiddingAnalysis no banco
```

---

## Variáveis de ambiente adicionais (opcional)

### Claude AI (Análise de Editais)

Necessário para geração de análises automáticas de editais via Anthropic Claude:

```env
ANTHROPIC_API_KEY=sua-chave-aqui
```

Obtenha em: https://console.anthropic.com/settings/keys

> **Railway**: Acesse o projeto → aba *Variables* → adicione `ANTHROPIC_API_KEY`.
> Sem essa variável o sistema funciona normalmente — apenas a análise Claude é desabilitada (graceful degradation). O app **não** trava ao iniciar sem essa chave.

### Catálogo e perfil de alertas

O endpoint autenticado `GET /api/biddings` permite consultar o índice local alimentado por PNCP e Compras.gov.br sem exigir palavra-chave. Ele aceita filtros por objeto/órgão, UF, município ou código IBGE, modalidade, fonte, status, esfera, valor e janelas de publicação/proposta/abertura, retornando facetas de município, modalidade, fonte e status.

A configuração tenant-scoped está disponível em `GET /api/alert-profile` e `PUT /api/alert-profile`. O perfil aceita keywords de inclusão/exclusão, regiões por UF ou município/IBGE, raio de referência, esfera, modalidade e canais de entrega. O matching usa esse perfil para decidir quais novas licitações viram oportunidades; o usuário pode revisar oportunidades no app e tocar em uma notificação para abrir o detalhe seguro da oportunidade.

### Proveniência e clean-room

O provider legado do Alerta Licitações está isolado em `apps/api/src/modules/integration/legacy/` e não é registrado no módulo NestJS, chamado pelo scheduler ou usado na ingestão. A implementação ativa consulta somente as APIs públicas e oficiais do PNCP e do Compras.gov.br. As tabelas `SourceRegistry`, `RawIngestRecord`, `IngestionCursor`, `BiddingEvent` e os campos de proveniência em `Bidding`/`IntegrationSyncRun` preservam a origem e o hash de cada snapshot.

Endpoints administrativos protegidos por JWT e papel `taed_admin` ou `taed_operator`:

| Endpoint | Finalidade |
|---|---|
| `POST /api/internal/integrations/sources/pncp/sync` | Dispara uma sincronização manual multi-fonte compatível com a rota histórica |
| `GET /api/internal/integrations/sources/health` | Verifica PNCP e Compras.gov.br em uma resposta consolidada |
| `GET /api/internal/integrations/sources/sync-runs?limit=50` | Lista métricas e erros recentes de ingestão, sem payload bruto |

### Firebase Cloud Messaging (Push Notifications)

Quando configurado, envia push notifications reais via Firebase Admin SDK.
Sem essa variável, o serviço opera em modo simulado (mock — log apenas):

```env
# JSON da service account do Firebase (raw JSON ou codificado em base64)
# Gere em: Firebase Console → Project Settings → Service Accounts → Generate new private key
# Para codificar: base64 -w 0 serviceAccountKey.json
FIREBASE_SERVICE_ACCOUNT_JSON=seu-service-account-json-ou-base64
```

### WhatsApp Business Cloud API (Meta)

Quando configurado, envia mensagens reais via API do WhatsApp Business (Meta).
Sem essas variáveis, o serviço opera em modo simulado (mock — log apenas):

```env
# Token de acesso permanente ou temporário do Meta Business Dashboard
WHATSAPP_TOKEN=seu-token

# Phone Number ID do aplicativo WhatsApp Business no Meta Developer Console
WHATSAPP_PHONE_NUMBER_ID=seu-phone-number-id

# Nomes dos templates aprovados no Meta Business Manager (locale pt_BR)
# Padrões mostrados — sobrescreva apenas se registrou templates com nomes diferentes.
WHATSAPP_TEMPLATE_OPPORTUNITY=opportunity_alert
WHATSAPP_TEMPLATE_PARTICIPATION=participation_confirmation
```

---

## Ordem de merge dos PRs

Os PRs devem ser revisados e incorporados na ordem abaixo, pois cada etapa depende do contrato e do schema da anterior:

| Ordem | PR/branch | Conteúdo |
|---:|---|---|
| 1 | `chore/isolate-legacy-alerta-provider` — PR #2 | Isolamento do provider legado e scheduler legado desativado |
| 2 | `feat/source-provenance-model` — PR #3 | Schema relacional de proveniência e migration aprovada |
| 3 | `feat/pncp-adapter` — PR #4 | Adapter oficial PNCP, paginação, cursor e snapshots |
| 4 | `feat/compras-publicas-adapter` — PR #5 | Adapter oficial Compras.gov.br e orquestração multi-fonte |
| 5 | `feat/bidding-faceted-search` | Busca por município sem palavra-chave, filtros compostos e facetas |
| 6 | `feat/incremental-scheduler-observability` — PR #7 | Scheduler BullMQ, cursores incrementais, health e sync-runs |
| `feat/alert-system-mvp` — PR #9 | Catálogo, detalhe, perfil de alertas, matching e notificações reais |

Depois de cada merge, execute `pnpm typecheck`, o build da API e a suíte local sem rede. Não altere migrations já aprovadas sem uma nova revisão explícita.

---

## Estrutura do projeto

```
licita-ia/
├── apps/
│   ├── api/                    # Backend NestJS
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Schema completo do banco
│   │   │   ├── seed.ts         # Dados iniciais de demonstração
│   │   │   └── migrations/     # Migrations SQL (RLS + FTS)
│   │   └── src/
│   │       ├── app.module.ts   # Módulo raiz
│   │       ├── main.ts         # Bootstrap NestJS
│   │       ├── common/         # Guards, decorators
│   │       └── modules/        # Módulos de domínio
│   └── mobile-client/          # App React Native (Expo)
│       └── src/
│           ├── context/        # AuthContext
│           ├── navigation/     # AppNavigator
│           ├── screens/        # Telas (Login, Dashboard, etc.)
│           ├── services/       # API client (axios)
│           └── components/     # Componentes reutilizáveis
├── packages/
│   └── shared-types/           # Tipos TypeScript compartilhados
├── plan.md                     # Documento de arquitetura
└── pnpm-workspace.yaml
```

---

## Scripts disponíveis (raiz do monorepo)

| Script | Descrição |
|---|---|
| `pnpm dev` | Inicia o backend em modo desenvolvimento |
| `pnpm build` | Compila o backend para produção |
| `pnpm db:generate` | Gera o Prisma Client |
| `pnpm db:migrate` | Aplica migrations em produção |
| `pnpm db:seed` | Roda o seed de dados iniciais |
| `pnpm typecheck` | Verifica tipos em todos os projetos |
| `pnpm lint` | Lint em todos os projetos |
