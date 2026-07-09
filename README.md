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

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Bcrypt
BCRYPT_ROUNDS=12
```

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
| `IntegrationModule` | Sync de licitações via provider (AlertaLicitacao adapter) |
| `MatchingModule` | Motor de matching por keywords + regiões; score ponderado |
| `BiddingsModule` | Consulta de licitações e itens |
| `OpportunitiesModule` | Oportunidades por tenant; aceite/declínio |
| `ParticipationModule` | Proposta consolidada; submissão para TAED |
| `ReportsModule` | Geração de PDF via Puppeteer; download auditado |
| `CapagModule` | Sync e consulta de CAPAG por município/UF; cache Redis |
| `NotificationsModule` | Push (FCM) e WhatsApp Business API; preferências por usuário |
| `AnalysisModule` | Análise de editais com Claude AI (Anthropic); pontos de impugnação, risco, recomendação |

---

## Fluxo ponta a ponta

```
Scheduler → IntegrationService.syncBiddings()
         → cria Bidding + BiddingItems
         → publica job na fila MATCHING

Queue MATCHING → MatchingProcessor
              → MatchingService.matchBiddingForAllTenants()
              → cria Opportunity por tenant elegível
              → publica jobs nas filas REPORTS e NOTIFICATIONS

Queue REPORTS → ReportsProcessor → ReportsService.generateReport()
             → Puppeteer renderiza HTML → PDF → salvo em storage/reports/
             → atualiza Report status=ready

Queue NOTIFICATIONS → NotificationsProcessor → NotificationsService.processNotification()
                   → cria Notification records (push + whatsapp)
                   → envia via PushService (FCM) / WhatsAppService (Meta API)

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

### AlertaLicitacao (Integração de Licitações)

Quando configurado, busca licitações reais da API AlertaLicitacao.
Sem esse token, o sistema usa dados simulados (mock):

```env
ALERTA_LICITACAO_API_KEY=seu-token-aqui
```

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
